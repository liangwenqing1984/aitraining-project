import { db } from '../config/database';
import { searchDocs, DOC_SECTIONS, type DocSearchResult } from './docIndexService';
import { llmService } from './llm/index';

export interface ChatSession {
  id?: number;
  title: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ChatMessage {
  id?: number;
  sessionId: number;
  role: 'user' | 'assistant';
  content: string;
  sources?: DocSearchResult[];
  createdAt?: string;
}

export interface ChatResponse {
  sessionId: number;
  message: ChatMessage;
}

const RAG_SYSTEM_PROMPT = `你是招聘职位智能采集与分析系统的智能助手，专门回答关于本系统的各类问题。

## 知识范围
你可以根据以下类型的内容回答用户问题：
- 帮助文档：系统功能说明、API参考、使用指南
- 用户手册：系统安装部署、配置指南、常见问题
- 诊断文档：历史问题诊断、根因分析、修复方案
- 设计文档：项目需求、技术架构、功能设计、测试用例
- 后端源代码：TypeScript实现细节（服务层/控制器/路由）
- 前端源代码：Vue组件逻辑、API封装、状态管理

## 你的职责
1. 优先根据提供的参考内容回答问题
2. 如果多种来源都有相关信息，综合回答并注明来源类型
3. 如果所有参考内容中都没有相关信息，诚实告知用户"文档和代码中暂无相关内容"，不要猜测或编造
4. 回答要简洁清晰，适合技术人员阅读
5. 当涉及API端点、配置参数、代码实现等细节时，给出准确信息
6. 使用中文回答

## 参考内容
{context}

## 用户问题
{question}

请根据以上参考内容回答用户问题。如果内容不足以回答问题，请说明。`;

// 内存级关键词兜底匹配（不依赖 pgvector，确保总能找到文档）
async function fallbackSearch(query: string, topK: number = 5): Promise<DocSearchResult[]> {
  const results: DocSearchResult[] = [];

  // 1. 硬编码帮助文档匹配（保持原有逻辑）
  const keywords: string[] = [];
  const chineseWords = query.match(/[一-龥]{2,}/g) || [];
  const englishWords = query.match(/[a-zA-Z]{2,}/g) || [];
  keywords.push(...chineseWords, ...englishWords, query);

  for (const cw of chineseWords) {
    for (let i = 0; i <= cw.length - 2; i++) {
      const bigram = cw.substring(i, i + 2);
      if (!keywords.includes(bigram)) keywords.push(bigram);
    }
  }

  const scored: { section: typeof DOC_SECTIONS[0]; score: number }[] = [];
  for (const section of DOC_SECTIONS) {
    let score = 0;
    const titleLower = section.title.toLowerCase();
    const contentLower = section.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').toLowerCase();
    for (const kw of keywords) {
      const kwLower = kw.toLowerCase();
      if (titleLower.includes(kwLower)) score += 5;
      if (contentLower.includes(kwLower)) score += 1;
    }
    if (score > 0) scored.push({ section, score });
  }
  scored.sort((a, b) => b.score - a.score);
  for (const s of scored.slice(0, topK)) {
    results.push({
      sectionId: s.section.sectionId,
      sectionTitle: s.section.title,
      chunkIndex: 0,
      textContent: s.section.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 2000),
      similarity: Math.min(s.score / 20, 0.99),
      sourceType: 'doc_section',
      filePath: undefined,
    });
  }

  // 2. 数据库源码 ILIKE 匹配（搜索非 doc_section 类型的索引数据）
  if (results.length < topK) {
    try {
      const dbKeywords = [...chineseWords, ...englishWords].filter(k => k.length >= 2);
      if (dbKeywords.length > 0) {
        const conditions = dbKeywords.map((_, i) =>
          `(section_title ILIKE $${i + 1} OR text_content ILIKE $${i + 1})`
        );
        const params = dbKeywords.map(k => `%${k}%`);
        const sql = `
          SELECT section_id, section_title, chunk_index, text_content, source_type, file_path, 0.4 AS similarity
          FROM sp_doc_embeddings
          WHERE source_type != 'doc_section'
            AND (${conditions.join(' OR ')})
          ORDER BY section_id, chunk_index
          LIMIT $${params.length + 1}
        `;
        params.push(String(topK - results.length));
        const rows = await db.prepare(sql).all(...params) as any[];
        for (const r of rows) {
          const sid = r.sectionId || r.section_id;
          if (!results.some(existing => existing.sectionId === sid)) {
            results.push({
              sectionId: sid,
              sectionTitle: r.sectionTitle || r.section_title,
              chunkIndex: r.chunkIndex || r.chunk_index || 0,
              textContent: (r.textContent || r.text_content || '').substring(0, 2000),
              similarity: 0.4,
              sourceType: r.sourceType || 'backend_source',
              filePath: r.filePath || undefined,
            });
          }
        }
      }
    } catch (e: any) {
      console.warn('[Chat] 源码兜底搜索失败:', e.message);
    }
  }

  return results;
}

export async function sendMessage(
  question: string,
  sessionId?: number
): Promise<ChatResponse> {
  // 1. 语义搜索相关文档
  let docResults: DocSearchResult[] = [];
  try {
    docResults = await searchDocs(question, 5, 0.2);
    console.log(`[Chat] 向量搜索返回 ${docResults.length} 条结果:`, docResults.map(d => d.sectionTitle));
  } catch (e: any) {
    console.warn('[Chat] 向量搜索失败:', e.message);
  }

  // 2. 内存关键词兜底（始终执行，与向量结果合并）
  const fallbackResults = await fallbackSearch(question, 5);
  console.log(`[Chat] 内存匹配返回 ${fallbackResults.length} 条结果:`, fallbackResults.map(d => d.sectionTitle));

  // 合并去重：向量结果优先，内存结果补充
  const existingIds = new Set(docResults.map(r => r.sectionId));
  for (const fr of fallbackResults) {
    if (!existingIds.has(fr.sectionId)) {
      docResults.push(fr);
      existingIds.add(fr.sectionId);
    }
  }
  // 限制最多 6 个章节
  docResults = docResults.slice(0, 6);

  // 3. 构建上下文（带来源类型标签）
  const SOURCE_LABELS: Record<string, string> = {
    doc_section: '帮助文档',
    user_doc: '用户手册',
    diagnostic: '诊断文档',
    design_doc: '设计文档',
    backend_source: '后端源代码',
    frontend_source: '前端源代码',
  };
  const context = docResults.length > 0
    ? docResults.map((d, i) => {
        const label = SOURCE_LABELS[d.sourceType] || d.sourceType;
        const prefix = label ? `[${label}] ` : '';
        return `### ${prefix}${d.sectionTitle}\n${d.textContent}`;
      }).join('\n\n')
    : '暂无相关文档内容';

  // 3. 构建 prompt
  const systemPrompt = RAG_SYSTEM_PROMPT.replace('{context}', context);
  const userPrompt = question;

  // 4. 调用 LLM
  let answer: string;
  try {
    const result = await llmService.callLLM(systemPrompt, userPrompt, {
      taskType: 'query',
      temperature: 0.3,
    });
    answer = result.content;
  } catch (e: any) {
    console.error('[Chat] LLM 调用失败:', e.message);
    answer = '抱歉，AI 服务暂时不可用，请检查模型配置后重试。';
    docResults = []; // LLM 失败时清除引用来源
  }

  // 5. 创建或获取会话
  let finalSessionId: number;
  if (sessionId) {
    finalSessionId = sessionId;
    // 更新会话标题（用问题的前30个字符）
    const title = question.length > 30 ? question.substring(0, 30) + '...' : question;
    // 只在会话标题为默认值时更新
    const session = await db.prepare(
      'SELECT title FROM sp_chat_sessions WHERE id = $1'
    ).get(finalSessionId) as any;
    if (session?.title === '新对话') {
      await db.prepare(
        'UPDATE sp_chat_sessions SET title = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2'
      ).run(title, finalSessionId);
    } else {
      await db.prepare(
        'UPDATE sp_chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = $1'
      ).run(finalSessionId);
    }
  } else {
    const result = await db.prepare(
      'INSERT INTO sp_chat_sessions (title) VALUES ($1) RETURNING id'
    ).get('新对话') as any;
    finalSessionId = result.id;
  }

  // 6. 保存用户消息
  await db.prepare(
    'INSERT INTO sp_chat_messages (session_id, role, content) VALUES ($1, $2, $3)'
  ).run(finalSessionId, 'user', question);

  // 7. 保存 AI 回复
  const sourcesJson = docResults.length > 0
    ? JSON.stringify(docResults.map(d => ({
        sectionId: d.sectionId,
        sectionTitle: d.sectionTitle,
        similarity: d.similarity,
        sourceType: d.sourceType,
        filePath: d.filePath,
      })))
    : null;

  const msgResult = await db.prepare(
    'INSERT INTO sp_chat_messages (session_id, role, content, sources) VALUES ($1, $2, $3, $4) RETURNING id, created_at'
  ).get(finalSessionId, 'assistant', answer, sourcesJson) as any;

  return {
    sessionId: finalSessionId,
    message: {
      id: msgResult.id,
      sessionId: finalSessionId,
      role: 'assistant',
      content: answer,
      sources: docResults,
      createdAt: msgResult.createdAt || msgResult.created_at,
    },
  };
}

export async function getSessions(): Promise<ChatSession[]> {
  const rows = await db.prepare(
    'SELECT id, title, created_at, updated_at FROM sp_chat_sessions ORDER BY updated_at DESC'
  ).all() as any[];

  return rows.map(r => ({
    id: r.id,
    title: r.title,
    createdAt: r.createdAt || r.created_at,
    updatedAt: r.updatedAt || r.updated_at,
  }));
}

export async function getSessionMessages(sessionId: number): Promise<ChatMessage[]> {
  const rows = await db.prepare(
    'SELECT id, session_id, role, content, sources, created_at FROM sp_chat_messages WHERE session_id = $1 ORDER BY created_at ASC'
  ).all(sessionId) as any[];

  return rows.map(r => ({
    id: r.id,
    sessionId: r.sessionId || r.session_id,
    role: r.role,
    content: r.content,
    sources: r.sources ? (typeof r.sources === 'string' ? JSON.parse(r.sources) : r.sources) : undefined,
    createdAt: r.createdAt || r.created_at,
  }));
}

export async function deleteSession(sessionId: number): Promise<void> {
  await db.prepare('DELETE FROM sp_chat_sessions WHERE id = $1').run(sessionId);
}
