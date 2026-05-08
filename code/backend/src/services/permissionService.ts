import { db } from '../config/database';
import type { SystemPermission } from '../types';

export async function listPermissions(params: {
  page?: number; pageSize?: number; keyword?: string;
}): Promise<{ list: SystemPermission[]; total: number }> {
  const { page = 1, pageSize = 10, keyword } = params;
  const offset = (page - 1) * pageSize;

  let where = '';
  const args: any[] = [];

  if (keyword) {
    where = 'WHERE name ILIKE $1 OR code ILIKE $1 OR resource ILIKE $1';
    args.push(`%${keyword}%`);
  }

  const countResult = await db.prepare(
    `SELECT COUNT(*) as cnt FROM sp_permissions ${where}`
  ).get(...args);
  const total = (countResult as any)?.cnt || 0;

  const list = await db.prepare(
    `SELECT * FROM sp_permissions ${where} ORDER BY resource, action LIMIT $${args.length + 1} OFFSET $${args.length + 2}`
  ).all(...args, pageSize, offset) as SystemPermission[];

  return { list, total };
}

export async function getAllPermissions(): Promise<{ resource: string; permissions: SystemPermission[] }[]> {
  const perms = await db.prepare(
    'SELECT * FROM sp_permissions ORDER BY resource, action'
  ).all() as SystemPermission[];

  // 按 resource 分组
  const groups: Record<string, SystemPermission[]> = {};
  for (const perm of perms) {
    if (!groups[perm.resource]) groups[perm.resource] = [];
    groups[perm.resource].push(perm);
  }

  return Object.entries(groups).map(([resource, permissions]) => ({ resource, permissions }));
}

export async function getPermissionById(id: number): Promise<SystemPermission | null> {
  return db.prepare('SELECT * FROM sp_permissions WHERE id = $1').get(id) as Promise<SystemPermission | null>;
}

export async function createPermission(data: SystemPermission): Promise<SystemPermission> {
  await db.prepare(
    'INSERT INTO sp_permissions (name, code, resource, action, description) VALUES ($1, $2, $3, $4, $5)'
  ).run(data.name, data.code, data.resource, data.action, data.description || null);

  const inserted = await db.prepare('SELECT * FROM sp_permissions ORDER BY id DESC LIMIT 1').get();
  return inserted as SystemPermission;
}

export async function updatePermission(id: number, data: Partial<SystemPermission>): Promise<SystemPermission | null> {
  const existing = await db.prepare('SELECT * FROM sp_permissions WHERE id = $1').get(id) as any;
  if (!existing) return null;

  const name = data.name ?? existing.name;
  const code = data.code ?? existing.code;
  const resource = data.resource ?? existing.resource;
  const action = data.action ?? existing.action;
  const description = data.description !== undefined ? data.description : existing.description;

  await db.prepare(
    'UPDATE sp_permissions SET name=$1, code=$2, resource=$3, action=$4, description=$5 WHERE id=$6'
  ).run(name, code, resource, action, description, id);

  return db.prepare('SELECT * FROM sp_permissions WHERE id = $1').get(id) as Promise<SystemPermission>;
}

export async function deletePermission(id: number): Promise<boolean> {
  const result = await db.prepare('DELETE FROM sp_permissions WHERE id = $1').run(id);
  return (result as any).changes > 0;
}
