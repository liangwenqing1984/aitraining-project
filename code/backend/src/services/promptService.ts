import { db } from '../config/database';
import type { PromptCategory, PromptRecord, PromptType } from '../types';

const TABLE = 'sp_prompts';

function convertRow(row: any): PromptRecord {
  return {
    id: row.id,
    category: row.category,
    promptType: row.promptType || row.prompt_type,
    name: row.name,
    content: row.content,
    variables: Array.isArray(row.variables) ? row.variables
      : (typeof row.variables === 'string' ? JSON.parse(row.variables) : []),
    description: row.description,
    isActive: typeof row.isActive === 'boolean' ? row.isActive : (row.is_active !== false),
    sortOrder: row.sortOrder ?? row.sort_order ?? 0,
    createdAt: row.createdAt || row.created_at,
    updatedAt: row.updatedAt || row.updated_at,
  };
}

export async function listByCategory(category: PromptCategory): Promise<PromptRecord[]> {
  const rows = await db.prepare(
    `SELECT * FROM ${TABLE} WHERE category = $1 ORDER BY sort_order, id`
  ).all(category) as any[];
  return rows.map(convertRow);
}

export async function getById(id: number): Promise<PromptRecord | null> {
  const row = await db.prepare(
    `SELECT * FROM ${TABLE} WHERE id = $1`
  ).get(id) as any;
  return row ? convertRow(row) : null;
}

export async function create(data: Omit<PromptRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<PromptRecord> {
  // 如果新建的提示词为激活状态，先将同分类同类型的其他提示词设为未激活
  if (data.isActive !== false) {
    await db.prepare(
      `UPDATE ${TABLE} SET is_active = false WHERE category = $1 AND prompt_type = $2`
    ).run(data.category, data.promptType);
  }

  const result = await db.prepare(`
    INSERT INTO ${TABLE} (category, prompt_type, name, content, variables, description, is_active, sort_order)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
  `).get(
    data.category,
    data.promptType,
    data.name,
    data.content,
    JSON.stringify(data.variables || []),
    data.description || null,
    data.isActive !== false,
    data.sortOrder || 0,
  ) as any;
  return convertRow(result);
}

export async function update(id: number, data: Partial<PromptRecord>): Promise<PromptRecord | null> {
  const existing = await getById(id);
  if (!existing) return null;

  const category = data.category ?? existing.category;
  const promptType = data.promptType ?? existing.promptType;
  const name = data.name ?? existing.name;
  const content = data.content ?? existing.content;
  const variables = data.variables !== undefined ? JSON.stringify(data.variables) : JSON.stringify(existing.variables);
  const description = data.description !== undefined ? data.description : existing.description;
  const isActive = data.isActive !== undefined ? data.isActive : existing.isActive;
  const sortOrder = data.sortOrder !== undefined ? data.sortOrder : existing.sortOrder;

  // 如果激活，先将同分类同类型的其他提示词设为未激活
  if (isActive) {
    await db.prepare(
      `UPDATE ${TABLE} SET is_active = false WHERE category = $1 AND prompt_type = $2 AND id != $3`
    ).run(category, promptType, id);
  }

  const result = await db.prepare(`
    UPDATE ${TABLE}
    SET category = $1, prompt_type = $2, name = $3, content = $4, variables = $5,
        description = $6, is_active = $7, sort_order = $8, updated_at = CURRENT_TIMESTAMP
    WHERE id = $9
    RETURNING *
  `).get(category, promptType, name, content, variables, description, isActive, sortOrder, id) as any;
  return result ? convertRow(result) : null;
}

export async function remove(id: number): Promise<boolean> {
  const result = await db.prepare(
    `DELETE FROM ${TABLE} WHERE id = $1`
  ).run(id);
  return result.changes > 0;
}

export async function getActiveForCategory(category: PromptCategory): Promise<{
  systemPrompt: string;
  userPromptTemplate: string;
} | null> {
  const systemRow = await db.prepare(
    `SELECT content FROM ${TABLE} WHERE category = $1 AND prompt_type = 'system' AND is_active = true ORDER BY sort_order LIMIT 1`
  ).get(category) as any;

  const userRow = await db.prepare(
    `SELECT content FROM ${TABLE} WHERE category = $1 AND prompt_type = 'user' AND is_active = true ORDER BY sort_order LIMIT 1`
  ).get(category) as any;

  if (!systemRow && !userRow) return null;

  return {
    systemPrompt: systemRow?.content || '',
    userPromptTemplate: userRow?.content || '',
  };
}

export async function resetDefault(category: PromptCategory, promptType: PromptType): Promise<PromptRecord> {
  // 动态导入默认提示词
  const { getDefaultPromptContent } = await import('./llm/promptDefaults');
  const defaultContent = getDefaultPromptContent(category, promptType);

  // 删除同分类同类型的现有记录
  await db.prepare(
    `DELETE FROM ${TABLE} WHERE category = $1 AND prompt_type = $2`
  ).run(category, promptType);

  // 插入默认值
  return create({
    category,
    promptType,
    name: `${category} ${promptType === 'system' ? 'System' : 'User'} Prompt`,
    content: defaultContent,
    variables: [],
    description: '从默认值重置',
    isActive: true,
    sortOrder: 0,
  });
}
