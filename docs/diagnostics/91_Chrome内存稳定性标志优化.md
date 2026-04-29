# Chrome 内存稳定性标志优化

## 问题

并发爬取时，多个 `page.goto()` 同时加载大型详情页（500-750KB HTML），Chrome 堆内存快速增长，触发 OOM 导致浏览器崩溃：

- 典型错误：`TargetCloseError` / `Navigating frame was detached`
- 频率：高并发（≥3）时几乎必定发生
- 影响：任务失败 → 重试 → 再次崩溃 → 无限循环

## 根因

Puppeteer 默认 Chrome 启动参数未限制内存，在并发页面请求下 V8 堆可快速突破宿主机可用内存。

## 解决方案

在 `puppeteer.launch()` 的 `args` 中添加 4 个内存稳定性标志：

```typescript
const browser = await puppeteer.launch({
  executablePath: chromePath,
  headless: true,
  args: [
    // ... 原有的安全/沙箱参数 ...
    
    // 🔧 内存与稳定性优化：防止 OOM 崩溃
    '--js-flags="--max-old-space-size=512"',  // 限制 JS 堆内存为 512MB
    '--disable-hang-monitor',                   // 禁用挂起监控，防止误杀
    '--disable-background-timer-throttling',    // 禁用后台定时器节流
    '--disable-renderer-backgrounding',         // 禁止渲染器后台降级
  ],
  timeout: 30000  // 30 秒启动超时
});
```

### 各标志说明

| 标志 | 作用 | 必要性 |
|------|------|--------|
| `--js-flags="--max-old-space-size=512"` | V8 老生代堆上限 512MB，触发 GC 而非进程 OOM 被系统 kill | **核心**：直接防止 OOM |
| `--disable-hang-monitor` | 高负载下浏览器可长时间无响应，此监控会误判为假死并杀进程 | 防止误杀 |
| `--disable-background-timer-throttling` | 后台页面定时器被节流时，异步操作堆积导致内存暴涨 | 防止定时器堆积 |
| `--disable-renderer-backgrounding` | 后台渲染进程被降级后资源受限，影响抓取效率 | 保持渲染性能 |

## 效果

- OOM 崩溃概率大幅降低
- 3-5 个并发页面请求稳定运行（配合 maxConcurrency=5）
- 内存异常时 V8 主动 GC 而非进程崩溃
