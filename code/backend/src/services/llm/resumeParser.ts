import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';
import { llmService } from './index';

/**
 * 从文件 buffer 中提取文本
 * 支持 .docx (mammoth) / .pdf (pdf-parse) / .txt (utf-8)
 */
export async function extractResumeText(
  buffer: Buffer,
  mimetype: string,
  originalname: string
): Promise<string> {
  const ext = originalname.toLowerCase().split('.').pop();

  if (ext === 'docx' || mimetype.includes('word') || mimetype.includes('docx')) {
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value?.trim();
    if (!text) throw new Error('无法从 Word 文件中提取文本内容');
    return text;
  }

  if (ext === 'pdf' || mimetype.includes('pdf')) {
    const result = await pdfParse(buffer);
    const text = result.text?.trim();
    if (!text) throw new Error('无法从 PDF 文件中提取文本内容');
    return text;
  }

  // .txt or fallback: try utf-8 first, then gbk/latin1
  let text = buffer.toString('utf-8').trim();
  if (!text) {
    text = buffer.toString('latin1').trim();
  }
  if (!text) throw new Error('无法从文件中提取文本内容，请确认文件格式');
  return text;
}

export interface ParsedResume {
  name: string | null;
  email: string | null;
  phone: string | null;
  educationLevel: string | null;
  school: string | null;
  major: string | null;
  graduationYear: number | null;
  workYears: number | null;
  skills: string[];
  skillLevels: Record<string, string>;
  desiredPosition: string | null;
  desiredCity: string | null;
  desiredSalaryMin: number | null;
  desiredSalaryMax: number | null;
  jobType: string | null;
  projects: Array<{ name: string; role: string; duration: string; description: string; techStack: string[] }>;
  certifications: string[];
  languages: Array<{ name: string; level: string }>;
  selfEvaluation: string | null;
  parseConfidence: number;
}

/**
 * 使用 LLM 从简历文本中提取结构化信息
 * 带递进重试：推理模型思考消耗大，content 为空时自动提升 maxTokens
 */
export async function parseResumeStructure(resumeText: string): Promise<ParsedResume> {
  const startTime = Date.now();
  const truncatedText = resumeText.substring(0, 4000);

  let lastError: Error | null = null;
  const tokenLimits = [16384, 32768, 49152];

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await llmService.callLLMWithPrompts(
        'resume-parse',
        { resumeText: truncatedText },
        { taskType: 'resume-parse', responseFormat: 'json', temperature: 0.1, maxTokens: tokenLimits[attempt] }
      );

      const content = (result.content || '').trim();
      if (!content) {
        console.error(`[ResumeParser] LLM 返回空内容 (attempt=${attempt + 1}), tokensUsed=${JSON.stringify(result.tokensUsed)}`);
        throw new Error('LLM 返回空内容（推理模型思考过程可能占满了 token 限制）');
      }

      // 尝试去掉可能的 markdown 代码块标记
      const jsonStr = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
      let parsed: any;
      try {
        parsed = JSON.parse(jsonStr);
      } catch {
        const m = jsonStr.match(/\{[\s\S]*\}/);
        if (m) {
          parsed = JSON.parse(m[0]);
        } else {
          throw new Error('LLM 未返回有效的 JSON');
        }
      }

      const duration = Date.now() - startTime;
      console.log(`[ResumeParser] LLM 解析完成 (attempt=${attempt + 1}), 耗时 ${duration}ms, 置信度 ${parsed.parse_confidence}`);

      return {
        name: parsed.name || null,
        email: parsed.email || null,
        phone: parsed.phone || null,
        educationLevel: parsed.education_level || null,
        school: parsed.school || null,
        major: parsed.major || null,
        graduationYear: parsed.graduation_year || null,
        workYears: parsed.work_years || null,
        skills: Array.isArray(parsed.skills) ? parsed.skills : [],
        skillLevels: parsed.skill_levels && typeof parsed.skill_levels === 'object' ? parsed.skill_levels : {},
        desiredPosition: parsed.desired_position || null,
        desiredCity: parsed.desired_city || null,
        desiredSalaryMin: parsed.desired_salary_min || null,
        desiredSalaryMax: parsed.desired_salary_max || null,
        jobType: parsed.job_type || null,
        projects: Array.isArray(parsed.projects) ? parsed.projects : [],
        certifications: Array.isArray(parsed.certifications) ? parsed.certifications : [],
        languages: Array.isArray(parsed.languages) ? parsed.languages : [],
        selfEvaluation: parsed.self_evaluation || null,
        parseConfidence: parsed.parse_confidence || 0,
      };
    } catch (e: any) {
      lastError = e;
      if (attempt < 2) {
        console.warn(`[ResumeParser] 第${attempt + 1}次解析失败，重试中 (maxTokens=${tokenLimits[attempt + 1]}): ${e.message}`);
      }
    }
  }

  throw lastError || new Error('LLM 简历解析失败：3次重试均未返回有效结果');
}
