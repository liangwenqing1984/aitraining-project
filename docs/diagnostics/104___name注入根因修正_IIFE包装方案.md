# `__name` 注入根因修正 — IIFE 包装方案（第三轮修复）

## 涉及提交

| 提交 | 说明 |
|------|------|
| `4a3fc7c` | 使用 IIFE 包装彻底消除 page.evaluate 中的 __name 注入 |

## 前情回顾

前两轮修复（[102](102_51job_pageEvaluate的__name错误修复与并发支持.md)）的核心假设：

> 函数声明（`function fn() {}`）不会被 esbuild 注入 `__name`，只有赋值给变量的函数表达式才会。

**这个结论是错误的。**

---

## 真实根因

### esbuild `keepNames` 对函数声明也注入 `__name`

经过直接编译测试验证：

```javascript
// 源代码
page.evaluate(() => {
  function get(sels) { return ''; }
  return get('test');
});

// ↓ esbuild 编译后（keepNames: true）
page.evaluate(() => {
  function get(sels) { return ""; }
  __name(get, "get");    // ← 注入点：声明之后插入调用语句
  return get("test");
});
```

函数声明虽然没有被"包装"，但 esbuild 在声明**之后**插入一条 `__name(get, "get")` 调用。这个 `__name` 是模块顶层定义的辅助函数：

```javascript
// 模块顶层（Node.js 上下文）
var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// page.evaluate 回调（浏览器沙箱上下文）
() => {
  function get(sels) { ... }
  __name(get, "get");  // ← __name 在浏览器中不存在 → ReferenceError
}
```

Puppeteer 通过 `.toString()` 序列化回调并发送到浏览器，**模块顶层的 `__name` 不会被带入**。

### 完整注入规则（修正后）

| 代码形式 | 是否注入 | 注入方式 |
|---------|---------|---------|
| `function fn() {}` | **触发** | 声明后插入 `__name(fn, "fn")` |
| `var fn = function() {}` | **触发** | 包装为 `__name(function(){}, "fn")` |
| `const fn = () => {}` | **触发** | 包装为 `__name(()=>{}, "fn")` |
| `{ key: function() {} }` | **触发** | 包装为 `{ key: __name(function(){}, "key") }` |
| `forEach(function(el) {})` | 不触发 | 匿名回调 |
| `map(el => ...)` | 不触发 | 匿名箭头 |
| `navPerms.query = function() {}` | 不触发 | 属性赋值（非变量声明） |

### 此次影响范围

两处受影响（均在 [job51.ts](code/backend/src/services/crawler/job51.ts)）：

| 位置 | 代码模式 | 注入次数 |
|------|---------|---------|
| `fetchJobDetail` L781 `page.evaluate` | `function get(sels)` | 1 处（**可见错误**） |
| `setupPageFingerprint` L605 `evaluateOnNewDocument` | `{ get: function() {} }` ×3, `loadTimes: function() {}`, `csi: function() {}` | 5 处（**静默失败**） |

`evaluateOnNewDocument` 的错误不会传播到 Node.js，所以之前的日志只显示了 `fetchJobDetail` 的错误。但这意味着**指纹隐藏一直未生效**。

---

## 修复方案：IIFE 包装

### 原理

esbuild 仅对**直接的函数表达式/声明**注入 `__name`。如果赋值右侧是**调用表达式**（IIFE），则跳过。

```javascript
// 触发注入
var get = function(sels) { ... };

// 不触发注入 — RHS 是 IIFE 调用，不是函数表达式
var get = (function() {
  return function(sels) { ... };
})();
```

### 修复前 vs 修复后

**fetchJobDetail page.evaluate：**

```javascript
// 修复前
const detail = await page.evaluate(() => {
  function get(sels) {
    var selectors = sels.split(', ');
    // ...
    return '';
  }
  // ...
});

// 修复后
const detail = await page.evaluate(() => {
  var get = (function() {
    return function(sels) {
      var selectors = sels.split(', ');
      // ...
      return '';
    };
  })();
  // ...
});
```

**setupPageFingerprint evaluateOnNewDocument：**

```javascript
// 修复前
Object.defineProperty(navigator, 'webdriver', { get: function() { return undefined; } });
window.chrome = { runtime: {}, loadTimes: function() {}, csi: function() {}, app: {} };

// 修复后
Object.defineProperty(navigator, 'webdriver', {
  get: (function() { return function() { return undefined; }; })()
});
window.chrome = {
  runtime: {},
  loadTimes: (function() { return function() {}; })(),
  csi: (function() { return function() {}; })(),
  app: {}
};
```

### 编译验证

```
=== fetchJobDetail evaluate ===
Has __name? false

=== evaluateOnNewDocument ===
Has __name? false
```

两处回调编译后均**零 `__name` 注入**。

---

## 为什么不用 polyfill 方案

第一直觉是在 evaluate 内部添加 `var __name = function(target, value) { return target; };` 作为 polyfill。但 esbuild 会：

1. 将内部 `__name` 重命名为 `__name2`（避免与模块顶层 `__name` 冲突）
2. 对其注入 `__name(__name2, "__name")`（引用模块顶层 `__name`）

```javascript
// 尝试添加 polyfill
page.evaluate(() => {
  var __name = function(target, value) { return target; };
  // ...
});

// ↓ esbuild 编译后
page.evaluate(() => {
  var __name2 = __name(function(target, value) { return target; }, "__name");
  //           ^^^^^ 再次引用模块顶层 __name → 浏览器中仍不存在
  // ...
});
```

polyfill 方案形成死循环 — 定义 `__name` 本身需要一个 `__name`。

---

## 效果预期

| 指标 | 修复前 | 修复后 |
|------|--------|--------|
| `__name is not defined` 错误 | 每次详情页抓取均出现 | 0 |
| 详情页抓取成功率 | 0%（全部降级 `generateBasicJob`） | > 90% |
| Excel 详情字段 | `workExperience`/`education`/`jobDescription` 等为空 | 全部填充 |
| 浏览器指纹隐藏 | 静默失败（webdriver 未隐藏） | 正常生效 |
