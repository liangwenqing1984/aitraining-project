import { Request, Response } from 'express';
import { db } from '../config/database';
import { ApiResponse } from '../types';

// 获取任务ID对应的 sp_jobs 原始数据
async function getJobDataByFileId(fileId: string): Promise<{ taskId: string; rows: any[] }> {
  const file = await db.prepare('SELECT * FROM sp_csv_files WHERE id = ?').get(fileId) as any;
  if (!file) {
    throw new Error('文件不存在');
  }
  const rows = await db.prepare(
    'SELECT * FROM sp_jobs WHERE task_id = ?'
  ).all(file.taskId || file.task_id) as any[];
  return { taskId: file.taskId || file.task_id, rows };
}

// 从 sp_jobs raw_data JSONB 提取英文字段或使用顶层列
function getField(row: any, topLevelKey: string, rawDataKey: string): string {
  // 先查顶层列
  const topVal = row[topLevelKey];
  if (topVal && String(topVal).trim()) return String(topVal);
  // 再查 raw_data
  try {
    const raw = typeof row.rawData === 'object' ? row.rawData :
      (typeof row.rawData === 'string' ? JSON.parse(row.rawData || '{}') : {});
    const rawVal = raw[rawDataKey];
    if (rawVal && String(rawVal).trim()) return String(rawVal);
  } catch {}
  return '';
}

// 分析数据
export async function analyze(req: Request, res: Response) {
  try {
    const { fileId } = req.body;
    const { rows } = await getJobDataByFileId(fileId);

    const totalJobs = rows.length;
    const cities = new Set(rows.map((r: any) => getField(r, 'workCity', 'workCity') || getField(r, 'work_city', 'workCity')).filter(Boolean));
    const companies = new Set(rows.map((r: any) => getField(r, 'companyName', 'companyName') || getField(r, 'company_name', 'companyName')).filter(Boolean));

    const salaries = rows
      .map((r: any) => parseSalary(getField(r, 'salaryRange', 'salaryRange') || getField(r, 'salary_range', 'salaryRange')))
      .filter((s: number) => s > 0);
    const avgSalary = salaries.length > 0
      ? (salaries.reduce((a: number, b: number) => a + b, 0) / salaries.length).toFixed(1)
      : 0;

    res.json({ success: true, data: { totalJobs, cityCount: cities.size, companyCount: companies.size, avgSalary } } as ApiResponse);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message } as ApiResponse);
  }
}

// 薪资分布
export async function getSalaryDistribution(req: Request, res: Response) {
  try {
    const { fileId } = req.params;
    const { rows } = await getJobDataByFileId(fileId);

    const distribution: Record<string, number> = {
      '5k以下': 0, '5-10k': 0, '10-15k': 0, '15-20k': 0, '20-30k': 0, '30k以上': 0
    };

    rows.forEach((r: any) => {
      const avg = parseSalary(getField(r, 'salaryRange', 'salaryRange') || getField(r, 'salary_range', 'salaryRange'));
      if (avg <= 0) return;
      if (avg < 5) distribution['5k以下']++;
      else if (avg < 10) distribution['5-10k']++;
      else if (avg < 15) distribution['10-15k']++;
      else if (avg < 20) distribution['15-20k']++;
      else if (avg < 30) distribution['20-30k']++;
      else distribution['30k以上']++;
    });

    res.json({ success: true, data: distribution } as ApiResponse);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message } as ApiResponse);
  }
}

// 城市分布
export async function getCityDistribution(req: Request, res: Response) {
  try {
    const { fileId } = req.params;
    const { rows } = await getJobDataByFileId(fileId);

    const cityCount: Record<string, number> = {};
    rows.forEach((r: any) => {
      const city = getField(r, 'workCity', 'workCity') || getField(r, 'work_city', 'workCity') || '未知';
      cityCount[city] = (cityCount[city] || 0) + 1;
    });

    const sorted = Object.entries(cityCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    res.json({ success: true, data: sorted } as ApiResponse);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message } as ApiResponse);
  }
}

// 学历分布
export async function getEducationDistribution(req: Request, res: Response) {
  try {
    const { fileId } = req.params;
    const { rows } = await getJobDataByFileId(fileId);

    const eduCount: Record<string, number> = {};
    rows.forEach((r: any) => {
      const edu = getField(r, 'education', 'education') || '不限';
      eduCount[edu] = (eduCount[edu] || 0) + 1;
    });

    const sorted = Object.entries(eduCount).map(([name, count]) => ({ name, count }));

    res.json({ success: true, data: sorted } as ApiResponse);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message } as ApiResponse);
  }
}

// 经验分布
export async function getExperienceDistribution(req: Request, res: Response) {
  try {
    const { fileId } = req.params;
    const { rows } = await getJobDataByFileId(fileId);

    const expCount: Record<string, number> = {};
    rows.forEach((r: any) => {
      const exp = getField(r, 'workExperience', 'workExperience') || getField(r, 'work_experience', 'workExperience') || '不限';
      expCount[exp] = (expCount[exp] || 0) + 1;
    });

    const sorted = Object.entries(expCount).map(([name, count]) => ({ name, count }));

    res.json({ success: true, data: sorted } as ApiResponse);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message } as ApiResponse);
  }
}

// 解析薪资字符串，返回平均K值
function parseSalary(salaryStr: string): number {
  if (!salaryStr) return 0;

  const match = salaryStr.match(/(\d+)[kK]?[-~至](\d+)[kK]?/i);
  if (match) {
    return (parseInt(match[1]) + parseInt(match[2])) / 2;
  }

  const match2 = salaryStr.match(/(\d+)[kK]以上/i);
  if (match2) {
    return parseInt(match2[1]);
  }

  return 0;
}
