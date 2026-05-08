import { Request, Response } from 'express';
import { ApiResponse } from '../types';
import * as userService from '../services/userService';

export async function listUsers(req: Request, res: Response) {
  try {
    const { page, pageSize, keyword } = req.query;
    const result = await userService.listUsers({
      page: page ? parseInt(page as string) : 1,
      pageSize: pageSize ? parseInt(pageSize as string) : 10,
      keyword: keyword as string,
    });
    return res.json({ success: true, data: result } as ApiResponse);
  } catch (error: any) {
    console.error('[UserController] 获取用户列表失败:', error.message);
    return res.status(500).json({ success: false, error: error.message } as ApiResponse);
  }
}

export async function getUser(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, error: '无效的用户ID' } as ApiResponse);

    const user = await userService.getUserById(id);
    if (!user) return res.status(404).json({ success: false, error: '用户不存在' } as ApiResponse);

    return res.json({ success: true, data: user } as ApiResponse);
  } catch (error: any) {
    console.error('[UserController] 获取用户详情失败:', error.message);
    return res.status(500).json({ success: false, error: error.message } as ApiResponse);
  }
}

export async function createUser(req: Request, res: Response) {
  try {
    const { username, password, realName, email, phone, status, roleIds } = req.body;
    if (!username || !password || !realName) {
      return res.status(400).json({ success: false, error: '用户名、密码和真实姓名为必填项' } as ApiResponse);
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, error: '密码长度不能少于6位' } as ApiResponse);
    }

    const user = await userService.createUser({ username, password, realName, email, phone, status: status !== false, roleIds } as any);
    return res.json({ success: true, data: user, message: '用户创建成功' } as ApiResponse);
  } catch (error: any) {
    console.error('[UserController] 创建用户失败:', error.message);
    if (error.message?.includes('unique') || error.message?.includes('duplicate')) {
      return res.status(400).json({ success: false, error: '用户名已存在' } as ApiResponse);
    }
    return res.status(500).json({ success: false, error: error.message } as ApiResponse);
  }
}

export async function updateUser(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, error: '无效的用户ID' } as ApiResponse);

    const user = await userService.updateUser(id, req.body);
    if (!user) return res.status(404).json({ success: false, error: '用户不存在' } as ApiResponse);

    return res.json({ success: true, data: user, message: '用户更新成功' } as ApiResponse);
  } catch (error: any) {
    console.error('[UserController] 更新用户失败:', error.message);
    return res.status(500).json({ success: false, error: error.message } as ApiResponse);
  }
}

export async function deleteUser(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, error: '无效的用户ID' } as ApiResponse);

    const done = await userService.deleteUser(id);
    if (!done) return res.status(404).json({ success: false, error: '用户不存在' } as ApiResponse);

    return res.json({ success: true, message: '用户已删除' } as ApiResponse);
  } catch (error: any) {
    console.error('[UserController] 删除用户失败:', error.message);
    return res.status(500).json({ success: false, error: error.message } as ApiResponse);
  }
}

export async function updateUserRoles(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, error: '无效的用户ID' } as ApiResponse);

    const { roleIds } = req.body;
    if (!Array.isArray(roleIds)) {
      return res.status(400).json({ success: false, error: 'roleIds 必须为数组' } as ApiResponse);
    }

    await userService.updateUserRoles(id, roleIds);
    const user = await userService.getUserById(id);
    return res.json({ success: true, data: user, message: '角色分配更新成功' } as ApiResponse);
  } catch (error: any) {
    console.error('[UserController] 更新用户角色失败:', error.message);
    return res.status(500).json({ success: false, error: error.message } as ApiResponse);
  }
}
