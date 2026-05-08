import { db } from '../config/database';
import type { SystemMenu } from '../types';

export async function listMenus(params: {
  page?: number; pageSize?: number; keyword?: string;
}): Promise<{ list: SystemMenu[]; total: number }> {
  const { page = 1, pageSize = 50, keyword } = params;

  let where = '';
  const args: any[] = [];

  if (keyword) {
    where = 'WHERE name ILIKE $1 OR path ILIKE $1';
    args.push(`%${keyword}%`);
  }

  const all = await db.prepare(
    `SELECT * FROM sp_menus ${where} ORDER BY sort_order, id`
  ).all(...args) as SystemMenu[];

  return { list: all, total: all.length };
}

export async function getMenuTree(): Promise<SystemMenu[]> {
  const all = await db.prepare(
    'SELECT * FROM sp_menus ORDER BY sort_order, id'
  ).all() as SystemMenu[];

  return buildTree(all, null);
}

function buildTree(menus: SystemMenu[], parentId: number | null): SystemMenu[] {
  return menus
    .filter(m => (m.parentId ?? null) === parentId)
    .map(m => ({
      ...m,
      children: buildTree(menus, m.id!),
    }));
}

export async function getMenuById(id: number): Promise<SystemMenu | null> {
  return db.prepare('SELECT * FROM sp_menus WHERE id = $1').get(id) as Promise<SystemMenu | null>;
}

export async function createMenu(data: SystemMenu): Promise<SystemMenu> {
  await db.prepare(
    `INSERT INTO sp_menus (name, path, icon, parent_id, sort_order, component, hidden)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`
  ).run(
    data.name, data.path || null, data.icon || null,
    data.parentId || null, data.sortOrder || 0,
    data.component || null, data.hidden || false
  );

  const inserted = await db.prepare('SELECT * FROM sp_menus ORDER BY id DESC LIMIT 1').get();
  return inserted as SystemMenu;
}

export async function updateMenu(id: number, data: Partial<SystemMenu>): Promise<SystemMenu | null> {
  const existing = await db.prepare('SELECT * FROM sp_menus WHERE id = $1').get(id) as any;
  if (!existing) return null;

  const name = data.name ?? existing.name;
  const path = data.path !== undefined ? data.path : existing.path;
  const icon = data.icon !== undefined ? data.icon : existing.icon;
  const parentId = data.parentId !== undefined ? data.parentId : existing.parentId;
  const sortOrder = data.sortOrder ?? existing.sortOrder;
  const component = data.component !== undefined ? data.component : existing.component;
  const hidden = data.hidden !== undefined ? data.hidden : existing.hidden;

  // 防止循环引用：父级不能是自己或自己的后代
  if (parentId) {
    let checkId: number | null = parentId;
    while (checkId) {
      if (checkId === id) {
        throw new Error('不能将菜单的父级设置为自己或自己的子菜单');
      }
      const parent = await db.prepare('SELECT parent_id FROM sp_menus WHERE id = $1').get(checkId) as any;
      checkId = parent?.parentId ?? null;
    }
  }

  await db.prepare(
    `UPDATE sp_menus SET name=$1, path=$2, icon=$3, parent_id=$4, sort_order=$5, component=$6, hidden=$7, updated_at=CURRENT_TIMESTAMP WHERE id=$8`
  ).run(name, path, icon, parentId, sortOrder, component, hidden, id);

  return db.prepare('SELECT * FROM sp_menus WHERE id = $1').get(id) as Promise<SystemMenu>;
}

export async function deleteMenu(id: number): Promise<{ success: boolean; error?: string }> {
  // 检查是否有子菜单
  const children = await db.prepare('SELECT COUNT(*) as cnt FROM sp_menus WHERE parent_id = $1').get(id) as any;
  if (children?.cnt > 0) {
    return { success: false, error: '该菜单下有子菜单，请先删除子菜单' };
  }

  // 清理关联数据
  await db.prepare('DELETE FROM sp_role_menus WHERE menu_id = $1').run(id);
  const result = await db.prepare('DELETE FROM sp_menus WHERE id = $1').run(id);
  return { success: (result as any).changes > 0 };
}
