import { db } from '../../config/database';
import { generateEmbedding, buildJobText, EMBEDDING_DIM } from './embeddings';
import { io } from '../../app';
import crypto from 'crypto';
import ExcelJS from 'exceljs';

export interface JobVectorResult {
  id: string;
  jobId: string;
  taskId: string;
  jobName: string;
  jobCategoryL1: string;
  jobCategoryL2: string;
  companyName: string;
  companyIndustry: string;
  workCity: string;
  salaryMonthlyMin: number;
  salaryMonthlyMax: number;
  keySkills: string[];
  similarity: number;
}

/**
 * 将 job_enrichments 中的增强数据向量化并写入 job_embeddings 表
 */
export async function indexJobEmbeddings(
  taskId: string,
  onProgress?: (message: string) => void
): Promise<{ total: number; indexed: number; skipped: number; errors: number }> {
  const emit = (msg: string) => {
    console.log(`[RAG] ${msg}`);
    io.emit('rag:progress', { taskId, message: msg, timestamp: Date.now() });
    onProgress?.(msg);
  };

  emit('正在从 job_enrichments 读取增强数据...');

  const rows = await db.prepare(`
    SELECT * FROM job_enrichments WHERE task_id = $1
  `).all(taskId) as any[];

  if (!rows || rows.length === 0) {
    throw new Error(`任务 ${taskId} 没有增强数据，请先进行 AI 增强`);
  }

  emit(`找到 ${rows.length} 条增强数据，开始向量化...`);

  // 从 Excel 文件读取原始职位数据 (job_name, company_name, work_city)
  const rawDataMap = new Map<string, { jobName: string; companyName: string; workCity: string }>();
  const csvFile = await db.prepare(
    'SELECT * FROM csv_files WHERE task_id=$1 ORDER BY created_at DESC LIMIT 1'
  ).get(taskId) as any;

  if (csvFile?.filepath) {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(csvFile.filepath);
      const worksheet = workbook.worksheets[0];

      if (worksheet) {
        const headers: string[] = [];
        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) {
            row.eachCell((cell) => headers.push(String(cell.value || '')));
            return;
          }
          const rowData: Record<string, string> = {};
          row.eachCell((cell, colNumber) => {
            rowData[headers[colNumber - 1] || `col_${colNumber}`] = String(cell.value || '');
          });
          const jid = rowData['职位ID'] || '';
          if (jid) {
            rawDataMap.set(jid, {
              jobName: rowData['职位名称'] || '',
              companyName: rowData['企业名称'] || '',
              workCity: rowData['工作城市'] || '',
            });
          }
        });
      }
      emit(`从 Excel 读取到 ${rawDataMap.size} 条原始职位数据`);
    } catch (e: any) {
      console.error('[RAG] 读取 Excel 文件失败:', e.message);
    }
  }

  let indexed = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const jobId = row.jobId || row.job_id;

    try {
      // 从 Excel 原始数据获取缺失字段
      const raw = rawDataMap.get(jobId) || { jobName: '', companyName: '', workCity: '' };

      const textContent = buildJobText({
        jobName: raw.jobName || row.jobName,
        jobCategoryL1: row.jobCategoryL1,
        jobCategoryL2: row.jobCategoryL2,
        keySkills: row.keySkills,
        companyIndustry: row.companyIndustry,
        companyName: raw.companyName,
        workCity: raw.workCity,
        educationNormalized: row.educationNormalized,
        salaryMonthlyMin: row.salaryMonthlyMin,
        salaryMonthlyMax: row.salaryMonthlyMax,
        workMode: row.workMode,
      });

      const { embedding } = await generateEmbedding(textContent);

      // pgvector 存储格式：逗号分隔的浮点数数组
      const vectorStr = `[${embedding.join(',')}]`;

      await db.prepare(`
        INSERT INTO job_embeddings
        (id, job_id, task_id, text_content, embedding, job_name, job_category_l1,
         job_category_l2, company_name, company_industry, work_city,
         salary_monthly_min, salary_monthly_max, key_skills, source_metadata)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        ON CONFLICT (task_id, job_id) DO UPDATE SET
          embedding = EXCLUDED.embedding,
          text_content = EXCLUDED.text_content,
          job_name = EXCLUDED.job_name,
          company_name = EXCLUDED.company_name,
          work_city = EXCLUDED.work_city
      `).run(
        crypto.randomUUID(), jobId, taskId, textContent, vectorStr,
        raw.jobName || row.jobName || '',
        row.jobCategoryL1 || '',
        row.jobCategoryL2 || '',
        raw.companyName || '',
        row.companyIndustry || '',
        raw.workCity || '',
        row.salaryMonthlyMin || null,
        row.salaryMonthlyMax || null,
        JSON.stringify(
          Array.isArray(row.keySkills) ? row.keySkills :
          (typeof row.keySkills === 'string' ? (() => { try { return JSON.parse(row.keySkills); } catch { return []; } })() : [])
        ),
        JSON.stringify({ taskId, jobId })
      );

      indexed++;
      if (i % 10 === 0) {
        emit(`向量化进度 ${i + 1}/${rows.length}（已索引 ${indexed}，跳过 ${skipped}，错误 ${errors}）`);
      }

      // 避免 Ollama 过载
      if (i < rows.length - 1) {
        await new Promise(r => setTimeout(r, 200));
      }
    } catch (e: any) {
      errors++;
      console.error(`[RAG] 向量化失败 jobId=${jobId}:`, e.message);
      if (errors > 10) {
        throw new Error(`向量化错误过多（>10），已中止。最后错误: ${e.message}`);
      }
    }
  }

  emit(`向量化完成：共 ${rows.length} 条，索引 ${indexed}，跳过 ${skipped}，错误 ${errors}`);

  // 尝试重建 IVFFlat 索引
  if (indexed > 0) {
    try {
      await db.prepare(`
        CREATE INDEX IF NOT EXISTS idx_job_embeddings_vector_${taskId.substring(0, 8)}
        ON job_embeddings USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 50)
      `).run();
    } catch {
      console.log('[RAG] IVFFlat 索引创建跳过');
    }
  }

  io.emit('rag:completed', {
    taskId,
    total: rows.length,
    indexed,
    skipped,
    errors,
    timestamp: Date.now(),
  });

  return { total: rows.length, indexed, skipped, errors };
}

/**
 * 语义相似搜索
 * @param queryText 自然语言查询文本
 * @param limit 返回结果数量
 * @param taskId 可选，限定搜索范围
 * @param minSimilarity 最小相似度阈值 (0-1)
 */
export async function semanticSearch(
  queryText: string,
  options: {
    limit?: number;
    taskId?: string;
    minSimilarity?: number;
  } = {}
): Promise<JobVectorResult[]> {
  const { limit = 10, taskId, minSimilarity = 0.3 } = options;

  // 生成查询 embedding
  const { embedding } = await generateEmbedding(queryText);
  const vectorStr = `[${embedding.join(',')}]`;

  // 余弦相似度搜索 (<=> 是余弦距离，1 - 距离 = 相似度)
  let sql: string;
  let params: any[];

  if (taskId) {
    sql = `
      SELECT id, job_id, task_id, job_name, job_category_l1, job_category_l2,
             company_name, company_industry, work_city,
             salary_monthly_min, salary_monthly_max, key_skills,
             1 - (embedding <=> $1::vector) AS similarity
      FROM job_embeddings
      WHERE task_id = $2
        AND 1 - (embedding <=> $1::vector) >= $3
      ORDER BY embedding <=> $1::vector
      LIMIT $4
    `;
    params = [vectorStr, taskId, minSimilarity, limit];
  } else {
    sql = `
      SELECT id, job_id, task_id, job_name, job_category_l1, job_category_l2,
             company_name, company_industry, work_city,
             salary_monthly_min, salary_monthly_max, key_skills,
             1 - (embedding <=> $1::vector) AS similarity
      FROM job_embeddings
      WHERE 1 - (embedding <=> $1::vector) >= $2
      ORDER BY embedding <=> $1::vector
      LIMIT $3
    `;
    params = [vectorStr, minSimilarity, limit];
  }

  const rows = await db.prepare(sql).all(...params) as any[];

  return rows.map((r: any) => ({
    id: r.id,
    jobId: r.jobId || r.job_id,
    taskId: r.taskId || r.task_id,
    jobName: r.jobName || r.job_name || '',
    jobCategoryL1: r.jobCategoryL1 || r.job_category_l1 || '',
    jobCategoryL2: r.jobCategoryL2 || r.job_category_l2 || '',
    companyName: r.companyName || r.company_name || '',
    companyIndustry: r.companyIndustry || r.company_industry || '',
    workCity: r.workCity || r.work_city || '',
    salaryMonthlyMin: r.salaryMonthlyMin || r.salary_monthly_min || 0,
    salaryMonthlyMax: r.salaryMonthlyMax || r.salary_monthly_max || 0,
    keySkills: typeof r.keySkills === 'string' ? JSON.parse(r.keySkills || '[]') : (r.keySkills || r.key_skills || []),
    similarity: Math.round((r.similarity || 0) * 10000) / 10000,
  }));
}

/**
 * 获取向量化状态统计
 */
export async function getEmbeddingStats(taskId?: string) {
  if (taskId) {
    const row = await db.prepare(
      'SELECT COUNT(*) as cnt, MAX(created_at) as last_indexed FROM job_embeddings WHERE task_id=$1'
    ).get(taskId) as any;
    return { taskId, count: row?.cnt || 0, lastIndexed: row?.lastIndexed || null };
  }

  const rows = await db.prepare(`
    SELECT task_id, COUNT(*) as cnt, MAX(created_at) as last_indexed
    FROM job_embeddings GROUP BY task_id ORDER BY last_indexed DESC
  `).all() as any[];

  return rows.map((r: any) => ({
    taskId: r.taskId || r.task_id,
    count: r.cnt,
    lastIndexed: r.lastIndexed || r.last_indexed,
  }));
}
