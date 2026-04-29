# 可中断延迟 abortableSleep 实现

## 问题

用户点击"停止"任务后，任务可能在 `setTimeout` 等待中阻塞长达 10 秒才能响应，体验极差。

## 根因

原代码中使用 `setTimeout` + `Promise` 实现延迟等待：

```typescript
await new Promise(resolve => setTimeout(resolve, delay));
```

这种实现无法感知 `AbortSignal` 的中止信号——即使 `signal.aborted` 已为 `true`，setTimeout 仍会等待超时后才继续执行。

## 解决方案

### abortableSleep — 可中断延迟

```typescript
private abortableSleep(ms: number): Promise<void> {
  return new Promise(resolve => {
    if (this.signal?.aborted) {
      resolve();
      return;
    }
    const cleanup = () => {
      this.signal?.removeEventListener('abort', onAbort);
    };
    const onAbort = () => {
      clearTimeout(timer);
      cleanup();
      resolve();
    };
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    this.signal?.addEventListener('abort', onAbort);
  });
}
```

**关键设计**：
- 双重触发路径：`setTimeout` 正常到期 或 `abort` 事件提前触发
- `cleanup()` 函数确保无论哪条路径先触发，都正确清理 `removeEventListener`，防止内存泄漏
- 入口检查 `this.signal?.aborted`：如果调用时已中止，立即返回不等待

### randomDelay — 基于 abortableSleep 的随机延迟

```typescript
private async randomDelay(min: number = 2000, max: number = 5000): Promise<void> {
  if (this.signal?.aborted) return;
  const delay = Math.random() * (max - min) + min;
  await this.abortableSleep(delay);
}
```

### 中止处理器 — 强制关闭浏览器

```typescript
const abortHandler = () => {
  this.log('info', `[ZhilianCrawler] ⏹️ 收到中止信号，正在强制关闭浏览器...`);
  browser.close().catch(() => {});
};
signal.addEventListener('abort', abortHandler, { once: true });
```

**联动效应**：当用户点击停止 → `signal.abort()` 触发 → abortHandler 关闭浏览器 → 所有进行中的 `page.goto()`/`waitForSelector()` 立即抛出异常 → 同时 abortableSleep 路径全部 resolve → 控制流快速回到外层 catch/finally 块。

## 替换清单

| 原调用 | 新调用 | 文件位置（约） |
|--------|--------|---------------|
| `await new Promise(r => setTimeout(r, delay))` in page.evaluate | 无法替换（浏览器上下文） | ~395 |
| `await new Promise(r => setTimeout(r, 2000))` 等待渲染 | `await this.abortableSleep(2000)` | ~2002, 2233, 2237, 2240, 2289 |
| `await this.randomDelay(min, max)` 详情页延迟 | 已内置 abort 感知 | ~1167, 1427 |

> 注：`page.evaluate` 内部的 `setTimeout` 运行在浏览器上下文，无法访问 Node.js 的 AbortSignal，故保留。但这些 evaluate 在浏览器关闭后会自然失败，不影响停止体验。

## 效果

- 停止响应时间：从 **2-10 秒** 降至 **1-2 秒**
- 无内存泄漏：cleanup 确保 abort listener 总是被移除
- 无重复触发：`{ once: true }` 配合显式 cleanup
