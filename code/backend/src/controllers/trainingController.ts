import { Request, Response } from 'express';
import { db } from '../config/database';
import { buildTrainingDataset, listDatasets, previewDataset } from '../services/llm/trainingData';
import { ChildProcess, spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

// 跟踪运行中的训练进程，支持停止操作
const runningProcesses = new Map<number, ChildProcess>();

/**
 * POST /api/training/dataset/build
 */
export async function buildDataset(req: Request, res: Response) {
  try {
    const { taskIds, positiveStrategy } = req.body;
    if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
      return res.status(400).json({ success: false, error: '请选择至少一个任务' });
    }

    const result = await buildTrainingDataset({ taskIds, positiveStrategy });
    res.json({ success: true, data: result });
  } catch (e: any) {
    console.error('[Training] buildDataset error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
}

/**
 * GET /api/training/dataset/list
 */
export async function listDatasetsHandler(_req: Request, res: Response) {
  try {
    const datasets = listDatasets();
    res.json({ success: true, data: datasets });
  } catch (e: any) {
    console.error('[Training] listDatasets error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
}

/**
 * GET /api/training/dataset/:id/preview
 */
export async function previewDatasetHandler(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const filePath = path.resolve(__dirname, '../../data/training', id);
    const samples = previewDataset(filePath);
    res.json({ success: true, data: { samples } });
  } catch (e: any) {
    console.error('[Training] previewDataset error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
}

/**
 * POST /api/training/start
 */
export async function startTraining(req: Request, res: Response) {
  try {
    const { datasetPath, baseModel, params } = req.body;
    if (!datasetPath || !baseModel) {
      return res.status(400).json({ success: false, error: '缺少必要参数: datasetPath, baseModel' });
    }

    const trainingParams = {
      epochs: params?.epochs || 3,
      batchSize: params?.batchSize || 16,
      learningRate: params?.learningRate || 2e-5,
    };

    // 创建训练任务记录
    const insertResult = await db.prepare(`
      INSERT INTO sp_training_jobs (name, dataset_config, base_model, params, status, dataset_path, log)
      VALUES ($1, $2, $3, $4, 'running', $5, '')
      RETURNING id
    `).get(
      `训练_${new Date().toISOString().slice(0, 19)}`,
      JSON.stringify({}),
      baseModel,
      JSON.stringify(trainingParams),
      datasetPath,
    ) as any;

    const jobId = insertResult?.id;

    // 预先写入 model_output_path，确保删除任务时能清理对应的模型文件目录
    const modelOutputDir = path.resolve(__dirname, '../../data/models', `model_${jobId}`);
    await db.prepare(
      'UPDATE sp_training_jobs SET model_output_path = $1 WHERE id = $2'
    ).run(modelOutputDir, jobId);

    // 异步启动 Python 训练
    res.json({ success: true, data: { jobId, status: 'running', message: '训练任务已启动' } });

    // 后台执行训练
    runPythonTraining(jobId, datasetPath, baseModel, trainingParams)
      .catch(e => {
        console.error(`[Training] 任务 ${jobId} 异常:`, e.message);
        db.prepare(
          'UPDATE sp_training_jobs SET status = $1, log = COALESCE(log, \'\') || $2, finished_at = CURRENT_TIMESTAMP WHERE id = $3'
        ).run('failed', `\n异常: ${e.message}`, jobId);
      });
  } catch (e: any) {
    console.error('[Training] startTraining error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
}

async function runPythonTraining(
  jobId: number, datasetPath: string, baseModel: string, params: any
): Promise<void> {
  const modelOutputDir = path.resolve(__dirname, '../../data/models', `model_${jobId}`);
  fs.mkdirSync(modelOutputDir, { recursive: true });

  // 检查 Python 是否可用
  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
  const scriptPath = path.resolve(__dirname, '../../scripts/train_embedding.py');

  const args = [
    scriptPath,
    '--dataset', datasetPath,
    '--base-model', baseModel,
    '--output', modelOutputDir,
    '--epochs', String(params.epochs),
    '--batch-size', String(params.batchSize),
    '--lr', String(params.learningRate),
  ];

  console.log(`[Training] 启动 Python: ${pythonCmd} ${args.join(' ')}`);

  const env = {
    ...process.env,
    HF_ENDPOINT: process.env.HF_ENDPOINT || 'https://hf-mirror.com',
    HF_HUB_ENABLE_HF_XET: '0',
  };

  const child = spawn(pythonCmd, args, {
    cwd: path.resolve(__dirname, '../..'),
    env,
  });

  runningProcesses.set(jobId, child);

  let log = '';
  let lastProgress = 0;
  let logDirty = false;

  // 清理 tqdm 进度条字符和回车控制符，避免日志乱码
  function sanitizeLog(text: string): string {
    return text
      .replace(/\r/g, '\n')           // tqdm 回车 → 换行
      .replace(/[▀-▟]+/g, '') // 删除 Unicode 块字符（▀ ▄ █ ▌ 等）
      .replace(/\|[\s\d/]*\|\s*\d+\/\d+\s*\[[\d<>,?its ]+\]/g, '') // 删除 tqdm 进度条
      .replace(/\n{3,}/g, '\n\n');     // 压缩多余空行
  }

  // 每隔 2 秒把最新日志刷入 DB，避免只有 PROGRESS 行才更新
  const logTimer = setInterval(() => {
    if (logDirty) {
      logDirty = false;
      db.prepare(
        'UPDATE sp_training_jobs SET progress = $1, log = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3'
      ).run(lastProgress, sanitizeLog(log), jobId).catch(() => {});
    }
  }, 2000);

  child.stdout.on('data', (data: Buffer) => {
    const text = data.toString();
    log += text;
    logDirty = true;

    // 解析 PROGRESS:xx 行
    const progressMatch = text.match(/PROGRESS:(\d+(?:\.\d+)?)/);
    if (progressMatch) {
      lastProgress = parseFloat(progressMatch[1]);
      // 进度更新立即刷入 DB
      db.prepare(
        'UPDATE sp_training_jobs SET progress = $1, log = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3'
      ).run(lastProgress, sanitizeLog(log), jobId).catch(() => {});
      logDirty = false;
    }
  });

  child.stderr.on('data', (data: Buffer) => {
    log += data.toString();
    logDirty = true;
  });

  const exitCode = await new Promise<number>((resolve) => {
    child.on('close', resolve);
  });

  clearInterval(logTimer);
  runningProcesses.delete(jobId);

  // 最后一次性刷入完整日志
  await db.prepare(
    'UPDATE sp_training_jobs SET progress = $1, log = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3'
  ).run(lastProgress, sanitizeLog(log), jobId).catch(() => {});

  if (exitCode === 0) {
    // 读取 metrics.json
    let metrics = {};
    try {
      const metricsPath = path.join(modelOutputDir, 'metrics.json');
      if (fs.existsSync(metricsPath)) {
        metrics = JSON.parse(fs.readFileSync(metricsPath, 'utf-8'));
      }
    } catch {}

    await db.prepare(`
      UPDATE sp_training_jobs
      SET status = $1, progress = 100, metrics = $2, model_output_path = $3,
          log = $4, finished_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
    `).run('completed', JSON.stringify(metrics), modelOutputDir, log, jobId);

    console.log(`[Training] 任务 ${jobId} 训练完成: ${modelOutputDir}`);
  } else {
    await db.prepare(`
      UPDATE sp_training_jobs
      SET status = $1, log = $2, finished_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `).run('failed', log, jobId);

    console.error(`[Training] 任务 ${jobId} 训练失败 (exitCode=${exitCode})`);
  }
}

/**
 * GET /api/training/status/:id
 */
export async function getTrainingStatus(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const row = await db.prepare(
      'SELECT * FROM sp_training_jobs WHERE id = $1'
    ).get(id) as any;

    if (!row) {
      return res.status(404).json({ success: false, error: '训练任务不存在' });
    }

    res.json({
      success: true,
      data: {
        ...row,
        metrics: typeof row.metrics === 'string' ? JSON.parse(row.metrics) : row.metrics,
        params: typeof row.params === 'string' ? JSON.parse(row.params) : row.params,
      },
    });
  } catch (e: any) {
    console.error('[Training] getTrainingStatus error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
}

/**
 * GET /api/training/list
 */
export async function listTrainingJobs(req: Request, res: Response) {
  try {
    const { page = '1', pageSize = '10' } = req.query;
    const pg = Math.max(1, parseInt(page as string) || 1);
    const ps = Math.min(50, Math.max(1, parseInt(pageSize as string) || 10));
    const offset = (pg - 1) * ps;

    const countRow = await db.prepare(
      'SELECT COUNT(*) as total FROM sp_training_jobs'
    ).get() as any;

    const rows = await db.prepare(
      'SELECT * FROM sp_training_jobs ORDER BY created_at DESC LIMIT $1 OFFSET $2'
    ).all(ps, offset) as any[];

    res.json({
      success: true,
      data: {
        list: rows.map(r => ({
          ...r,
          metrics: typeof r.metrics === 'string' ? JSON.parse(r.metrics) : r.metrics,
          params: typeof r.params === 'string' ? JSON.parse(r.params) : r.params,
        })),
        total: Number(countRow?.total) || 0,
        page: pg,
        pageSize: ps,
      },
    });
  } catch (e: any) {
    console.error('[Training] listTrainingJobs error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
}

/**
 * POST /api/training/:id/stop
 */
export async function stopTraining(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, error: '缺少任务ID' });
    }

    const child = runningProcesses.get(id);
    if (!child) {
      return res.status(404).json({ success: false, error: '该任务未在运行或已结束' });
    }

    const pid = child.pid;
    if (pid) {
      try {
        if (process.platform === 'win32') {
          spawn('taskkill', ['/PID', String(pid), '/T', '/F']);
        } else {
          process.kill(-pid, 'SIGTERM');
        }
      } catch {}
    }

    child.kill('SIGTERM');
    runningProcesses.delete(id);

    await db.prepare(
      'UPDATE sp_training_jobs SET status = $1, finished_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $2'
    ).run('stopped', id);

    console.log(`[Training] 任务 ${id} 已被用户停止`);
    res.json({ success: true, data: { message: '训练已停止' } });
  } catch (e: any) {
    console.error('[Training] stopTraining error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
}

/**
 * DELETE /api/training/:id
 */
export async function deleteTrainingJob(req: Request, res: Response) {
  try {
    const { id } = req.params;

    // 查询关联文件路径
    const row = await db.prepare(
      'SELECT model_output_path, dataset_path FROM sp_training_jobs WHERE id = $1'
    ).get(id) as any;

    if (row?.model_output_path && fs.existsSync(row.model_output_path)) {
      fs.rmSync(row.model_output_path, { recursive: true, force: true });
    }

    const result = await db.prepare(
      'DELETE FROM sp_training_jobs WHERE id = $1'
    ).run(id);

    res.json({ success: true, data: { deleted: result.changes > 0 } });
  } catch (e: any) {
    console.error('[Training] deleteTrainingJob error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
}

/**
 * GET /api/training/models
 * 列出已训练完成的模型 + Ollama 可用模型
 */
export async function listModels(_req: Request, res: Response) {
  try {
    const modelsDir = path.resolve(__dirname, '../../data/models');
    const models: any[] = [];

    if (fs.existsSync(modelsDir)) {
      const dirs = fs.readdirSync(modelsDir, { withFileTypes: true })
        .filter(d => d.isDirectory());

      for (const d of dirs) {
        const modelPath = path.join(modelsDir, d.name);
        const metricsPath = path.join(modelPath, 'metrics.json');
        let metrics = {};
        if (fs.existsSync(metricsPath)) {
          try { metrics = JSON.parse(fs.readFileSync(metricsPath, 'utf-8')); } catch {}
        }
        const stat = fs.statSync(modelPath);
        const createdAt = stat.birthtime || stat.mtime;
        models.push({
          name: d.name,
          path: modelPath,
          metrics,
          hasModelfile: fs.existsSync(path.join(modelPath, 'Modelfile')),
          createdAt: createdAt.toISOString().replace('T', ' ').slice(0, 19),
        });
      }
    }

    res.json({ success: true, data: models });
  } catch (e: any) {
    console.error('[Training] listModels error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
}

/**
 * DELETE /api/training/models/:name
 * 直接删除模型目录（用于清理孤儿模型文件）
 */
export async function deleteModel(req: Request, res: Response) {
  try {
    const { name } = req.params;
    if (!name) {
      return res.status(400).json({ success: false, error: '缺少模型名称' });
    }

    const modelsDir = path.resolve(__dirname, '../../data/models');
    const modelPath = path.join(modelsDir, name);

    // 安全检查：确保路径在 modelsDir 内，防止目录穿越
    if (!modelPath.startsWith(modelsDir)) {
      return res.status(403).json({ success: false, error: '非法路径' });
    }

    if (!fs.existsSync(modelPath)) {
      return res.status(404).json({ success: false, error: '模型目录不存在' });
    }

    fs.rmSync(modelPath, { recursive: true, force: true });
    console.log(`[Training] 模型目录已删除: ${modelPath}`);

    res.json({ success: true, data: { deleted: true } });
  } catch (e: any) {
    console.error('[Training] deleteModel error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
}

/**
 * POST /api/training/models/deploy
 * 部署模型到 Ollama
 */
export async function deployModel(req: Request, res: Response) {
  try {
    const { modelPath, modelName } = req.body;
    if (!modelPath || !modelName) {
      return res.status(400).json({ success: false, error: '缺少 modelPath 或 modelName' });
    }

    const modelfilePath = path.join(modelPath, 'Modelfile');
    if (!fs.existsSync(modelfilePath)) {
      return res.status(400).json({ success: false, error: `Modelfile 不存在: ${modelfilePath}` });
    }

    const modelfileContent = fs.readFileSync(modelfilePath, 'utf-8');

    // 调用 Ollama API 创建模型
    const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    const response = await fetch(`${ollamaUrl}/api/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName, modelfile: modelfileContent }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(500).json({ success: false, error: `Ollama 返回错误: ${errText}` });
    }

    console.log(`[Training] 模型已部署到 Ollama: ${modelName}`);

    res.json({
      success: true,
      data: { modelName, message: `模型 ${modelName} 已部署到 Ollama，可在模型配置中将 embedding 任务指向此模型` },
    });
  } catch (e: any) {
    console.error('[Training] deployModel error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
}
