import { db } from '../../config/database';
import { llmService } from './index';
import { INSIGHTS_SYSTEM, INSIGHTS_USER } from './prompts';
import crypto from 'crypto';

export interface MarketReport {
  id: string;
  fileId: string;
  reportType: string;
  title: string;
  content: string;
  summary: string;
  chartsConfig: any;
  modelUsed: string;
  createdAt: string;
}

function extractJSON(text: string): any {
  let cleaned = text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .replace(/\/\/[^\n]*/g, '')
    .trim();

  try { return JSON.parse(cleaned); } catch {}

  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start !== -1 && end > start) {
    cleaned = cleaned.substring(start, end + 1)
      .replace(/,(\s*[}\]])/g, '$1')
      .replace(/[\x00-\x1F\x7F]/g, ' ');
    try { return JSON.parse(cleaned); } catch {}
  }

  try {
    return JSON.parse(cleaned
      .replace(/:\s*'([^']*)'/g, ': "$1"')
      .replace(/(\w+):/g, '"$1":')
    );
  } catch {}

  throw new Error(`无法从以下内容提取 JSON: ${text.substring(0, 300)}`);
}

async function buildStats(fileId: string) {
  const file = await db.prepare(
    'SELECT * FROM csv_files WHERE id=$1'
  ).get(fileId) as any;

  if (!file) throw new Error('文件不存在');

  // 使用增强数据构建统计
  const taskId = file.taskId;

  const stats: any = {};

  // 总职位数
  const countResult = await db.prepare(
    'SELECT COUNT(*) as cnt FROM job_enrichments WHERE task_id=$1'
  ).get(taskId) as any;
  stats.totalJobs = countResult?.cnt || 0;

  if (stats.totalJobs === 0) {
    throw new Error('该任务尚未进行数据增强，请先进行 AI 增强');
  }

  // 薪资分布
  const salaryRows = await db.prepare(`
    SELECT salary_monthly_min, salary_monthly_max
    FROM job_enrichments WHERE task_id=$1
    AND salary_monthly_min IS NOT NULL
  `).all(taskId) as any[];

  if (salaryRows.length > 0) {
    const ranges = [
      { label: '5K以下', min: 0, max: 5000, count: 0 },
      { label: '5K-10K', min: 5000, max: 10000, count: 0 },
      { label: '10K-15K', min: 10000, max: 15000, count: 0 },
      { label: '15K-20K', min: 15000, max: 20000, count: 0 },
      { label: '20K-30K', min: 20000, max: 30000, count: 0 },
      { label: '30K以上', min: 30000, max: Infinity, count: 0 },
    ];
    salaryRows.forEach((r: any) => {
      const val = r.salaryMonthlyMin || r.salaryMonthlyMax || 0;
      for (const range of ranges) {
        if (val >= range.min && val < range.max) { range.count++; break; }
      }
    });
    stats.salaryDistribution = ranges;
  }

  // 城市分布（从原始 task 数据）
  const cityRows = await db.prepare(
    'SELECT config FROM tasks WHERE id=$1'
  ).get(taskId) as any;

  if (cityRows?.config) {
    try {
      const config = typeof cityRows.config === 'string' ? JSON.parse(cityRows.config) : cityRows.config;
      stats.cityDistribution = (config.cities || []).map((c: any) =>
        typeof c === 'string' ? { name: c, count: 0 } : c
      );
    } catch {}
  }

  // 职位分类分布
  const catRows = await db.prepare(`
    SELECT job_category_l1, COUNT(*) as cnt
    FROM job_enrichments WHERE task_id=$1 AND job_category_l1 IS NOT NULL
    GROUP BY job_category_l1 ORDER BY cnt DESC
  `).all(taskId) as any[];
  stats.jobCategoryDistribution = catRows.map((r: any) => ({
    name: r.jobCategoryL1, count: r.cnt,
  }));

  // 学历分布
  const eduRows = await db.prepare(`
    SELECT education_normalized, COUNT(*) as cnt
    FROM job_enrichments WHERE task_id=$1 AND education_normalized IS NOT NULL
    GROUP BY education_normalized ORDER BY cnt DESC
  `).all(taskId) as any[];
  stats.educationDistribution = eduRows.map((r: any) => ({
    name: r.educationNormalized, count: r.cnt,
  }));

  // 热门技能
  const skillRows = await db.prepare(`
    SELECT key_skills FROM job_enrichments WHERE task_id=$1 AND key_skills IS NOT NULL
  `).all(taskId) as any[];

  const skillCount: Record<string, number> = {};
  skillRows.forEach((r: any) => {
    let skills = r.keySkills;
    if (typeof skills === 'string') {
      try { skills = JSON.parse(skills); } catch { skills = []; }
    }
    if (Array.isArray(skills)) {
      skills.forEach((s: string) => {
        skillCount[s] = (skillCount[s] || 0) + 1;
      });
    }
  });
  stats.topSkills = Object.entries(skillCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([name, count]) => ({ name, count }));

  // 公司行业分布
  const industryRows = await db.prepare(`
    SELECT company_industry, COUNT(*) as cnt
    FROM job_enrichments WHERE task_id=$1 AND company_industry IS NOT NULL
    GROUP BY company_industry ORDER BY cnt DESC
  `).all(taskId) as any[];
  stats.industryDistribution = industryRows.map((r: any) => ({
    name: r.companyIndustry, count: r.cnt,
  }));

  // 工作经验分布
  const expRows = await db.prepare(`
    SELECT experience_years_min, experience_years_max, COUNT(*) as cnt
    FROM job_enrichments WHERE task_id=$1 AND experience_years_min IS NOT NULL
    GROUP BY experience_years_min, experience_years_max ORDER BY experience_years_min
  `).all(taskId) as any[];
  stats.experienceDistribution = expRows.map((r: any) => ({
    min: r.experienceYearsMin,
    max: r.experienceYearsMax,
    count: r.cnt,
  }));

  // 公司性质分布
  const natureRows = await db.prepare(`
    SELECT company_industry, COUNT(*) as cnt
    FROM job_enrichments WHERE task_id=$1 AND company_industry IS NOT NULL
    GROUP BY company_industry ORDER BY cnt DESC
  `).all(taskId) as any[];
  stats.companyNatureDistribution = natureRows.map((r: any) => ({
    name: r.companyIndustry, count: r.cnt,
  }));

  // 热门职位 Top 10
  const topJobRows = await db.prepare(`
    SELECT job_category_l2, COUNT(*) as cnt
    FROM job_enrichments WHERE task_id=$1 AND job_category_l2 IS NOT NULL
    GROUP BY job_category_l2 ORDER BY cnt DESC LIMIT 10
  `).all(taskId) as any[];
  stats.topJobs = topJobRows.map((r: any) => ({
    name: r.jobCategoryL2, count: r.cnt,
  }));

  // 城市数量
  stats.cityCount = stats.cityDistribution?.length || 0;
  stats.dateRange = file.createdAt || '未知';

  return stats;
}

export async function generateInsights(fileId: string): Promise<MarketReport> {
  const stats = await buildStats(fileId);

  console.log(`[Insights] 生成报告中，数据: ${stats.totalJobs} 条职位`);

  const result = await llmService.callLLM(
    INSIGHTS_SYSTEM,
    INSIGHTS_USER(stats),
    {
      taskType: 'insights',
      temperature: 0.3,
      maxTokens: 16384,
    }
  );

  const rawContent = result.content || '';
  if (!rawContent.trim()) {
    throw new Error('LLM 返回空内容，报告生成失败');
  }

  const parsed = extractJSON(rawContent);

  const id = crypto.randomUUID();
  const file = await db.prepare('SELECT * FROM csv_files WHERE id=$1').get(fileId) as any;
  const taskId = file?.taskId || '';

  const now = new Date().toISOString();

  await db.prepare(`
    INSERT INTO market_reports (id, file_id, task_id, report_type, title, content, summary, charts_config, model_used, created_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
  `).run(
    id, fileId, taskId, 'overview',
    parsed.title || '市场分析报告',
    JSON.stringify(parsed.sections || []),
    parsed.summary || '',
    JSON.stringify(parsed.chartsConfig || []),
    result.model || '',
    now
  );

  return {
    id,
    fileId,
    reportType: 'overview',
    title: parsed.title || '市场分析报告',
    content: JSON.stringify(parsed.sections || []),
    summary: parsed.summary || '',
    chartsConfig: parsed.chartsConfig || [],
    modelUsed: result.model || '',
    createdAt: now,
  };
}

export async function getInsightsHistory(fileId: string): Promise<MarketReport[]> {
  const rows = await db.prepare(`
    SELECT * FROM market_reports WHERE file_id=$1
    ORDER BY created_at DESC LIMIT 10
  `).all(fileId) as any[];

  return rows.map((r: any) => ({
    id: r.id,
    fileId: r.fileId,
    reportType: r.reportType,
    title: r.title,
    content: r.content,
    summary: r.summary,
    chartsConfig: typeof r.chartsConfig === 'string' ? JSON.parse(r.chartsConfig) : r.chartsConfig,
    modelUsed: r.modelUsed,
    createdAt: r.createdAt,
  }));
}

export async function getInsightsReport(reportId: string): Promise<MarketReport | null> {
  const r = await db.prepare('SELECT * FROM market_reports WHERE id=$1').get(reportId) as any;
  if (!r) return null;

  return {
    id: r.id,
    fileId: r.fileId,
    reportType: r.reportType,
    title: r.title,
    content: r.content,
    summary: r.summary,
    chartsConfig: typeof r.chartsConfig === 'string' ? JSON.parse(r.chartsConfig) : r.chartsConfig,
    modelUsed: r.modelUsed,
    createdAt: r.createdAt,
  };
}
