import { Request, Response } from 'express';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { db } from '../config/database';
import { ApiResponse } from '../types';
import { generateAllInsights, getAllInsightsHistory, getInsightsReport } from '../services/llm/insights';

export async function overview(_req: Request, res: Response) {
  try {
    // 汇总统计 — 总数不加薪资过滤，薪资相关指标单独过滤
    const totalResult = await db.prepare(`
      SELECT COUNT(*) as cnt, COUNT(DISTINCT task_id) as tasks
      FROM sp_job_enrichments
    `).get() as any;

    const salarySummary = await db.prepare(`
      SELECT
        ROUND(AVG((salary_monthly_min + salary_monthly_max) / 2.0)) as avg_salary,
        MAX(salary_monthly_max) as max_salary,
        MIN(salary_monthly_min) as min_salary
      FROM sp_job_enrichments
      WHERE salary_monthly_min IS NOT NULL
    `).get() as any;

    // 薪资分布
    const salaryRows = await db.prepare(`
      SELECT salary_monthly_min, salary_monthly_max
      FROM sp_job_enrichments
      WHERE salary_monthly_min IS NOT NULL
    `).all() as any[];

    const salaryBuckets = [
      { label: '5K以下', min: 0, max: 5000, count: 0 },
      { label: '5K-10K', min: 5000, max: 10000, count: 0 },
      { label: '10K-15K', min: 10000, max: 15000, count: 0 },
      { label: '15K-20K', min: 15000, max: 20000, count: 0 },
      { label: '20K-30K', min: 20000, max: 30000, count: 0 },
      { label: '30K以上', min: 30000, max: Infinity, count: 0 },
    ];
    salaryRows.forEach((r: any) => {
      const mid = r.salaryMonthlyMax
        ? (r.salaryMonthlyMin + r.salaryMonthlyMax) / 2
        : r.salaryMonthlyMin;
      for (const bucket of salaryBuckets) {
        if (mid >= bucket.min && mid < bucket.max) { bucket.count++; break; }
      }
    });

    // 城市分布（从 sp_jobs 取城市信息）
    const cityRows = await db.prepare(`
      SELECT work_city as city, COUNT(*) as cnt
      FROM sp_jobs GROUP BY work_city
      ORDER BY cnt DESC LIMIT 15
    `).all() as any[];

    // 学历分布
    const eduRows = await db.prepare(`
      SELECT education_normalized as name, COUNT(*) as count
      FROM sp_job_enrichments WHERE education_normalized IS NOT NULL
      GROUP BY education_normalized ORDER BY count DESC
    `).all() as any[];

    // 经验年限分布
    const expRows = await db.prepare(`
      SELECT
        experience_years_min,
        experience_years_max,
        COUNT(*) as count
      FROM sp_job_enrichments WHERE experience_years_min IS NOT NULL
      GROUP BY experience_years_min, experience_years_max
      ORDER BY experience_years_min
    `).all() as any[];
    const experienceDistribution = expRows.map((r: any) => ({
      name: r.experienceYearsMax
        ? `${r.experienceYearsMin}-${r.experienceYearsMax}年`
        : `${r.experienceYearsMin}年以上`,
      count: r.count,
    }));

    // 行业分布
    const industryRows = await db.prepare(`
      SELECT company_industry as name,
             COUNT(*) as count,
             ROUND(AVG((salary_monthly_min + salary_monthly_max) / 2.0)) as avg_salary
      FROM sp_job_enrichments WHERE company_industry IS NOT NULL
      GROUP BY company_industry ORDER BY count DESC
    `).all() as any[];

    // 职位分类 (L1)
    const categoryRows = await db.prepare(`
      SELECT job_category_l1 as name, COUNT(*) as count
      FROM sp_job_enrichments WHERE job_category_l1 IS NOT NULL
      GROUP BY job_category_l1 ORDER BY count DESC
    `).all() as any[];

    // 热门技能 Top 20
    const skillRows = await db.prepare(`
      SELECT key_skills FROM sp_job_enrichments WHERE key_skills IS NOT NULL
    `).all() as any[];
    const skillCount: Record<string, number> = {};
    skillRows.forEach((r: any) => {
      let skills = r.keySkills;
      if (typeof skills === 'string') {
        try { skills = JSON.parse(skills); } catch { skills = []; }
      }
      if (Array.isArray(skills)) {
        skills.forEach((s: string) => { if (s) skillCount[s] = (skillCount[s] || 0) + 1; });
      }
    });
    const topSkills = Object.entries(skillCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([name, count]) => ({ name, count }));

    // 工作模式分布
    const workModeRows = await db.prepare(`
      SELECT work_mode as name, COUNT(*) as count
      FROM sp_job_enrichments WHERE work_mode IS NOT NULL
      GROUP BY work_mode ORDER BY count DESC
    `).all() as any[];

    // 公司总数
    const companyCount = await db.prepare(`
      SELECT COUNT(DISTINCT company_name) as cnt FROM sp_jobs WHERE company_name IS NOT NULL
    `).get() as any;

    // 强制转换所有数值为 number（PG 驱动可能返回字符串）
    const num = (v: any) => Number(v) || 0;

    res.json({
      success: true,
      data: {
        summary: {
          totalJobs: num(totalResult?.cnt),
          totalTasks: num(totalResult?.tasks),
          totalCompanies: num(companyCount?.cnt),
          avgSalary: num(salarySummary?.avgSalary),
          maxSalary: num(salarySummary?.maxSalary),
          minSalary: num(salarySummary?.minSalary),
        },
        salaryDistribution: salaryBuckets.map(b => ({ ...b, count: num(b.count) })),
        cityDistribution: cityRows.map((r: any) => ({ name: r.city, count: num(r.cnt) })),
        educationDistribution: eduRows.map((r: any) => ({ name: r.name, count: num(r.count) })),
        experienceDistribution: experienceDistribution.map((r: any) => ({ ...r, count: num(r.count) })),
        industryDistribution: industryRows.map((r: any) => ({ name: r.name, count: num(r.count), avgSalary: num(r.avgSalary) })),
        categoryDistribution: categoryRows.map((r: any) => ({ name: r.name, count: num(r.count) })),
        topSkills: topSkills.map(s => ({ ...s, count: num(s.count) })),
        workModeDistribution: workModeRows.map((r: any) => ({ name: r.name, count: num(r.count) })),
      },
    } as ApiResponse);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message } as ApiResponse);
  }
}

// ==================== AI 全量洞察报告 ====================

export async function generateInsight(_req: Request, res: Response) {
  try {
    console.log('[DashboardController] 开始生成全量洞察报告...');
    const report = await generateAllInsights();
    res.json({ success: true, data: report } as ApiResponse);
  } catch (error: any) {
    console.error('[DashboardController] 全量洞察生成失败:', error.message);
    res.status(500).json({ success: false, error: error.message } as ApiResponse);
  }
}

export async function getInsightHistory(_req: Request, res: Response) {
  try {
    const reports = await getAllInsightsHistory();
    res.json({ success: true, data: reports } as ApiResponse);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message } as ApiResponse);
  }
}

export async function getInsightReportById(req: Request, res: Response) {
  try {
    const report = await getInsightsReport(req.params.reportId);
    if (!report) {
      return res.status(404).json({ success: false, error: '报告不存在' } as ApiResponse);
    }
    res.json({ success: true, data: report } as ApiResponse);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message } as ApiResponse);
  }
}

export async function downloadReportPdf(req: Request, res: Response) {
  try {
    const report = await getInsightsReport(req.params.reportId);
    if (!report) {
      return res.status(404).json({ success: false, error: '报告不存在' } as ApiResponse);
    }

    let sections: any[];
    try {
      sections = typeof report.content === 'string'
        ? JSON.parse(report.content)
        : report.content;
    } catch {
      sections = [{ heading: '报告内容', body: String(report.content) }];
    }

    // 构建 HTML 报告页面
    const sectionsHtml = sections.map((s: any, i: number) => `
      <div class="section">
        <h2>${i + 1}. ${s.heading || '章节'}</h2>
        <div class="body">${(s.body || '').replace(/\n/g, '<br>')}</div>
        ${s.key_insight ? `<div class="insight">💡 关键发现：${s.key_insight}</div>` : ''}
      </div>
    `).join('\n');

    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>${report.title}</title>
<style>
  body { font-family: "Microsoft YaHei", "PingFang SC", sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; color: #333; line-height: 1.8; }
  .cover { text-align: center; padding: 60px 0; border-bottom: 2px solid #667eea; margin-bottom: 40px; }
  .cover h1 { font-size: 28px; color: #667eea; margin: 0 0 16px; }
  .cover .meta { color: #909399; font-size: 14px; }
  .summary { background: linear-gradient(135deg, rgba(102,126,234,0.06), rgba(118,75,162,0.06)); padding: 20px 24px; border-radius: 8px; margin-bottom: 32px; border-left: 4px solid #667eea; }
  .summary h3 { color: #667eea; margin: 0 0 8px; }
  .section { margin-bottom: 28px; page-break-inside: avoid; }
  .section h2 { font-size: 18px; color: #303133; border-bottom: 1px solid #ebeef5; padding-bottom: 8px; margin-bottom: 12px; }
  .body { font-size: 14px; color: #4b5563; }
  .insight { background: #fdf6ec; padding: 10px 16px; border-radius: 6px; margin-top: 12px; font-size: 13px; color: #e6a23c; border-left: 3px solid #e6a23c; }
  .footer { text-align: center; color: #c0c4cc; font-size: 12px; margin-top: 40px; padding-top: 20px; border-top: 1px solid #ebeef5; }
</style>
</head>
<body>
<div class="cover">
  <h1>${report.title}</h1>
  <div class="meta">报告生成时间：${report.createdAt ? new Date(report.createdAt).toLocaleString('zh-CN') : ''} | 分析模型：${report.modelUsed || 'AI'}</div>
</div>
<div class="summary">
  <h3>📊 摘要</h3>
  <p>${report.summary || '暂无摘要'}</p>
</div>
${sectionsHtml}
<div class="footer">本报告由 AI 自动生成，数据来源为系统全量招聘数据 | 生成时间 ${new Date().toLocaleString('zh-CN')}</div>
</body>
</html>`;

    // 将 HTML 写入临时文件，用 Chrome 命令行直接生成 PDF（避免 puppeteer 版本兼容问题）
    const { execFile } = (await import('child_process'));
    const tmpDir = path.join(os.tmpdir(), 'pdf-report-' + Date.now());
    fs.mkdirSync(tmpDir, { recursive: true });
    const htmlFile = path.join(tmpDir, 'report.html');
    const pdfFile = path.join(tmpDir, 'report.pdf');
    fs.writeFileSync(htmlFile, html, 'utf-8');

    try {
      await new Promise<void>((resolve, reject) => {
        const chromePath = 'C:\\Users\\Administrator\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe';
        execFile(chromePath, [
          '--headless',
          '--disable-gpu',
          '--no-sandbox',
          '--print-to-pdf=' + pdfFile,
          '--no-pdf-header-footer',
          'file:///' + htmlFile.replace(/\\/g, '/'),
        ], { timeout: 30000 }, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      const pdfBuffer = fs.readFileSync(pdfFile);
      console.log('[DashboardController] PDF 生成成功，大小:', (pdfBuffer.length / 1024).toFixed(1), 'KB');

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(report.title)}.pdf"`);
      res.send(pdfBuffer);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  } catch (error: any) {
    console.error('[DashboardController] PDF 生成失败:', error.message);
    res.status(500).json({ success: false, error: error.message } as ApiResponse);
  }
}
