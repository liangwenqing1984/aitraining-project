# 模型训练模块诊断报告

## 诊断日期
2026-05-15

## 问题清单

### 1. 模型大小显示错误（已修复）

**现象：** 模型管理「大小」列显示 `547912563.0 MB`，数字异常庞大且换行。

**根因：** `trainingController.ts` 中 `getDirSize()` 函数返回的是文件系统字节数（`fs.statSync().size`），而字段命名为 `sizeMB`，前后端均未做单位转换。

**修复：**
- 后端：重写为 `getDirSizeMB()`，内部递归累加字节后除以 `1024 * 1024` 得到真实 MB 值
- 前端：列宽 110px + `white-space: nowrap` 防止换行

**影响范围：** `GET /api/training/models`

---

### 2. 模型评估指标为空（已修复）

**现象：** 模型管理「评估指标」列始终显示 `-`。

**根因：** 旧版 Python 训练脚本 `train_embedding.py` 未包含评估逻辑，已训练的模型目录下无 `metrics.json` 文件。后端 `listModels` 读取空对象 `{}`，前端检测不到 `accuracy_top1` / `eval_pearson` 字段。

**修复：**
- 新增 `evaluate_model.py` — 独立评估脚本，可对已有模型离线评估
- 后端新增 `POST /api/training/models/evaluate` — 调用评估脚本，写入 `metrics.json`
- 前端新增「评估」按钮 — 在模型管理 Tab 选择数据集后一键评估

**评估指标：**
| 指标 | 含义 | 来源 |
|------|------|------|
| `eval_pearson` | Pearson 相关系数 | `EmbeddingSimilarityEvaluator` |
| `accuracy_top1` | Top-1 排序准确率 | 锚点-正样本排序测试 |

**使用说明：**
1. 进入「模型训练 → 模型管理」
2. 点击目标模型的「评估」按钮
3. 选择对应的训练数据集（JSONL）
4. 点击「开始评估」，完成后刷新列表即显示指标

---

### 3. 全局圆角回退为 Element Plus 默认值（已完成）

**说明：** `style.css` 中自定义的组件 border-radius 值（6-16px）统一移除，所有组件恢复 Element Plus 默认 4px 圆角。

---

## 变更文件清单

| 文件 | 类型 |
|------|------|
| `code/backend/src/controllers/trainingController.ts` | 修复 + 新增 |
| `code/backend/src/routes/trainingRoutes.ts` | 新增路由 |
| `code/backend/scripts/evaluate_model.py` | 新增脚本 |
| `code/frontend/src/api/training.ts` | 新增 API |
| `code/frontend/src/views/system/ModelTraining.vue` | 修复 + 新增 |
| `code/frontend/src/layouts/MainLayout.vue` | 样式修复 |
| `code/frontend/src/style.css` | 样式修复 |
| `code/frontend/src/views/system/*.vue` (7 files) | 按钮图标 |

## 验证步骤

1. 启动后端，确认 `GET /api/training/models` 返回的 `sizeMB` 为正常 MB 值
2. 在模型管理 Tab 确认「大小」列不换行
3. 对无评估指标的模型点击「评估」，选择有效数据集，确认评估完成
4. 刷新页面确认「评估指标」列显示 Pearson + Top-1 值
