# 智能查询结果增加原始数据展示 — JOIN sp_jobs 表

## 日期

2026-05-07

## 背景

智能数据查询（NL Query）模块的结果此前只展示 `sp_job_enrichments`（AI 增强后）的数据字段（薪资范围、技能标签、行业分类等），缺少原始爬取字段（企业名称、职位名称、工作城市、薪资原文等），导致查询结果信息不完整。

## 修复方案

修改 LLM 的 NL_QUERY_SYSTEM prompt，引导 LLM 生成 SQL 时默认 `LEFT JOIN sp_jobs`，将两表数据合并返回。

### 变更内容

**`prompts.ts`** — 更新 NL_QUERY_SYSTEM 注意事项：

- 原规则 2：`查询薪资、技能、学历、行业、职位分类等信息时，必须从 sp_job_enrichments 表查询`
- 新规则 2+3：
  1. 增强字段（薪资、技能等）从 sp_job_enrichments 查；原始字段（企业名称、职位名称、工作城市等）从 sp_jobs 查
  2. **重要**：默认使用 `LEFT JOIN sp_jobs ON sp_job_enrichments.task_id = sp_jobs.task_id AND sp_job_enrichments.job_id = sp_jobs.job_id`，SELECT 中列出两表字段

**`query.ts`** — 更新 schema 描述：

```
sp_job_enrichments（核心增强数据表，主表）LEFT JOIN sp_jobs（原始职位数据表，ON task_id+job_id）
```

### 效果

查询 `薪资最高的10个岗位` 时，SQL 输出类似：

```sql
SELECT e.salary_monthly_max, e.job_category_l1,
       j.company_name, j.job_name, j.work_city, j.salary_range
FROM sp_job_enrichments e
LEFT JOIN sp_jobs j ON e.task_id = j.task_id AND e.job_id = j.job_id
ORDER BY e.salary_monthly_max DESC
LIMIT 10
```

前端表格会同时展示增强字段（月薪上限、一级分类）和原始字段（企业名称、职位名称、城市、薪资原文），无需前端改动。

## 涉及文件

| 文件 | 操作 |
|------|------|
| `code/backend/src/services/llm/prompts.ts` | NL_QUERY_SYSTEM 规则改为两表 JOIN |
| `code/backend/src/services/llm/query.ts` | schema 字符串更新为 JOIN 形式 |
