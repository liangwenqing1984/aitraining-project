import * as promptService from '../promptService';
import { getDefaultPromptContent } from './promptDefaults';
import type { PromptCategory } from '../../types';

// 60 秒内存缓存
interface CacheEntry {
  systemPrompt: string;
  userPromptTemplate: string;
  timestamp: number;
}
const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 60_000;

/**
 * 替换模板字符串中的 \${varName} 占位符
 * 支持点号嵌套访问：\${obj.nested.field}
 */
export function interpolateTemplate(template: string, vars: Record<string, any>): string {
  if (!template || Object.keys(vars).length === 0) return template;

  return template.replace(/\$\{([^}]+)\}/g, (_match, expr: string) => {
    const path = expr.trim().split('.');
    let value: any = vars;
    for (const key of path) {
      if (value == null) break;
      value = value[key];
    }
    return value != null ? String(value) : '';
  });
}

/**
 * 解析提示词：优先 DB → 回退硬编码默认值 → 插值用户提示词
 */
export async function resolvePrompts(
  category: PromptCategory,
  userPromptVars?: Record<string, any>
): Promise<{ systemPrompt: string; userPrompt: string }> {
  const now = Date.now();
  const cached = cache.get(category);

  let systemPrompt: string;
  let userPromptTemplate: string;

  if (cached && (now - cached.timestamp) < CACHE_TTL) {
    systemPrompt = cached.systemPrompt;
    userPromptTemplate = cached.userPromptTemplate;
  } else {
    const dbPrompts = await promptService.getActiveForCategory(category);

    if (dbPrompts && (dbPrompts.systemPrompt || dbPrompts.userPromptTemplate)) {
      systemPrompt = dbPrompts.systemPrompt || getDefaultPromptContent(category, 'system');
      userPromptTemplate = dbPrompts.userPromptTemplate || getDefaultPromptContent(category, 'user');
    } else {
      systemPrompt = getDefaultPromptContent(category, 'system');
      userPromptTemplate = getDefaultPromptContent(category, 'user');
    }

    cache.set(category, { systemPrompt, userPromptTemplate, timestamp: now });
  }

  const userPrompt = userPromptVars
    ? interpolateTemplate(userPromptTemplate, userPromptVars)
    : userPromptTemplate;

  return { systemPrompt, userPrompt };
}

/** 清除缓存（管理端修改提示词后调用） */
export function clearPromptCache(category?: PromptCategory): void {
  if (category) {
    cache.delete(category);
  } else {
    cache.clear();
  }
}
