import { db } from '../../config/database';
import { llmService } from './index';
import { NL_QUERY_SYSTEM, NL_QUERY_USER } from './prompts';
import crypto from 'crypto';

function extractJSON(text: string): any {
  let cleaned = text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .replace(/\/\/[^\n]*/g, '')
    .trim();

  try { return JSON.parse(cleaned); } catch {}

  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start !== -1 && end > start) {
    cleaned = cleaned.substring(start, end + 1)
      .replace(/,(\s*[}\]])/g, '$1')
      .replace(/[\x00-\x1F\x7F]/g, ' ');
    try { return JSON.parse(cleaned); } catch {}
  }

  try {
    return JSON.parse(cleaned
      .replace(/:\s*'([^']*)'/g, ': "$1"')
      .replace(/(\w+):/g, '"$1":')
    );
  } catch {}

  throw new Error(`无法从以下内容提取 JSON: ${text.substring(0, 300)}`);
}

function validateSQL(sql: string): boolean {
  const upper = sql.trim().toUpperCase();
  // Only allow SELECT statements
  if (!upper.startsWith('SELECT')) return false;
  // Block dangerous keywords
  const dangerous = [
    'INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE',
    'TRUNCATE', 'EXEC', 'EXECUTE', 'CALL', 'DO $$',
    'COPY', 'GRANT', 'REVOKE', 'VACUUM',
  ];
  for (const kw of dangerous) {
    if (upper.includes(kw)) return false;
  }
  return true;
}

function limitSQL(sql: string): string {
  const upper = sql.trim().toUpperCase();
  if (!upper.includes('LIMIT')) {
    return `${sql.trim()} LIMIT 500`;
  }
  return sql.trim();
}

export interface QueryResult {
  id: string;
  userQuery: string;
  generatedSql: string;
  resultSummary: string;
  resultData: any[];
  resultCount: number;
  modelUsed: string;
  createdAt: string;
}

export async function executeNLQuery(
  question: string,
  taskId?: string
): Promise<QueryResult> {
  console.log(`[NLQuery] 处理查询: "${question}"`);

  // Step 1: Generate SQL
  const schema = taskId
    ? `job_enrichments (task_id='${taskId}')`
    : 'job_enrichments, tasks, csv_files';

  const llmResult = await llmService.callLLM(
    NL_QUERY_SYSTEM,
    NL_QUERY_USER(question, schema),
    {
      taskType: 'query',
      temperature: 0.1,
      maxTokens: 4096,
    }
  );

  const rawContent = llmResult.content || '';
  if (!rawContent.trim()) {
    throw new Error('LLM 返回空内容，查询失败');
  }

  const parsed = extractJSON(rawContent);
  let sql = parsed.sql || '';
  let needsAppFilter = parsed.needsAppFilter || false;

  if (!sql.trim()) {
    throw new Error('LLM 未能生成有效 SQL');
  }

  if (!validateSQL(sql)) {
    throw new Error(`SQL 安全校验未通过: ${sql.substring(0, 100)}`);
  }

  sql = limitSQL(sql);
  console.log(`[NLQuery] 生成 SQL: ${sql}`);

  // Step 2: Execute SQL
  let resultData: any[] = [];
  let resultCount = 0;

  try {
    // Extract params (simple approach: replace placeholders directly)
    let querySql = sql;
    const params = parsed.params || [];

    // If SQL uses $1, $2 style, use direct execution
    if (params.length > 0) {
      resultData = await db.prepare(querySql).all(...params) as any[];
    } else {
      // Try with raw client for queries without params
      resultData = await db.prepare(querySql).all() as any[];
    }

    resultCount = Array.isArray(resultData) ? resultData.length : 0;
    console.log(`[NLQuery] 查询结果: ${resultCount} 行`);
  } catch (execErr: any) {
    console.error(`[NLQuery] SQL 执行失败: ${execErr.message}`);
    throw new Error(`SQL 执行失败: ${execErr.message}`);
  }

  // Step 3: Generate summary with LLM
  let resultSummary = '';
  if (resultCount > 0) {
    const summaryData = resultData.slice(0, 20);
    try {
      const summaryResult = await llmService.callLLM(
        '你是一个数据分析助手。用简洁的中文总结查询结果的关键发现。',
        `用户问题：${question}\n\n查询结果（前20条）：\n${JSON.stringify(summaryData, null, 2)}\n\n请用2-3句话总结关键发现。`,
        {
          taskType: 'query',
          temperature: 0.3,
          maxTokens: 512,
        }
      );
      resultSummary = summaryResult.content || `共查询到 ${resultCount} 条结果`;
    } catch {
      resultSummary = `共查询到 ${resultCount} 条结果`;
    }
  } else {
    resultSummary = '未查询到匹配结果';
  }

  // Step 4: Save to history
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.prepare(`
    INSERT INTO saved_queries (id, task_id, user_query, generated_sql, result_summary, result_data, result_count, model_used, created_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
  `).run(
    id, taskId || null, question, sql,
    resultSummary, JSON.stringify(resultData.slice(0, 50)),
    resultCount, llmResult.model || '', now
  );

  return {
    id,
    userQuery: question,
    generatedSql: sql,
    resultSummary,
    resultData: resultData.slice(0, 500),
    resultCount,
    modelUsed: llmResult.model || '',
    createdAt: now,
  };
}

export async function getQueryHistory(): Promise<QueryResult[]> {
  const rows = await db.prepare(`
    SELECT * FROM saved_queries ORDER BY created_at DESC LIMIT 50
  `).all() as any[];

  return rows.map((r: any) => ({
    id: r.id,
    userQuery: r.userQuery,
    generatedSql: r.generatedSql,
    resultSummary: r.resultSummary,
    resultData: typeof r.resultData === 'string' ? JSON.parse(r.resultData) : r.resultData,
    resultCount: r.resultCount,
    modelUsed: r.modelUsed,
    createdAt: r.createdAt,
  }));
}

export async function deleteQuery(id: string): Promise<void> {
  await db.prepare('DELETE FROM saved_queries WHERE id=$1').run(id);
}
