# totalRecords 作用域提升与失败持久化修复

## 问题

### 问题 1：恢复任务后 record_count 从 1 开始计数

任务恢复前已采集了若干条数据（如 200 条），恢复后 `record_count` 在 UI 上从 1 重新计数。虽然 CSV 文件包含之前的数据，但进度显示和最终统计都不正确。

### 问题 2：任务失败后 record_count 丢失

任务因异常（如浏览器崩溃）失败后，`tasks` 表 `record_count` 字段为 0，导致后续无法正确恢复。

## 根因分析

### totalRecords 作用域问题

```typescript
// 旧代码 — 变量在 try 块内部声明
try {
  let totalRecords = 0;  // try 内部声明，catch 块不可访问
  // ...
} catch (error) {
  // ❌ totalRecords 不可访问！TypeScript 编译错误 TS2304
  await db.prepare(`UPDATE tasks SET ... record_count = $1 ...`)
    .run(error.message, totalRecords, taskId);
}
```

### 失败处理不保存 record_count

旧代码在 catch 块中仅更新 status='failed' 和 error_message，不保存 `record_count`：

```typescript
await db.prepare(`
  UPDATE tasks SET status = 'failed', error_message = $1, updated_at = CURRENT_TIMESTAMP
  WHERE id = $2
`).run(error.message, taskId);
// ❌ 缺少 record_count = $2
```

## 解决方案

### 1. totalRecords 作用域提升到 while 循环外

```typescript
let isRetry = false;
let totalRecords = 0;  // 🔧 提升到 try/catch 外层，使 catch 块可访问

while (true) {
  try {
    // ... 爬取逻辑 ...
    totalRecords = retryResumeState?.initialRecordCount || 0;
    // ...
```

### 2. catch 块保存 record_count

```typescript
} catch (error: any) {
  // 🔧 失败时保存 record_count，确保恢复时能继续计数
  await db.prepare(`
    UPDATE tasks SET status = 'failed', error_message = $1, record_count = $2, updated_at = CURRENT_TIMESTAMP
    WHERE id = $3
  `).run(error.message, totalRecords, taskId);
  
  // 🔧 失败时也检查文件是否有数据，有数据则创建 csv_files 记录
  // （确保有数据的失败任务可以下载文件）
}
```

### 3. 恢复时从 DB 读取初始记录数

```typescript
// 从 DB 读取 existingTask.record_count 作为 initialRecordCount
retryResumeState = {
  combinationIndex: existingConfig._resumeState.combinationIndex,
  currentPage: existingConfig._resumeState.currentPage,
  initialRecordCount: existingTask.record_count  // 从失败的记录数恢复
};
```

## 修改位置

| 修改 | 文件 | 位置 |
|------|------|------|
| totalRecords 声明提升 | taskService.ts | ~233 |
| totalRecords 赋值改为引用 | taskService.ts | ~249 |
| catch 块 record_count 写入 | taskService.ts | ~691-693 |
| 失败后 CSV 文件检查 | taskService.ts | ~695 |
| 恢复时读取 record_count | taskService.ts | 原有逻辑 |

## 效果

- 任务失败后 record_count 正确持久化到数据库
- 恢复任务时从正确的记录数开始计数
- 前端显示和统计准确
- 有数据的失败任务可以正常下载文件
