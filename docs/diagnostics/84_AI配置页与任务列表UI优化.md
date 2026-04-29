# AI 配置页与任务列表 UI 优化

**日期**：2026-04-29
**分支**：with-ai
**提交范围**：d48fafc → cf6fa78

---

## 一、AI 配置页 (LLMSettings.vue) 优化

### 1.1 提供商快捷卡片（8 个远程 + 1 个本地）

在配置表格上方新增模型提供商快捷卡片区域，分"远程模型"和"本地模型"两组：

**远程模型**（4 列 × 2 行，8 张卡片）：
| DeepSeek | OpenAI | Anthropic | 智谱 AI |
|----------|--------|-----------|----------|
| 通义千问 | 文心一言 | 豆包 | 月之暗面 |

**本地模型**：Ollama（单卡）

卡片交互：
- 未配置：显示"点击配置"，按钮"添加"，点击进入快速添加弹窗
- 已配置：显示模型名称，按钮统一显示"添加"（非编辑），点击进入编辑弹窗
- 卡片悬停有上浮 + 阴影效果，点击有缩放反馈

### 1.2 模型预设与端点自动填充

- 模型名称从自由输入改为**可筛选下拉选择**，支持手动输入自定义模型名
- 9 个提供商各有预设模型列表（如 OpenAI: gpt-4o / gpt-4o-mini / o1 等）
- 切换提供商时**自动填入默认 API 端点**
- 新增"任务分配"复选框自动推荐（Ollama 默认勾选数据增强+反爬检测，云端模型默认全部勾选）

### 1.3 新增 4 家国内 LLM 提供商

| 提供商 | 模型预设 | 默认端点 |
|--------|---------|---------|
| 通义千问 | qwen-max / qwen-plus / qwen-turbo / qwen3-235b-a22b / qwq-32b | dashscope.aliyuncs.com |
| 文心一言 | ernie-4.5 / ernie-4.0-turbo / ernie-3.5 / ernie-speed | qianfan.baidubce.com |
| 豆包 | doubao-pro-256k / doubao-lite-32k / doubao-vision-pro | ark.cn-beijing.volces.com |
| 月之暗面 | kimi-k2 / moonshot-v1-128k / moonshot-v1-32k / kimi-thinking | api.moonshot.cn |

### 1.4 卡片样式优化

- 统一卡片高度：`height: 100%` 撑满网格行，消除两行高度不一致
- 移除卡片上的任务类型标签（数据增强、智能洞察等），保持简洁
- 卡片只显示：图标 + 提供商名称 + 模型名（或"点击配置"）+ 添加按钮

---

## 二、全局操作列图标规范

### 2.1 变更范围

3 个页面的所有表格操作列按钮统一添加 Element Plus SVG 图标：

| 页面 | 按钮 | 图标 |
|------|------|------|
| files/Index.vue | 预览 | `View` |
| | 下载 | `Download` |
| | 删除 | `Delete` |
| LLMSettings.vue | 测试 | `Link` |
| | 编辑 | `Edit` |
| | 删除 | `Delete` |
| crawler/Index.vue | 开始 | `VideoPlay` |
| | 停止 | `VideoPause` |
| | 恢复 | `RefreshRight` |
| | 监控 | `Monitor` |
| | 详情 | `Document` |
| | 配置 | `Setting` |
| | 下载 | `Download`（已有） |
| | 分析 | `TrendCharts`（已有） |
| | AI 增强 | `DataAnalysis`（已有） |
| | 删除 | `Delete`（已有） |

### 2.2 操作列样式

```css
.action-buttons {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 2px;
}
.action-icon {
  margin-right: 3px;
  font-size: 14px;
}
```

---

## 三、多组合任务进度优化

### 3.1 问题

多组合任务（如 3 关键词 × 3 城市 = 9 组合）的进度由两套逻辑竞争写入：
- **爬虫** (zhilian.ts)：每完成一个组合写入 `currentCombo / totalCombos × 99` %（如 2/9 = 22%）
- **TaskService** (taskService.ts)：按总记录数估算（≥50 条记录 = 80%+），用 `Math.max` 覆盖

导致进度在早期组合就跳到 80%+，然后长时间停留在 99%，不符合实际完成比例。

### 3.2 修复方案

**后端** (taskService.ts)：多组合任务改用混合公式

```
progress = completedBase + withinCombo
completedBase = completedCombo / totalCombos × 100    （已完成组合基准）
withinCombo   = (recordEstimate / 100) × perCombo     （当前组合内进度，缩放到组合份额）
```

- `completedCombo` 从 DB 的 `current` 字段读取（爬虫每完成一个组合写入）
- `recordEstimate` 为渐进式记录估算（0-50%/50-80%/80-99%）
- `perCombo` = 100 / totalCombos，每个组合占总进度的份额

**前端** (crawler/Index.vue)：
- 进度列宽度从 150 增至 170
- 多组合任务在进度条下方显示 `3/9 组合` 字样
- 新增 `getComboInfo()` 辅助函数

### 3.3 效果对比

| 场景 | 优化前 | 优化后 |
|------|--------|--------|
| 9 组合，第 2 组合 30 条记录 | 80%（失真） | ~25%（2/9 + 组合内比例） |
| 9 组合，第 5 组合 | 99%（不动） | ~55%（5/9 基准） |
| 单组合任务 | 不变 | 不变 |

---

## 四、操作列宽度修复

crawler/Index.vue 操作列从 320px 增至 **420px**。

completed 状态任务同时显示 6 个按钮（详情 + 配置 + 下载 + 分析 + AI 增强 + 删除），320px 不够导致末尾删除按钮被 `flex-wrap: nowrap` 裁剪。

---

## 五、涉及文件

| 文件 | 变更类型 |
|------|---------|
| `code/frontend/src/views/settings/LLMSettings.vue` | 重构（快捷卡片、4×2 网格、模型预设、图标） |
| `code/frontend/src/views/crawler/Index.vue` | 修改（操作列图标、宽度、组合进度显示） |
| `code/frontend/src/views/files/Index.vue` | 修改（操作列图标、样式） |
| `code/backend/src/services/taskService.ts` | 修改（多组合进度算法） |
