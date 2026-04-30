# 51job 搜索页 WAF：IP 级别封锁 + 旧版 URL 回退绕过

## 涉及提交

| 提交 | 说明 |
|------|------|
| *待提交* | 新增旧版 search.51job.com/list/... 服务端渲染 URL 作为第三级 WAF 回退 |

## 问题现象

任务 `a07de0ed-94ed-4177-bca8-e4447fcb3177`（keyword=销售，city=北京）经历 3 次浏览器重启后失败，产出 0 条数据。

```
Attempt 1: 首页预访问 ✅ → 搜索页 7884字节(WAF) → 重载 7884 → 备用URL(reportType=1) 7884 → 0条 → 重启
Attempt 2: 首页预访问 → 搜索页 7884字节(WAF) → 重载 7884 → 备用URL 7884 → 0条 → 重启
Attempt 3: 浏览器 newPage() CDP 竞争崩溃 → 0条 → 任务终止
```

**与上次任务 `0e0a24a8` 的关键区别**：

| 维度 | 0e0a24a8 | a07de0ed |
|------|----------|----------|
| 主 URL（无 pageSize） | 7884 (WAF) | 7884 (WAF) |
| 备用 URL（reportType=1） | 7884 (WAF) | 7884 (WAF) |
| 无 pageSize 备用 URL | 148666 ✅ | 7884 (WAF) |
| 结论 | pageSize 是触发因素 | **IP 已被锁定** |

无 pageSize 的 URL 在上个任务中能返回 148KB 正常页面，但本任务中同样返回 7884 字节 WAF 页面——说明 WAF 已经从参数级规则升级为 IP 级封锁。

## 根因分析

### WAF 升级路径

同一 IP 在短时间内多次请求 `we.51job.com` 搜索页后，Aliyun WAF 的封锁策略逐步升级：

```
阶段 1: pageSize 触发规则 → 返回验证码页（7KB）
阶段 2: 移除 pageSize → 恢复正常（148KB）    ← 任务 0e0a24a8
阶段 3: 持续请求触发频率限制 → IP 加黑名单    ← 任务 a07de0ed
阶段 4: 无论任何参数，we.51job.com 搜索页一律返回 7KB WAF 页
```

### 为什么旧版 URL 可能绕过 WAF

51job 有两个搜索入口：

| 入口 | URL 格式 | 子域名 | 渲染方式 | WAF 策略 |
|------|----------|--------|----------|----------|
| 新版 SPA | `we.51job.com/pc/search?keyword=...` | `we.51job.com` | Vue.js SPA（JS 动态渲染） | 严格（反爬重点目标） |
| 旧版服务端 | `search.51job.com/list/CITYCODE,...html` | `search.51job.com` | 服务端渲染 HTML | 较宽松（传统页面） |

**关键差异**：
1. **不同子域名**：`we.51job.com` 和 `search.51job.com` 在 WAF 中可能是不同的防护策略
2. **不同渲染方式**：SPA 依赖 JS 执行 + API 调用（容易检测自动化）；服务端渲染直接返回 HTML（模拟更简单）
3. **不同用户行为模型**：SPA 搜索是"现代"用户行为；旧版 URL 接收移动端/老浏览器/搜索引擎爬虫流量，WAF 更宽松
4. **已验证可用**：`jobs.51job.com` 的详情页（同属旧版域名体系）在所有任务中均能正常加载，不受 WAF 影响

### 旧版 URL 格式解析

```
https://search.51job.com/list/010000,000000,0000,00,9,99,%E9%94%80%E5%94%AE,2,1.html
                              ────── ────── ──── ── ─ ── ──────────── ─ ─
                              城市码  职能码  行业   ?  ? ?   URL编码关键词  ? 页码
```

- `010000` — 城市代码（与 JOB51_CITY_CODES 兼容，如北京=010000）
- `000000` — 职能分类（全零=不限）
- `0000` — 行业分类（全零=不限）
- `9` — 发布日期过滤（推测 9=所有）
- `99` — 其他过滤参数
- `2` — 固定值（可能表示搜索类型）
- 页码 — 从 1 开始

## 修复方案

### WAF 恢复流程增强：三级回退链

```
搜索 URL 加载
  → HTML < 50000? ──否──→ 正常流程
      ↓是
  → page.reload() ────≥50000──→ 正常流程
      ↓仍小
  → 备用 URL（+reportType=1）──≥50000──→ 正常流程
      ↓仍小
  → 🆕 旧版 URL（search.51job.com/list/...）──≥50000──→ DOM提取（旧版选择器）
      ↓仍小
  → AI分类 → BROWSER_RESTART_SCHEDULED → 新浏览器重试
```

### 代码实现

**1. 旧版 URL 构建方法**（`job51.ts:641-651`）：

```typescript
private buildOldFormatUrl(keyword: string, cityCode: string, page: number): string {
  const encodedKeyword = encodeURIComponent(keyword);
  return `https://search.51job.com/list/${cityCode},000000,0000,00,9,99,${encodedKeyword},2,${page}.html`;
}
```

**2. WAF 回退链集成**（`job51.ts:245-257`）：

```typescript
// 如果备用 URL 仍然返回 WAF 小页面，尝试旧版服务端渲染 URL
if (htmlLength < MIN_PAGE_HTML) {
  this.log('warn', `🔄 备用URL仍过小，尝试旧版 search.51job.com 服务端渲染URL...`);
  const oldFormatUrl = this.buildOldFormatUrl(keyword, cityCode, currentPage);
  try {
    await page.goto(oldFormatUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    html = await page.content();
    htmlLength = html.length;
    this.log('info', `🔄 旧版URL HTML: ${htmlLength}字符`);
  } catch (oldUrlErr: any) {
    this.log('error', `❌ 旧版URL加载失败: ${oldUrlErr.message}`);
  }
}
```

**3. 旧版 DOM 选择器**（已在前次提交中添加，`job51.ts:683`）：

```typescript
'div.el', 'div.e', '.j_joblist > div',  // 旧版 search.51job.com 格式
```

旧版页面使用 `div.el` 作为职位卡片容器（`.el` class），每个卡片内包含 `.t1`（职位名）、`.t2`（公司）、`.t3`（薪资）、`.t4`（地点）等子元素。这些选择器已在 `extractJobsFromDOM()` 中优先排列（排在 SPA 选择器之前）。

## 修改文件

| 文件 | 变更 |
|------|------|
| `code/backend/src/services/crawler/job51.ts` | 新增 `buildOldFormatUrl()` 方法（+10行）；WAF 回退链新增旧版 URL 第三级回退（+13行） |

## 效果预期

| 场景 | 修复前 | 修复后 |
|------|--------|--------|
| we.51job.com 被 WAF 封锁 | 0 数据，任务失败 | 自动切换到 search.51job.com 旧版 URL |
| search.51job.com 也失败 | — | 进入 BROWSER_RESTART_SCHEDULED 流程 |
| we.51job.com 正常 | 正常提取 | 无影响（不触发回退） |
| 旧版 HTML > 50KB | — | DOM 提取（已配置旧版选择器） |
| 旧版页面与新版数据结构差异 | — | extractJobsFromDOM 同时支持两种 DOM 结构 |
