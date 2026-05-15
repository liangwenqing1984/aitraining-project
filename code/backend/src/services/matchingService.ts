import { db } from '../config/database';
import { generateEmbedding } from './llm/embeddings';

export interface HardRuleCheck {
  passed: boolean;
  education: { passed: boolean; required: string; actual: string };
  experience: { passed: boolean; requiredMin: number; actual: number };
  requiredSkills: { passed: boolean; required: string[]; matched: string[]; missing: string[]; mode: 'all' | 'any' };
}

export interface ScreeningResult {
  internalJobId: number;
  internalJobTitle: string;
  department: string;
  hardRules: HardRuleCheck;
  softMatch: {
    similarity: number;
    matchedSkills: string[];
    preferredSkillMatches: string[];
  };
  totalScore: number;
  scoreBreakdown: {
    hardRuleScore: number;
    similarityScore: number;
    skillBonus: number;
  };
  recommendation: 'strong' | 'moderate' | 'weak' | 'rejected';
}

export interface ScreenRequest {
  resumeId?: number;
  resumeText?: string;
  internalJobId?: number;
  limit?: number;
  minScore?: number;
}

/**
 * 简历-岗位匹配打分引擎
 * 三级融合：硬性规则过滤 + 向量语义相似度 + 技能加分
 */
export async function screenResumeAgainstJobs(params: ScreenRequest): Promise<{
  resumeId: number | null;
  resumeName: string;
  totalJobsCompared: number;
  results: ScreeningResult[];
}> {
  const limit = Math.min(50, Math.max(1, params.limit || 20));
  const minScore = params.minScore || 0;

  // 1. 获取简历数据和向量
  let resumeData: any;
  let resumeEmbedding: number[] | null = null;

  if (params.resumeId) {
    resumeData = await db.prepare('SELECT * FROM sp_resumes WHERE id = ?').get(params.resumeId) as any;
    if (!resumeData) throw new Error('简历不存在');
    // 获取已有 embedding 或实时生成
    if (resumeData.embedding) {
      resumeEmbedding = parseVector(resumeData.embedding);
    } else if (resumeData.raw_text) {
      const { embedding } = await generateEmbedding(resumeData.raw_text.substring(0, 2000));
      resumeEmbedding = embedding;
    }
  } else if (params.resumeText) {
    resumeData = { raw_text: params.resumeText, name: '手动输入', skills: [], education_level: null, work_years: null };
    const { embedding } = await generateEmbedding(params.resumeText.substring(0, 2000));
    resumeEmbedding = embedding;
  } else {
    throw new Error('请提供简历 ID 或简历文本');
  }

  // 解析简历字段
  const resumeSkills: string[] = typeof resumeData.skills === 'string'
    ? JSON.parse(resumeData.skills || '[]')
    : (resumeData.skills || []);
  const resumeEducation = resumeData.education_level || '';
  const resumeWorkYears = resumeData.work_years || 0;

  // 2. 获取内部岗位列表
  let jobs: any[];
  if (params.internalJobId) {
    jobs = await db.prepare(
      'SELECT * FROM sp_internal_jobs WHERE id = ? AND status = ?'
    ).all(params.internalJobId, 'open') as any[];
  } else {
    jobs = await db.prepare(
      'SELECT * FROM sp_internal_jobs WHERE status = ? ORDER BY updated_at DESC'
    ).all('open') as any[];
  }

  if (jobs.length === 0) throw new Error('没有可匹配的内部岗位（状态为"招聘中"）');

  // 3. 对每个岗位计算匹配分数
  const results: ScreeningResult[] = [];

  for (const job of jobs) {
    const jobSkills: string[] = typeof job.required_skills === 'string'
      ? JSON.parse(job.required_skills || '[]')
      : (job.required_skills || []);
    const jobPreferredSkills: string[] = typeof job.preferred_skills === 'string'
      ? JSON.parse(job.preferred_skills || '[]')
      : (job.preferred_skills || []);
    const skillMode: 'all' | 'any' = job.skill_match_mode || 'any';

    // 硬性规则检查
    const hardRules = checkHardRules({
      resumeEducation,
      resumeWorkYears,
      resumeSkills,
      jobEducation: job.education_required || '',
      jobExperienceMin: job.experience_years_min || 0,
      jobRequiredSkills: jobSkills,
      skillMode,
    });

    // 向量语义相似度
    let similarity = 0;
    if (resumeEmbedding && job.embedding) {
      const jobEmb = parseVector(job.embedding);
      similarity = cosineSimilarity(resumeEmbedding, jobEmb) * 100;
    } else if (resumeEmbedding && job.embedding_text) {
      // fallback: 为岗位实时生成 embedding
      const { embedding } = await generateEmbedding(job.embedding_text.substring(0, 2000));
      similarity = cosineSimilarity(resumeEmbedding, embedding) * 100;
    }

    // 技能匹配计算
    const resumeSkillLower = resumeSkills.map((s: string) => s.toLowerCase());
    const matchedRequired = jobSkills.filter((s: string) => resumeSkillLower.includes(s.toLowerCase()));
    const matchedPreferred = jobPreferredSkills.filter((s: string) => resumeSkillLower.includes(s.toLowerCase()));
    const matchedSkills = [...new Set([...matchedRequired, ...matchedPreferred])];

    // 打分
    const hardRuleScore = hardRules.passed ? 40 : 0;
    const similarityScore = Math.round(similarity * 0.4 * 10) / 10; // 0-100 * 0.4 → 0-40
    const skillBonus = Math.min(20,
      matchedRequired.length * 3 + matchedPreferred.length * 2
      + Math.max(0, matchedSkills.length - matchedRequired.length - matchedPreferred.length) * 1
    );
    const totalScore = Math.round((hardRuleScore + similarityScore + skillBonus) * 10) / 10;

    let recommendation: ScreeningResult['recommendation'] = 'rejected';
    if (totalScore >= 80) recommendation = 'strong';
    else if (totalScore >= 60) recommendation = 'moderate';
    else if (totalScore >= 40) recommendation = 'weak';

    if (totalScore >= minScore) {
      results.push({
        internalJobId: job.id,
        internalJobTitle: job.title,
        department: job.department || '',
        hardRules,
        softMatch: { similarity, matchedSkills, preferredSkillMatches: matchedPreferred },
        totalScore,
        scoreBreakdown: { hardRuleScore, similarityScore, skillBonus },
        recommendation,
      });
    }
  }

  // 排序：强制通过硬规则的排前面，然后按总分降序
  results.sort((a, b) => {
    if (a.hardRules.passed !== b.hardRules.passed) return a.hardRules.passed ? -1 : 1;
    return b.totalScore - a.totalScore;
  });

  return {
    resumeId: params.resumeId || null,
    resumeName: resumeData.name || '未命名简历',
    totalJobsCompared: jobs.length,
    results: results.slice(0, limit),
  };
}

function checkHardRules(params: {
  resumeEducation: string;
  resumeWorkYears: number;
  resumeSkills: string[];
  jobEducation: string;
  jobExperienceMin: number;
  jobRequiredSkills: string[];
  skillMode: 'all' | 'any';
}): HardRuleCheck {
  const { resumeEducation, resumeWorkYears, resumeSkills, jobEducation, jobExperienceMin, jobRequiredSkills, skillMode } = params;

  // 学历等级映射
  const eduRank: Record<string, number> = { '高中': 1, '大专': 2, '本科': 3, '硕士': 4, '博士': 5 };
  const eduPassed = !jobEducation || (eduRank[resumeEducation] || 0) >= (eduRank[jobEducation] || 0);

  // 经验年限检查
  const expPassed = jobExperienceMin <= 0 || resumeWorkYears >= jobExperienceMin;

  // 技能检查
  const resumeSkillLower = resumeSkills.map(s => s.toLowerCase());
  const matched = jobRequiredSkills.filter(s => resumeSkillLower.includes(s.toLowerCase()));
  const missing = jobRequiredSkills.filter(s => !resumeSkillLower.includes(s.toLowerCase()));
  const skillsPassed = jobRequiredSkills.length === 0
    || (skillMode === 'any' ? matched.length > 0 : missing.length === 0);

  return {
    passed: eduPassed && expPassed && skillsPassed,
    education: { passed: eduPassed, required: jobEducation, actual: resumeEducation },
    experience: { passed: expPassed, requiredMin: jobExperienceMin, actual: resumeWorkYears },
    requiredSkills: { passed: skillsPassed, required: jobRequiredSkills, matched, missing, mode: skillMode },
  };
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

function parseVector(v: any): number[] {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') {
    // pgvector 格式: [0.1,0.2,...] 或 (0.1,0.2,...)
    const s = v.replace(/[\[\]()]/g, '');
    return s.split(',').map(Number);
  }
  return [];
}
