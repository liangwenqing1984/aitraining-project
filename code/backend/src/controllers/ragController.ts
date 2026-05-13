import { Request, Response } from 'express';
import multer from 'multer';
import { db } from '../config/database';
import { indexJobEmbeddings, semanticSearch, getEmbeddingStats } from '../services/llm/rag';
import { generateEmbedding } from '../services/llm/embeddings';
import { extractResumeText } from '../services/llm/resumeParser';
import { io } from '../app';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['.docx', '.pdf', '.txt', '.doc'];
    const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`不支持的文件格式: ${ext}，仅支持 ${allowed.join(', ')}`));
    }
  },
});

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

    // 后台异步索引，通过 WebSocket 推送完成/失败事件
    indexJobEmbeddings(taskId)
      .then(result => {
        io.emit('rag:indexCompleted', { taskId, ...result, timestamp: Date.now() });
      })
      .catch(e => {
        console.error('[RAG] 索引任务失败:', e.message);
        io.emit('rag:indexFailed', { taskId, error: e.message, timestamp: Date.now() });
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
 * GET /api/rag/index/records
 * 分页列出职位向量索引记录
 */
export async function listJobEmbeddings(req: Request, res: Response) {
  try {
    const { taskId, keyword, page = '1', pageSize = '10' } = req.query;
    const pg = Math.max(1, parseInt(page as string) || 1);
    const ps = Math.min(100, Math.max(1, parseInt(pageSize as string) || 10));
    const offset = (pg - 1) * ps;

    let where = 'WHERE 1=1';
    const params: any[] = [];

    if (taskId) {
      where += ' AND je.task_id = ?';
      params.push(taskId);
    }
    if (keyword) {
      where += ' AND (je.job_id ILIKE ? OR je.text_content ILIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    const countRow = await db.prepare(
      `SELECT COUNT(*) as total FROM sp_job_embeddings je ${where}`
    ).get(...params) as any;

    const rows = await db.prepare(
      `SELECT je.id, je.task_id, je.job_id, je.job_name, je.company_name, je.job_category_l1, je.job_category_l2, je.work_city, SUBSTRING(je.text_content, 1, 200) as text_preview FROM sp_job_embeddings je ${where} ORDER BY je.job_id DESC LIMIT ? OFFSET ?`
    ).all(...params, ps, offset) as any[];

    console.log(`[RAG] listJobEmbeddings: page=${pg}, pageSize=${ps}, offset=${offset}, found=${rows.length}, total=${countRow?.total}`);

    res.json({
      success: true,
      data: { list: rows, total: Number(countRow?.total) || 0, page: pg, pageSize: ps },
    });
  } catch (e: any) {
    console.error('[RAG] listJobEmbeddings error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
}

/**
 * DELETE /api/rag/index/:taskId
 * 删除指定任务的向量索引数据
 */
export async function deleteIndex(req: Request, res: Response) {
  try {
    const { taskId } = req.params;
    if (!taskId) {
      return res.status(400).json({ success: false, error: '缺少 taskId 参数' });
    }

    const result = await db.prepare(
      'DELETE FROM sp_job_embeddings WHERE task_id = $1'
    ).run(taskId);

    console.log(`[RAG] 已删除任务 ${taskId} 的向量索引，共 ${result.changes} 条`);

    res.json({
      success: true,
      data: { taskId, deletedCount: result.changes },
      message: `已删除 ${result.changes} 条向量索引`,
    });
  } catch (e: any) {
    console.error('[RAG] deleteIndex error:', e.message);
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

/**
 * POST /api/rag/resume/match
 * 简历文本 → 向量化 → 与职位向量做余弦相似度匹配
 * Body: { resumeText: string, limit?: number, minSimilarity?: number }
 */
export async function matchResume(req: Request, res: Response) {
  try {
    const { resumeText, limit = 20, minSimilarity = 0.3 } = req.body;

    if (!resumeText || typeof resumeText !== 'string' || resumeText.trim().length < 10) {
      return res.status(400).json({ success: false, error: '简历文本内容太短（至少10个字符）' });
    }

    const trimmedText = resumeText.trim();

    // 生成简历向量（generateEmbedding 内部自动截断超长文本）
    const { embedding } = await generateEmbedding(trimmedText);
    const vectorStr = `[${embedding.join(',')}]`;

    // 余弦相似度搜索（LEFT JOIN sp_jobs 兜底 job_name/company_name）
    const rows = await db.prepare(`
      SELECT
        je.job_id,
        COALESCE(NULLIF(je.job_name, ''), j.job_name, '未知职位') AS job_name,
        COALESCE(NULLIF(je.company_name, ''), j.company_name, '') AS company_name,
        je.job_category_l1,
        je.job_category_l2,
        je.company_industry,
        COALESCE(NULLIF(je.work_city, ''), j.work_city, '') AS work_city,
        je.task_id,
        je.text_content,
        1 - (je.embedding <=> ?::vector) AS similarity
      FROM sp_job_embeddings je
      LEFT JOIN sp_jobs j ON je.job_id = j.job_id AND je.task_id = j.task_id
      WHERE 1 - (je.embedding <=> ?::vector) >= ?
      ORDER BY je.embedding <=> ?::vector
      LIMIT ?
    `).all(vectorStr, vectorStr, minSimilarity, vectorStr, limit) as any[];

    console.log(`[RAG] 简历匹配: 文本长度=${trimmedText.length}, 匹配到 ${rows.length} 个职位`);

    res.json({
      success: true,
      data: {
        resumeText: trimmedText.substring(0, 500),
        results: rows.map(r => ({
          ...r,
          similarity: Number(r.similarity),
        })),
        count: rows.length,
      },
    });
  } catch (e: any) {
    console.error('[RAG] matchResume error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
}

/**
 * POST /api/rag/resume/upload
 * 上传简历文件（docx/pdf/txt）→ 解析文本 → 向量化 → 匹配职位
 */
export const uploadAndMatch = [
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ success: false, error: '请上传简历文件' });
      }

      const limit = Math.min(50, Math.max(1, parseInt(req.body.limit) || 20));
      const minSimilarity = Math.min(0.9, Math.max(0.1, parseFloat(req.body.minSimilarity) || 0.3));

      // 解析文件提取文本
      let resumeText: string;
      try {
        resumeText = await extractResumeText(file.buffer, file.mimetype, file.originalname);
      } catch (parseErr: any) {
        return res.status(400).json({ success: false, error: `文件解析失败: ${parseErr.message}` });
      }

      if (resumeText.length < 10) {
        return res.status(400).json({ success: false, error: '解析出的简历文本内容太短（至少10个字符）' });
      }

      console.log(`[RAG] 简历文件解析: ${file.originalname}, 提取文本 ${resumeText.length} 字符`);

      // 生成向量（generateEmbedding 内部自动截断超长文本）
      const { embedding } = await generateEmbedding(resumeText);
      const vectorStr = `[${embedding.join(',')}]`;

      // 余弦相似度搜索（LEFT JOIN sp_jobs 兜底 job_name/company_name）
      const rows = await db.prepare(`
        SELECT
          je.job_id,
          COALESCE(NULLIF(je.job_name, ''), j.job_name, '未知职位') AS job_name,
          COALESCE(NULLIF(je.company_name, ''), j.company_name, '') AS company_name,
          je.job_category_l1,
          je.job_category_l2,
          je.company_industry,
          COALESCE(NULLIF(je.work_city, ''), j.work_city, '') AS work_city,
          je.task_id,
          je.text_content,
          1 - (je.embedding <=> ?::vector) AS similarity
        FROM sp_job_embeddings je
        LEFT JOIN sp_jobs j ON je.job_id = j.job_id AND je.task_id = j.task_id
        WHERE 1 - (je.embedding <=> ?::vector) >= ?
        ORDER BY je.embedding <=> ?::vector
        LIMIT ?
      `).all(vectorStr, vectorStr, minSimilarity, vectorStr, limit) as any[];

      console.log(`[RAG] 简历文件匹配: ${file.originalname}, 匹配到 ${rows.length} 个职位`);

      res.json({
        success: true,
        data: {
          fileName: file.originalname,
          resumeText: resumeText.substring(0, 500),
          fullTextLength: resumeText.length,
          results: rows.map(r => ({ ...r, similarity: Number(r.similarity) })),
          count: rows.length,
        },
      });
    } catch (e: any) {
      console.error('[RAG] uploadAndMatch error:', e.message);
      if (e.message.includes('不支持的文件格式')) {
        return res.status(400).json({ success: false, error: e.message });
      }
      res.status(500).json({ success: false, error: e.message });
    }
  },
] as any;
