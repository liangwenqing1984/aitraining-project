# RAG 知识库构建关键问题修复

**日期**: 2026-04-28  
**影响范围**: 职位向量化存储、语义搜索、pgvector集成  
**关联文件**: `database.ts`, `embeddings.ts`, `rag.ts`, `ragController.ts`, `ragRoutes.ts`, `MainLayout.vue`, `router/index.ts`, `rag/Index.vue`

---

## 问题1: pgvector 类型 `type "vector" does not exist`

### 现象
后端启动时报错 `type "vector" does not exist`，`job_embeddings` 表创建失败。

### 根因
`pgvector` 扩展安装在 `public` schema，但应用数据操作使用 `liangwenqing` schema。`SET search_path TO liangwenqing` 不包含 `public`，导致 PostgreSQL 找不到 `vector` 类型。

### 修复
1. 将 `CREATE EXTENSION IF NOT EXISTS vector` 移到 `SET search_path` 之前执行
2. 将所有 `SET search_path TO liangwenqing` 改为 `SET search_path TO liangwenqing, public`（3处：`db.prepare().all/get/run`）

**文件**: [database.ts:35-38](code/backend/src/config/database.ts)

---

## 问题2: TypeScript 编译错误 `'workMode' does not exist`

### 现象
```
error TS2353: Object literal may only specify known properties, 
and 'workMode' does not exist in type ...
```

### 根因
`buildJobText()` 的参数类型定义缺少 `workMode` 字段，但函数体和调用方（`rag.ts`）都已使用该字段，仅类型声明遗漏。

### 修复
在 `buildJobText` 参数类型中添加 `workMode?: string`，移除函数体内的 `(job as any).workMode` 强制类型转换。

**文件**: [embeddings.ts:47-60](code/backend/src/services/llm/embeddings.ts)

---

## 问题3: 语义搜索结果显示"未知职位"

### 现象
搜索结果中 `jobName`、`companyName`、`workCity` 全部为空字符串，界面显示"未知职位"。

### 根因
`indexJobEmbeddings` 只从 `job_enrichments` 表读取数据，但该表仅存储 LLM 增强字段（技能、分类、学历等），不包含原始职位字段（职位名称、公司名称、工作城市）。原始数据仅存在于 Excel 文件中。

### 修复
在 `indexJobEmbeddings` 中添加 Excel 读取步骤：
1. 从 `csv_files` 表查找任务对应的 Excel 文件路径
2. 用 ExcelJS 读取 Excel，构建 `Map<jobId, {jobName, companyName, workCity}>`
3. INSERT 时使用 Map 中的真实值替代空字符串
4. ON CONFLICT DO UPDATE 同步更新 `job_name`、`company_name`、`work_city`

**文件**: [rag.ts:48-85](code/backend/src/services/llm/rag.ts)

---

## 问题4: 重新索引后旧数据未更新

### 现象
修改索引代码后重新索引，已存在的 55 条记录仍显示"未知职位"。

### 根因
`indexJobEmbeddings` 中有"检查是否已存在 → 跳过"的逻辑（`if (existing) { skipped++; continue; }`）。当记录已存在时，INSERT 永远不会执行，`ON CONFLICT DO UPDATE` 也永远不会触发。

### 修复
移除跳过已存在记录的检查逻辑，让 `ON CONFLICT DO UPDATE` 处理所有重复情况。重新索引时旧记录会被更新为包含完整原始字段。

**文件**: [rag.ts:95-103](code/backend/src/services/llm/rag.ts)（已删除该检查块）

---

## 问题5: 语义搜索页面"选择要索引的任务"下拉框无数据

### 现象
下拉框始终为空，无法选择任务进行向量化索引。

### 根因
前端调用 `taskApi.listTasks()` 但实际 API 方法名为 `taskApi.getTasks()`。调用静默失败（catch 块为空），下拉框无数据。

同时，`getTasks` 返回的数据结构为 `{ list, total }`，而非 `{ tasks }`，数据路径也不匹配。

### 修复
1. `taskApi.listTasks()` → `taskApi.getTasks()`
2. `res.data.tasks || res.data.rows || res.data` → `res.data.list || res.data`

**文件**: [rag/Index.vue:202](code/frontend/src/views/rag/Index.vue)

---

## 架构总结

```
Crawler → Excel (.xlsx 磁盘文件)
              ↙                      ↘
    enrichment 读取 Excel        RAG 索引读取 Excel
    → LLM 增强 → job_enrichments  → 构建原始字段 Map
              ↘                      ↙
              job_embeddings (向量 + 原始字段 + 增强字段)
                     ↓
              semanticSearch (余弦相似度)
```
