import api from './index';

// ==================== 类型定义 ====================

export interface SystemUser {
  id?: number;
  username: string;
  password?: string;
  realName: string;
  email?: string;
  phone?: string;
  oauth2UserId?: string;
  status: boolean;
  roleIds?: number[];
  roles?: { id: number; name: string; code: string }[];
  createdAt?: string;
  updatedAt?: string;
}

export interface SystemRole {
  id?: number;
  name: string;
  code: string;
  description?: string;
  status: boolean;
  permissionIds?: number[];
  menuIds?: number[];
  createdAt?: string;
  updatedAt?: string;
}

export interface SystemPermission {
  id?: number;
  name: string;
  code: string;
  resource: string;
  action: string;
  description?: string;
  createdAt?: string;
}

export interface SystemMenu {
  id?: number;
  name: string;
  path?: string;
  icon?: string;
  parentId?: number | null;
  sortOrder: number;
  component?: string;
  hidden: boolean;
  children?: SystemMenu[];
  createdAt?: string;
  updatedAt?: string;
}

// ==================== 用户 API ====================

export function getUsers(params: { page?: number; pageSize?: number; keyword?: string }) {
  return api.get('/users', { params }) as Promise<any>;
}

export function getUser(id: number) {
  return api.get(`/users/${id}`) as Promise<any>;
}

export function createUser(data: Partial<SystemUser>) {
  return api.post('/users', data) as Promise<any>;
}

export function updateUser(id: number, data: Partial<SystemUser>) {
  return api.put(`/users/${id}`, data) as Promise<any>;
}

export function deleteUser(id: number) {
  return api.delete(`/users/${id}`) as Promise<any>;
}

export function updateUserRoles(id: number, roleIds: number[]) {
  return api.put(`/users/${id}/roles`, { roleIds }) as Promise<any>;
}

// ==================== 角色 API ====================

export function getRoles(params: { page?: number; pageSize?: number; keyword?: string }) {
  return api.get('/roles', { params }) as Promise<any>;
}

export function getAllRoles() {
  return api.get('/roles/all') as Promise<any>;
}

export function getRole(id: number) {
  return api.get(`/roles/${id}`) as Promise<any>;
}

export function createRole(data: Partial<SystemRole>) {
  return api.post('/roles', data) as Promise<any>;
}

export function updateRole(id: number, data: Partial<SystemRole>) {
  return api.put(`/roles/${id}`, data) as Promise<any>;
}

export function deleteRole(id: number) {
  return api.delete(`/roles/${id}`) as Promise<any>;
}

// ==================== 权限 API ====================

export function getPermissions(params: { page?: number; pageSize?: number; keyword?: string }) {
  return api.get('/permissions', { params }) as Promise<any>;
}

export function getAllPermissions() {
  return api.get('/permissions/all') as Promise<any>;
}

export function createPermission(data: Partial<SystemPermission>) {
  return api.post('/permissions', data) as Promise<any>;
}

export function updatePermission(id: number, data: Partial<SystemPermission>) {
  return api.put(`/permissions/${id}`, data) as Promise<any>;
}

export function deletePermission(id: number) {
  return api.delete(`/permissions/${id}`) as Promise<any>;
}

// ==================== 菜单 API ====================

export function getMenus(params: { page?: number; pageSize?: number; keyword?: string }) {
  return api.get('/menus', { params }) as Promise<any>;
}

export function getMenuTree() {
  return api.get('/menus/tree') as Promise<any>;
}

export function getMenu(id: number) {
  return api.get(`/menus/${id}`) as Promise<any>;
}

export function createMenu(data: Partial<SystemMenu>) {
  return api.post('/menus', data) as Promise<any>;
}

export function updateMenu(id: number, data: Partial<SystemMenu>) {
  return api.put(`/menus/${id}`, data) as Promise<any>;
}

export function deleteMenu(id: number) {
  return api.delete(`/menus/${id}`) as Promise<any>;
}
