# 停止后再继续生成两个 Excel + 计数重置的根因修复

## 问题现象

点击"停止"后再点击"继续"，任务不再复用已有 Excel，而是创建新文件 `job_data_{taskId}.xlsx`，且 `已采集条数` 从 1 重新计数。

## 根因

### 控制流问题

`zhilian.ts` 中 while 循环内部的结构：

```
while (hasNextPage && !checkAborted()) {       // line 238
    try {                                       // line 273
        page.goto / page.evaluate / 所有处理
        hasNextPage 检查 (line 1484)
    } catch (error) {                           // line 1557
        if (isBrowserCrash || isDetachedFrame) {
            if (checkAborted()) {
                throw error;  // ← BUG! 直接抛错
            }
        }
        break;  // ← BUG! 跳过后面的保存
    } finally { ... }
    
    // ❌ throw/break 后永远执行不到这里
    if (checkAborted() || !hasNextPage) {       // line 1711
        if (checkAborted()) {
            保存 _resumeState → DB             // 这是唯一保存断点的地方
        }
        break;
    }
}
```

### 触发过程

1. 用户点击停止 → `controller.abort()` 触发 → abortHandler 关闭浏览器
2. 正在执行的 Puppeteer 操作（page.goto / page.evaluate）抛出 `TargetCloseError`
3. catch 块捕获错误 → `isBrowserCrash` 为 true → `checkAborted()` 为 true
4. **直接 `throw error` 跳过第 1711 行的 `_resumeState` 保存**
5. 任务停止，但 DB `config` 列中**没有** `_resumeState`

### 恢复时的连锁反应

`taskService.startTask()` 第 138-139 行：

```typescript
const resumeStateFromConfig = (config as any)._resumeState;
const hasResumeState = resumeStateFromConfig && resumeStateFromConfig.combinationIndex > 0;
```

由于 `_resumeState` 不存在 → `hasResumeState` = false → 走 else 分支：

```typescript
// 新任务模式：创建新Excel文件
const filename = `job_data_{taskId}.xlsx`;
filepath = path.join(csvDir, filename);
await this.createExcelFile(filepath);  // 创建全新的文件！
```

同时 `initialRecordCount = 0` → 计数从 1 开始。

## 修复

在 catch 块的两个出口路径中，**抛错/break 之前**先保存 `_resumeState` 到 DB：

### 出口 1：浏览器崩溃 + abort 检测（line 1574）

```typescript
if (this.checkAborted()) {
    // 🔧 关键修复：先保存断点再抛错
    try {
        const abortResumeTask = await db.prepare('SELECT config FROM tasks WHERE id = $1').get(taskId!) as any;
        if (abortResumeTask) {
            const abortConfig = typeof abortResumeTask.config === 'string' ? JSON.parse(abortResumeTask.config) : abortResumeTask.config;
            abortConfig._resumeState = { combinationIndex: currentCombination, currentPage: currentPage, jobIndex: 0 };
            await db.prepare('UPDATE tasks SET config = $1 WHERE id = $2').run(JSON.stringify(abortConfig), taskId!);
        }
    } catch (e: any) {}
    throw error;
}
```

### 出口 2：非崩溃错误 + abort 检测（line 1689，防御性修复）

```typescript
if (this.checkAborted()) {
    // 防御：超时等非崩溃错误也可能在 abort 时发生
    try { ... 同上 ... } catch (e: any) {}
}
break;
```

## 修改位置

| 修改 | 文件 | 行号 |
|------|------|------|
| catch 块 abort + 崩溃路径保存断点 | zhilian.ts | ~1574-1589 |
| catch 块 abort + 非崩溃路径保存断点 | zhilian.ts | ~1690-1702 |

## 效果

- 用户停止后 `_resumeState` 始终写入 DB config
- 恢复任务时正确复用已有 Excel，继续追加数据
- `record_count` 从停止时的数值继续增长
- 不再产生重复 Excel 文件
