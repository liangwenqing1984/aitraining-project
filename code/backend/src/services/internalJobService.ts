import { db } from '../config/database';
import { generateEmbedding } from './llm/embeddings';
import type { InternalJob } from '../types';

export async function listInternalJobs(params: {
  keyword?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ list: any[]; total: number; page: number; pageSize: number }> {
  const pg = Math.max(1, params.page || 1);
  const ps = Math.min(100, Math.max(1, params.pageSize || 10));
  const offset = (pg - 1) * ps;

  let where = 'WHERE 1=1';
  const args: any[] = [];

  if (params.keyword) {
    where += ' AND (title ILIKE ? OR department ILIKE ? OR description ILIKE ?)';
    args.push(`%${params.keyword}%`, `%${params.keyword}%`, `%${params.keyword}%`);
  }
  if (params.status) {
    where += ' AND status = ?';
    args.push(params.status);
  }

  const countRow = await db.prepare(
    `SELECT COUNT(*) as total FROM sp_internal_jobs ${where}`
  ).get(...args) as any;

  const rows = await db.prepare(
    `SELECT * FROM sp_internal_jobs ${where} ORDER BY updated_at DESC LIMIT ? OFFSET ?`
  ).all(...args, ps, offset) as any[];

  return {
    list: rows.map(parseRow),
    total: Number(countRow?.total) || 0,
    page: pg,
    pageSize: ps,
  };
}

export async function getInternalJob(id: number): Promise<any | null> {
  const row = await db.prepare('SELECT * FROM sp_internal_jobs WHERE id = ?').get(id) as any;
  return row ? parseRow(row) : null;
}

export async function createInternalJob(data: InternalJob): Promise<number> {
  const result = await db.prepare(`
    INSERT INTO sp_internal_jobs (title, department, description, requirement, education_required, experience_years_min, experience_years_max, required_skills, preferred_skills, skill_match_mode, city_preferred, job_category, headcount, salary_min, salary_max, job_type, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.title, data.department || null, data.description, data.requirement || null,
    data.educationRequired || null, data.experienceYearsMin || null, data.experienceYearsMax || null,
    JSON.stringify(data.requiredSkills || []), JSON.stringify(data.preferredSkills || []),
    data.skillMatchMode || 'any', JSON.stringify(data.cityPreferred || []),
    data.jobCategory || null, data.headcount || 1,
    data.salaryMin || null, data.salaryMax || null,
    data.jobType || '全职', data.status || 'open'
  );

  const jobId = result.lastID as number;

  // 异步生成 embedding
  generateInternalJobEmbedding(jobId, data).catch(e => {
    console.error(`[InternalJob] embedding 生成失败 id=${jobId}:`, e.message);
  });

  return jobId;
}

export async function updateInternalJob(id: number, data: Partial<InternalJob>): Promise<void> {
  const existing = await db.prepare('SELECT id FROM sp_internal_jobs WHERE id = ?').get(id) as any;
  if (!existing) throw new Error('岗位不存在');

  const fieldMap: Record<string, string> = {
    title: 'title', department: 'department', description: 'description',
    requirement: 'requirement', educationRequired: 'education_required',
    experienceYearsMin: 'experience_years_min', experienceYearsMax: 'experience_years_max',
    skillMatchMode: 'skill_match_mode', jobCategory: 'job_category',
    headcount: 'headcount', salaryMin: 'salary_min', salaryMax: 'salary_max',
    jobType: 'job_type', status: 'status',
  };

  const setClauses: string[] = [];
  const args: any[] = [];

  for (const [key, col] of Object.entries(fieldMap)) {
    if ((data as any)[key] !== undefined) {
      setClauses.push(`${col} = ?`);
      args.push((data as any)[key]);
    }
  }

  const jsonbFields = ['requiredSkills', 'preferredSkills', 'cityPreferred'];
  for (const f of jsonbFields) {
    if ((data as any)[f] !== undefined) {
      const col = f.replace(/[A-Z]/g, m => '_' + m.toLowerCase());
      setClauses.push(`${col} = ?`);
      args.push(JSON.stringify((data as any)[f]));
    }
  }

  if (setClauses.length === 0) return;

  setClauses.push('updated_at = CURRENT_TIMESTAMP');
  args.push(id);

  await db.prepare(`UPDATE sp_internal_jobs SET ${setClauses.join(', ')} WHERE id = ?`).run(...args);

  // 如果 description 或 requirement 有变更，重新生成 embedding
  if (data.description || data.requirement) {
    const updated = await getInternalJob(id);
    if (updated) {
      generateInternalJobEmbedding(id, updated).catch(e => {
        console.error(`[InternalJob] embedding 更新失败 id=${id}:`, e.message);
      });
    }
  }
}

export async function deleteInternalJob(id: number): Promise<void> {
  await db.prepare('DELETE FROM sp_internal_jobs WHERE id = ?').run(id);
}

async function generateInternalJobEmbedding(id: number, data: any): Promise<void> {
  const textParts = [data.title, data.description, data.requirement].filter(Boolean);
  const text = textParts.join('\n\n');
  if (!text.trim()) return;

  const { embedding } = await generateEmbedding(text);
  const vectorStr = `[${embedding.join(',')}]`;

  await db.prepare(
    'UPDATE sp_internal_jobs SET embedding = ?::vector, embedding_text = ? WHERE id = ?'
  ).run(vectorStr, text.substring(0, 2000), id);
}

function parseRow(row: any): any {
  for (const f of ['requiredSkills', 'preferredSkills', 'cityPreferred']) {
    if (typeof row[f] === 'string' && row[f]) {
      try { row[f] = JSON.parse(row[f]); } catch { row[f] = []; }
    }
    if (!row[f]) row[f] = [];
  }
  return row;
}
