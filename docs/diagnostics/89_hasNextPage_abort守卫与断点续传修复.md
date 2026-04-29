# hasNextPage abort 守卫与断点续传修复

## 问题

用户点击停止后，`while` 循环中的 `hasNextPage` 检查会调用 `page.evaluate()`。此时浏览器已被 abort handler 强制关闭，导致 `TargetCloseError`。该错误被误判为浏览器崩溃，触发重试流程，导致：

1. 浏览器重新启动，任务继续执行
2. `_resumeState` 未保存（因为 evaluate 抛出异常跳过了保存逻辑）
3. 恢复时从头开始，产生新的 Excel 文件，record_count 重置

## 根因

```typescript
// 旧代码：page.evaluate 前无 abort 检查
hasNextPage = await page.evaluate(() => {
  // ... 检查下一页按钮 ...
});
```

stop → abort → 浏览器关闭 → `page.evaluate` 在已关闭的浏览器上执行 → `TargetCloseError` → 进入 catch 重试流程。

## 解决方案

### 1. hasNextPage 检查前添加 abort 守卫

```typescript
if (this.checkAborted()) {
  hasNextPage = false;
} else {
  hasNextPage = await page.evaluate(() => {
    // ... 检查下一页按钮 ...
  });
}
```

如果已中止，`hasNextPage` 设为 `false`，然后循环条件 `while (hasNextPage && !this.checkAborted())` 为 false，自然退出循环。

### 2. 中止时保存 _resumeState

```typescript
if (this.checkAborted() || !hasNextPage) {
  if (this.checkAborted()) {
    // 保存断点续传状态到 DB
    abortConfig._resumeState = {
      combinationIndex: currentCombination,
      currentPage: currentPage,
      jobIndex: 0
    };
    await db.prepare('UPDATE tasks SET config = $1 WHERE id = $2')
      .run(JSON.stringify(abortConfig), taskId);
  }
  break;
}
```

### 3. 浏览器崩溃恢复中检查 abort

```typescript
if (isBrowserCrash || isDetachedFrame) {
  // 用户手动中止导致的浏览器断开，直接抛出，不触发恢复
  if (this.checkAborted()) {
    this.log('info', `⏹️ 用户中止导致的浏览器断开，跳过恢复`);
    throw error;
  }
  // ... 正常的崩溃恢复流程 ...
}
```

### 4. pageStartJobIndex 安全钳

重新解析页面时，职位列表可能比原始列表短。断点索引可能越界：

```typescript
let pageStartJobIndex = (resumeState && currentCombination === startCombinationIndex
                         && currentPage === startPage) ? globalStartJobIndex : 0;
if (pageStartJobIndex >= filteredJobs.length) {
  this.log('warn', `⚠️ 断点续传位置超出重新解析的职位数，重置为0`);
  pageStartJobIndex = 0;
  // 依赖去重机制跳过已采集的职位
}
```

## 修改位置

| 修改 | 文件 | 位置 |
|------|------|------|
| hasNextPage abort 守卫 | zhilian.ts | ~1484 |
| 中止时保存断点 | zhilian.ts | ~1698-1712 |
| 崩溃恢复 abort 检查 | zhilian.ts | ~1574 |
| pageStartJobIndex 安全钳 | zhilian.ts | ~1125-1129 |
| 组合中止跳过完成逻辑 | zhilian.ts | ~1727 |

## 效果

- 停止命令发出后不再触发浏览器崩溃重试
- `_resumeState` 正确保存到 DB config 列
- 恢复时从正确的断点继续
- 防止新的 Excel 文件产生和 record_count 重置
