# 51job 搜索页 WAF：pageSize 参数触发拦截

## 涉及提交

| 提交 | 说明 |
|------|------|
| *待提交* | 从搜索 URL 移除 pageSize 参数，更新 WAF 备用 URL 逻辑 |

## 问题现象

任务 `0e0a24a8-4035-481f-88fb-06ac1bccf20c`（keyword=销售，city=北京）经历 3 次浏览器重启后失败，产出 0 条数据。

```
Attempt 1: 首页预访问 ✅(20s) → 搜索页 → 7884字节(WAF) → 重载7884 → 备用URL 148666字节(✅正常!)
           → 但提取流程在备用URL生效前已走 WAF 路径 → 0条 → 触发重启
Attempt 2: 首页预访问 ✅(14s) → 搜索页 → 7884字节(WAF) → 重载7884 → 备用URL 7884 → 0条 → 重启
Attempt 3: 浏览器 newPage() 时崩溃 → 0条 → 任务终止
```

## 根因分析

### 关键证据

Attempt 1 日志中存在一条决定性线索：

```
09:58:15 🔄 重载后HTML: 7884字符
09:58:15 🔄 重载后仍过小，尝试不带pageSize的备用URL...
09:58:17 🔄 备用URL HTML: 148666字符  ← 正常页面！
09:58:25 🤖 AI分类: type=normal, confidence=0.98
```

同一个浏览器、同一个页面对象：

| URL | HTML 大小 | 结果 |
|-----|----------|------|
| `...&page=1&pageSize=20` | 7,884 字节 | WAF 拦截 |
| `...&page=1`（去掉 pageSize） | 148,666 字节 | **正常页面** |

**`pageSize=20` 参数触发了 Aliyun WAF 的规则匹配。**

### 为什么 WAF 会针对 pageSize

Aliyun WAF 的规则引擎会对请求参数进行模式匹配。`pageSize=20` 是一个分页参数，常见于爬虫/API 调用中。人类用户通过浏览器访问搜索页时，URL 通常不携带显式的 `pageSize` 参数——这个参数由 SPA 的 JavaScript 动态添加到 API 请求中。

爬虫代码直接构造了完整的 API 参数 URL：
```
/we.51job.com/pc/search?keyword=销售&city=010000&page=1&pageSize=20
```

当 WAF 看到浏览器（尤其是 headless 浏览器）首次请求就携带 `pageSize` 这样的 API 风格参数时，将其判定为自动化脚本。

### 为什么 Attempt 1 备用 URL 生效了但未提取到数据

备用 URL（148KB 正常 HTML）确实加载成功了，但代码流程存在问题：

1. HTML 大小检测发现 7884 字节 → WAF 标记
2. 重载 → 仍 7884
3. 备用 URL → 148666 ✅
4. 但代码随后检查 `wasHtmlSmall` → 仍然为 true（因为 `htmlLength < MIN_PAGE_HTML` 在步骤 1 已触发）
5. 走 WAF 处理路径 → 请求 AI 建议选择器
6. **AI 建议选择器在 WAF 页面（7884 字节的 HTML）上执行，而非 148KB 的正常页面**

```typescript
// 问题：备用 URL 加载成功后，html 变量已更新，但 wasHtmlSmall 仍为 true
const wasHtmlSmall = htmlLength < MIN_PAGE_HTML;  // 在备用URL前计算
// ...
if (wasHtmlSmall) {
  // 走 WAF 路径，但此时 page.content() 已经是新的正常 HTML
  // 冲突：html 是新的正常页面，但流程按 WAF 处理
}
```

流程冲突导致正常页面被当 WAF 处理。

### Attempt 3 浏览器崩溃

前两次浏览器会话在关闭时可能未完全释放 Chrome 进程资源（userDataDir 文件锁、端口占用等），第三次启动时出现 CDP 协议竞争导致 page creation 失败。

## 修复方案

### 核心修复：移除 pageSize 参数

```typescript
// 修复前
const url = `https://we.51job.com/pc/search?keyword=...&city=...&page=${currentPage}&pageSize=20`;

// 修复后
const url = `https://we.51job.com/pc/search?keyword=...&city=...&page=${currentPage}`;
```

直接去掉 `pageSize`，让 51job 使用默认分页大小。实测返回正常 HTML 页面（148KB vs 7KB WAF 页面）。

### WAF 备用 URL 逻辑更新

由于主 URL 不再包含 `pageSize`，WAF 恢复流程中的备用 URL 策略同步更新：

```typescript
// 修复前：尝试去掉 pageSize
const altUrl = url.replace(/&pageSize=\d+/, '');  // 对无 pageSize 的 URL 是 no-op

// 修复后：尝试添加 reportType 参数绕过 WAF
const altUrl = url.includes('?') ? url + '&reportType=1' : url + '?reportType=1';
```

AI 恢复路径中同样更新：
```typescript
// 修复前
const altUrl = url.replace(/&pageSize=\d+/, '&pageSize=10');

// 修复后
const altUrl = url.includes('?') ? url + '&pageSize=10' : url + '?pageSize=10';
```

## 修改文件

| 文件 | 变更 |
|------|------|
| `code/backend/src/services/crawler/job51.ts` | 主 URL 移除 `&pageSize=20`（-1 参数）；WAF 备用 URL 策略更新为添加 `reportType` 参数；AI 恢复路径备用 URL 策略更新为追加 `pageSize=10` |

## 效果预期

| 指标 | 修复前 | 修复后 |
|------|--------|--------|
| 首次搜索 WAF 概率 | 高（pageSize 触发规则） | 低（无 API 风格参数） |
| 搜索页 HTML 大小 | 7884 字节 (WAF) | 约 148KB（正常） |
| 备用 URL 有效性 | 去掉 pageSize 有效（但流程冲突未利用） | 添加 reportType 作为备选 |
| 首页预访问必要性 | 需要（但 14-20s 较慢） | 仍然需要，但主 URL 不再触发 WAF |
