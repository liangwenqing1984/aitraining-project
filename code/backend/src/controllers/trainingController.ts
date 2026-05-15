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
    PYTHONUNBUFFERED: '1',
    PYTHONIOENCODING: 'utf-8',
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
      .replace(/\r/g, '\n')
      // 删除 tqdm 进度条模式: |fill| N/M [time_info]
      .replace(/\|[\s\u{2580}-\u{259f}]*\|\s*\d+([.,]\d+)?[kMG]?\/\d+([.,]\d+)?[kMG]?\s*\[[^\]]*\]/gu, '')
      // 删除残留的 Unicode 块字符 (U+2580-U+259F)
      .replace(/[\u{2580}-\u{259f}]+/gu, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
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

  // 统一处理 stdout/stderr 输出，解析进度
  function processOutput(text: string) {
    log += text;
    logDirty = true;

    // 解析 PROGRESS:xx 行 — 立即刷新
    const pm = text.match(/PROGRESS:(\d+(?:\.\d+)?)/);
    if (pm) {
      lastProgress = parseFloat(pm[1]);
      db.prepare(
        'UPDATE sp_training_jobs SET progress = $1, log = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3'
      ).run(lastProgress, sanitizeLog(log), jobId).catch(() => {});
      logDirty = false;
      return;
    }

    // 解析 tqdm 训练进度百分比（stderr 输出），映射到当前阶段区间
    const tm = text.match(/(\d{1,3})\s*%/);
    if (tm) {
      const pct = parseInt(tm[1]);
      if (pct > 0 && pct <= 100) {
        if (lastProgress >= 5 && lastProgress < 15) {
          // 模型下载阶段: PROGRESS:5 → PROGRESS:15
          lastProgress = Math.round(5 + (pct / 100) * 10);
        } else if (lastProgress >= 20 && lastProgress < 85) {
          // 训练阶段: PROGRESS:20 → PROGRESS:85
          lastProgress = Math.round(20 + (pct / 100) * 65);
        }
        logDirty = true;
      }
    }
  }

  child.stdout.on('data', (data: Buffer) => processOutput(data.toString()));

  child.stderr.on('data', (data: Buffer) => processOutput(data.toString()));

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

function getDirSizeMB(dirPath: string): number {
  function walk(d: string): number {
    let bytes = 0;
    const files = fs.readdirSync(d, { withFileTypes: true });
    for (const f of files) {
      const fp = path.join(d, f.name);
      if (f.isDirectory()) bytes += walk(fp);
      else bytes += fs.statSync(fp).size;
    }
    return bytes;
  }
  try { return walk(dirPath) / (1024 * 1024); } catch { return 0; }
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
        // 计算模型目录大小 (MB)
        const sizeMB = getDirSizeMB(modelPath);
        models.push({
          name: d.name,
          path: modelPath,
          metrics,
          hasModelfile: fs.existsSync(path.join(modelPath, 'Modelfile')),
          createdAt: createdAt.toISOString().replace('T', ' ').slice(0, 19),
          sizeMB,
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
 * POST /api/training/models/evaluate
 * 对已训练模型单独运行评估，生成 metrics.json
 */
export async function evaluateModel(req: Request, res: Response) {
  try {
    const { modelPath, datasetPath } = req.body;
    if (!modelPath || !datasetPath) {
      res.status(400).json({ success: false, error: '请提供 modelPath 和 datasetPath' });
      return;
    }
    if (!fs.existsSync(modelPath) || !fs.existsSync(datasetPath)) {
      res.status(400).json({ success: false, error: '模型路径或数据集路径不存在' });
      return;
    }

    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    const scriptPath = path.resolve(__dirname, '../../scripts/evaluate_model.py');
    const args = [scriptPath, '--model', modelPath, '--dataset', datasetPath];

    console.log(`[Training] 启动评估: ${pythonCmd} ${args.join(' ')}`);

    const child = spawn(pythonCmd, args, {
      cwd: path.resolve(__dirname, '../..'),
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1',
        PYTHONIOENCODING: 'utf-8',
        HF_ENDPOINT: process.env.HF_ENDPOINT || 'https://hf-mirror.com',
        HF_HUB_ENABLE_HF_XET: '0',
      },
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
    child.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });

    child.on('close', (code: number) => {
      console.log(`[Training] 评估完成, exit code: ${code}`);
      const tail = (s: string, n: number) => s.split('\n').slice(-n).join('\n').trim();
      if (code === 0) {
        const metricsPath = path.join(modelPath, 'metrics.json');
        let metrics = {};
        if (fs.existsSync(metricsPath)) {
          try { metrics = JSON.parse(fs.readFileSync(metricsPath, 'utf-8')); } catch {}
        }
        res.json({ success: true, data: { metrics, stdout: tail(stdout, 20), stderr: tail(stderr, 20) } });
      } else {
        const detail = [stderr.trim(), stdout.trim()].filter(Boolean).join('\n');
        res.status(500).json({ success: false, error: `评估脚本退出码 ${code}\n${detail}`, stdout: tail(stdout, 20), stderr: tail(stderr, 20) });
      }
    });

    child.on('error', (err: Error) => {
      console.error('[Training] 评估进程启动失败:', err.message);
      res.status(500).json({ success: false, error: err.message });
    });
  } catch (e: any) {
    console.error('[Training] evaluateModel error:', e.message);
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

    let modelfileContent = fs.readFileSync(modelfilePath, 'utf-8');

    // 解析 Modelfile 的 FROM 行，提取基座模型名
    const fromMatch = modelfileContent.match(/^FROM\s+(.+)$/m);
    const fromModel = fromMatch ? fromMatch[1].trim() : null;

    // 自动修正 HuggingFace ID 为 Ollama 可识别的模型名
    const HF_TO_OLLAMA: Record<string, string> = {
      'nomic-ai/nomic-embed-text-v1.5': 'nomic-embed-text:latest',
      'nomic-ai/nomic-embed-text-v1': 'nomic-embed-text:latest',
      'BAAI/bge-base-zh-v1.5': 'bge-base-zh:latest',
      'BAAI/bge-small-zh-v1.5': 'bge-small-zh:latest',
      'sentence-transformers/all-MiniLM-L6-v2': 'all-minilm:latest',
      'sentence-transformers/all-mpnet-base-v2': 'all-minilm:latest',
    };
    let ollamaFrom = fromModel ? (HF_TO_OLLAMA[fromModel] || fromModel) : 'nomic-embed-text:latest';

    // 调用 Ollama API 创建模型（Ollama 0.5+ 使用 from 参数替代 modelfile）
    const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    const response = await fetch(`${ollamaUrl}/api/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName, from: ollamaFrom }),
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
