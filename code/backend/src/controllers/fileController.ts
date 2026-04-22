import { Request, Response } from 'express';
import { db } from '../config/database';
import { ApiResponse } from '../types';
import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';

const csvDir = path.join(__dirname, '../../data/csv');

// 获取文件列表
export async function getFiles(req: Request, res: Response) {
  try {
    const { source, keyword, page = 1, pageSize = 10 } = req.query;
    const offset = (Number(page) - 1) * Number(pageSize);

    let sql = 'SELECT * FROM csv_files';
    const params: any[] = [];
    let paramIndex = 1;

    // 🔧 修复: 添加WHERE子句构建逻辑
    const conditions: string[] = [];
    
    if (source) {
      conditions.push(`source = $${paramIndex++}`);
      params.push(source);
    }
    
    if (keyword && typeof keyword === 'string') {
      conditions.push(`filename LIKE $${paramIndex++}`);
      params.push(`%${keyword}%`);
    }
    
    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    sql += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(Number(pageSize), offset);

    const files = await db.prepare(sql).all(...params);

    console.log('[FileController] Query result:', {
      type: Array.isArray(files) ? 'array' : typeof files,
      length: Array.isArray(files) ? files.length : 'N/A',
      value: files
    });

    // 获取总数
    let countSql = 'SELECT COUNT(*) as total FROM csv_files';
    const countParams: any[] = [];
    let countParamIndex = 1;
    
    const countConditions: string[] = [];
    if (source) {
      countConditions.push(`source = $${countParamIndex++}`);
      countParams.push(source);
    }
    if (keyword && typeof keyword === 'string') {
      countConditions.push(`filename LIKE $${countParamIndex++}`);
      countParams.push(`%${keyword}%`);
    }
    
    if (countConditions.length > 0) {
      countSql += ` WHERE ${countConditions.join(' AND ')}`;
    }
    
    const total = await db.prepare(countSql).get(...countParams) as { total: number };

    // 🔧 关键修复：确保list始终是数组
    const fileList = Array.isArray(files) ? files : [];

    res.json({
      success: true,
      data: {
        list: fileList,
        total: total?.total || 0,
        page: Number(page),
        pageSize: Number(pageSize)
      }
    } as ApiResponse);
  } catch (error: any) {
    console.error('[FileController] Get files error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    } as ApiResponse);
  }
}

// 获取文件详情
export async function getFile(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const file = await db.prepare('SELECT * FROM csv_files WHERE id = $1').get(id);

    if (!file) {
      return res.status(404).json({
        success: false,
        error: '文件不存在'
      } as ApiResponse);
    }

    res.json({
      success: true,
      data: file
    } as ApiResponse);
  } catch (error: any) {
    console.error('[FileController] Get file error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    } as ApiResponse);
  }
}

// 🔧 新增：根据taskId获取文件信息
export async function getFileByTaskId(req: Request, res: Response) {
  try {
    const { taskId } = req.params;
    const file = await db.prepare('SELECT * FROM csv_files WHERE task_id = $1 ORDER BY created_at DESC LIMIT 1').get(taskId);

    if (!file) {
      return res.status(404).json({
        success: false,
        error: '未找到该任务对应的文件'
      } as ApiResponse);
    }

    res.json({
      success: true,
      data: file
    } as ApiResponse);
  } catch (error: any) {
    console.error('[FileController] Get file by task ID error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    } as ApiResponse);
  }
}

// 🔧 新增：分析CSV文件数据
export async function analyzeCsvFile(req: Request, res: Response) {
  try {
    const { id } = req.params;
    
    // 1. 获取文件信息
    const file = await db.prepare('SELECT * FROM csv_files WHERE id = $1').get(id) as any;
    
    if (!file) {
      return res.status(404).json({
        success: false,
        error: '文件不存在'
      } as ApiResponse);
    }
    
    // 2. 读取文件(支持CSV和Excel双格式)
    const filePath = file.filepath;
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: '文件不存在'
      } as ApiResponse);
    }
    
    // 🔧 关键修复：根据文件扩展名选择解析器
    const isExcel = filePath.endsWith('.xlsx') || filePath.endsWith('.xls');
    const records: any[] = [];
    let headers: string[] = [];
    
    if (isExcel) {
      // 📊 Excel格式解析
      console.log(`[FileController] 检测到Excel文件，使用ExcelJS解析`);
      const ExcelJSModule = await import('exceljs');
      // 🔧 关键修复：ExcelJS动态导入后需要访问.default属性
      const ExcelJS = ExcelJSModule.default || ExcelJSModule;
      const workbook = new ExcelJS.Workbook();
      
      try {
        await workbook.xlsx.readFile(filePath);
        const worksheet = workbook.worksheets[0]; // 读取第一个工作表
        
        if (!worksheet) {
          return res.json({
            success: true,
            data: {
              totalRecords: 0,
              message: 'Excel文件为空'
            }
          } as ApiResponse);
        }
        
        // 提取表头（第1行）
        const headerRow = worksheet.getRow(1);
        headers = [];
        headerRow.eachCell((cell, colNumber) => {
          headers.push(String(cell.value || '').trim());
        });
        
        console.log(`[FileController] Excel表头解析完成: ${headers.length}个字段`, headers);
        
        // 提取数据行（第2行起）
        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return; // 跳过表头
          
          const record: any = {};
          headers.forEach((header, index) => {
            const cellValue = row.getCell(index + 1).value;
            record[header] = cellValue ? String(cellValue).trim() : '';
          });
          
          // 过滤全空行
          const hasData = Object.values(record).some(v => v && v !== '');
          if (hasData) {
            records.push(record);
          }
        });
        
        console.log(`[FileController] Excel数据解析完成: ${records.length}条记录`);
        
      } catch (error: any) {
        console.error('[FileController] Excel解析失败:', error);
        return res.status(500).json({
          success: false,
          error: `Excel文件解析失败: ${error.message}`
        } as ApiResponse);
      }
    } else {
      // 📄 CSV格式解析
      console.log(`[FileController] 检测到CSV文件，使用csv-parser解析`);
      
      await new Promise((resolve, reject) => {
        fs.createReadStream(filePath, { encoding: 'utf-8' })
          .pipe(csv())
          .on('headers', (headerList) => {
            headers = headerList;
            console.log(`[FileController] CSV表头解析完成: ${headers.length}个字段`, headers);
          })
          .on('data', (row) => {
            records.push(row);
          })
          .on('end', () => {
            console.log(`[FileController] CSV数据解析完成: ${records.length}条记录`);
            resolve(true);
          })
          .on('error', reject);
      });
    }
    
    if (records.length === 0) {
      return res.json({
        success: true,
        data: {
          totalRecords: 0,
          message: '文件为空'
        }
      } as ApiResponse);
    }
    
    // 🔧 详细诊断日志
    console.log(`[FileController] ========== 分析诊断 ==========`);
    console.log(`[FileController] 文件格式: ${isExcel ? 'Excel (.xlsx)' : 'CSV'}`);
    console.log(`[FileController] 文件路径: ${filePath}`);
    console.log(`[FileController] 总记录数: ${records.length}`);
    console.log(`[FileController] 字段数量: ${headers.length}`);
    console.log(`[FileController] 字段列表:`, headers);
    console.log(`[FileController] 第一条数据示例:`, records[0]);
    console.log(`[FileController] ======================================`);
    
    // 3. 深度统计分析
    const analysis: any = {
      totalRecords: records.length,
      headers: headers,
      fieldStats: {} as any,
      insights: [] as any[] // 智能洞察
    };
    
    // 对每个字段进行统计
    headers.forEach(header => {
      const values = records.map(r => r[header]).filter(v => v && v !== '');
      const uniqueValues = new Set(values);
      
      analysis.fieldStats[header] = {
        totalCount: values.length,
        emptyCount: records.length - values.length,
        uniqueCount: uniqueValues.size,
        sampleValues: Array.from(uniqueValues).slice(0, 10)
      };
      
      // 数值型字段统计（薪资）
      const numericValues = values.map(v => parseFloat(v)).filter(v => !isNaN(v));
      if (numericValues.length > 0) {
        numericValues.sort((a, b) => a - b);
        analysis.fieldStats[header].min = numericValues[0];
        analysis.fieldStats[header].max = numericValues[numericValues.length - 1];
        analysis.fieldStats[header].avg = numericValues.reduce((a, b) => a + b, 0) / numericValues.length;
        
        // 计算中位数
        const mid = Math.floor(numericValues.length / 2);
        analysis.fieldStats[header].median = numericValues.length % 2 === 0
          ? (numericValues[mid - 1] + numericValues[mid]) / 2
          : numericValues[mid];
        
        // 计算标准差
        const mean = analysis.fieldStats[header].avg;
        const variance = numericValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / numericValues.length;
        analysis.fieldStats[header].stdDev = Math.sqrt(variance);
      }
      
      // 分类字段频率分布（城市、职位、公司性质等）
      // 🔧 优化：提高阈值到200，确保企业性质、公司规模等字段能生成topValues
      if (uniqueValues.size <= 200 && uniqueValues.size > 1) {
        const frequency: any = {};
        values.forEach(v => {
          frequency[v] = (frequency[v] || 0) + 1;
        });
        
        // 按频率排序，取前20
        const sorted = Object.entries(frequency)
          .sort((a: any, b: any) => b[1] - a[1])
          .slice(0, 20);
        
        analysis.fieldStats[header].topValues = sorted.map(([value, count]) => ({
          value,
          count,
          percentage: ((count as number) / values.length * 100).toFixed(1)
        }));
      } else if (uniqueValues.size > 200) {
        console.warn(`[FileController] 字段 "${header}" 唯一值过多(${uniqueValues.size})，跳过topValues生成`);
      }
    });
    
    // 4. 特殊字段深度分析
    
    // 4.1 薪资分析（如果有薪资范围字段）
    const salaryField = headers.find(h => h.includes('薪资'));
    if (salaryField) {
      const salaryData = parseSalaryDistribution(records, salaryField);
      analysis.salaryAnalysis = salaryData;
      
      // 生成薪资洞察
      if (salaryData.avgSalary > 0) {
        analysis.insights.push({
          type: 'salary',
          icon: '💰',
          title: '平均薪资水平',
          content: `当前市场平均薪资为 ${salaryData.avgSalary.toFixed(0)} 元/月`,
          level: 'info'
        });
        
        if (salaryData.medianSalary > 0) {
          const diff = ((salaryData.avgSalary - salaryData.medianSalary) / salaryData.medianSalary * 100).toFixed(1);
          if (Math.abs(parseFloat(diff)) > 10) {
            analysis.insights.push({
              type: 'warning',
              icon: '⚠️',
              title: '薪资分布偏斜',
              content: `平均薪资比中位数${parseFloat(diff) > 0 ? '高' : '低'}${Math.abs(parseFloat(diff))}%，可能存在极端值`,
              level: 'warning'
            });
          }
        }
      }
    }
    
    // 4.2 城市分布分析
    const cityField = headers.find(h => h.includes('城市'));
    if (cityField && analysis.fieldStats[cityField]?.topValues) {
      const topCities = analysis.fieldStats[cityField].topValues.slice(0, 5);
      const totalCityJobs = topCities.reduce((sum: number, c: any) => sum + c.count, 0);
      const concentrationRate = (totalCityJobs / records.length * 100).toFixed(1);
      
      analysis.insights.push({
        type: 'city',
        icon: '🌆',
        title: '城市集中度',
        content: `TOP5城市集中了${concentrationRate}%的岗位，就业机会主要集中在这些地区`,
        level: 'info'
      });
    }
    
    // 4.3 经验要求分析
    const expField = headers.find(h => h.includes('经验'));
    if (expField && analysis.fieldStats[expField]?.topValues) {
      const expData = analysis.fieldStats[expField].topValues;
      const entryLevelJobs = expData.filter((e: any) => 
        e.value.includes('应届') || e.value.includes('无经验') || e.value.includes('1年')
      ).reduce((sum: number, e: any) => sum + e.count, 0);
      const entryLevelRate = (entryLevelJobs / records.length * 100).toFixed(1);
      
      analysis.insights.push({
        type: 'experience',
        icon: '📊',
        title: '入门友好度',
        content: `${entryLevelRate}%的岗位适合应届生或初级从业者`,
        level: parseFloat(entryLevelRate) > 30 ? 'success' : 'info'
      });
    }
    
    // 4.4 学历要求分析
    const eduField = headers.find(h => h.includes('学历'));
    if (eduField && analysis.fieldStats[eduField]?.topValues) {
      const eduData = analysis.fieldStats[eduField].topValues;
      const bachelorOrAbove = eduData.filter((e: any) => 
        e.value.includes('本科') || e.value.includes('硕士') || e.value.includes('博士')
      ).reduce((sum: number, e: any) => sum + e.count, 0);
      const highEduRate = (bachelorOrAbove / records.length * 100).toFixed(1);
      
      analysis.insights.push({
        type: 'education',
        icon: '🎓',
        title: '学历门槛',
        content: `${highEduRate}%的岗位要求本科及以上学历`,
        level: parseFloat(highEduRate) > 70 ? 'warning' : 'info'
      });
    }
    
    // 4.5 企业性质分析（优先精确匹配）
    let natureField: string | undefined = headers.find((h: string) => h === '公司性质')
    if (!natureField) {
      natureField = headers.find((h: string) => h.includes('性质'))
    }
    
    if (natureField && analysis.fieldStats[natureField]?.topValues) {
      const natureData = analysis.fieldStats[natureField].topValues;
      console.log(`[FileController] 企业性质分析: 找到${natureData.length}种类型`);
      analysis.companyNatureAnalysis = natureData;
    } else {
      console.warn(`[FileController] 企业性质分析: 未找到数据`, { 
        natureField, 
        hasTopValues: natureField ? !!analysis.fieldStats[natureField]?.topValues : false 
      });
    }
    
    // 4.6 公司规模分析（优先精确匹配）
    let scaleField: string | undefined = headers.find((h: string) => h === '公司规模')
    if (!scaleField) {
      scaleField = headers.find((h: string) => h.includes('规模'))
    }
    
    if (scaleField && analysis.fieldStats[scaleField]?.topValues) {
      const scaleData = analysis.fieldStats[scaleField].topValues;
      console.log(`[FileController] 公司规模分析: 找到${scaleData.length}种类型`);
      analysis.companyScaleAnalysis = scaleData;
    } else {
      console.warn(`[FileController] 公司规模分析: 未找到数据`, { 
        scaleField, 
        hasTopValues: scaleField ? !!analysis.fieldStats[scaleField]?.topValues : false 
      });
    }
    
    // 5. 综合评分
    analysis.overallScore = calculateOverallScore(analysis);
    
    res.json({
      success: true,
      data: analysis
    } as ApiResponse);
  } catch (error: any) {
    console.error('[FileController] Analyze CSV error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    } as ApiResponse);
  }
}

// 辅助函数：解析薪资分布
function parseSalaryDistribution(records: any[], salaryField: string) {
  const salaries: number[] = [];
  
  records.forEach(record => {
    const salaryText = record[salaryField];
    if (!salaryText) return;
    
    // 尝试解析各种薪资格式
    const parsed = parseSalary(salaryText);
    if (parsed > 0) {
      salaries.push(parsed);
    }
  });
  
  if (salaries.length === 0) {
    return { avgSalary: 0, medianSalary: 0, distribution: [] };
  }
  
  salaries.sort((a, b) => a - b);
  
  // 计算平均值和中位数
  const avgSalary = salaries.reduce((a, b) => a + b, 0) / salaries.length;
  const mid = Math.floor(salaries.length / 2);
  const medianSalary = salaries.length % 2 === 0
    ? (salaries[mid - 1] + salaries[mid]) / 2
    : salaries[mid];
  
  // 生成分布区间
  const ranges = [
    { label: '5K以下', min: 0, max: 5000, count: 0 },
    { label: '5K-10K', min: 5000, max: 10000, count: 0 },
    { label: '10K-15K', min: 10000, max: 15000, count: 0 },
    { label: '15K-20K', min: 15000, max: 20000, count: 0 },
    { label: '20K-30K', min: 20000, max: 30000, count: 0 },
    { label: '30K以上', min: 30000, max: Infinity, count: 0 }
  ];
  
  salaries.forEach(salary => {
    const range = ranges.find(r => salary >= r.min && salary < r.max);
    if (range) range.count++;
  });
  
  return {
    avgSalary,
    medianSalary,
    distribution: ranges.map(r => ({
      ...r,
      percentage: ((r.count / salaries.length) * 100).toFixed(1)
    }))
  };
}

// 辅助函数：解析单个薪资金额
function parseSalary(salaryText: string): number {
  if (!salaryText) return 0;
  
  // 匹配 "10K-15K"、"10000-15000"、"10-15K" 等格式
  const match = salaryText.match(/(\d+\.?\d*)\s*[Kk万]?[-~至到]\s*(\d+\.?\d*)\s*[Kk万]?/);
  if (match) {
    let min = parseFloat(match[1]);
    let max = parseFloat(match[2]);
    
    // 处理单位
    if (salaryText.includes('K') || salaryText.includes('k')) {
      min *= 1000;
      max *= 1000;
    } else if (salaryText.includes('万')) {
      min *= 10000;
      max *= 10000;
    }
    
    return (min + max) / 2; // 返回平均值
  }
  
  // 匹配单个数字
  const singleMatch = salaryText.match(/(\d+\.?\d*)\s*[Kk万]?/);
  if (singleMatch) {
    let value = parseFloat(singleMatch[1]);
    if (salaryText.includes('K') || salaryText.includes('k')) {
      value *= 1000;
    } else if (salaryText.includes('万')) {
      value *= 10000;
    }
    return value;
  }
  
  return 0;
}

// 辅助函数：计算综合评分
function calculateOverallScore(analysis: any): number {
  let score = 0;
  let factors = 0;
  
  // 数据完整性（20分）
  const totalFields = analysis.headers.length;
  const nonEmptyFields = Object.values(analysis.fieldStats).filter((f: any) => f.totalCount > 0).length;
  score += (nonEmptyFields / totalFields) * 20;
  factors += 20;
  
  // 薪资数据质量（20分）
  if (analysis.salaryAnalysis?.avgSalary > 0) {
    score += 20;
  }
  factors += 20;
  
  // 数据量（20分）
  if (analysis.totalRecords > 1000) {
    score += 20;
  } else if (analysis.totalRecords > 500) {
    score += 15;
  } else if (analysis.totalRecords > 100) {
    score += 10;
  } else {
    score += 5;
  }
  factors += 20;
  
  // 城市多样性（20分）
  const cityField = analysis.headers.find((h: string) => h.includes('城市'));
  if (cityField && analysis.fieldStats[cityField]?.uniqueCount > 10) {
    score += 20;
  } else if (cityField && analysis.fieldStats[cityField]?.uniqueCount > 5) {
    score += 15;
  } else if (cityField) {
    score += 10;
  }
  factors += 20;
  
  // 职位多样性（20分）
  const jobField = analysis.headers.find((h: string) => h.includes('职位'));
  if (jobField && analysis.fieldStats[jobField]?.uniqueCount > 50) {
    score += 20;
  } else if (jobField && analysis.fieldStats[jobField]?.uniqueCount > 20) {
    score += 15;
  } else if (jobField) {
    score += 10;
  }
  factors += 20;
  
  return Math.round((score / factors) * 100);
}

// 下载文件
export async function downloadFile(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const file = await db.prepare('SELECT * FROM csv_files WHERE id = $1').get(id) as any;

    if (!file) {
      return res.status(404).json({
        success: false,
        error: '文件不存在'
      } as ApiResponse);
    }

    const filePath = file.filepath;
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: '文件不存在'
      } as ApiResponse);
    }

    res.download(filePath, file.filename);
  } catch (error: any) {
    console.error('[FileController] Download file error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    } as ApiResponse);
  }
}

// 预览文件
export async function previewFile(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { rows = 100 } = req.query;

    const file = await db.prepare('SELECT * FROM csv_files WHERE id = $1').get(id) as any;

    if (!file) {
      return res.status(404).json({
        success: false,
        error: '文件不存在'
      } as ApiResponse);
    }

    const filePath = file.filepath;
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: '文件不存在'
      } as ApiResponse);
    }

    // 🔧 关键修复：根据文件扩展名选择解析器，支持CSV和Excel双格式
    const isExcel = filePath.endsWith('.xlsx') || filePath.endsWith('.xls');
    const records: any[] = [];
    let headers: string[] = [];
    
    if (isExcel) {
      // 📊 Excel格式解析
      console.log(`[FileController] 预览Excel文件，使用ExcelJS解析`);
      const ExcelJSModule = await import('exceljs');
      // 🔧 关键修复：ExcelJS动态导入后需要访问.default属性
      const ExcelJS = ExcelJSModule.default || ExcelJSModule;
      const workbook = new ExcelJS.Workbook();
      
      try {
        await workbook.xlsx.readFile(filePath);
        const worksheet = workbook.worksheets[0]; // 读取第一个工作表
        
        if (!worksheet) {
          return res.json({
            success: true,
            data: {
              headers: [],
              rows: []
            }
          } as ApiResponse);
        }
        
        // 提取表头（第1行）
        const headerRow = worksheet.getRow(1);
        headers = [];
        headerRow.eachCell((cell, colNumber) => {
          headers.push(String(cell.value || '').trim());
        });
        
        // 提取数据行（第2行起），限制预览行数
        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return; // 跳过表头
          if (records.length >= Number(rows)) return; // 限制预览行数
          
          const record: any = {};
          headers.forEach((header, index) => {
            const cellValue = row.getCell(index + 1).value;
            record[header] = cellValue ? String(cellValue).trim() : '';
          });
          
          // 过滤全空行
          const hasData = Object.values(record).some(v => v && v !== '');
          if (hasData) {
            records.push(record);
          }
        });
      } catch (error: any) {
        console.error('[FileController] Excel预览解析失败:', error);
        return res.status(500).json({
          success: false,
          error: `Excel文件预览失败: ${error.message}`
        } as ApiResponse);
      }
    } else {
      // 📄 CSV格式解析
      console.log(`[FileController] 预览CSV文件，使用csv-parser解析`);
      
      await new Promise((resolve, reject) => {
        fs.createReadStream(filePath, { encoding: 'utf-8' })
          .pipe(csv())
          .on('headers', (headerList) => {
            headers = headerList;
          })
          .on('data', (row) => {
            if (records.length < Number(rows)) {
              records.push(row);
            }
          })
          .on('end', () => {
            resolve(true);
          })
          .on('error', (error) => {
            reject(error);
          });
      });
    }

    console.log(`[FileController] Preview: parsed ${records.length} records with headers:`, headers);

    res.json({
      success: true,
      data: {
        headers,
        rows: records.map(record => headers.map(header => record[header] || ''))
      }
    } as ApiResponse);
  } catch (error: any) {
    console.error('[FileController] Preview file error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    } as ApiResponse);
  }
}

// 删除文件
export async function deleteFile(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const file = await db.prepare('SELECT * FROM csv_files WHERE id = $1').get(id) as any;

    if (file && fs.existsSync(file.filepath)) {
      fs.unlinkSync(file.filepath);
    }

    await db.prepare('DELETE FROM csv_files WHERE id = $1').run(id);

    res.json({
      success: true,
      message: '文件已删除'
    } as ApiResponse);
  } catch (error: any) {
    console.error('[FileController] Delete file error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    } as ApiResponse);
  }
}

// 批量删除
export async function batchDelete(req: Request, res: Response) {
  try {
    const { ids } = req.body;

    for (const id of ids) {
      const file = await db.prepare('SELECT * FROM csv_files WHERE id = $1').get(id) as any;
      if (file && fs.existsSync(file.filepath)) {
        fs.unlinkSync(file.filepath);
      }
      await db.prepare('DELETE FROM csv_files WHERE id = $1').run(id);
    }

    res.json({
      success: true,
      message: `已删除 ${ids.length} 个文件`
    } as ApiResponse);
  } catch (error: any) {
    console.error('[FileController] Batch delete error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    } as ApiResponse);
  }
}
