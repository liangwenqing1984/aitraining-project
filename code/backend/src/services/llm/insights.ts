import { db } from '../../config/database';
import { llmService } from './index';
import { INSIGHTS_SYSTEM, INSIGHTS_USER } from './prompts';
import { io } from '../../app';
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

function emitProgress(fileId: string, message: string) {
  io.emit('insights:progress', { fileId, message, timestamp: Date.now() });
  console.log(`[Insights] ${message}`);
}

async function buildStats(fileId: string) {
  const file = await db.prepare(
    'SELECT * FROM csv_files WHERE id=$1'
  ).get(fileId) as any;

  if (!file) throw new Error('文件不存在');

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

  emitProgress(fileId, '正在分析薪资分布...');

  // 薪资分布（使用月薪中位数分类）
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
      // Use midpoint for more accurate bucketing
      const mid = r.salaryMonthlyMax
        ? (r.salaryMonthlyMin + r.salaryMonthlyMax) / 2
        : r.salaryMonthlyMin;
      const val = mid || r.salaryMonthlyMin || 0;
      for (const range of ranges) {
        if (val >= range.min && val < range.max) { range.count++; break; }
      }
    });
    stats.salaryDistribution = ranges;
  }

  emitProgress(fileId, '正在分析职位分类...');

  // 职位分类分布（L1 + L2）
  const catRows = await db.prepare(`
    SELECT job_category_l1, job_category_l2, COUNT(*) as cnt
    FROM job_enrichments WHERE task_id=$1 AND job_category_l1 IS NOT NULL
    GROUP BY job_category_l1, job_category_l2 ORDER BY cnt DESC
  `).all(taskId) as any[];

  // L1 summary
  const l1Map: Record<string, number> = {};
  catRows.forEach((r: any) => {
    l1Map[r.jobCategoryL1] = (l1Map[r.jobCategoryL1] || 0) + (r.cnt || 0);
  });
  stats.jobCategoryDistribution = Object.entries(l1Map)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));

  // Top L2 jobs
  stats.topJobs = catRows
    .filter((r: any) => r.jobCategoryL2)
    .slice(0, 15)
    .map((r: any) => ({ name: r.jobCategoryL2, count: r.cnt }));

  emitProgress(fileId, '正在分析学历与经验要求...');

  // 学历分布
  const eduRows = await db.prepare(`
    SELECT education_normalized, COUNT(*) as cnt
    FROM job_enrichments WHERE task_id=$1 AND education_normalized IS NOT NULL
    GROUP BY education_normalized ORDER BY cnt DESC
  `).all(taskId) as any[];
  stats.educationDistribution = eduRows.map((r: any) => ({
    name: r.educationNormalized, count: r.cnt,
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

  emitProgress(fileId, '正在提取热门技能...');

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
        if (s) skillCount[s] = (skillCount[s] || 0) + 1;
      });
    }
  });
  stats.topSkills = Object.entries(skillCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([name, count]) => ({ name, count }));

  emitProgress(fileId, '正在分析行业分布...');

  // 公司行业分布（合并去重，之前有两次重复查询）
  const industryRows = await db.prepare(`
    SELECT company_industry, COUNT(*) as cnt,
           AVG(salary_monthly_min) as avg_salary_min,
           AVG(salary_monthly_max) as avg_salary_max
    FROM job_enrichments WHERE task_id=$1 AND company_industry IS NOT NULL
    GROUP BY company_industry ORDER BY cnt DESC
  `).all(taskId) as any[];
  stats.industryDistribution = industryRows.map((r: any) => ({
    name: r.companyIndustry,
    count: r.cnt,
    avgSalaryMin: Math.round(r.avgSalaryMin || 0),
    avgSalaryMax: Math.round(r.avgSalaryMax || 0),
  }));

  // 工作模式分布
  const workModeRows = await db.prepare(`
    SELECT work_mode, COUNT(*) as cnt
    FROM job_enrichments WHERE task_id=$1 AND work_mode IS NOT NULL
    GROUP BY work_mode ORDER BY cnt DESC
  `).all(taskId) as any[];
  stats.workModeDistribution = workModeRows.map((r: any) => ({
    name: r.workMode, count: r.cnt,
  }));

  // 城市数（从增强数据中推算，实际需要原始数据；这里使用任务配置信息）
  stats.cityCount = (() => {
    try {
      const config = typeof file?.config === 'string' ? JSON.parse(file.config) : file?.config;
      return (config?.cities || []).length || 0;
    } catch { return 0; }
  })();
  stats.dateRange = file.createdAt || '未知';

  return stats;
}

export async function generateInsights(fileId: string): Promise<MarketReport> {
  emitProgress(fileId, '开始构建统计数据...');

  const stats = await buildStats(fileId);

  emitProgress(fileId, `统计数据构建完成（${stats.totalJobs} 条职位），正在调用 AI 生成报告...`);

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

  emitProgress(fileId, 'AI 报告生成完成，正在解析...');

  const parsed = extractJSON(rawContent);

  const id = crypto.randomUUID();
  const file = await db.prepare('SELECT * FROM csv_files WHERE id=$1').get(fileId) as any;
  const taskId = file?.taskId || '';
  const now = new Date().toISOString();

  // 处理 ECharts 配置中的函数/表达式
  const safeChartsConfig = (parsed.chartsConfig || []).map((cfg: any) => {
    if (cfg.echartsOption) {
      // Remove non-serializable properties
      delete cfg.echartsOption._comment;
      // Ensure color values are strings not expressions
      try { JSON.stringify(cfg.echartsOption); } catch { cfg.echartsOption = {}; }
    }
    return cfg;
  });

  await db.prepare(`
    INSERT INTO market_reports (id, file_id, task_id, report_type, title, content, summary, charts_config, model_used, created_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
  `).run(
    id, fileId, taskId, 'overview',
    parsed.title || '市场分析报告',
    JSON.stringify(parsed.sections || []),
    parsed.summary || '',
    JSON.stringify(safeChartsConfig),
    result.model || '',
    now
  );

  emitProgress(fileId, `报告保存完成: ${parsed.title || '市场分析报告'}`);

  // Notify completion via WebSocket
  io.emit('insights:completed', {
    fileId,
    reportId: id,
    title: parsed.title || '市场分析报告',
    summary: parsed.summary || '',
  });

  return {
    id,
    fileId,
    reportType: 'overview',
    title: parsed.title || '市场分析报告',
    content: JSON.stringify(parsed.sections || []),
    summary: parsed.summary || '',
    chartsConfig: safeChartsConfig,
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
