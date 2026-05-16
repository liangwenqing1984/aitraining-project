import { Request, Response, NextFunction } from 'express';
import * as promptService from '../services/promptService';
import type { PromptCategory, PromptType } from '../types';

const VALID_CATEGORIES: PromptCategory[] = ['enrichment', 'insights', 'query', 'resume-parse', 'anti-crawl'];

export async function listPrompts(req: Request, res: Response, next: NextFunction) {
  try {
    const category = req.query.category as PromptCategory;
    if (!category || !VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ success: false, message: '无效的提示词分类' });
    }
    const list = await promptService.listByCategory(category);
    res.json({ success: true, data: list });
  } catch (err) { next(err); }
}

export async function getPrompt(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ success: false, message: '无效ID' });
    const prompt = await promptService.getById(id);
    if (!prompt) return res.status(404).json({ success: false, message: '提示词不存在' });
    res.json({ success: true, data: prompt });
  } catch (err) { next(err); }
}

export async function createPrompt(req: Request, res: Response, next: NextFunction) {
  try {
    const { category, promptType, name, content, variables, description, isActive, sortOrder } = req.body;
    if (!category || !VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ success: false, message: '无效的提示词分类' });
    }
    if (!promptType || !['system', 'user'].includes(promptType)) {
      return res.status(400).json({ success: false, message: '无效的提示词类型' });
    }
    if (!name || !content) {
      return res.status(400).json({ success: false, message: '名称和内容不能为空' });
    }

    const record = await promptService.create({
      category, promptType, name, content,
      variables: variables || [],
      description: description || null,
      isActive: isActive !== false,
      sortOrder: sortOrder || 0,
    });
    res.status(201).json({ success: true, data: record });
  } catch (err) { next(err); }
}

export async function updatePrompt(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ success: false, message: '无效ID' });

    const existing = await promptService.getById(id);
    if (!existing) return res.status(404).json({ success: false, message: '提示词不存在' });

    const result = await promptService.update(id, req.body);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

export async function deletePrompt(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ success: false, message: '无效ID' });
    const removed = await promptService.remove(id);
    if (!removed) return res.status(404).json({ success: false, message: '提示词不存在' });
    res.json({ success: true, message: '删除成功' });
  } catch (err) { next(err); }
}

export async function resetDefault(req: Request, res: Response, next: NextFunction) {
  try {
    const { category, promptType } = req.body;
    if (!category || !VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ success: false, message: '无效的提示词分类' });
    }
    if (!promptType || !['system', 'user'].includes(promptType)) {
      return res.status(400).json({ success: false, message: '无效的提示词类型' });
    }
    const record = await promptService.resetDefault(category as PromptCategory, promptType as PromptType);
    res.json({ success: true, data: record });
  } catch (err) { next(err); }
}
