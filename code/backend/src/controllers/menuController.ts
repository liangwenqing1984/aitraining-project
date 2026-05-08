import { Request, Response } from 'express';
import { ApiResponse } from '../types';
import * as menuService from '../services/menuService';

export async function listMenus(req: Request, res: Response) {
  try {
    const { page, pageSize, keyword } = req.query;
    const result = await menuService.listMenus({
      page: page ? parseInt(page as string) : 1,
      pageSize: pageSize ? parseInt(pageSize as string) : 50,
      keyword: keyword as string,
    });
    return res.json({ success: true, data: result } as ApiResponse);
  } catch (error: any) {
    console.error('[MenuController] 获取菜单列表失败:', error.message);
    return res.status(500).json({ success: false, error: error.message } as ApiResponse);
  }
}

export async function getMenuTree(req: Request, res: Response) {
  try {
    const tree = await menuService.getMenuTree();
    return res.json({ success: true, data: tree } as ApiResponse);
  } catch (error: any) {
    console.error('[MenuController] 获取菜单树失败:', error.message);
    return res.status(500).json({ success: false, error: error.message } as ApiResponse);
  }
}

export async function getMenu(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, error: '无效的菜单ID' } as ApiResponse);

    const menu = await menuService.getMenuById(id);
    if (!menu) return res.status(404).json({ success: false, error: '菜单不存在' } as ApiResponse);

    return res.json({ success: true, data: menu } as ApiResponse);
  } catch (error: any) {
    console.error('[MenuController] 获取菜单详情失败:', error.message);
    return res.status(500).json({ success: false, error: error.message } as ApiResponse);
  }
}

export async function createMenu(req: Request, res: Response) {
  try {
    const { name, path, icon, parentId, sortOrder, component, hidden } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: '菜单名称为必填项' } as ApiResponse);
    }

    const menu = await menuService.createMenu({ name, path, icon, parentId, sortOrder, component, hidden } as any);
    return res.json({ success: true, data: menu, message: '菜单创建成功' } as ApiResponse);
  } catch (error: any) {
    console.error('[MenuController] 创建菜单失败:', error.message);
    return res.status(500).json({ success: false, error: error.message } as ApiResponse);
  }
}

export async function updateMenu(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, error: '无效的菜单ID' } as ApiResponse);

    const menu = await menuService.updateMenu(id, req.body);
    if (!menu) return res.status(404).json({ success: false, error: '菜单不存在' } as ApiResponse);

    return res.json({ success: true, data: menu, message: '菜单更新成功' } as ApiResponse);
  } catch (error: any) {
    console.error('[MenuController] 更新菜单失败:', error.message);
    return res.status(500).json({ success: false, error: error.message } as ApiResponse);
  }
}

export async function deleteMenu(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, error: '无效的菜单ID' } as ApiResponse);

    const result = await menuService.deleteMenu(id);
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error } as ApiResponse);
    }

    return res.json({ success: true, message: '菜单已删除' } as ApiResponse);
  } catch (error: any) {
    console.error('[MenuController] 删除菜单失败:', error.message);
    return res.status(500).json({ success: false, error: error.message } as ApiResponse);
  }
}
