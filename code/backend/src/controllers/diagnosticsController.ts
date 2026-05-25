import { Request, Response } from 'express';
import { db } from '../config/database';
import { execSync } from 'child_process';
import os from 'os';
import fs from 'fs';

/**
 * 系统综合诊断端点
 * GET /api/diagnostics — 全量检查
 * GET /api/diagnostics?quick=1 — 快速检查（仅 DB + 内存）
 */
export async function getDiagnostics(req: Request, res: Response) {
  const quick = req.query.quick === '1';
  const results: Record<string, any> = {};
  let overallOk = true;

  // ---- 系统信息 ----
  results.system = {
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    cpus: os.cpus().length,
    totalMemMB: Math.round(os.totalmem() / 1024 / 1024),
    freeMemMB: Math.round(os.freemem() / 1024 / 1024),
    uptimeMinutes: Math.round(os.uptime() / 60),
    nodeVersion: process.version,
  };

  // ---- 环境变量（脱敏，仅显示关键配置） ----
  results.env = {
    PORT: process.env.PORT || '3004',
    DB_HOST: process.env.DB_HOST || '(default)',
    DB_PORT: process.env.DB_PORT || '5432',
    DB_NAME: process.env.DB_NAME || '(default)',
    REDIS_HOST: process.env.REDIS_HOST || '(default)',
    TRAINER_CONTAINER: process.env.TRAINER_CONTAINER || 'aitrain-trainer',
    PROXY_POOL_URL: process.env.PROXY_POOL_URL || '(default)',
    OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL || '(not set)',
    HF_HOME: process.env.HF_HOME || '(not set)',
    CORS_ORIGIN: process.env.CORS_ORIGIN || '(default)',
  };

  // ---- 数据卷磁盘空间 ----
  try {
    const dataDir = '/app/data';
    if (fs.existsSync(dataDir)) {
      const stat = fs.statfsSync(dataDir);
      const freeGB = ((stat.bsize * stat.bavail) / 1024 / 1024 / 1024).toFixed(1);
      const totalGB = ((stat.bsize * stat.blocks) / 1024 / 1024 / 1024).toFixed(1);
      results.disk = {
        mount: dataDir,
        totalGB: parseFloat(totalGB),
        freeGB: parseFloat(freeGB),
        ok: parseFloat(freeGB) > 1,
      };
      if (!results.disk.ok) overallOk = false;
    }
  } catch (e: any) {
    results.disk = { error: e.message };
  }

  // ---- PostgreSQL 连通性 ----
  const dbStart = Date.now();
  try {
    const row = await db.prepare('SELECT 1 AS ok').get() as any;
    results.database = { ok: row?.ok === 1, latency: Date.now() - dbStart };
  } catch (e: any) {
    results.database = { ok: false, latency: Date.now() - dbStart, error: e.message };
    overallOk = false;
  }

  if (quick) {
    results.mode = 'quick';
    return res.json({ ok: overallOk, results });
  }

  // ---- Trainer 容器状态 ----
  const trainerName = process.env.TRAINER_CONTAINER || 'aitrain-trainer';
  try {
    const out = execSync(`docker inspect -f '{{.State.Status}}' ${trainerName}`, {
      timeout: 5000,
      encoding: 'utf-8',
    }).trim();
    results.trainer = { container: trainerName, status: out, ok: out === 'running' };
    if (!results.trainer.ok) overallOk = false;
  } catch (e: any) {
    results.trainer = { container: trainerName, ok: false, error: e.message?.trim() };
    overallOk = false;
  }

  // ---- Ollama 连通性 ----
  const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  const ollamaStart = Date.now();
  try {
    const resp = await fetch(`${ollamaUrl}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });
    if (resp.ok) {
      const data: any = await resp.json();
      results.ollama = {
        ok: true,
        url: ollamaUrl,
        latency: Date.now() - ollamaStart,
        modelCount: data.models?.length || 0,
      };
    } else {
      results.ollama = { ok: false, url: ollamaUrl, status: resp.status, error: `HTTP ${resp.status}` };
      overallOk = false;
    }
  } catch (e: any) {
    results.ollama = { ok: false, url: ollamaUrl, error: e.message };
    // Ollama 不可用不一定是系统故障（可能未部署），标记但不断言 overall false
  }

  // ---- IP 代理池连通性 ----
  const proxyUrl = process.env.PROXY_POOL_URL || 'http://proxy-pool:5010';
  const proxyStart = Date.now();
  try {
    const resp = await fetch(`${proxyUrl}/all`, {
      signal: AbortSignal.timeout(5000),
    });
    results.proxyPool = {
      ok: resp.ok,
      url: proxyUrl,
      latency: Date.now() - proxyStart,
      status: resp.status,
    };
  } catch (e: any) {
    results.proxyPool = { ok: false, url: proxyUrl, error: e.message };
  }

  // ---- 关键文件存在性 ----
  results.files = {};
  const keyFiles = [
    '/scripts/train_embedding.py',
    '/app/src/index.ts',
    '/usr/bin/chromium',
  ];
  for (const f of keyFiles) {
    results.files[f] = fs.existsSync(f);
  }

  return res.json({ ok: overallOk, results });
}
