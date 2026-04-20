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
    
    // 2. 读取CSV文件
    const filePath = file.filepath;
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: '文件不存在'
      } as ApiResponse);
    }
    
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      return res.json({
        success: true,
        data: {
          totalRecords: 0,
          message: '文件为空'
        }
      } as ApiResponse);
    }
    
    // 3. 解析CSV头部和数据
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const records = lines.slice(1).map(line => {
      // 简单CSV解析（处理引号）
      const values: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim().replace(/^"|"$/g, ''));
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim().replace(/^"|"$/g, ''));
      
      const record: any = {};
      headers.forEach((header, index) => {
        record[header] = values[index] || '';
      });
      return record;
    });
    
    // 4. 统计分析
    const analysis: any = {
      totalRecords: records.length,
      headers: headers,
      fieldStats: {} as any
    };
    
    // 对每个字段进行统计
    headers.forEach(header => {
      const values = records.map(r => r[header]).filter(v => v && v !== '');
      const uniqueValues = new Set(values);
      
      analysis.fieldStats[header] = {
        totalCount: values.length,
        emptyCount: records.length - values.length,
        uniqueCount: uniqueValues.size,
        sampleValues: Array.from(uniqueValues).slice(0, 10) // 前10个唯一值作为示例
      };
      
      // 如果是数值型字段，计算统计信息
      const numericValues = values.map(v => parseFloat(v)).filter(v => !isNaN(v));
      if (numericValues.length > 0) {
        numericValues.sort((a, b) => a - b);
        analysis.fieldStats[header].min = numericValues[0];
        analysis.fieldStats[header].max = numericValues[numericValues.length - 1];
        analysis.fieldStats[header].avg = numericValues.reduce((a, b) => a + b, 0) / numericValues.length;
      }
      
      // 如果是分类字段（如城市、职位），计算频率分布
      if (uniqueValues.size <= 50 && uniqueValues.size > 1) {
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
          count
        }));
      }
    });
    
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

    // 🔧 关键修复: 使用csv-parser正确解析CSV,处理逗号、引号等特殊情况
    const records: any[] = [];
    let headers: string[] = [];
    
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
