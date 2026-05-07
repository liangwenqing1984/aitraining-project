import { db, pgvectorAvailable } from '../../config/database';
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
 * 将 sp_job_enrichments 中的增强数据向量化并写入 sp_job_embeddings 表
 */
export async function indexJobEmbeddings(
  taskId: string,
  onProgress?: (message: string) => void
): Promise<{ total: number; indexed: number; skipped: number; errors: number }> {
  if (!pgvectorAvailable) {
    throw new Error('pgvector 扩展未安装，无法进行向量化索引。请在 PostgreSQL 服务器安装 pgvector 扩展。');
  }

  const emit = (msg: string) => {
    console.log(`[RAG] ${msg}`);
    io.emit('rag:progress', { taskId, message: msg, timestamp: Date.now() });
    onProgress?.(msg);
  };

  emit('正在从 sp_job_enrichments 读取增强数据...');

  const rows = await db.prepare(`
    SELECT * FROM sp_job_enrichments WHERE task_id = $1
  `).all(taskId) as any[];

  if (!rows || rows.length === 0) {
    throw new Error(`任务 ${taskId} 没有增强数据，请先进行 AI 增强`);
  }

  emit(`找到 ${rows.length} 条增强数据，开始向量化...`);

  // 从 Excel 文件读取原始职位数据 (job_name, company_name, work_city)
  const rawDataMap = new Map<string, { jobName: string; companyName: string; workCity: string }>();
  const csvFile = await db.prepare(
    'SELECT * FROM sp_csv_files WHERE task_id=$1 ORDER BY created_at DESC LIMIT 1'
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
        INSERT INTO sp_job_embeddings
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
        ON sp_job_embeddings USING ivfflat (embedding vector_cosine_ops)
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
 * 短查询扩展：当查询过短（≤10字）时，嵌入信息量不足导致准确率下降。
 * 通过常用技术术语映射表 + 招聘领域上下文包装，提升 embedding 质量。
 */
const QUERY_EXPANSION_MAP: Record<string, string> = {
  'ui': 'UI设计师 用户界面设计 交互设计 视觉设计 Figma Sketch',
  'ux': 'UX设计师 用户体验设计 交互设计 用户研究 可用性测试',
  'java': 'Java开发 后端开发 Spring SpringBoot 微服务 JVM',
  'python': 'Python开发 后端开发 数据分析 机器学习 Django Flask',
  'go': 'Golang开发 后端开发 云原生 微服务 高并发',
  'c++': 'C++开发 系统开发 嵌入式 游戏开发 高性能计算',
  '前端': '前端开发 Vue React TypeScript Web开发 JavaScript HTML CSS',
  '后端': '后端开发 Java Python Go 微服务 API开发 数据库',
  '测试': '软件测试 自动化测试 性能测试 测试开发 QA Selenium',
  '运维': '运维开发 DevOps SRE Linux Docker Kubernetes CI/CD',
  '产品': '产品经理 产品设计 需求分析 用户研究 B端C端',
  '数据': '数据分析 数据开发 数据仓库 ETL SQL Python',
  '算法': '算法工程师 机器学习 深度学习 NLP CV 推荐系统',
  '架构': '架构师 系统设计 技术选型 高可用 分布式 微服务',
  '安全': '信息安全 网络安全 渗透测试 安全开发 数据安全',
  'ios': 'iOS开发 Swift Objective-C 移动开发 Apple',
  'android': 'Android开发 Kotlin Java 移动开发',
  'php': 'PHP开发 Laravel 后端开发 Web开发',
  'net': '.NET开发 C# ASP.NET 后端开发',
  'node': 'Node.js开发 后端开发 JavaScript 全栈开发',
  'react': 'React开发 前端开发 TypeScript Web开发 组件化',
  'vue': 'Vue开发 前端开发 TypeScript Web开发 组件化',
  'flutter': 'Flutter开发 移动开发 Dart 跨平台',
  'dba': '数据库管理员 DBA MySQL PostgreSQL Oracle 数据库运维',
  'devops': 'DevOps工程师 CI/CD Kubernetes Docker 自动化运维',
  'ai': '人工智能 AI工程师 机器学习 深度学习 NLP 大模型 算法',
  'gpt': '大模型开发 LLM AI工程师 NLP 深度学习',
  'llm': '大模型开发 LLM AI工程师 NLP 深度学习 RAG',
  'sre': 'SRE工程师 站点可靠性 运维开发 Kubernetes 监控告警',
  '嵌入式': '嵌入式开发 C语言 单片机 RTOS Linux驱动 ARM',
  '区块链': '区块链开发 Solidity Web3 智能合约 去中心化',
  'sap': 'SAP顾问 SAP开发 SAP实施 ERP FICO模块',
  'erp': 'ERP实施 ERP开发 企业信息化 SAP 金蝶 用友',
  'hr': 'HR 人力资源 招聘 薪酬绩效 员工关系 HRBP',
};

function expandQuery(query: string): string {
  const trimmed = query.trim().toLowerCase();

  // 精确匹配常用术语
  if (QUERY_EXPANSION_MAP[trimmed]) {
    return `${query} (${QUERY_EXPANSION_MAP[trimmed]})`;
  }

  // 中文或英文短查询（≤10字）：加招聘领域上下文
  if (trimmed.length <= 10) {
    return `${query} 招聘 职位`;
  }

  // 较长查询保持原样
  return query;
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
  if (!pgvectorAvailable) {
    throw new Error('pgvector 扩展未安装，无法进行语义搜索。请在 PostgreSQL 服务器安装 pgvector 扩展。');
  }

  const { limit = 10, taskId, minSimilarity = 0.5 } = options;

  // 短查询扩展：提升 embedding 信息量
  const expandedQuery = expandQuery(queryText);
  if (expandedQuery !== queryText) {
    console.log(`[RAG] 查询扩展: "${queryText}" → "${expandedQuery}"`);
  }

  // 生成查询 embedding
  const { embedding } = await generateEmbedding(expandedQuery);
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
      FROM sp_job_embeddings
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
      FROM sp_job_embeddings
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
      'SELECT COUNT(*) as cnt, MAX(created_at) as last_indexed FROM sp_job_embeddings WHERE task_id=$1'
    ).get(taskId) as any;
    return { taskId, count: row?.cnt || 0, lastIndexed: row?.lastIndexed || null };
  }

  const rows = await db.prepare(`
    SELECT task_id, COUNT(*) as cnt, MAX(created_at) as last_indexed
    FROM sp_job_embeddings GROUP BY task_id ORDER BY last_indexed DESC
  `).all() as any[];

  return rows.map((r: any) => ({
    taskId: r.taskId || r.task_id,
    count: r.cnt,
    lastIndexed: r.lastIndexed || r.last_indexed,
  }));
}
