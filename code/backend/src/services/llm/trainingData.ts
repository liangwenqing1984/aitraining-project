import fs from 'fs';
import path from 'path';
import { db } from '../../config/database';
import { buildJobText } from './embeddings';

export interface DatasetConfig {
  taskIds: string[];
  positiveStrategy: 'same_l2' | 'same_industry';  // 正样本策略
  maxPairs?: number;
}

interface JobRecord {
  jobId: string;
  jobName?: string;
  jobCategoryL1?: string;
  jobCategoryL2?: string;
  companyIndustry?: string;
  keySkills?: string[] | string;
  companyName?: string;
  workCity?: string;
  educationNormalized?: string;
  salaryMonthlyMin?: number;
  salaryMonthlyMax?: number;
  workMode?: string;
}

/**
 * 从 sp_job_enrichments 提取训练数据，生成对比学习训练对
 * 正样本：同 job_category_l2（或同 company_industry）
 * 负样本：不同 job_category_l1 的随机岗位
 */
export async function buildTrainingDataset(config: DatasetConfig): Promise<{
  filePath: string;
  pairCount: number;
  jobCount: number;
}> {
  const { taskIds, positiveStrategy = 'same_l2', maxPairs = 5000 } = config;

  if (!taskIds || taskIds.length === 0) {
    throw new Error('至少选择一个任务');
  }

  const placeholders = taskIds.map((_, i) => `$${i + 1}`).join(',');

  const rows = await db.prepare(`
    SELECT
      e.job_id, e.job_category_l1, e.job_category_l2,
      e.company_industry, e.key_skills, e.education_normalized,
      e.salary_monthly_min, e.salary_monthly_max, e.work_mode,
      j.job_name, j.company_name, j.work_city
    FROM sp_job_enrichments e
    LEFT JOIN sp_jobs j ON e.job_id = j.job_id AND e.task_id = j.task_id
    WHERE e.task_id IN (${placeholders})
      AND e.job_category_l1 IS NOT NULL
      AND e.job_category_l2 IS NOT NULL
  `).all(...taskIds) as JobRecord[];

  if (rows.length < 2) {
    throw new Error(`训练数据不足：仅找到 ${rows.length} 条有效记录（需至少2条）`);
  }

  // 按 L1+L2 分组，用于正样本匹配
  const byL2 = new Map<string, JobRecord[]>();
  // 按 L1 分组，用于负样本匹配
  const byL1 = new Map<string, JobRecord[]>();

  for (const r of rows) {
    const l2Key = `${r.jobCategoryL1}||${r.jobCategoryL2}`;
    if (!byL2.has(l2Key)) byL2.set(l2Key, []);
    byL2.get(l2Key)!.push(r);

    const l1Key = r.jobCategoryL1!;
    if (!byL1.has(l1Key)) byL1.set(l1Key, []);
    byL1.get(l1Key)!.push(r);
  }

  const pairs: Array<{ anchor: string; positive: string; negative: string }> = [];
  const allL2Keys = Array.from(byL2.keys());

  for (const r of rows) {
    if (pairs.length >= maxPairs) break;

    const anchorText = buildJobText({
      jobName: r.jobName,
      jobCategoryL1: r.jobCategoryL1,
      jobCategoryL2: r.jobCategoryL2,
      keySkills: r.keySkills,
      companyIndustry: r.companyIndustry,
      companyName: r.companyName,
      workCity: r.workCity,
      educationNormalized: r.educationNormalized,
      salaryMonthlyMin: r.salaryMonthlyMin,
      salaryMonthlyMax: r.salaryMonthlyMax,
      workMode: r.workMode,
    });

    // 正样本：同 L2 分类下的随机另一个岗位
    const l2Key = `${r.jobCategoryL1}||${r.jobCategoryL2}`;
    const sameL2Group = byL2.get(l2Key) || [];
    const positives = sameL2Group.filter(p => p.jobId !== r.jobId);
    const positive = positives.length > 0
      ? positives[Math.floor(Math.random() * positives.length)]
      : r;

    // 负样本：不同 L1 分类的随机岗位
    const diffL1Keys = allL2Keys.filter(k => !k.startsWith(r.jobCategoryL1!));
    if (diffL1Keys.length === 0) continue;
    const negKey = diffL1Keys[Math.floor(Math.random() * diffL1Keys.length)];
    const negGroup = byL2.get(negKey) || [];
    const negative = negGroup[Math.floor(Math.random() * negGroup.length)];

    const positiveText = buildJobText({
      jobName: positive.jobName,
      jobCategoryL1: positive.jobCategoryL1,
      jobCategoryL2: positive.jobCategoryL2,
      keySkills: positive.keySkills,
      companyIndustry: positive.companyIndustry,
      companyName: positive.companyName,
      workCity: positive.workCity,
      educationNormalized: positive.educationNormalized,
      salaryMonthlyMin: positive.salaryMonthlyMin,
      salaryMonthlyMax: positive.salaryMonthlyMax,
      workMode: positive.workMode,
    });

    const negativeText = buildJobText({
      jobName: negative.jobName,
      jobCategoryL1: negative.jobCategoryL1,
      jobCategoryL2: negative.jobCategoryL2,
      keySkills: negative.keySkills,
      companyIndustry: negative.companyIndustry,
      companyName: negative.companyName,
      workCity: negative.workCity,
      educationNormalized: negative.educationNormalized,
      salaryMonthlyMin: negative.salaryMonthlyMin,
      salaryMonthlyMax: negative.salaryMonthlyMax,
      workMode: negative.workMode,
    });

    pairs.push({ anchor: anchorText, positive: positiveText, negative: negativeText });
  }

  // 写入 JSONL
  const outDir = path.resolve(__dirname, '../../../data/training');
  fs.mkdirSync(outDir, { recursive: true });
  const fileName = `dataset_${Date.now()}.jsonl`;
  const filePath = path.join(outDir, fileName);

  const stream = fs.createWriteStream(filePath, { encoding: 'utf-8' });
  for (const p of pairs) {
    stream.write(JSON.stringify(p) + '\n');
  }
  stream.end();

  console.log(`[TrainingData] 生成训练数据: ${filePath}, ${pairs.length} 对`);

  return { filePath, pairCount: pairs.length, jobCount: rows.length };
}

/**
 * 列出已有的训练数据集
 */
export function listDatasets(): Array<{
  name: string;
  path: string;
  pairCount: number;
  size: string;
}> {
  const dir = path.resolve(__dirname, '../../../data/training');
  if (!fs.existsSync(dir)) return [];

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsonl'));
  return files.map(f => {
    const fullPath = path.join(dir, f);
    const stat = fs.statSync(fullPath);
    const content = fs.readFileSync(fullPath, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);
    return {
      name: f,
      path: fullPath,
      pairCount: lines.length,
      size: `${(stat.size / 1024).toFixed(1)} KB`,
    };
  }).sort((a, b) => b.name.localeCompare(a.name));
}

/**
 * 预览数据集前 N 条
 */
export function previewDataset(filePath: string, limit = 10): object[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`数据集文件不存在: ${filePath}`);
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n').filter(Boolean);
  return lines.slice(0, limit).map(line => JSON.parse(line));
}
