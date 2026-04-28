import { db } from '../../config/database';
import { llmService } from './index';
import { ENRICHMENT_SYSTEM, ENRICHMENT_USER } from './prompts';
import { io } from '../../app';
import ExcelJS from 'exceljs';
import crypto from 'crypto';

const BATCH_SIZE = 1;
const BATCH_DELAY_MS = 500;

export interface EnrichmentProgress {
  taskId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  total: number;
  completed: number;
  failed: number;
  message: string;
}

// Track running enrichments to prevent duplicates
const runningEnrichments = new Map<string, boolean>();

export async function startEnrichment(taskId: string): Promise<void> {
  if (runningEnrichments.get(taskId)) {
    throw new Error('该任务的数据增强已在运行中');
  }

  const csvFile = await db.prepare(
    'SELECT * FROM csv_files WHERE task_id=$1 ORDER BY created_at DESC LIMIT 1'
  ).get(taskId) as any;

  if (!csvFile) {
    throw new Error('未找到任务的导出文件');
  }

  runningEnrichments.set(taskId, true);
  const total = csvFile.recordCount || 0;
  let completed = 0;
  let failed = 0;

  const emitProgress = (message: string) => {
    io.to(`task:${taskId}`).emit('enrichment:progress', {
      taskId,
      status: 'running',
      total,
      completed,
      failed,
      message,
    } as EnrichmentProgress);
    console.log(`[Enrichment] ${taskId}: ${message} (${completed}/${total})`);
  };

  try {
    emitProgress('开始读取数据文件...');

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(csvFile.filepath);
    const worksheet = workbook.worksheets[0];

    if (!worksheet) {
      throw new Error('Excel 文件中没有工作表');
    }

    const rows: Record<string, string>[] = [];
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
      rows.push(rowData);
    });

    emitProgress(`数据读取完成，共 ${rows.length} 条记录，开始 AI 增强...`);

    // Process in batches
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.allSettled(
        batch.map((row) => enrichSingleJob(taskId, row))
      );

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          completed++;
        } else {
          failed++;
          console.error(`[Enrichment] 单条增强失败: ${taskId}`, result.reason?.message);
        }
      }

      emitProgress(`处理中... (第 ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length} 条)`);

      // Delay between batches to avoid rate limiting
      if (i + BATCH_SIZE < rows.length) {
        await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
      }
    }

    io.to(`task:${taskId}`).emit('enrichment:progress', {
      taskId,
      status: 'completed',
      total: rows.length,
      completed,
      failed,
      message: `增强完成：成功 ${completed} 条，失败 ${failed} 条`,
    } as EnrichmentProgress);

    console.log(`[Enrichment] ✅ ${taskId} 完成: 成功 ${completed}, 失败 ${failed}`);
  } catch (e: any) {
    console.error(`[Enrichment] ❌ ${taskId} 失败:`, e.message);
    io.to(`task:${taskId}`).emit('enrichment:progress', {
      taskId,
      status: 'failed',
      total,
      completed,
      failed,
      message: `增强失败: ${e.message}`,
    } as EnrichmentProgress);
    throw e;
  } finally {
    runningEnrichments.delete(taskId);
  }
}

function extractJSON(text: string): any {
  let cleaned = text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .replace(/\/\/[^\n]*/g, '')    // Remove single-line comments
    .trim();

  // Try direct parse first
  try { return JSON.parse(cleaned); } catch {}

  // Try to find JSON object boundaries
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start !== -1 && end > start) {
    cleaned = cleaned.substring(start, end + 1)
      .replace(/,(\s*[}\]])/g, '$1')   // Remove trailing commas
      .replace(/[\x00-\x1F\x7F]/g, ' '); // Replace control chars
    try { return JSON.parse(cleaned); } catch {}
  }

  // Last resort: try to fix common issues
  try {
    return JSON.parse(cleaned
      .replace(/:\s*'([^']*)'/g, ': "$1"')  // Single quotes → double quotes
      .replace(/(\w+):/g, '"$1":')           // Quote unquoted keys
    );
  } catch {}

  throw new Error(`无法从以下内容提取 JSON: ${text.substring(0, 300)}`);
}

async function enrichSingleJob(
  taskId: string,
  row: Record<string, string>
): Promise<void> {
  const jobData = {
    companyName: row['企业名称'] || '',
    jobName: row['职位名称'] || '',
    jobCategory: row['职位分类'] || '',
    salaryRange: row['薪资范围'] || '',
    workCity: row['工作城市'] || '',
    workExperience: row['工作经验'] || '',
    education: row['学历'] || '',
    companyNature: row['公司性质'] || '',
    companyScale: row['公司规模'] || '',
    businessScope: row['经营范围'] || '',
    jobTags: row['职位标签'] || '',
    workType: row['工作性质'] || '',
    workAddress: row['工作地址'] || '',
    jobDescription: row['职位描述'] || '',
  };

  const jobId = row['职位ID'] || `${taskId}_${Date.now()}`;

  // Retry up to 3 times on failure
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await llmService.callLLM(
        ENRICHMENT_SYSTEM,
        ENRICHMENT_USER(jobData),
        {
          taskType: 'enrichment',
          temperature: attempt === 0 ? 0.1 : 0.3,
          maxTokens: 8192,
        }
      );

      const rawContent = result.content || '';
      if (!rawContent.trim()) {
        console.error(`[Enrichment] LLM 返回空内容，tokensUsed=${JSON.stringify(result.tokensUsed)}`);
        throw new Error('LLM 返回空内容（可能是推理模型思考过程占满了 token 限制）');
      }

      const parsed = extractJSON(rawContent);
      // Success - proceed to DB insert
      return await saveEnrichmentResult(taskId, jobId, parsed, result.model);
    } catch (e: any) {
      lastError = e;
      if (attempt < 2) {
        console.warn(`[Enrichment] 第 ${attempt + 1} 次尝试失败 (${jobId})，重试中...`, e.message);
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }
  throw lastError || new Error('增强失败');
}

async function saveEnrichmentResult(
  taskId: string,
  jobId: string,
  parsed: any,
  modelUsed: string
): Promise<void> {

  const id = crypto.randomUUID();

  // Upsert into job_enrichments
  await db.prepare(`
    INSERT INTO job_enrichments (
      id, task_id, job_id, salary_monthly_min, salary_monthly_max,
      salary_annual_estimate, job_category_l1, job_category_l2,
      company_industry, key_skills, required_skills, preferred_skills,
      education_normalized, experience_years_min, experience_years_max,
      benefits, work_mode, model_used
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
    ON CONFLICT (task_id, job_id) DO UPDATE SET
      salary_monthly_min = EXCLUDED.salary_monthly_min,
      salary_monthly_max = EXCLUDED.salary_monthly_max,
      salary_annual_estimate = EXCLUDED.salary_annual_estimate,
      job_category_l1 = EXCLUDED.job_category_l1,
      job_category_l2 = EXCLUDED.job_category_l2,
      company_industry = EXCLUDED.company_industry,
      key_skills = EXCLUDED.key_skills,
      required_skills = EXCLUDED.required_skills,
      preferred_skills = EXCLUDED.preferred_skills,
      education_normalized = EXCLUDED.education_normalized,
      experience_years_min = EXCLUDED.experience_years_min,
      experience_years_max = EXCLUDED.experience_years_max,
      benefits = EXCLUDED.benefits,
      work_mode = EXCLUDED.work_mode,
      model_used = EXCLUDED.model_used,
      enriched_at = CURRENT_TIMESTAMP
  `).run(
    id,
    taskId,
    jobId,
    parsed.salary_monthly_min ?? null,
    parsed.salary_monthly_max ?? null,
    parsed.salary_annual_estimate ?? null,
    parsed.job_category_l1 ?? null,
    parsed.job_category_l2 ?? null,
    parsed.company_industry ?? null,
    JSON.stringify(parsed.key_skills || []),
    JSON.stringify(parsed.required_skills || []),
    JSON.stringify(parsed.preferred_skills || []),
    parsed.education_normalized ?? null,
    parsed.experience_years_min ?? null,
    parsed.experience_years_max ?? null,
    JSON.stringify(parsed.benefits || []),
    parsed.work_mode ?? null,
    modelUsed
  );
}

export async function getEnrichmentStatus(taskId: string): Promise<{
  exists: boolean;
  total: number;
  lastEnrichedAt: string | null;
}> {
  const result = await db.prepare(`
    SELECT COUNT(*) as total, MAX(enriched_at) as last_enriched_at
    FROM job_enrichments WHERE task_id=$1
  `).get(taskId) as any;

  return {
    exists: result?.total > 0,
    total: result?.total || 0,
    lastEnrichedAt: result?.lastEnrichedAt || null,
  };
}

export async function getEnrichmentResults(taskId: string): Promise<any[]> {
  const rows = await db.prepare(`
    SELECT * FROM job_enrichments WHERE task_id=$1 ORDER BY enriched_at DESC
  `).all(taskId) as any[];

  return rows.map((r) => ({
    ...r,
    keySkills: typeof r.keySkills === 'string' ? JSON.parse(r.keySkills) : r.keySkills,
    requiredSkills: typeof r.requiredSkills === 'string' ? JSON.parse(r.requiredSkills) : r.requiredSkills,
    preferredSkills: typeof r.preferredSkills === 'string' ? JSON.parse(r.preferredSkills) : r.preferredSkills,
    benefits: typeof r.benefits === 'string' ? JSON.parse(r.benefits) : r.benefits,
  }));
}
