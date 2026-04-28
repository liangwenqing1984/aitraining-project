/**
 * Embedding 向量化服务
 * 使用 Ollama nomic-embed-text 模型生成 768 维文本向量
 * 支持单个/批量文本向量化
 */

const EMBEDDING_MODEL = 'nomic-embed-text';
const EMBEDDING_DIM = 768;
const OLLAMA_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

export interface EmbeddingResult {
  embedding: number[];
  tokens: number;
  duration: number;
}

async function callOllamaEmbedding(text: string): Promise<EmbeddingResult> {
  const start = Date.now();
  const response = await fetch(`${OLLAMA_URL}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: EMBEDDING_MODEL, prompt: text }),
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
 * 生成单个文本的 embedding
 */
export async function generateEmbedding(text: string): Promise<EmbeddingResult> {
  return callOllamaEmbedding(text);
}

/**
 * 批量生成 embedding（顺序调用，避免 Ollama 并发压力）
 */
export async function generateEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
  const results: EmbeddingResult[] = [];
  for (let i = 0; i < texts.length; i++) {
    console.log(`[Embedding] 向量化 ${i + 1}/${texts.length}...`);
    try {
      const result = await callOllamaEmbedding(texts[i]);
      results.push(result);
    } catch (e: any) {
      console.error(`[Embedding] 第 ${i + 1} 条失败:`, e.message);
      throw e;
    }
    // 避免 Ollama 过载
    if (i < texts.length - 1) {
      await new Promise(r => setTimeout(r, 100));
    }
  }
  return results;
}

export { EMBEDDING_MODEL, EMBEDDING_DIM };
