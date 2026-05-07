# 原始职位数据同步入库 — 新增 sp_jobs 表

## 日期

2026-05-07

## 背景

爬虫采集的原始职位数据仅写入 Excel 文件，未持久化到数据库。这导致：
- 数据分析、自然语言查询等模块无法直接查询原始数据
- Excel 文件丢失后数据不可恢复
- 无法做跨任务的职位数据聚合查询

## 修复方案

### 1. 新增 `sp_jobs` 表

在 `database.ts` 中创建，存储原始爬取数据：

| 字段 | 类型 | 说明 |
|------|------|------|
| id | VARCHAR(255) PK | UUID |
| task_id | VARCHAR(255) FK | 关联 sp_tasks，CASCADE 删除 |
| job_id | VARCHAR(255) | 职位 ID |
| data_source | VARCHAR(50) | 前程无忧 / 智联招聘 |
| company_name | VARCHAR(500) | 企业名称 |
| job_name | VARCHAR(500) | 职位名称 |
| work_city | VARCHAR(100) | 工作城市 |
| salary_range | VARCHAR(100) | 薪资范围 |
| education | VARCHAR(50) | 学历要求 |
| work_experience | VARCHAR(100) | 工作经验 |
| job_category | VARCHAR(200) | 职位分类 |
| raw_data | JSONB | 完整原始数据（所有 JobData 字段） |
| created_at | TIMESTAMP | 创建时间 |

- `UNIQUE(task_id, job_id)` 约束，支持幂等重跑
- 索引：`idx_jobs_task_id`、`idx_jobs_data_source`

### 2. 改造 `appendExcelRow` 同步入库

在 `taskService.ts` 的 `appendExcelRow()` 中，Excel 写入成功后立即执行 DB INSERT：

```typescript
// 同时写入数据库（原始职位数据持久化）
try {
  await db.prepare(`
    INSERT INTO sp_jobs (...) VALUES (...) ON CONFLICT (task_id, job_id) DO NOTHING
  `).run(uuidv4(), taskId, job.jobId, ...);
} catch (dbErr) {
  // DB 写入失败不中断爬取
}
```

关键设计：
- `ON CONFLICT DO NOTHING`：断点续传时重复数据静默跳过
- `try-catch` 包裹：DB 写入失败不影响爬取和 Excel 写入
- 独立于去重逻辑：已写入的 jobId 仍记录到 dedup Set

## 涉及文件

| 文件 | 操作 |
|------|------|
| `code/backend/src/config/database.ts` | 新增 sp_jobs 表 + 2 个索引 |
| `code/backend/src/services/taskService.ts` | appendExcelRow 增加 DB INSERT 逻辑 |

## 数据流

```
爬虫 yield JobData
  → appendExcelRow()
    → Excel 写入 (原有逻辑)
    → DB INSERT INTO sp_jobs (新增)
    → 去重 Set 记录
```
