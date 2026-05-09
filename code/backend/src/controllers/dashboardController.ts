import { Request, Response } from 'express';
import { db } from '../config/database';
import { ApiResponse } from '../types';

export async function overview(_req: Request, res: Response) {
  try {
    // 汇总统计
    const summary = await db.prepare(`
      SELECT
        COUNT(*) as total_jobs,
        COUNT(DISTINCT task_id) as total_tasks,
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
          totalJobs: num(summary?.totalJobs),
          totalTasks: num(summary?.totalTasks),
          totalCompanies: num(companyCount?.cnt),
          avgSalary: num(summary?.avgSalary),
          maxSalary: num(summary?.maxSalary),
          minSalary: num(summary?.minSalary),
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
