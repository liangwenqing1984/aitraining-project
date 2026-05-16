import type { PromptCategory, PromptType } from '../../types';
import { ENRICHMENT_SYSTEM } from './prompts';
import { INSIGHTS_SYSTEM } from './prompts';
import { NL_QUERY_SYSTEM } from './prompts';
import { RESUME_PARSE_SYSTEM } from './prompts';
import { ANTI_CRAWL_SYSTEM } from './prompts';

// 用户提示词的默认模板内容（对应 prompts.ts 中各 USER 函数的模板文本）
const ENRICHMENT_USER_TEMPLATE = `请分析以下职位信息并进行标准化：

企业名称：\${companyName}
职位名称：\${jobName}
职位分类：\${jobCategory}
薪资范围：\${salaryRange}
工作城市：\${workCity}
工作地址：\${workAddress}
工作经验：\${workExperience}
学历要求：\${education}
公司性质：\${companyNature}
公司规模：\${companyScale}
经营范围：\${businessScope}
职位标签：\${jobTags}
工作性质：\${workType}
职位描述：\${jobDescription}`;

const INSIGHTS_USER_TEMPLATE = `请基于以下招聘数据统计生成深度分析报告：

数据概览：
- 总职位数：\${totalJobs}
- 覆盖城市数：\${cityCount}
- 数据时间范围：\${dateRange}

薪资分布：
\${salaryDistribution}

城市分布（Top 10）：
\${cityDistribution}

学历分布：
\${educationDistribution}

经验要求分布：
\${experienceDistribution}

公司性质分布：
\${companyNatureDistribution}

热门职位（Top 10）：
\${topJobs}

热门技能：
\${topSkills}`;

const NL_QUERY_USER_TEMPLATE = `用户问题：\${question}

请生成对应的SQL查询。`;

const RESUME_PARSE_USER_TEMPLATE = `请解析以下简历文本并提取结构化信息：

\${resumeText}`;

const ANTI_CRAWL_USER_TEMPLATE = `URL: \${url}

HTML内容（前5000字符）:
\${html}`;

export function getDefaultPromptContent(category: PromptCategory, promptType: PromptType): string {
  const map: Record<string, Record<string, string>> = {
    enrichment: { system: ENRICHMENT_SYSTEM, user: ENRICHMENT_USER_TEMPLATE },
    insights: { system: INSIGHTS_SYSTEM, user: INSIGHTS_USER_TEMPLATE },
    query: { system: NL_QUERY_SYSTEM, user: NL_QUERY_USER_TEMPLATE },
    'resume-parse': { system: RESUME_PARSE_SYSTEM, user: RESUME_PARSE_USER_TEMPLATE },
    'anti-crawl': { system: ANTI_CRAWL_SYSTEM, user: ANTI_CRAWL_USER_TEMPLATE },
  };

  const entry = map[category];
  if (!entry) throw new Error(`Unknown prompt category: ${category}`);
  const content = entry[promptType];
  if (content === undefined) throw new Error(`Unknown prompt type: ${promptType} for ${category}`);
  return content;
}
