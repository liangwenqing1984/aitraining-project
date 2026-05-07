# 智能查询与分析模块：Excel/CSV → sp_jobs 数据库迁移

## 日期

2026-05-07

## 背景

此前已将爬虫原始职位数据同步写入 `sp_jobs` 表（参考 [#120](120_原始职位数据同步入库_sp_jobs表.md)），但智能查询、语义搜索、智能分析三个模块仍在读取 Excel/CSV 文件，导致：

- 数据源不一致：分析结果依赖文件系统上的 Excel，与数据库数据可能不同步
- 架构不统一：增强/向量化已切到 sp_jobs，但分析模块仍走旧路径
- 维护负担：两套数据读取逻辑并存

## 修复方案

将三个模块全部从 Excel/CSV 文件读取改为 `sp_jobs` 数据库表查询。

### 1. 智能分析模块 — analysisController.ts（完全重写）

**原有逻辑**：通过 `csv-parser` + `fs.createReadStream` 读取 CSV 文件，解析后统计。

**新逻辑**：
- 新增 `getJobDataByFileId(fileId)` 函数：通过 `sp_csv_files` 查询 taskId，再查 `sp_jobs`
- 新增 `getField(row, topLevelKey, rawDataKey)` 函数：优先取顶层列，回退到 `raw_data` JSONB
- 5 个接口函数全部改用上述两个 helper 从 sp_jobs 取数

```typescript
async function getJobDataByFileId(fileId: string): Promise<{ taskId: string; rows: any[] }> {
  const file = await db.prepare('SELECT * FROM sp_csv_files WHERE id = ?').get(fileId) as any;
  if (!file) throw new Error('文件不存在');
  const rows = await db.prepare('SELECT * FROM sp_jobs WHERE task_id = ?').all(file.taskId || file.task_id) as any[];
  return { taskId: file.taskId || file.task_id, rows };
}
```

### 2. 语义搜索模块 — rag.ts

**原有逻辑**：`indexJobEmbeddings()` 用 ExcelJS 打开 Excel 文件读取 `job_name`、`company_name`、`work_city` 构建 rawDataMap。

**新逻辑**：直接从 `sp_jobs` 表查询这三个字段：
```typescript
const jobRows = await db.prepare(
  'SELECT job_id, job_name, company_name, work_city FROM sp_jobs WHERE task_id = $1'
).all(taskId) as any[];
```

### 3. AI 数据增强模块 — enrichment.ts

**原有逻辑**：`startEnrichment()` 通过 ExcelJS 读取 Excel 文件构建 rows 数组。

**新逻辑**：查询 `sp_jobs` 表，解析 `raw_data` JSONB + 顶层字段覆盖构建 rows，保持与 `enrichSingleJob()` 兼容。

### 4. 智能查询模块 — query.ts + prompts.ts

**原有逻辑**：LLM 的 schema 上下文中只提到 `sp_job_enrichments`、`tasks`、`csv_files`。

**新逻辑**：
- `query.ts`：schema 字符串增加 `sp_jobs（原始职位数据表）`
- `prompts.ts`：`NL_QUERY_SYSTEM` 中新增 `sp_jobs` 表完整定义，让 LLM 可以直接对原始数据生成 SQL

## 涉及文件

| 文件 | 操作 |
|------|------|
| `code/backend/src/controllers/analysisController.ts` | 完全重写：CSV 解析 → sp_jobs 查询 |
| `code/backend/src/services/llm/rag.ts` | Excel 读取 → sp_jobs 查询 |
| `code/backend/src/services/llm/enrichment.ts` | Excel 读取 → sp_jobs + raw_data JSONB |
| `code/backend/src/services/llm/query.ts` | schema 字符串添加 sp_jobs |
| `code/backend/src/services/llm/prompts.ts` | NL_QUERY_SYSTEM 添加 sp_jobs 表定义 |

## 数据流

```
爬虫 yield JobData
  → appendExcelRow()
    → Excel 写入
    → DB INSERT INTO sp_jobs（ON CONFLICT DO NOTHING）
    → 去重 Set 记录

下游模块：
  → AI 增强 → 读 sp_jobs → 写 sp_job_enrichments
  → 语义搜索 → 读 sp_jobs → 写 sp_job_embeddings
  → 智能分析 → 读 sp_jobs → 实时统计
  → 智能查询 → LLM 可直接查 sp_jobs（原始字段）+ sp_job_enrichments（增强字段）
```

## Bug 修复

- `enrichment.ts` 第 60 行多余 `}` 导致编译失败 — 删除
- `enrichment.ts` `total` 变量作用域问题（const 在 try 块内，catch 块无法引用） — 提升为 `let total = 0;` 外部声明
