import { Request, Response } from 'express';
import * as docIndexService from '../services/docIndexService';
import { ApiResponse } from '../types';

export async function indexDocs(req: Request, res: Response) {
  try {
    const result = await docIndexService.indexAllDocs((msg) => {
      console.log(`[DocController] ${msg}`);
    });

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
