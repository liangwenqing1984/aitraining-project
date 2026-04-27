# WAF 反爬对抗增强方案

**日期**: 2026-04-27  
**分支**: `with-deepseek`  
**Commit**: `10ded02`  
**关联任务**: `8a562723-0ddf-434b-8816-edba73bf1ca4`

---

## 问题描述

智联招聘详情页（`zhaopin.com/jobdetail/...`）100% 被 WAF 拦截，返回 `Security Verification` 页面，导致详情页抓取全部失败。

### 日志特征

```
页面标题: "Security Verification"
body长度: 846 字节（正常页面 750KB+）
hasTitle: false
hasCompany: false
刷新重试无效（WAF 拦截会话已绑定）
```

### 根因

1. 并发=2，同时请求 2 个详情页，访问模式被 WAF 识别为爬虫
2. 每次都使用相同的 Viewport(1920×1080) 和 User-Agent，缺乏指纹变化
3. CSS 样式表被拦截（`request.abort('stylesheet')`），正常浏览器必定加载 CSS
4. WAF 拦截后仍执行 3 次无效重试，浪费时间

---

## 修复内容

### 1. WAF 专项检测（跳过无效重试）

```typescript
// 新增 isSecurityVerification 检测
isSecurityVerification: (document.title || '').includes('Security Verification')

// 检测到 WAF 页面直接抛错误，不重试
if (pageHealth.isSecurityVerification) {
  throw new Error('WAF_DETECTED: 智联招聘安全验证拦截');
}
```

**覆盖位置**:
- `fetchJobDetailWithPage()` — 并发路径的健康检查
- `fetchJobDetail()` — 串行路径的 page.evaluate 前

### 2. WAF 命中后自动降级串行

```typescript
// 批次结果中检测 WAF 错误
const wafInBatch = batchResults.some(r =>
  r.status === 'fulfilled' && r.value.error?.includes('WAF_DETECTED')
);

if (wafInBatch) {
  wafDetected = true;
  // 剩余职位用串行模式处理，延迟 5-10 秒
  for (let i = batchEnd; i < filteredJobs.length; i++) {
    const wafDelay = 5000 + Math.random() * 5000;
    await new Promise(resolve => setTimeout(resolve, wafDelay));
    // 逐个抓取...
  }
}
```

串行模式也做了增强：WAF 命中后延迟从 2-4 秒增加到 4-8 秒。

### 3. 浏览器指纹随机化

```typescript
// Viewport 随机化: 1366-1920 × 768-1080
const viewportWidth = 1366 + Math.floor(Math.random() * 554);
const viewportHeight = 768 + Math.floor(Math.random() * 312);

// User-Agent 轮换 (4 个可选)
const userAgents = [
  '...Chrome/131.0.0.0 Safari/537.36',
  '...Chrome/130.0.0.0 Safari/537.36',
  '...Chrome/129.0.0.0 Safari/537.36',
  '...Firefox/132.0',
];
```

### 4. 保留 CSS 加载

```diff
- if (['image', 'stylesheet', 'font', 'media'].includes(request.resourceType()))
+ if (['image', 'font', 'media'].includes(request.resourceType()))
```

正常浏览器一定会加载 CSS，拦截它是明显的爬虫特征。

---

## 效果对比

| 指标 | 修复前 | 修复后 |
|------|--------|--------|
| 详情页成功数 | 0/19 (0%) | 待新任务验证 |
| WAF 识别速度 | 每次等重试3次才放弃 | 首次即识别 |
| 浏览器指纹 | 固定 | 每标签页随机 |
| CSS 加载 | 被拦截 | 正常加载 |

---

## 遗留问题

假阳性 Bug 仍存在（见 `67_反爬检测假阳性修复.md`），`[class*="verify"]` 选择器过于宽泛。
