/**
 * Embedding 向量化服务
 * 优先使用 LLM 配置中的 embedding 模型，未配置时回退到 Ollama nomic-embed-text
 * 支持单个/批量文本向量化
 */

import { llmService } from './index';
import { EmbeddingResult } from '../../types';

// 回退常量（未配置 embedding 模型时使用）
const FALLBACK_MODEL = 'nomic-embed-text';
const FALLBACK_DIM = 768;
const FALLBACK_OLLAMA_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

// 常用 embedding 模型维度映射（动态获取配置时用于确定向量维度）
const MODEL_DIM_MAP: Record<string, number> = {
  'nomic-embed-text': 768,
  'text-embedding-3-small': 1536,
  'text-embedding-3-large': 3072,
  'text-embedding-ada-002': 1536,
  'bge-large-zh': 1024,
  'bge-m3': 1024,
  'mxbai-embed-large': 1024,
  'all-minilm': 384,
};

let cachedDim: number | null = null;

/**
 * 获取当前使用的 embedding 向量维度
 */
export async function getEmbeddingDim(): Promise<number> {
  if (cachedDim !== null) return cachedDim;
  try {
    const config = await llmService.getConfigForTask('embedding');
    if (config) {
      cachedDim = MODEL_DIM_MAP[config.modelName] || FALLBACK_DIM;
      return cachedDim;
    }
  } catch {}
  cachedDim = FALLBACK_DIM;
  return cachedDim;
}

/**
 * 重置维度缓存（配置变更后调用）
 */
export function resetEmbeddingDimCache(): void {
  cachedDim = null;
}

/**
 * 回退方案：直接调用 Ollama Embedding API（无配置时使用）
 */
async function fallbackOllamaEmbedding(text: string): Promise<EmbeddingResult> {
  const start = Date.now();
  const response = await fetch(`${FALLBACK_OLLAMA_URL}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: FALLBACK_MODEL, prompt: text }),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '未知错误');
    throw new Error(`Ollama Embedding API 错误 (${response.status}): ${errText.substring(0, 200)}`);
  }

  const data: any = await response.json();
  const embedding = data.embedding as number[];

  if (!embedding || embedding.length === 0) {
    throw new Error('Ollama 返回空 embedding');
  }

  return {
    embedding,
    tokens: data.prompt_eval_count || 0,
    duration: Date.now() - start,
  };
}

/**
 * 将职位信息拼接为可向量化的文本
 */
export function buildJobText(job: {
  jobName?: string;
  jobCategoryL1?: string;
  jobCategoryL2?: string;
  keySkills?: string[] | string;
  companyIndustry?: string;
  jobDescription?: string;
  companyName?: string;
  workCity?: string;
  educationNormalized?: string;
  salaryMonthlyMin?: number;
  salaryMonthlyMax?: number;
  workMode?: string;
}): string {
  const parts: string[] = [];

  if (job.jobName) parts.push(`职位: ${job.jobName}`);
  if (job.jobCategoryL1) parts.push(`分类: ${job.jobCategoryL1}`);
  if (job.jobCategoryL2) parts.push(`子分类: ${job.jobCategoryL2}`);

  let skills: string[] = [];
  if (Array.isArray(job.keySkills)) {
    skills = job.keySkills;
  } else if (typeof job.keySkills === 'string') {
    try { skills = JSON.parse(job.keySkills); } catch { skills = [job.keySkills]; }
  }
  if (skills.length > 0) parts.push(`技能: ${skills.join(', ')}`);

  if (job.companyIndustry) parts.push(`行业: ${job.companyIndustry}`);
  if (job.companyName) parts.push(`公司: ${job.companyName}`);
  if (job.workCity) parts.push(`城市: ${job.workCity}`);
  if (job.educationNormalized) parts.push(`学历: ${job.educationNormalized}`);

  const salaryParts: string[] = [];
  if (job.salaryMonthlyMin) salaryParts.push(`月薪下限${job.salaryMonthlyMin}元`);
  if (job.salaryMonthlyMax) salaryParts.push(`上限${job.salaryMonthlyMax}元`);
  if (salaryParts.length > 0) parts.push(salaryParts.join(''));

  if (job.workMode) parts.push(`工作模式: ${job.workMode}`);
  if (job.jobDescription) {
    parts.push(`描述: ${job.jobDescription.substring(0, 500)}`);
  }

  return parts.join('; ');
}

/**
 * 生成单个文本的 embedding（优先使用配置，回退到 Ollama 本地模型）
 */
export async function generateEmbedding(text: string): Promise<EmbeddingResult> {
  try {
    const config = await llmService.getConfigForTask('embedding');
    if (config) {
      console.log(`[Embedding] 使用模型: ${config.provider}/${config.modelName}`);
      return await llmService.embed(text);
    }
  } catch (e: any) {
    console.warn(`[Embedding] 配置模型调用失败，回退到 Ollama ${FALLBACK_MODEL}: ${e.message}`);
  }

  console.log(`[Embedding] 回退到默认模型: ${FALLBACK_MODEL}`);
  return fallbackOllamaEmbedding(text);
}

/**
 * 批量生成 embedding（顺序调用，避免并发压力）
 */
export async function generateEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
  const results: EmbeddingResult[] = [];
  for (let i = 0; i < texts.length; i++) {
    console.log(`[Embedding] 向量化 ${i + 1}/${texts.length}...`);
    try {
      const result = await generateEmbedding(texts[i]);
      results.push(result);
    } catch (e: any) {
      console.error(`[Embedding] 第 ${i + 1} 条失败:`, e.message);
      throw e;
    }
    if (i < texts.length - 1) {
      await new Promise(r => setTimeout(r, 100));
    }
  }
  return results;
}

// 保留旧常量导出以兼容（推荐使用 getEmbeddingDim()）
export const EMBEDDING_MODEL = FALLBACK_MODEL;
export const EMBEDDING_DIM = FALLBACK_DIM;
