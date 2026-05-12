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

const RAG_SYSTEM_PROMPT = `你是AI培训系统的智能助手，专门回答关于本系统的使用问题。

## 你的职责
1. 仅根据提供的帮助文档内容回答问题，不要编造不存在的信息
2. 如果文档中没有相关信息，诚实告知用户"文档中暂无相关内容"，不要猜测
3. 回答要简洁清晰，适合非技术用户阅读
4. 当涉及API端点、配置参数等细节时，给出准确信息
5. 使用中文回答

## 帮助文档内容
{context}

## 用户问题
{question}

请根据以上文档内容回答用户问题。如果文档内容不足以回答问题，请说明。`;

// 内存级关键词兜底匹配（不依赖 pgvector，确保总能找到文档）
function fallbackSearch(query: string, topK: number = 5): DocSearchResult[] {
  const lower = query.toLowerCase();
  const scored: { section: typeof DOC_SECTIONS[0]; score: number }[] = [];

  // 提取关键词：中文2字以上词 + 英文词 + 中文拆分为2字片段
  const keywords: string[] = [];
  const chineseWords = query.match(/[一-龥]{2,}/g) || [];
  const englishWords = query.match(/[a-zA-Z]{2,}/g) || [];
  keywords.push(...chineseWords, ...englishWords, query);

  // 中文长词拆分为2字片段，解决"数据库设计"无法匹配"数据库表结构"的问题
  for (const cw of chineseWords) {
    for (let i = 0; i <= cw.length - 2; i++) {
      const bigram = cw.substring(i, i + 2);
      if (!keywords.includes(bigram)) keywords.push(bigram);
    }
  }

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
  return scored.slice(0, topK).map(s => ({
    sectionId: s.section.sectionId,
    sectionTitle: s.section.title,
    chunkIndex: 0,
    textContent: s.section.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 2000),
    similarity: Math.min(s.score / 20, 0.99),
  }));
}

export async function sendMessage(
  question: string,
  sessionId?: number
): Promise<ChatResponse> {
  // 1. 语义搜索相关文档
  let docResults: DocSearchResult[] = [];
  try {
    docResults = await searchDocs(question, 5, 0.3);
    console.log(`[Chat] 向量搜索返回 ${docResults.length} 条结果:`, docResults.map(d => d.sectionTitle));
  } catch (e: any) {
    console.warn('[Chat] 向量搜索失败:', e.message);
  }

  // 2. 内存关键词兜底（始终执行，与向量结果合并）
  const fallbackResults = fallbackSearch(question, 5);
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

  // 3. 构建上下文
  const context = docResults.length > 0
    ? docResults.map((d, i) => `### ${d.sectionTitle}\n${d.textContent}`).join('\n\n')
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
