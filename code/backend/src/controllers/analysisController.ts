import { Request, Response } from 'express';
import { db } from '../config/database';
import { ApiResponse } from '../types';
import fs from 'fs';
import csv from 'csv-parser';

// 分析数据
export async function analyze(req: Request, res: Response) {
  try {
    const { fileId } = req.body;

    const file = await db.prepare('SELECT * FROM csv_files WHERE id = ?').get(fileId) as any;
    if (!file) {
      return res.status(404).json({
        success: false,
        error: '文件不存在'
      } as ApiResponse);
    }

    const results: any[] = [];
    const filePath = file.filepath;

    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', resolve)
        .on('error', reject);
    });

    // 基础统计
    const totalJobs = results.length;
    const cities = new Set(results.map(r => r['工作城市']));
    const companies = new Set(results.map(r => r['公司代码']));

    // 薪资统计
    const salaries = results
      .map(r => parseSalary(r['薪资范围']))
      .filter(s => s > 0);
    const avgSalary = salaries.length > 0
      ? (salaries.reduce((a, b) => a + b, 0) / salaries.length).toFixed(1)
      : 0;

    res.json({
      success: true,
      data: {
        totalJobs,
        cityCount: cities.size,
        companyCount: companies.size,
        avgSalary
      }
    } as ApiResponse);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    } as ApiResponse);
  }
}

// 薪资分布
export async function getSalaryDistribution(req: Request, res: Response) {
  try {
    const { fileId } = req.params;
    const file = await db.prepare('SELECT * FROM csv_files WHERE id = ?').get(fileId) as any;

    if (!file) {
      return res.status(404).json({
        success: false,
        error: '文件不存在'
      } as ApiResponse);
    }

    const results: any[] = [];
    await new Promise((resolve, reject) => {
      fs.createReadStream(file.filepath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', resolve)
        .on('error', reject);
    });

    // 薪资区间分布
    const distribution: Record<string, number> = {
      '5k以下': 0,
      '5-10k': 0,
      '10-15k': 0,
      '15-20k': 0,
      '20-30k': 0,
      '30k以上': 0
    };

    results.forEach(r => {
      const avg = parseSalary(r['薪资范围']);
      if (avg < 5) distribution['5k以下']++;
      else if (avg < 10) distribution['5-10k']++;
      else if (avg < 15) distribution['10-15k']++;
      else if (avg < 20) distribution['15-20k']++;
      else if (avg < 30) distribution['20-30k']++;
      else distribution['30k以上']++;
    });

    res.json({
      success: true,
      data: distribution
    } as ApiResponse);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    } as ApiResponse);
  }
}

// 城市分布
export async function getCityDistribution(req: Request, res: Response) {
  try {
    const { fileId } = req.params;
    const file = await db.prepare('SELECT * FROM csv_files WHERE id = ?').get(fileId) as any;

    if (!file) {
      return res.status(404).json({
        success: false,
        error: '文件不存在'
      } as ApiResponse);
    }

    const results: any[] = [];
    await new Promise((resolve, reject) => {
      fs.createReadStream(file.filepath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', resolve)
        .on('error', reject);
    });

    const cityCount: Record<string, number> = {};
    results.forEach(r => {
      const city = r['工作城市'] || '未知';
      cityCount[city] = (cityCount[city] || 0) + 1;
    });

    // 排序取TOP10
    const sorted = Object.entries(cityCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    res.json({
      success: true,
      data: sorted
    } as ApiResponse);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    } as ApiResponse);
  }
}

// 学历分布
export async function getEducationDistribution(req: Request, res: Response) {
  try {
    const { fileId } = req.params;
    const file = db.prepare('SELECT * FROM csv_files WHERE id = ?').get(fileId) as any;

    if (!file) {
      return res.status(404).json({
        success: false,
        error: '文件不存在'
      } as ApiResponse);
    }

    const results: any[] = [];
    await new Promise((resolve, reject) => {
      fs.createReadStream(file.filepath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', resolve)
        .on('error', reject);
    });

    const eduCount: Record<string, number> = {};
    results.forEach(r => {
      const edu = r['学历'] || '不限';
      eduCount[edu] = (eduCount[edu] || 0) + 1;
    });

    const sorted = Object.entries(eduCount)
      .map(([name, count]) => ({ name, count }));

    res.json({
      success: true,
      data: sorted
    } as ApiResponse);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    } as ApiResponse);
  }
}

// 经验分布
export async function getExperienceDistribution(req: Request, res: Response) {
  try {
    const { fileId } = req.params;
    const file = db.prepare('SELECT * FROM csv_files WHERE id = ?').get(fileId) as any;

    if (!file) {
      return res.status(404).json({
        success: false,
        error: '文件不存在'
      } as ApiResponse);
    }

    const results: any[] = [];
    await new Promise((resolve, reject) => {
      fs.createReadStream(file.filepath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', resolve)
        .on('error', reject);
    });

    const expCount: Record<string, number> = {};
    results.forEach(r => {
      const exp = r['工作经验'] || '不限';
      expCount[exp] = (expCount[exp] || 0) + 1;
    });

    const sorted = Object.entries(expCount)
      .map(([name, count]) => ({ name, count }));

    res.json({
      success: true,
      data: sorted
    } as ApiResponse);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    } as ApiResponse);
  }
}

// 解析薪资字符串，返回平均K值
function parseSalary(salaryStr: string): number {
  if (!salaryStr) return 0;

  // 匹配 "10-15k" "10K-15K" "10k-15k" 等格式
  const match = salaryStr.match(/(\d+)[kK]?[-~至](\d+)[kK]?/i);
  if (match) {
    return (parseInt(match[1]) + parseInt(match[2])) / 2;
  }

  // 匹配 "10k以上" 格式
  const match2 = salaryStr.match(/(\d+)[kK]以上/i);
  if (match2) {
    return parseInt(match2[1]);
  }

  return 0;
}
