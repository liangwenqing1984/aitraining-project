# 127 — JS MutationObserver 强制固定列不透明：最终方案

## 背景

经过 6+ 轮 CSS 修复（!important、background 简写、body 前缀提高特异性、background-color 双写、CSS 变量级联、cell-style 内联），任务列表固定列仍然透明。

## 根因推测

CSS 方案失效的可能原因：
1. Vite HMR 对非 scoped `<style>` 块的热更新不可靠，浏览器可能缓存旧 CSS
2. Element Plus 内部渲染固定列时可能有额外的样式覆盖逻辑
3. CSS 文件加载顺序导致规则优先级不稳定

无论根因如何，纯 CSS 方案在此项目中无法可靠解决问题。

## 方案：JavaScript + CSSOM `setProperty('important')`

`element.style.setProperty(property, value, 'important')` 通过 CSSOM 设置内联样式，并标记为 `!important` 优先级。等效于在元素上写 `style="background: #fafafa !important"`，这是 CSS 中绝对最高优先级：
- 高于任何样式表规则（包括 `!important` 的样式表规则）
- 高于 CSS 变量
- 高于任何选择器特异性

### 实现

```typescript
function forceFixedColumnBg() {
  // 覆盖固定列容器
  document.querySelectorAll('.task-table .el-table__fixed-right').forEach(el => {
    el.style.setProperty('background', '#fafafa', 'important')
    el.style.setProperty('background-color', '#fafafa', 'important')
  })
  // 覆盖所有内部单元格
  document.querySelectorAll('.task-table .el-table__fixed-right td, th, .el-table__cell').forEach(el => {
    el.style.setProperty('background', '#fafafa', 'important')
    el.style.setProperty('background-color', '#fafafa', 'important')
  })
}
```

### MutationObserver 守卫

数据异步加载后表格会重新渲染，MutationObserver 监听 DOM 变化自动重新应用修复：

```typescript
const observer = new MutationObserver(() => forceFixedColumnBg())
observer.observe(tableEl, { childList: true, subtree: true, attributes: true })
```

### 生命周期

- `onMounted` + `nextTick`：首屏渲染后立即修复
- `onUnmounted`：disconnect observer 防止内存泄漏

## 涉及文件

| 文件 | 修改 |
|------|------|
| `code/frontend/src/views/crawler/Index.vue` | 新增 forceFixedColumnBg + MutationObserver + 生命周期 |

## CSS 方案保留

全局 style.css + 组件非 scoped CSS + el-table 内联 style CSS 变量 + cell-style 均保留作为兜底，但 JS 方案不再依赖它们。
