import { db } from '../config/database';
import type { SystemUser, SystemRole } from '../types';
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function listUsers(params: {
  page?: number; pageSize?: number; keyword?: string;
}): Promise<{ list: SystemUser[]; total: number }> {
  const { page = 1, pageSize = 10, keyword } = params;
  const offset = (page - 1) * pageSize;

  let where = '';
  const args: any[] = [];

  if (keyword) {
    where = 'WHERE u.username ILIKE $1 OR u.real_name ILIKE $1 OR u.email ILIKE $1';
    args.push(`%${keyword}%`);
  }

  const countResult = await db.prepare(
    `SELECT COUNT(*) as cnt FROM sp_users u ${where}`
  ).get(...args);
  const total = (countResult as any)?.cnt || 0;

  const users = await db.prepare(
    `SELECT u.id, u.username, u.real_name, u.email, u.phone, u.oauth2_user_id, u.status, u.created_at, u.updated_at
     FROM sp_users u ${where}
     ORDER BY u.id DESC
     LIMIT $${args.length + 1} OFFSET $${args.length + 2}`
  ).all(...args, pageSize, offset) as SystemUser[];

  // 批量加载角色
  if (users.length > 0) {
    const userIds = users.map(u => u.id!);
    const placeholders = userIds.map((_, i) => `$${i + 1}`).join(',');
    const roles = await db.prepare(
      `SELECT ur.user_id, r.id, r.name, r.code
       FROM sp_user_roles ur
       JOIN sp_roles r ON r.id = ur.role_id
       WHERE ur.user_id IN (${placeholders})`
    ).all(...userIds) as any[];

    const roleMap: Record<number, SystemRole[]> = {};
    for (const row of roles) {
      if (!roleMap[row.userId]) roleMap[row.userId] = [];
      roleMap[row.userId].push({ id: row.id, name: row.name, code: row.code, status: true });
    }
    for (const user of users) {
      user.roles = roleMap[user.id!] || [];
      user.roleIds = user.roles.map(r => r.id!);
    }
  }

  return { list: users, total };
}

export async function getUserById(id: number): Promise<SystemUser | null> {
  const user = await db.prepare(
    'SELECT id, username, real_name, email, phone, oauth2_user_id, status, created_at, updated_at FROM sp_users WHERE id = $1'
  ).get(id) as SystemUser | null;

  if (user) {
    const roles = await db.prepare(
      `SELECT r.id, r.name, r.code FROM sp_user_roles ur
       JOIN sp_roles r ON r.id = ur.role_id WHERE ur.user_id = $1`
    ).all(id) as any[];
    user.roles = roles.map((r: any) => ({ id: r.id, name: r.name, code: r.code, status: true }));
    user.roleIds = user.roles.map(r => r.id!);
  }

  return user;
}

export async function createUser(data: SystemUser): Promise<SystemUser> {
  const passwordHash = data.password ? await hashPassword(data.password) : null;

  const result = await db.prepare(
    `INSERT INTO sp_users (username, password_hash, real_name, email, phone, oauth2_user_id, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`
  ).run(data.username, passwordHash, data.realName, data.email || null, data.phone || null, data.oauth2UserId || null, data.status !== false);

  const id = (result as any).lastID || (result as any).rows?.[0]?.id;
  // 获取插入的ID
  const inserted = await db.prepare('SELECT id FROM sp_users ORDER BY id DESC LIMIT 1').get();
  const userId = (inserted as any)?.id || id;

  if (data.roleIds && data.roleIds.length > 0) {
    await updateUserRoles(userId, data.roleIds);
  }

  return (await getUserById(userId))!;
}

export async function updateUser(id: number, data: Partial<SystemUser>): Promise<SystemUser | null> {
  const existing = await db.prepare('SELECT * FROM sp_users WHERE id = $1').get(id) as any;
  if (!existing) return null;

  const username = data.username ?? existing.username;
  const realName = data.realName ?? existing.realName;
  const email = data.email !== undefined ? data.email : existing.email;
  const phone = data.phone !== undefined ? data.phone : existing.phone;
  const oauth2UserId = data.oauth2UserId !== undefined ? data.oauth2UserId : existing.oauth2UserId;
  const status = data.status !== undefined ? data.status : existing.status;

  let passwordHash = existing.passwordHash;
  if (data.password) {
    passwordHash = await hashPassword(data.password);
  }

  await db.prepare(
    `UPDATE sp_users SET username=$1, password_hash=$2, real_name=$3, email=$4, phone=$5, oauth2_user_id=$6, status=$7, updated_at=CURRENT_TIMESTAMP
     WHERE id=$8`
  ).run(username, passwordHash, realName, email, phone, oauth2UserId, status, id);

  if (data.roleIds !== undefined) {
    await updateUserRoles(id, data.roleIds);
  }

  return getUserById(id);
}

export async function deleteUser(id: number): Promise<boolean> {
  const result = await db.prepare('DELETE FROM sp_users WHERE id = $1').run(id);
  return (result as any).changes > 0;
}

export async function updateUserRoles(userId: number, roleIds: number[]): Promise<void> {
  await db.prepare('DELETE FROM sp_user_roles WHERE user_id = $1').run(userId);
  for (const roleId of roleIds) {
    await db.prepare('INSERT INTO sp_user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING').run(userId, roleId);
  }
}
