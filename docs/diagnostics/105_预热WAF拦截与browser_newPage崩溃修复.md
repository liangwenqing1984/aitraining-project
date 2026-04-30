# 预热 WAF 拦截 + browser.newPage() 崩溃修复

## 涉及提交

| 提交 | 说明 |
|------|------|
| `698daa6` | 修复预热失败后 browser.newPage() 崩溃导致任务直接失败 |

## 问题现象

```
16:06:53 🔥 正在预热浏览器会话（第1次尝试）...
16:06:59 ⚠️ 预热页面过小(7884字节 < 50000)，疑似被WAF拦截，将重试...
16:06:59 ⏳ 等待5秒后重试预热...
16:07:05 🔥 正在预热浏览器会话（第2次尝试）...
16:07:11 ⚠️ 预热页面过小(7884字节 < 50000)，疑似被WAF拦截，将重试...
16:07:11 ❌ 浏览器预热2次均失败，可能IP已被限制，继续尝试但可能无法获取数据
16:07:11 ╔══ 组合 1/1: "销售" × "北京" ══╗
16:07:11 📄 第 1 页: https://we.51job.com/pc/search?keyword=...
16:07:12 任务失败: Requesting main frame too early!
```

整个任务 20 秒即终止，产出 0 条数据。

## 根因分析

### 问题链路

```
预热 → WAF拦截 (7884字节小页面)
  → 浏览器标记为可疑
  → 预热页面关闭
  → 无延迟，立即创建主搜索页
  → puppeteer-extra stealth 插件 _createPageInContext
    → page.goto('about:blank')
    → FrameManager.mainFrame() 断言失败
    → "Requesting main frame too early!"
  → 异常在 try-catch 外部 → 直接传播到 taskService
  → 任务彻底失败
```

### 两个独立根因

**根因 1: 代码结构缺陷 — `browser.newPage()` 在 try-catch 外部**

```typescript
// 修复前 (job51.ts:142)
const page = await browser.newPage();  // ← 异常时直接传播到 taskService
try {
  await this.setupPageFingerprint(page);
  // ...
} catch (error: any) {
  this.log('error', ...);
  break;
}
```

`browser.newPage()` 的异常没有被捕获，直接向上传播到 `taskService.executeCrawling()`，触发 `任务失败` 流程，整个任务被终止。

**根因 2: CDP 协议竞争 — 预热页面关闭与主页面创建之间的竞争**

puppeteer-extra stealth 插件重写了 `_createPageInContext`，创建新页面后立即调用 `page.goto('about:blank')` 初始化。如果浏览器处于不稳定状态（刚关闭页面、有未完成的 CDP 消息），主 frame 可能尚未初始化，导致 `FrameManager.mainFrame()` 断言失败。

关闭预热页面后立即创建新页面，CDP 消息队列可能还有待处理的命令，导致竞争。

## 修复方案

### 1. `browser.newPage()` 移入 try-catch（核心修复）

```typescript
// 修复后
let page: any = null;
try {
  for (let pageAttempt = 0; pageAttempt < 2; pageAttempt++) {
    try {
      if (!browser.isConnected()) {
        throw new Error('浏览器连接已断开，无法创建新页面');
      }
      page = await browser.newPage();
      break;
    } catch (newPageErr: any) {
      if (newPageErr.message?.includes('main frame too early') && pageAttempt < 1) {
        this.log('warn', '⚠️ 页面创建CDP竞争，等待后重试...');
        await this.randomDelay(2000, 4000);
        continue;
      }
      throw newPageErr;
    }
  }
  // ... 正常流程
} catch (error: any) {
  this.log('error', `❌ 第 ${currentPage} 页出错: ${error.message}`);
  break;
}
```

`browser.newPage()` 失败时不再杀死任务，而是：
- 记录错误日志
- `break` 退出分页循环（当前组合结束）
- 其他组合不受影响

### 2. 预热阶段也加入重试

预热中的 `browser.newPage()` 同样可能遇到 CDP 竞争，添加相同的重试逻辑。

### 3. 预热失败后的恢复流程

```typescript
if (!warmupSuccess) {
  // 1. 不立即继续 — 给浏览器恢复时间
  await this.randomDelay(3000, 6000);
  // 2. 检查浏览器连通性
  if (!browser.isConnected()) {
    return;  // 浏览器已死，无法继续
  }
  // 3. 跳过预热，直接尝试爬取
}
```

关键改变：
- **修复前**：预热失败 → 立即继续爬取（浏览器可能不稳定）
- **修复后**：预热失败 → 延迟恢复 → 检查连通性 → 跳过预热直接爬取

### 4. 预热成功后也增加延迟

```typescript
} else {
  // 避免预热页面关闭与新页面创建的 CDP 竞争
  await this.randomDelay(1000, 2000);
}
```

预热成功后同样需要 CDP 消息队列排空时间。

## 影响范围

| 位置 | 变更 |
|------|------|
| 预热阶段 `browser.newPage()` | 新增重试 + CDP 竞争恢复 |
| 预热失败后处理 | 新增延迟 + 连通性检查 + 跳过预热 |
| 预热成功后处理 | 新增延迟（防 CDP 竞争） |
| 主循环 `browser.newPage()` | 移入 try-catch + 重试 + 连通性预检 |

## 效果预期

| 场景 | 修复前 | 修复后 |
|------|--------|--------|
| 预热 WAF + CDP 竞争 | 任务直接失败 | 单页失败，break 退出分页循环 |
| 预热 WAF + 浏览器正常 | 任务直接失败 | 跳过预热直接爬取 |
| 正常流程 | 无保护 | CDP 竞争自动重试 |
| 浏览器彻底断开 | 未检测，继续尝试 | 检查并提前退出 |
