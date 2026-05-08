import { Request, Response } from 'express';
import { ApiResponse } from '../types';
import * as permissionService from '../services/permissionService';

export async function listPermissions(req: Request, res: Response) {
  try {
    const { page, pageSize, keyword } = req.query;
    const result = await permissionService.listPermissions({
      page: page ? parseInt(page as string) : 1,
      pageSize: pageSize ? parseInt(pageSize as string) : 10,
      keyword: keyword as string,
    });
    return res.json({ success: true, data: result } as ApiResponse);
  } catch (error: any) {
    console.error('[PermissionController] 获取权限列表失败:', error.message);
    return res.status(500).json({ success: false, error: error.message } as ApiResponse);
  }
}

export async function getAllPermissions(req: Request, res: Response) {
  try {
    const groups = await permissionService.getAllPermissions();
    return res.json({ success: true, data: groups } as ApiResponse);
  } catch (error: any) {
    console.error('[PermissionController] 获取全部权限失败:', error.message);
    return res.status(500).json({ success: false, error: error.message } as ApiResponse);
  }
}

export async function getPermission(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, error: '无效的权限ID' } as ApiResponse);

    const perm = await permissionService.getPermissionById(id);
    if (!perm) return res.status(404).json({ success: false, error: '权限不存在' } as ApiResponse);

    return res.json({ success: true, data: perm } as ApiResponse);
  } catch (error: any) {
    console.error('[PermissionController] 获取权限详情失败:', error.message);
    return res.status(500).json({ success: false, error: error.message } as ApiResponse);
  }
}

export async function createPermission(req: Request, res: Response) {
  try {
    const { name, code, resource, action, description } = req.body;
    if (!name || !code || !resource || !action) {
      return res.status(400).json({ success: false, error: '权限名称、编码、资源和操作为必填项' } as ApiResponse);
    }

    const perm = await permissionService.createPermission({ name, code, resource, action, description } as any);
    return res.json({ success: true, data: perm, message: '权限创建成功' } as ApiResponse);
  } catch (error: any) {
    console.error('[PermissionController] 创建权限失败:', error.message);
    if (error.message?.includes('unique') || error.message?.includes('duplicate')) {
      return res.status(400).json({ success: false, error: '权限编码已存在' } as ApiResponse);
    }
    return res.status(500).json({ success: false, error: error.message } as ApiResponse);
  }
}

export async function updatePermission(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, error: '无效的权限ID' } as ApiResponse);

    const perm = await permissionService.updatePermission(id, req.body);
    if (!perm) return res.status(404).json({ success: false, error: '权限不存在' } as ApiResponse);

    return res.json({ success: true, data: perm, message: '权限更新成功' } as ApiResponse);
  } catch (error: any) {
    console.error('[PermissionController] 更新权限失败:', error.message);
    return res.status(500).json({ success: false, error: error.message } as ApiResponse);
  }
}

export async function deletePermission(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, error: '无效的权限ID' } as ApiResponse);

    const done = await permissionService.deletePermission(id);
    if (!done) return res.status(404).json({ success: false, error: '权限不存在' } as ApiResponse);

    return res.json({ success: true, message: '权限已删除' } as ApiResponse);
  } catch (error: any) {
    console.error('[PermissionController] 删除权限失败:', error.message);
    return res.status(500).json({ success: false, error: error.message } as ApiResponse);
  }
}
