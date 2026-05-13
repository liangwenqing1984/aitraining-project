import { Request, Response } from 'express';
import { db } from '../config/database';
import * as docIndexService from '../services/docIndexService';
import { ApiResponse } from '../types';

export async function indexDocs(req: Request, res: Response) {
  try {
    const { sourceTypes } = req.body;
    const result = await docIndexService.indexAllDocs((msg) => {
      console.log(`[DocController] ${msg}`);
    }, sourceTypes);

    return res.json({
      success: true,
      data: result,
    } as ApiResponse);
  } catch (error: any) {
    console.error('[DocController] 文档索引失败:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message || '文档索引失败',
    } as ApiResponse);
  }
}

export async function getIndexStatus(req: Request, res: Response) {
  try {
    const stats = await docIndexService.getDocIndexStats();
    return res.json({
      success: true,
      data: stats,
    } as ApiResponse);
  } catch (error: any) {
    console.error('[DocController] 获取索引状态失败:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message || '获取索引状态失败',
    } as ApiResponse);
  }
}

// ==================== 文档向量管理 ====================

// GET /api/docs/index/records — 分页列表
export async function listDocEmbeddings(req: Request, res: Response) {
  try {
    const { sourceType, keyword, page = '1', pageSize = '20' } = req.query;
    const pg = Math.max(1, parseInt(page as string) || 1);
    const ps = Math.min(100, Math.max(1, parseInt(pageSize as string) || 20));
    const offset = (pg - 1) * ps;

    let where = 'WHERE 1=1';
    const params: any[] = [];

    if (sourceType) {
      where += ' AND source_type = ?';
      params.push(sourceType);
    }
    if (keyword) {
      where += ' AND (section_id ILIKE ? OR section_title ILIKE ? OR file_path ILIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }

    const countRow = await db.prepare(
      `SELECT COUNT(*) as total FROM sp_doc_embeddings ${where}`
    ).get(...params) as any;

    const rows = await db.prepare(
      `SELECT id, section_id, section_title, source_type, file_path, chunk_index, embedding_model, char_count, created_at, updated_at FROM sp_doc_embeddings ${where} ORDER BY updated_at DESC LIMIT ? OFFSET ?`
    ).all(...params, ps, offset) as any[];

    return res.json({
      success: true,
      data: { list: rows, total: countRow?.total || 0, page: pg, pageSize: ps },
    } as ApiResponse);
  } catch (error: any) {
    console.error('[DocController] listDocEmbeddings 失败:', error.message);
    return res.status(500).json({ success: false, error: error.message } as ApiResponse);
  }
}

// DELETE /api/docs/index/source/:sourceType — 按来源类型删除
export async function deleteDocBySourceType(req: Request, res: Response) {
  try {
    const { sourceType } = req.params;
    const result = await db.prepare('DELETE FROM sp_doc_embeddings WHERE source_type = ?').run(sourceType);
    return res.json({ success: true, data: { sourceType, deletedCount: result.changes }, message: `已删除 ${result.changes} 条文档向量` } as ApiResponse);
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message } as ApiResponse);
  }
}

// DELETE /api/docs/index/:sectionId — 按 section 删除
export async function deleteDocBySection(req: Request, res: Response) {
  try {
    const { sectionId } = req.params;
    const result = await db.prepare('DELETE FROM sp_doc_embeddings WHERE section_id = ?').run(sectionId);
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: '未找到该文档向量' } as ApiResponse);
    }
    return res.json({ success: true, data: { sectionId, deletedCount: result.changes }, message: `已删除 ${result.changes} 条文档向量` } as ApiResponse);
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message } as ApiResponse);
  }
}
