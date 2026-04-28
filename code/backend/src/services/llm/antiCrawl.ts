import { llmService } from './index';
import { ANTI_CRAWL_SYSTEM, ANTI_CRAWL_USER } from './prompts';

export interface PageClassification {
  pageType: 'normal' | 'captcha' | 'waf' | 'login' | 'error' | 'empty';
  confidence: number;
  indicators: string[];
  reason: string;
}

export interface SelectorSuggestion {
  selector: string;
  type: 'list' | 'detail_link' | 'job_title' | 'salary' | 'company' | 'pagination';
  confidence: number;
  reason: string;
}

let lastClassificationTime = 0;
const CLASSIFICATION_COOLDOWN_MS = 5000;

export async function classifyPage(html: string, url: string): Promise<PageClassification> {
  const now = Date.now();
  if (now - lastClassificationTime < CLASSIFICATION_COOLDOWN_MS) {
    // Return a cached-like default for rapid checks
    return {
      pageType: 'normal',
      confidence: 0.5,
      indicators: ['频率限制 - 跳过 LLM 分类'],
      reason: '冷却期内，使用默认分类',
    };
  }
  lastClassificationTime = now;

  try {
    const result = await llmService.callLLM(
      ANTI_CRAWL_SYSTEM,
      ANTI_CRAWL_USER(html, url),
      {
        taskType: 'anti-crawl',
        temperature: 0.1,
        maxTokens: 1024,
      }
    );

    const rawContent = result.content || '';
    if (!rawContent.trim()) {
      return {
        pageType: 'normal',
        confidence: 0.3,
        indicators: ['LLM 返回空内容'],
        reason: 'LLM 无响应，假设为正常页面',
      };
    }

    let parsed: any;
    try {
      parsed = JSON.parse(
        rawContent
          .replace(/```json\s*/gi, '')
          .replace(/```\s*/g, '')
          .trim()
      );
    } catch {
      return {
        pageType: 'normal',
        confidence: 0.3,
        indicators: ['JSON 解析失败'],
        reason: `无法解析响应: ${rawContent.substring(0, 200)}`,
      };
    }

    return {
      pageType: parsed.page_type || 'normal',
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
      indicators: Array.isArray(parsed.indicators) ? parsed.indicators : [],
      reason: parsed.reason || '无说明',
    };
  } catch (e: any) {
    console.error(`[AntiCrawl] 页面分类失败: ${e.message}`);
    return {
      pageType: 'normal',
      confidence: 0,
      indicators: [`LLM 调用失败: ${e.message}`],
      reason: 'LLM 调用异常，假设为正常页面',
    };
  }
}

export async function suggestSelectors(
  html: string,
  target: string
): Promise<SelectorSuggestion[]> {
  const prompt = `分析以下HTML片段中的DOM结构，推荐提取"${target}"的CSS选择器。

HTML内容（前5000字符）:
${html.substring(0, 5000)}

请返回JSON格式：
{
  "selectors": [
    {
      "selector": "CSS选择器",
      "type": "list|detail_link|job_title|salary|company|pagination",
      "confidence": 0.0-1.0,
      "reason": "推荐理由"
    }
  ]
}`;

  try {
    const result = await llmService.callLLM(
      '你是一个网页DOM结构分析专家。根据HTML片段分析并推荐CSS选择器。只输出JSON。',
      prompt,
      {
        taskType: 'anti-crawl',
        temperature: 0.1,
        maxTokens: 2048,
      }
    );

    const rawContent = result.content || '';
    let parsed: any;
    try {
      parsed = JSON.parse(
        rawContent
          .replace(/```json\s*/gi, '')
          .replace(/```\s*/g, '')
          .trim()
      );
    } catch {
      console.error(`[AntiCrawl] 选择器建议 JSON 解析失败: ${rawContent.substring(0, 200)}`);
      return [];
    }

    return (parsed.selectors || []).map((s: any) => ({
      selector: s.selector || '',
      type: s.type || 'list',
      confidence: typeof s.confidence === 'number' ? s.confidence : 0.5,
      reason: s.reason || '',
    }));
  } catch (e: any) {
    console.error(`[AntiCrawl] 选择器推荐失败: ${e.message}`);
    return [];
  }
}

export async function recommendAction(
  classification: PageClassification
): Promise<{
  action: 'continue' | 'wait' | 'retry' | 'switch_ip' | 'captcha_solve' | 'abort';
  waitMs: number;
  reason: string;
}> {
  const { pageType, confidence } = classification;

  if (confidence < 0.5) {
    return { action: 'continue', waitMs: 0, reason: '置信度低，继续尝试' };
  }

  switch (pageType) {
    case 'normal':
      return { action: 'continue', waitMs: 0, reason: '正常页面，继续抓取' };
    case 'captcha':
      return { action: 'retry', waitMs: 30000, reason: '检测到验证码，等待30秒后重试' };
    case 'waf':
      return { action: 'retry', waitMs: 60000, reason: 'WAF 拦截，等待60秒后重试' };
    case 'login':
      return { action: 'abort', waitMs: 0, reason: '检测到登录页面，终止抓取' };
    case 'error':
      return { action: 'retry', waitMs: 10000, reason: '错误页面，10秒后重试' };
    case 'empty':
      return { action: 'retry', waitMs: 15000, reason: '空白页面，15秒后重试' };
    default:
      return { action: 'continue', waitMs: 0, reason: '未知类型，继续尝试' };
  }
}
