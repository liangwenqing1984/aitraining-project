import { Request, Response } from 'express';
import { ApiResponse } from '../types';
import * as roleService from '../services/roleService';

export async function listRoles(req: Request, res: Response) {
  try {
    const { page, pageSize, keyword } = req.query;
    const result = await roleService.listRoles({
      page: page ? parseInt(page as string) : 1,
      pageSize: pageSize ? parseInt(pageSize as string) : 10,
      keyword: keyword as string,
    });
    return res.json({ success: true, data: result } as ApiResponse);
  } catch (error: any) {
    console.error('[RoleController] 获取角色列表失败:', error.message);
    return res.status(500).json({ success: false, error: error.message } as ApiResponse);
  }
}

export async function getAllRoles(req: Request, res: Response) {
  try {
    const roles = await roleService.getAllRoles();
    return res.json({ success: true, data: roles } as ApiResponse);
  } catch (error: any) {
    console.error('[RoleController] 获取全部角色失败:', error.message);
    return res.status(500).json({ success: false, error: error.message } as ApiResponse);
  }
}

export async function getRole(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, error: '无效的角色ID' } as ApiResponse);

    const role = await roleService.getRoleById(id);
    if (!role) return res.status(404).json({ success: false, error: '角色不存在' } as ApiResponse);

    return res.json({ success: true, data: role } as ApiResponse);
  } catch (error: any) {
    console.error('[RoleController] 获取角色详情失败:', error.message);
    return res.status(500).json({ success: false, error: error.message } as ApiResponse);
  }
}

export async function createRole(req: Request, res: Response) {
  try {
    const { name, code, description, status, permissionIds, menuIds } = req.body;
    if (!name || !code) {
      return res.status(400).json({ success: false, error: '角色名称和编码为必填项' } as ApiResponse);
    }

    const role = await roleService.createRole({ name, code, description, status: status !== false, permissionIds, menuIds } as any);
    return res.json({ success: true, data: role, message: '角色创建成功' } as ApiResponse);
  } catch (error: any) {
    console.error('[RoleController] 创建角色失败:', error.message);
    if (error.message?.includes('unique') || error.message?.includes('duplicate')) {
      return res.status(400).json({ success: false, error: '角色编码已存在' } as ApiResponse);
    }
    return res.status(500).json({ success: false, error: error.message } as ApiResponse);
  }
}

export async function updateRole(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, error: '无效的角色ID' } as ApiResponse);

    const role = await roleService.updateRole(id, req.body);
    if (!role) return res.status(404).json({ success: false, error: '角色不存在' } as ApiResponse);

    return res.json({ success: true, data: role, message: '角色更新成功' } as ApiResponse);
  } catch (error: any) {
    console.error('[RoleController] 更新角色失败:', error.message);
    return res.status(500).json({ success: false, error: error.message } as ApiResponse);
  }
}

export async function deleteRole(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, error: '无效的角色ID' } as ApiResponse);

    const done = await roleService.deleteRole(id);
    if (!done) return res.status(404).json({ success: false, error: '角色不存在' } as ApiResponse);

    return res.json({ success: true, message: '角色已删除' } as ApiResponse);
  } catch (error: any) {
    console.error('[RoleController] 删除角色失败:', error.message);
    return res.status(500).json({ success: false, error: error.message } as ApiResponse);
  }
}
