import { db } from '../config/database';
import type { SystemRole } from '../types';

export async function listRoles(params: {
  page?: number; pageSize?: number; keyword?: string;
}): Promise<{ list: SystemRole[]; total: number }> {
  const { page = 1, pageSize = 10, keyword } = params;
  const offset = (page - 1) * pageSize;

  let where = '';
  const args: any[] = [];

  if (keyword) {
    where = 'WHERE name ILIKE $1 OR code ILIKE $1 OR description ILIKE $1';
    args.push(`%${keyword}%`);
  }

  const countResult = await db.prepare(
    `SELECT COUNT(*) as cnt FROM sp_roles ${where}`
  ).get(...args);
  const total = (countResult as any)?.cnt || 0;

  const roles = await db.prepare(
    `SELECT * FROM sp_roles ${where} ORDER BY id DESC LIMIT $${args.length + 1} OFFSET $${args.length + 2}`
  ).all(...args, pageSize, offset) as SystemRole[];

  return { list: roles, total };
}

export async function getAllRoles(): Promise<SystemRole[]> {
  return db.prepare(
    'SELECT id, name, code FROM sp_roles WHERE status = true ORDER BY id'
  ).all() as Promise<SystemRole[]>;
}

export async function getRoleById(id: number): Promise<SystemRole | null> {
  const role = await db.prepare('SELECT * FROM sp_roles WHERE id = $1').get(id) as SystemRole | null;
  if (!role) return null;

  const permissions = await db.prepare(
    'SELECT permission_id FROM sp_role_permissions WHERE role_id = $1'
  ).all(id) as any[];
  role.permissionIds = permissions.map((p: any) => p.permissionId);

  const menus = await db.prepare(
    'SELECT menu_id FROM sp_role_menus WHERE role_id = $1'
  ).all(id) as any[];
  role.menuIds = menus.map((m: any) => m.menuId);

  return role;
}

export async function createRole(data: SystemRole): Promise<SystemRole> {
  const result = await db.prepare(
    `INSERT INTO sp_roles (name, code, description, status) VALUES ($1, $2, $3, $4) RETURNING id`
  ).run(data.name, data.code, data.description || null, data.status !== false);

  const inserted = await db.prepare('SELECT id FROM sp_roles ORDER BY id DESC LIMIT 1').get();
  const roleId = (inserted as any)?.id;

  if (data.permissionIds && data.permissionIds.length > 0) {
    await updateRolePermissions(roleId, data.permissionIds);
  }
  if (data.menuIds && data.menuIds.length > 0) {
    await updateRoleMenus(roleId, data.menuIds);
  }

  return (await getRoleById(roleId))!;
}

export async function updateRole(id: number, data: Partial<SystemRole>): Promise<SystemRole | null> {
  const existing = await db.prepare('SELECT * FROM sp_roles WHERE id = $1').get(id) as any;
  if (!existing) return null;

  const name = data.name ?? existing.name;
  const code = data.code ?? existing.code;
  const description = data.description !== undefined ? data.description : existing.description;
  const status = data.status !== undefined ? data.status : existing.status;

  await db.prepare(
    `UPDATE sp_roles SET name=$1, code=$2, description=$3, status=$4, updated_at=CURRENT_TIMESTAMP WHERE id=$5`
  ).run(name, code, description, status, id);

  if (data.permissionIds !== undefined) {
    await updateRolePermissions(id, data.permissionIds);
  }
  if (data.menuIds !== undefined) {
    await updateRoleMenus(id, data.menuIds);
  }

  return getRoleById(id);
}

export async function deleteRole(id: number): Promise<boolean> {
  const result = await db.prepare('DELETE FROM sp_roles WHERE id = $1').run(id);
  return (result as any).changes > 0;
}

async function updateRolePermissions(roleId: number, permissionIds: number[]): Promise<void> {
  await db.prepare('DELETE FROM sp_role_permissions WHERE role_id = $1').run(roleId);
  for (const permId of permissionIds) {
    await db.prepare('INSERT INTO sp_role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING').run(roleId, permId);
  }
}

async function updateRoleMenus(roleId: number, menuIds: number[]): Promise<void> {
  await db.prepare('DELETE FROM sp_role_menus WHERE role_id = $1').run(roleId);
  for (const menuId of menuIds) {
    await db.prepare('INSERT INTO sp_role_menus (role_id, menu_id) VALUES ($1, $2) ON CONFLICT DO NOTHING').run(roleId, menuId);
  }
}
