# 模型训练模块诊断报告

## 诊断日期
2026-05-15（更新：2026-05-15 第二轮）

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

---

### 4. 评估脚本 HuggingFace 连接超时 + config 类冲突（已修复）

**现象：** 点击「评估」按钮后报错，前端无详细错误信息。

**根因（3 层叠加）：**
1. **Python 脚本尝试连接 huggingface.co**：`SentenceTransformer(model_path)` 默认在线下载依赖文件，国内网络超时重试 5 次（约 2 分钟）后失败
2. **config.json 的 auto_map 引用远程模块**：已训练模型的 `config.json` 中 `auto_map` 引用了 `nomic-ai/nomic-bert-2048--modeling_hf_nomic_bert.NomicBertModel`，与本地 `configuration_hf_nomic_bert.py` 的 config class 不匹配 → `ValueError`
3. **API 拦截器错误字段不匹配**：拦截器读取 `response.data?.message`，但后端返回 `error` 字段 → 始终显示"请求失败"
4. **评估 API 超时 30s**：HF 重试耗时 >2 分钟，Axios 默认 30s 超时提前中断

**修复：**
- Python 脚本：设置 `TRANSFORMERS_OFFLINE=1` + `HF_HUB_OFFLINE=1` 禁止在线下载；新增 `prepare_model_config()` 自动修复 auto_map 引用 + 复制 modeling 文件；NaN 转 null 确保 JSON 合法
- 后端 `evaluateModel`：补充 `HF_ENDPOINT`/`HF_HUB_ENABLE_HF_XET` 环境变量（与训练 spawn 保持一致）
- API 拦截器：同时读取 `data.error` 和 `data.message`
- 评估 API 超时：30s → 180s
- 前端错误展示：区分超时/HTTP 错误/通用错误，显示 stderr/stdout 详情

---

### 5. 评估 Pearson 指标始终为 NaN（已修复）

**现象：** 评估完成后「评估指标」只显示 Top-1 准确率，无 Pearson 数值。

**根因：** `EmbeddingSimilarityEvaluator` 仅将锚点-正样本对（anchor→positive）送入评估，所有标注分数统一为 1.0。评分序列无方差 → scipy Pearson 分母为 0 → NaN。与数据集大小无关，427 对数据同样 NaN。

**修复：**
- 重写 `load_training_data()` 加载三元组（anchor, positive, negative）
- Pearson 评估改为正负样本混合：正样本对标注 1.0 + 负样本对（anchor→negative）标注 0.0，产生充足方差
- Top-1 评估适配三元组格式

**验证结果（model_21 + 427 对数据）：**

| 指标 | 修复前 | 修复后 |
|------|--------|--------|
| eval_pearson | NaN | **0.878** |
| spearman_cosine | NaN | **0.844** |
| accuracy_top1 | 84.9% | 84.9% |

---

### 6. 模型部署到 Ollama 时报错 "neither 'from' or 'files' was specified"（已修复）

**现象：** 模型管理 → 点击「部署」→ 报错 `Ollama 返回错误: {"error":"neither 'from' or 'files' was specified"}`。

**根因（2 层叠加）：**
1. **Ollama API 参数变更**：Ollama 0.5+ `/api/create` 不再接受 `modelfile` 参数，改用 `from` 指定基座模型。旧代码发送 `{name, modelfile}` 不被识别
2. **Modelfile FROM 引用 HuggingFace ID**：训练脚本生成的 Modelfile 写入 `FROM nomic-ai/nomic-embed-text-v1.5`（HuggingFace 模型 ID），Ollama 期望 `FROM nomic-embed-text:latest`（Ollama 模型名）

**修复：**
- `train_embedding.py`：新增 `HF_TO_OLLAMA` 映射表，生成 Modelfile 时自动将 HF ID 转换为 Ollama 模型名
- `deployModel` 接口：解析 Modelfile FROM 行 → 查映射表容错 → 使用 `from` 参数调用 Ollama API
- 已有模型 `model_21/Modelfile`：FROM 行手动修正

**HF → Ollama 映射表：**

| HuggingFace ID | Ollama 模型 |
|------|------|
| nomic-ai/nomic-embed-text-v1.5 | nomic-embed-text:latest |
| BAAI/bge-base-zh-v1.5 | bge-base-zh:latest |
| sentence-transformers/all-MiniLM-L6-v2 | all-minilm:latest |

---

## 第二轮变更文件清单

| 文件 | 类型 |
|------|------|
| `code/backend/scripts/evaluate_model.py` | 修复 × 3 |
| `code/backend/scripts/train_embedding.py` | 修复 |
| `code/backend/src/controllers/trainingController.ts` | 修复 × 2 |
| `code/frontend/src/api/index.ts` | 修复 |
| `code/frontend/src/api/training.ts` | 修复 |
| `code/frontend/src/views/system/ModelTraining.vue` | 修复 |
| `code/frontend/src/views/Docs.vue` | 新增 Q14 + Q15 |

## 第二轮验证步骤

1. 重启后端，进入「模型管理」Tab
2. 点击「评估」→ 选择 427 对数据集 → 确认 Pearson ≈ 0.88 + Top-1 ≈ 84.9%
3. 点击「部署」→ 确认模型成功注册到 Ollama（`ollama list` 可见）
4. 打开帮助文档 → 语义模型训练 → 确认 Q14（Pearson 为空原因）和 Q15（指标介绍）已更新
