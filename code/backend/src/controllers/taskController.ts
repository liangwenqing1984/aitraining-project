import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/database';
import { TaskConfig, Task, ApiResponse } from '../types';
import { TaskService } from '../services/taskService';
import { REGIONS } from '../config/constants';

const taskService = new TaskService();

// 创建任务
export async function createTask(req: Request, res: Response) {
  try {
    console.log('[TaskController] ========== 收到创建任务请求 ==========');
    console.log('[TaskController] 请求体:', JSON.stringify(req.body, null, 2));
    
    const config: TaskConfig = req.body;
    
    // 验证必要字段 - 数据来源
    if (!config.sites || !Array.isArray(config.sites) || config.sites.length === 0) {
      console.error('[TaskController] ❌ 验证失败: 未选择数据来源');
      return res.status(400).json({
        success: false,
        error: '请选择至少一个数据来源'
      } as ApiResponse);
    }
    
    // 检查是否有关键词（支持单个或多个）
    const hasKeywords = (config.keywords && Array.isArray(config.keywords) && config.keywords.length > 0) || 
                        (config.keyword && typeof config.keyword === 'string' && config.keyword.trim().length > 0);
    
    if (!hasKeywords) {
      console.error('[TaskController] ❌ 验证失败: 未提供关键词');
      console.error('[TaskController] config.keywords:', config.keywords);
      console.error('[TaskController] config.keyword:', config.keyword);
      return res.status(400).json({
        success: false,
        error: '请至少输入一个职位关键词，并点击"添加"按钮'
      } as ApiResponse);
    }
    
    // 生成任务ID
    const taskId = uuidv4();
    console.log('[TaskController] ✅ 生成任务ID:', taskId);

    // 创建任务记录
    const stmt = db.prepare(`
      INSERT INTO tasks (id, name, source, config, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);

    const source = config.sites.length > 1 ? 'all' : config.sites[0];
    const taskName = generateTaskName(config);
    
    console.log('[TaskController] 任务名称:', taskName);
    console.log('[TaskController] 数据来源:', source);
    console.log('[TaskController] 配置对象:', JSON.stringify(config, null, 2));

    const result = await stmt.run(taskId, taskName, source, JSON.stringify(config));
    console.log('[TaskController] ✅ 数据库插入结果:', result);

    // 任务创建为待执行状态，不立即开始爬取
    console.log('[TaskController] ✅ 任务创建成功，返回响应');
    console.log('[TaskController] ==========================================');

    res.json({
      success: true,
      data: { taskId, name: taskName }
    } as ApiResponse);
  } catch (error: any) {
    console.error('[TaskController] ❌❌❌ 创建任务失败:', error.message);
    console.error('[TaskController] 错误堆栈:', error.stack);
    console.error('[TaskController] 错误详情:', error);
    
    res.status(500).json({
      success: false,
      error: error.message || '服务器内部错误'
    } as ApiResponse);
  }
}

// 启动任务
export async function startTask(req: Request, res: Response) {
  try {
    const { id } = req.params;

    console.log('[TaskController] 启动任务, ID:', id);

    const task = await db.prepare('SELECT * FROM tasks WHERE id = $1').get(id) as Task;
    if (!task) {
      console.warn('[TaskController] 任务不存在, ID:', id);
      return res.status(404).json({
        success: false,
        error: '任务不存在'
      } as ApiResponse);
    }

    if (task.status === 'running') {
      console.warn('[TaskController] 任务已在运行中, ID:', id);
      return res.status(400).json({
        success: false,
        error: '任务已在运行中'
      } as ApiResponse);
    }

    // PostgreSQL的JSONB字段查询返回时已经是对象，不需要JSON.parse
    const config = typeof task.config === 'string' ? JSON.parse(task.config) : task.config;
    await taskService.startTask(id, config);

    console.log('[TaskController] 任务已启动, ID:', id);

    res.json({
      success: true,
      message: '任务已启动'
    } as ApiResponse);
  } catch (error: any) {
    console.error('[TaskController] ❌ 启动任务失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    } as ApiResponse);
  }
}

// 获取任务列表
export async function getTasks(req: Request, res: Response) {
  try {
    const { status, page = 1, pageSize = 10 } = req.query;
    const offset = (Number(page) - 1) * Number(pageSize);

    let sql = 'SELECT * FROM tasks';
    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      sql += ` WHERE status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    sql += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(Number(pageSize), offset);

    console.log('[TaskController] 查询任务列表 SQL:', sql);
    console.log('[TaskController] 查询参数:', params);

    const tasks = await db.prepare(sql).all(...params);
    
    console.log('[TaskController] 查询结果数量:', tasks?.length || 0);

    // 获取总数
    let countSql = 'SELECT COUNT(*) as total FROM tasks';
    const countParams: any[] = [];
    if (status) {
      countSql += ' WHERE status = $1';
      countParams.push(status);
    }
    
    const total = await db.prepare(countSql).get(...countParams) as { total: number };
    
    console.log('[TaskController] 总记录数:', total?.total || 0);

    res.json({
      success: true,
      data: {
        list: tasks || [],
        total: total?.total || 0,
        page: Number(page),
        pageSize: Number(pageSize)
      }
    } as ApiResponse);
  } catch (error: any) {
    console.error('[TaskController] ❌ 获取任务列表失败:', error.message);
    console.error('[TaskController] 错误堆栈:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message
    } as ApiResponse);
  }
}

// 获取任务详情
export async function getTask(req: Request, res: Response) {
  try {
    const { id } = req.params;
    
    console.log('[TaskController] 查询任务详情, ID:', id);
    
    const task = await db.prepare('SELECT * FROM tasks WHERE id = $1').get(id);

    if (!task) {
      console.warn('[TaskController] 任务不存在, ID:', id);
      return res.status(404).json({
        success: false,
        error: '任务不存在'
      } as ApiResponse);
    }
    
    console.log('[TaskController] 找到任务:', task.id, task.name);

    res.json({
      success: true,
      data: task
    } as ApiResponse);
  } catch (error: any) {
    console.error('[TaskController] ❌ 获取任务详情失败:', error.message);
    console.error('[TaskController] 错误堆栈:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message
    } as ApiResponse);
  }
}

// 停止任务
export async function stopTask(req: Request, res: Response) {
  try {
    const { id } = req.params;

    console.log('[TaskController] 停止任务, ID:', id);

    taskService.stopTask(id);

    await db.prepare(`
      UPDATE tasks SET status = 'stopped', end_time = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `).run(id);

    console.log('[TaskController] 任务已停止, ID:', id);

    res.json({
      success: true,
      message: '任务已停止'
    } as ApiResponse);
  } catch (error: any) {
    console.error('[TaskController] ❌ 停止任务失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    } as ApiResponse);
  }
}

// 暂停任务
export async function pauseTask(req: Request, res: Response) {
  try {
    const { id } = req.params;

    console.log('[TaskController] 暂停任务, ID:', id);

    taskService.pauseTask(id);

    await db.prepare(`
      UPDATE tasks SET status = 'paused', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `).run(id);

    console.log('[TaskController] 任务已暂停, ID:', id);

    res.json({
      success: true,
      message: '任务已暂停'
    } as ApiResponse);
  } catch (error: any) {
    console.error('[TaskController] ❌ 暂停任务失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    } as ApiResponse);
  }
}

// 恢复任务
export async function resumeTask(req: Request, res: Response) {
  try {
    const { id } = req.params;

    console.log('[TaskController] 恢复任务, ID:', id);

    const task = await db.prepare('SELECT * FROM tasks WHERE id = $1').get(id) as Task;
    if (!task) {
      console.warn('[TaskController] 任务不存在, ID:', id);
      return res.status(404).json({
        success: false,
        error: '任务不存在'
      } as ApiResponse);
    }

    const config = typeof task.config === 'string' ? JSON.parse(task.config) : task.config;
    taskService.resumeTask(id, config);

    await db.prepare(`
      UPDATE tasks SET status = 'running', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `).run(id);

    console.log('[TaskController] 任务已恢复, ID:', id);

    res.json({
      success: true,
      message: '任务已恢复'
    } as ApiResponse);
  } catch (error: any) {
    console.error('[TaskController] ❌ 恢复任务失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    } as ApiResponse);
  }
}

// 删除任务
export async function deleteTask(req: Request, res: Response) {
  try {
    const { id } = req.params;

    console.log('[TaskController] 删除任务, ID:', id);

    // 先停止正在运行的任务
    taskService.stopTask(id);

    // 删除数据库记录
    const result = await db.prepare('DELETE FROM tasks WHERE id = $1').run(id);
    
    console.log('[TaskController] 删除结果:', result);

    res.json({
      success: true,
      message: '任务已删除'
    } as ApiResponse);
  } catch (error: any) {
    console.error('[TaskController] ❌ 删除任务失败:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    } as ApiResponse);
  }
}

// 获取省市列表
export async function getRegions(req: Request, res: Response) {
  res.json({
    success: true,
    data: REGIONS
  } as ApiResponse);
}

// 生成任务名称
function generateTaskName(config: TaskConfig): string {
  const parts: string[] = [];

  if (config.sites.length > 0) {
    const siteNames = config.sites.map(s => s === 'zhilian' ? '智联' : '前程无忧');
    parts.push(siteNames.join('+'));
  }

  // 🔧 修改：去掉职位关键词，只保留城市信息
  if (config.city) {
    parts.push(config.city);
  } else if (config.province) {
    parts.push(config.province);
  }

  return parts.join(' - ') || '全部职位';
}
