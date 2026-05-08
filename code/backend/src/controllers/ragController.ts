import { Request, Response } from 'express';
import { db } from '../config/database';
import { indexJobEmbeddings, semanticSearch, getEmbeddingStats } from '../services/llm/rag';

/**
 * POST /api/rag/index/:taskId
 * 启动职位向量化索引（异步执行，返回前检查增强数据是否存在）
 */
export async function indexTask(req: Request, res: Response) {
  try {
    const { taskId } = req.params;
    if (!taskId) {
      return res.status(400).json({ success: false, error: '缺少 taskId 参数' });
    }

    // 同步检查：增强数据是否存在
    const enrichRow = await db.prepare(
      'SELECT COUNT(*) as cnt FROM sp_job_enrichments WHERE task_id = $1'
    ).get(taskId) as any;
    const enrichCount = enrichRow?.cnt || 0;

    if (enrichCount === 0) {
      return res.status(400).json({
        success: false,
        error: '该任务尚未进行AI数据增强，无法向量化索引。请先在任务列表点击"AI增强"完成数据增强后再试。',
      });
    }

    // 异步执行，立即返回
    res.json({ success: true, data: { taskId, status: 'started', message: `向量化索引已启动（${enrichCount}条增强数据）` } });

    // 后台异步索引
    indexJobEmbeddings(taskId).catch(e => {
      console.error('[RAG] 索引任务失败:', e.message);
    });
  } catch (e: any) {
    console.error('[RAG] indexTask error:', e.message);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: e.message });
    }
  }
}

/**
 * POST /api/rag/index/:taskId/sync
 * 同步向量化索引（返回完整结果）
 */
export async function indexTaskSync(req: Request, res: Response) {
  try {
    const { taskId } = req.params;
    if (!taskId) {
      return res.status(400).json({ success: false, error: '缺少 taskId 参数' });
    }

    const result = await indexJobEmbeddings(taskId);
    res.json({ success: true, data: result });
  } catch (e: any) {
    console.error('[RAG] indexTaskSync error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
}

/**
 * POST /api/rag/search
 * 语义相似搜索
 * Body: { query: string, limit?: number, taskId?: string, minSimilarity?: number }
 */
export async function search(req: Request, res: Response) {
  try {
    const { query, limit, taskId, minSimilarity } = req.body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({ success: false, error: '请输入搜索内容' });
    }

    const results = await semanticSearch(query.trim(), {
      limit: limit || 10,
      taskId: taskId || undefined,
      minSimilarity: minSimilarity || 0.3,
    });

    res.json({
      success: true,
      data: {
        query,
        results,
        count: results.length,
      },
    });
  } catch (e: any) {
    console.error('[RAG] search error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
}

/**
 * GET /api/rag/stats
 * 获取向量化统计
 */
export async function stats(req: Request, res: Response) {
  try {
    const { taskId } = req.query;
    const data = await getEmbeddingStats(taskId as string | undefined);
    res.json({ success: true, data });
  } catch (e: any) {
    console.error('[RAG] stats error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
}
