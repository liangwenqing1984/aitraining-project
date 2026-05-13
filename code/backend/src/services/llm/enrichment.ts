import { db } from '../../config/database';
import { llmService } from './index';
import { ENRICHMENT_SYSTEM, ENRICHMENT_USER } from './prompts';
import { io } from '../../app';
import crypto from 'crypto';

const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 200;

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
// Store latest progress for replay on WebSocket reconnect
const latestProgress = new Map<string, EnrichmentProgress>();

export async function startEnrichment(taskId: string): Promise<void> {
  if (runningEnrichments.get(taskId)) {
    throw new Error('该任务的数据增强已在运行中');
  }

  runningEnrichments.set(taskId, true);

  const emitProgress = (message: string, total: number) => {
    const progress: EnrichmentProgress = {
      taskId,
      status: 'running',
      total,
      completed,
      failed,
      message,
    };
    io.to(`task:${taskId}`).emit('enrichment:progress', progress);
    latestProgress.set(taskId, progress);
    console.log(`[Enrichment] ${taskId}: ${message} (${completed}/${total})`);
  };

  let completed = 0;
  let failed = 0;
  let total = 0;

  try {
    emitProgress('开始从 sp_jobs 读取原始职位数据...', 0);

    const jobRows = await db.prepare(
      'SELECT * FROM sp_jobs WHERE task_id = ?'
    ).all(taskId) as any[];

    if (!jobRows || jobRows.length === 0) {
      throw new Error('sp_jobs 中没有该任务的原始数据，请先执行数据采集');
    }

    total = jobRows.length;

    // 将 sp_jobs 行转换为 Excel 风格的 {中文表头: 值} 格式，保持 enrichSingleJob 兼容
    const rows: Record<string, string>[] = [];
    for (const jr of jobRows) {
      const raw: Record<string, any> = {};
      // 解析 raw_data JSONB（存储完整的 JobData 英文字段）
      if (typeof jr.rawData === 'object') {
        Object.assign(raw, jr.rawData);
      } else if (typeof jr.rawData === 'string') {
        try { Object.assign(raw, JSON.parse(jr.rawData)); } catch {}
      }

      // 用 sp_jobs 顶层字段兜底覆盖（数据库值优先于 raw_data）
      raw['companyName'] = jr.companyName || jr.company_name || raw['companyName'] || '';
      raw['jobName'] = jr.jobName || jr.job_name || raw['jobName'] || '';
      raw['jobCategory'] = jr.jobCategory || jr.job_category || raw['jobCategory'] || '';
      raw['salaryRange'] = jr.salaryRange || jr.salary_range || raw['salaryRange'] || '';
      raw['workCity'] = jr.workCity || jr.work_city || raw['workCity'] || '';
      raw['workExperience'] = jr.workExperience || jr.work_experience || raw['workExperience'] || '';
      raw['education'] = jr.education || raw['education'] || '';

      const jid = jr.jobId || jr.job_id || raw['jobId'] || '';

      // 构建中文表头行（保持 enrichSingleJob 兼容性）
      const rowData: Record<string, string> = {
        '企业名称': raw['companyName'] || '',
        '职位名称': raw['jobName'] || '',
        '职位分类': raw['jobCategory'] || '',
        '薪资范围': raw['salaryRange'] || '',
        '工作城市': raw['workCity'] || '',
        '工作经验': raw['workExperience'] || '',
        '学历': raw['education'] || '',
        '公司性质': raw['companyNature'] || '',
        '公司规模': raw['companyScale'] || '',
        '经营范围': raw['businessScope'] || '',
        '职位标签': raw['jobTags'] || '',
        '工作性质': raw['workType'] || '',
        '工作地址': raw['workAddress'] || '',
        '职位描述': raw['jobDescription'] || '',
        '职位ID': jid,
        '_jobId': jid || `row_${rows.length}`,
      };
      rows.push(rowData);
    }

    emitProgress(`数据读取完成，共 ${rows.length} 条记录`, total);

    // 查询已增强的 job_id，跳过重复处理
    const existingRows = await db.prepare(
      `SELECT job_id FROM sp_job_enrichments WHERE task_id = $1`
    ).all(taskId) as any[];
    const enrichedIds = new Set(existingRows.map((r: any) => r.jobId));
    const rowsToProcess = rows.filter(row => {
      return !enrichedIds.has(row['_jobId']);
    });
    const skipped = rows.length - rowsToProcess.length;
    completed = skipped;  // 已增强的记录也算入完成数
    if (skipped > 0) {
      emitProgress(`跳过已增强 ${skipped} 条，待处理 ${rowsToProcess.length} 条，开始 AI 增强...`, total);
    } else {
      emitProgress(`共 ${rowsToProcess.length} 条记录，开始 AI 增强...`, total);
    }

    // Process in batches
    let consecutiveAuthFailures = 0;
    for (let i = 0; i < rowsToProcess.length; i += BATCH_SIZE) {
      const batch = rowsToProcess.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.allSettled(
        batch.map((row) => enrichSingleJob(taskId, row))
      );

      let batchAuthErrors = 0;
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          completed++;
        } else {
          failed++;
          const errMsg = (result.reason?.message || '').toLowerCase();
          if (/401|403|authentication|invalid.*api|unauthorized/i.test(errMsg)) {
            batchAuthErrors++;
          }
          console.error(`[Enrichment] 单条增强失败: ${taskId}`, result.reason?.message);
        }
      }

      // 整批都是认证错误 → 累计，2连批则中止
      if (batchAuthErrors === batch.length) {
        consecutiveAuthFailures++;
        const abortMsg = `增强中止：连续 ${consecutiveAuthFailures} 批全部认证失败（API Key 无效）。请检查 AI 模型配置中的 API Key 是否正确。`;
        emitProgress(abortMsg, total);
        console.error(`[Enrichment] ${abortMsg}`);
        throw new Error(abortMsg);
      } else if (batchAuthErrors > 0) {
        consecutiveAuthFailures = 0;
      }

      emitProgress(`处理中... (第 ${Math.min(i + BATCH_SIZE, rowsToProcess.length)}/${rowsToProcess.length} 条)`, total);

      // Delay between batches to avoid rate limiting
      if (i + BATCH_SIZE < rowsToProcess.length) {
        await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
      }
    }

    const finalProgress: EnrichmentProgress = {
      taskId,
      status: 'completed',
      total,
      completed,
      failed,
      message: `增强完成：成功 ${completed} 条，失败 ${failed} 条`,
    };
    io.to(`task:${taskId}`).emit('enrichment:progress', finalProgress);
    latestProgress.set(taskId, finalProgress);

    console.log(`[Enrichment] ✅ ${taskId} 完成: 成功 ${completed}, 失败 ${failed}`);
  } catch (e: any) {
    console.error(`[Enrichment] ❌ ${taskId} 失败:`, e.message);
    const failProgress: EnrichmentProgress = {
      taskId,
      status: 'failed',
      total,
      completed,
      failed,
      message: `增强失败: ${e.message}`,
    };
    io.to(`task:${taskId}`).emit('enrichment:progress', failProgress);
    latestProgress.set(taskId, failProgress);
    throw e;
  } finally {
    runningEnrichments.delete(taskId);
    // Clean up progress cache after 5 minutes
    setTimeout(() => { latestProgress.delete(taskId); }, 5 * 60 * 1000);
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

  const jobId = row['_jobId'] || row['职位ID'] || `${taskId}_${Date.now()}`;

  // Retry up to 3 times on failure, with progressive maxTokens for reasoning models
  let lastError: Error | null = null;
  // 16384 → 32768 → 49152: 推理模型思考消耗大，从较高起点开始避免无谓重试
  const tokenLimits = [16384, 32768, 49152];
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await Promise.race([
        llmService.callLLM(
          ENRICHMENT_SYSTEM,
          ENRICHMENT_USER(jobData),
          {
            taskType: 'enrichment',
            temperature: attempt === 0 ? 0.1 : 0.3,
            maxTokens: tokenLimits[attempt],
          }
        ),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('LLM 增强请求超时（120s）')), 120000)
        ),
      ]);

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
      // 永久性错误不重试：认证失败、权限不足、模型不存在等
      const msg = (e.message || '').toLowerCase();
      const isPermanent = /401|403|404|authentication|invalid.*api|api.*invalid|unauthorized|forbidden|not found/i.test(msg);
      if (isPermanent) {
        console.error(`[Enrichment] 永久性错误，跳过重试 (${jobId}): ${e.message}`);
        throw e;
      }
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

  // Upsert into sp_job_enrichments
  await db.prepare(`
    INSERT INTO sp_job_enrichments (
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
  isRunning: boolean;
  runningProgress: EnrichmentProgress | null;
}> {
  const result = await db.prepare(`
    SELECT COUNT(*) as total, MAX(enriched_at) as last_enriched_at
    FROM sp_job_enrichments WHERE task_id=$1
  `).get(taskId) as any;

  return {
    exists: result?.total > 0,
    total: result?.total || 0,
    lastEnrichedAt: result?.lastEnrichedAt || null,
    isRunning: runningEnrichments.get(taskId) || false,
    runningProgress: latestProgress.get(taskId) || null,
  };
}

export async function getEnrichmentResults(taskId: string): Promise<any[]> {
  const rows = await db.prepare(`
    SELECT * FROM sp_job_enrichments WHERE task_id=$1 ORDER BY enriched_at DESC
  `).all(taskId) as any[];

  return rows.map((r) => ({
    ...r,
    keySkills: typeof r.keySkills === 'string' ? JSON.parse(r.keySkills) : r.keySkills,
    requiredSkills: typeof r.requiredSkills === 'string' ? JSON.parse(r.requiredSkills) : r.requiredSkills,
    preferredSkills: typeof r.preferredSkills === 'string' ? JSON.parse(r.preferredSkills) : r.preferredSkills,
    benefits: typeof r.benefits === 'string' ? JSON.parse(r.benefits) : r.benefits,
  }));
}
