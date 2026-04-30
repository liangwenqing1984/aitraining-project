# 51job WAF 升级：IP 级封锁 + 首页搜索表单绕过

## 涉及提交

| 提交 | 说明 |
|------|------|
| *待提交* | 新增首页搜索表单交互方案，替换无效的旧版 URL 回退 |

## 问题现象

任务 `3a657a1f-361e-43cf-a88d-0099277f4ac0`（keyword=销售，city=北京）经历 2 次浏览器重启后失败，产出 0 条数据。

```
Attempt 1:
  10:22:35 🏠 首页预访问 → 10:22:53 ✅ (18s)
  10:22:35 📄 we.51job.com/pc/search → 10:23:11 ⚠️ SPA未出现
  10:23:16 HTML: 7884字节 (WAF)
  10:23:27 🔄 重载: 7884 (WAF)
  10:23:29 🔄 备用URL (+reportType=1): 7884 (WAF)
  10:23:31 🔄 旧版URL (search.51job.com/list/...): 39字节 ❌ (无效URL格式!)
  10:23:35 0条 → BROWSER_RESTART_SCHEDULED

Attempt 2:
  10:23:40 🏠 首页预访问 → 10:23:50 ✅ (10s)
  10:23:40 📄 we.51job.com/pc/search → 10:24:09 ⚠️ SPA未出现
  10:24:13 HTML: 7884字节 (WAF)
  [日志在此截断]
```

## 根因分析

### 三级封锁全景

经过三个任务的连续测试，WAF 封锁已从参数级升级到 IP 级：

| 任务 | 阶段 | we.51job.com | 备用 URL | 旧版 URL | 结果 |
|------|------|-------------|----------|----------|------|
| 7f1137d4 | 首次触发 | 7884 WAF | 7884 WAF | — | 新增首页预访问+BROWSER_RESTART |
| 0e0a24a8 | pageSize触发 | 7884 WAF | 148KB ✅ | — | 移除 pageSize 参数 |
| a07de0ed | IP初封 | 7884 WAF | 7884 WAF | — | 新增旧版URL回退 |
| **3a657a1f** | **IP深封** | **7884 WAF** | **7884 WAF** | **39 字节** | **→ 旧版URL无效，需新方案** |

### 关键证据

**1. 首页正常，搜索异常** —— IP 仅封锁搜索子域名

| 子域名 | 访问结果 | 时间 |
|--------|---------|------|
| `www.51job.com` | ✅ 正常（10-18s 加载成功） | 两次均成功 |
| `we.51job.com/pc/search` | ❌ 7884 字节 WAF 页面 | 全部失败 |
| `jobs.51job.com/*.html` | ✅ 正常（详情页始终可访问） | 一直正常 |
| `search.51job.com/list/...` | ❌ 39 字节空页面 | URL 格式已失效 |

**2. 旧版 URL 格式已废弃**

`search.51job.com/list/010000,000000,0000,00,9,99,%E9%94%80%E5%94%AE,2,1.html` 返回仅 39 字节。该子域名/路径已不再提供搜索服务（51job 已完全迁移至 SPA 架构）。`jobs.51job.com` 的详情页之所以正常，是因为详情页仍使用传统 HTML 渲染，但**搜索功能**已完全迁移到 `we.51job.com`。

**3. 即使新浏览器+新 userDataDir 也无效**

Attempt 2 使用全新浏览器实例（新 userDataDir），但仍被封锁——说明 WAF 在 IP 层面进行锁定，浏览器指纹/会话无关。

### WAF 升级路径

```
阶段 1: 参数检测 → pageSize=20 触发规则
阶段 2: IP 标记 → 移除参数后恢复（单一 session 内多次请求触发）
阶段 3: IP 加黑名单 → 任何参数都返回 WAF
阶段 4: 持续黑洞 → 新浏览器也无法绕过（IP 层面完全封锁）
```

## 修复方案：首页搜索表单交互

### 核心思路

既然直接 URL 导航到 `we.51job.com` 被 WAF 检测为自动化请求，但 `www.51job.com` 首页可以正常访问，那就**在首页通过搜索表单执行搜索**——模拟真实用户的完整行为路径：

```
浏览器启动
  → 访问 www.51job.com 首页
  → 等待加载 + 滚动浏览（建立会话/cookie）
  → 在搜索框中输入关键词（模拟键盘输入+React事件）
  → 点击搜索按钮（或按回车）
  → 浏览器自然跳转到搜索结果页
  → 带完整 Referer: https://www.51job.com/
  → 带首页积累的 cookie context
  → 请求时序自然（首页→搜索，非直接深度链接）
```

**与直接 URL 导航的关键差异**：

| 维度 | 直接 URL 导航 | 首页搜索表单 |
|------|-------------|-------------|
| Referer | 空或不自然 | `https://www.51job.com/` |
| Cookie | 空或仅首页 cookie | 首页 cookie + 会话上下文 |
| 请求时序 | 浏览器启动→立即搜索 | 首页加载→浏览→搜索（自然间隔） |
| URL 构造 | 代码构造完整 API 参数 | 表单提交，浏览器自然生成 |
| 行为模式 | 深度链接，高概率自动化 | 首页→搜索，人类标准路径 |
| WAF 判定 | 自动化脚本 | 正常用户 |

### 两处集成

**1. 主路径：会话初始化阶段**（`job51.ts:154-164`）

首页预访问成功后，直接在当前页面执行搜索表单交互：

```typescript
if (currentPage === 1) {
  usedHomepageSearch = await this.searchViaHomepage(page, keyword, city);
  if (usedHomepageSearch) {
    // 跳过后续 page.goto(url)，直接使用当前页面内容
  }
}
```

**2. 恢复路径：WAF 检测后的回退**（`job51.ts:276-296`）

当直接 URL 导航触发 WAF 时，返回到首页通过表单重新搜索：

```
WAF 检测 → 重载 → 仍 WAF → 备用 URL(+reportType=1) → 仍 WAF
  → 🆕 回到 www.51job.com 首页
  → 等待 2-5s（随机）
  → searchViaHomepage() 填写表单搜索
  → 检查搜索结果 HTML
```

替换了之前无效果的 `search.51job.com/list/...` 旧版 URL 回退（39 字节）。

### searchViaHomepage 方法

```typescript
private async searchViaHomepage(page, keyword, city): Promise<boolean>
```

实现要点：
- **多种选择器覆盖**：支持 17 种搜索输入框选择器和 12 种搜索按钮选择器，覆盖不同版本首页
- **原生 setter 触发框架绑定**：使用 `HTMLInputElement.prototype.value` 原生 setter + `dispatchEvent('input'/'change'/'blur')` 确保 React/Vue 数据绑定被正确触发
- **可见性检测**：通过 `offsetParent` 和 `getBoundingClientRect().width` 确保选择的是可见输入框
- **双重提交机制**：优先点击搜索按钮（更自然），找不到按钮时使用键盘回车
- **导航检测**：`waitForNavigation` + 超时回退检查 URL 变化

## 修改文件

| 文件 | 变更 |
|------|------|
| `code/backend/src/services/crawler/job51.ts` | 新增 `searchViaHomepage()` 方法（+105行）；会话初始化集成首页搜索（+12行）；SPA 加载分支（首页搜索成功跳过 goto，+18行）；WAF 恢复用首页搜索替换旧版 URL（+15行）；新增恢复后 HTML 快照保存（+4行） |

## 效果预期

| 场景 | 修复前 | 修复后 |
|------|--------|--------|
| we.51job.com IP 封锁 | 0 数据，任务失败 | 首页搜索→自然跳转→正常提取 |
| 首页搜索也跳转到 we.51job.com 且被封锁 | — | 进入 BROWSER_RESTART_SCHEDULED |
| 首页搜索成功加载结果 | — | 跳过直接 URL 导航，节省一次请求 |
| WAF 恢复中首页搜索成功 | — | 可能救回原本会失败的会话 |
| 正常搜索（无 WAF） | 首页预访问 + 直接 URL | 首页预访问 + 首页搜索 + 直接 URL（回退） |
