# 51job page.evaluate 的 `__name` 错误修复与并发支持

## 涉及提交

| 提交 | 修复内容 |
|------|---------|
| `ff1c1ef` | 第一轮：移除所有 page.evaluate 中的 TS 类型注解 + ES6 语法，新增并发支持 |
| `92663ae` | 第二轮：将 `var fn = function()` 改为 `function fn()` 声明，彻底消除 `__name` 注入 |
| `3700689` | 第三轮：HTML 大小 WAF 检测 + 预热验证 + AI 空选择器跳过 |

---

## 问题现象

任务日志中出现两种错误，导致详情页抓取全部失败：

```
[WARN] 详情页重试2次后失败: __name is not defined
[WARN] 详情页重试2次后失败: 浏览器连接已断开
```

所有 20 条职位均因详情页失败而使用 `generateBasicJob` 降级数据，导致 Excel 中 `workExperience`、`education`、`jobDescription`、`jobTags`、`recruitmentCount` 等字段全部为空。

---

## 根因分析

### 第一层：esbuild 的 `__name` 辅助函数注入

`tsx` 使用 esbuild 进行 TypeScript 转译。esbuild 默认 `keepNames: true`，会对赋值给变量的函数表达式注入 `__name` 辅助调用以保留函数名：

```javascript
// 源代码（任何形式赋值给变量的函数）
var get = function(sels) { ... };
const get = (sels: string) => { ... };

// ↓ esbuild 编译后
var get = __name(function(sels) { ... }, "get");
```

`__name` 函数存在于 esbuild 的运行时辅助中，但在浏览器的 `page.evaluate()` 沙箱中不存在，导致 `ReferenceError: __name is not defined`。

### 第二层：第一轮修复为何无效

第一轮修复（`ff1c1ef`）将 TypeScript 箭头函数：

```typescript
const get = (sels: string) => { ... };  // TS + 箭头函数
```

改为 ES5 函数表达式：

```javascript
var get = function(sels) { ... };  // ES5 函数表达式
```

但两者在 esbuild 看来是**同一模式**——都是赋值给变量的函数表达式，都会触发 `__name` 注入。

### 第三层：唯一免疫的形式

只有**函数声明**（Function Declaration）不会被注入 `__name`：

```javascript
function get(sels) {               // 函数声明 — 安全
  var selectors = sels.split(', ');
  for (var i = 0; i < selectors.length; i++) {
    var el = document.querySelector(selectors[i]);
    if (el && el.textContent && el.textContent.trim()) return el.textContent.trim();
  }
  return '';
}
```

| 形式 | 是否触发 `__name` |
|------|------------------|
| `function fn() {}` | 不触发 |
| `var fn = function() {}` | **触发** |
| `const fn = () => {}` | **触发** |
| `arr.forEach(function(el) {})` | 不触发（匿名） |
| `arr.map(el => ...)` | 不触发（匿名） |

### 第四层：级联浏览器崩溃

`__name` 错误不仅导致详情页数据缺失，还引发级联故障：

```
详情页 evaluate 抛 __name 错误
  → fetchJobDetail 重试（maxRetries=2）
  → 每次重试创建新页面
  → 3 并发 × 3 次尝试 = 9 次 page.newPage()
  → Chrome 进程过载崩溃
  → 后续批次全部 "浏览器连接已断开"
```

---

## 变更详情

### 1. 四个 evaluate 回调全部去 TS/ES6 化

| 位置 | 方法 | 修复要点 |
|------|------|---------|
| `fetchJobDetail` (L694-781) | `page.evaluate` | `function get(sels) {}` 声明 + 所有匿名回调用 `function` |
| `setupPageFingerprint` (L466-483) | `evaluateOnNewDocument` | `(window as any)` → `window`，`(params: any)` → `function(params)` |
| AI 选择器 (L321-338) | `page.evaluate` | `(selector: string)` → `(selector)`，移除 `as HTMLAnchorElement` |
| `extractJobsFromDOM` (L502-652) | `page.evaluate` | `as HTMLAnchorElement` → `&&` guard，`?.` → `&&` guard |

关键原则：
- 使用 `function` 声明而非函数表达式
- 匿名回调使用 `function(el) {}` 而非 `(el) => {}`
- 移除所有类型注解和类型断言
- 可选链 `?.` → `&&` 守卫
- `String.includes()` → `String.indexOf()`（虽非必须但更安全）
- `const/let` → `var`（虽非必须但避免任何潜在转译问题）

### 2. 并发详情页抓取（config.concurrency）

[job51.ts:381-483](code/backend/src/services/crawler/job51.ts#L381-L483)

```
concurrency ≤ 1  → 串行模式（原有逻辑）
concurrency > 1  → Promise.allSettled 批次并行，上限 3，批次间 2-4s 延迟
```

| 参数 | 修复前 | 修复后 |
|------|--------|--------|
| 处理模式 | 硬编码串行 for 循环 | `concurrency ≤ 1` 串行 / `> 1` 并发 |
| config.concurrency | 被忽略 | 生效（上限 3） |
| 错误隔离 | 无（一个失败影响后续）| Promise.allSettled 隔离 |

### 3. WAF 拦截 HTML 大小检测（`3700689`）

**问题**：修复 `__name` 后重跑任务，发现 51job 对自动化的 WAF 拦截返回 7,884 字节的小页面，AI 误判为 `normal (confidence=0.95)`，导致后续选择器全部失效、0 条数据。

**根因链**：

```
浏览器预热拿到 WAF 小页面(7,884B) → 未验证 → 搜索时用坏 session
→ 搜索页也是 7,884B → AI假阳性判定为 normal → 选择器失效
→ AI 返回空选择器 "" → querySelectorAll('') 报错 → 0 jobs
```

**三项防御**：

| 防御点 | 位置 | 逻辑 |
|--------|------|------|
| 预热验证 | `crawl()` L75-112 | 预热后检查 HTML ≥ 50KB，不达标则等 5-8s 重试 1 次 |
| HTML 大小 WAF 检测 | `crawl()` L207-233 | 搜索页 < 50KB → 直接判定 WAF（跳过 AI），自动 reload + 备用 URL |
| AI 空选择器跳过 | `crawl()` L361-365 | `s.selector.trim() === ''` → 跳过而非抛异常 |

WAF 检测阈值：`MIN_PAGE_HTML = 50000`（正常 51job 搜索页约 500k-650k 字节）。

---

## 修改文件

| 文件 | 变更 |
|------|------|
| `code/backend/src/services/crawler/job51.ts` | ~280 行新增，~140 行删除（三轮累计） |
| `docs/diagnostics/102_51job_pageEvaluate的__name错误修复与并发支持.md` | 新增诊断文档 |

---

## 效果预期

| 指标 | 修复前 | 修复后 |
|------|--------|--------|
| 详情页抓取成功率 | 0%（全部 `__name` 失败）| > 90% |
| 单条处理时间 | ~45s（含重试）| ~7-15s |
| Excel 字段完整性 | XHR 基础字段有值，6+ 字段为空 | 详情页字段全部填充 |
| concurrency=3 生效 | 不生效（串行）| 3 并发批次并行 |
| 浏览器稳定性 | 重试风暴导致崩溃 | 正常请求，不触发重试风暴 |

---

## 验证方法

用相同配置重新运行任务（keyword=销售，city=北京，maxPages=1，concurrency=3），查看日志：

1. 不再出现 `__name is not defined` 错误
2. 详情页抓取成功
3. 下载的 Excel 中 `workExperience`、`education`、`jobDescription` 等字段有值
4. 日志显示并发模式生效：`⚡ 使用并发模式处理（批次大小=3）`
