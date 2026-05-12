import { Request, Response } from 'express';
import * as chatService from '../services/chatService';
import { ApiResponse } from '../types';

export async function sendMessage(req: Request, res: Response) {
  try {
    const { message, sessionId } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: '消息内容不能为空',
      } as ApiResponse);
    }

    if (message.trim().length > 2000) {
      return res.status(400).json({
        success: false,
        error: '消息内容过长，请限制在2000字以内',
      } as ApiResponse);
    }

    const result = await chatService.sendMessage(message.trim(), sessionId);

    return res.json({
      success: true,
      data: result,
    } as ApiResponse);
  } catch (error: any) {
    console.error('[ChatController] 发送消息失败:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message || '发送消息失败',
    } as ApiResponse);
  }
}

export async function listSessions(req: Request, res: Response) {
  try {
    const sessions = await chatService.getSessions();
    return res.json({
      success: true,
      data: sessions,
    } as ApiResponse);
  } catch (error: any) {
    console.error('[ChatController] 获取会话列表失败:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message || '获取会话列表失败',
    } as ApiResponse);
  }
}

export async function getSession(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        error: '无效的会话 ID',
      } as ApiResponse);
    }

    const messages = await chatService.getSessionMessages(id);
    return res.json({
      success: true,
      data: messages,
    } as ApiResponse);
  } catch (error: any) {
    console.error('[ChatController] 获取会话消息失败:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message || '获取会话消息失败',
    } as ApiResponse);
  }
}

export async function deleteSession(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        error: '无效的会话 ID',
      } as ApiResponse);
    }

    await chatService.deleteSession(id);
    return res.json({
      success: true,
      message: '会话已删除',
    } as ApiResponse);
  } catch (error: any) {
    console.error('[ChatController] 删除会话失败:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message || '删除会话失败',
    } as ApiResponse);
  }
}
