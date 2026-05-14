# 模型训练 HuggingFace 连接超时与 XetHub 大文件下载修复

## 概述

模型训练任务调用 `train_embedding.py` 时，因服务器无法访问 `huggingface.co`（国内网络限制），导致 `nomic-ai/nomic-embed-text-v1.5` 基座模型下载失败。进一步排查发现 hf-mirror.com 镜像对 XetHub 存储的大文件代理无效。通过配置环境变量 `HF_ENDPOINT` + `HF_HUB_ENABLE_HF_XET=0` 解决，同时修复训练任务删除后模型文件残留问题。

## 一、模型下载：HuggingFace 连接超时

### 问题
`SentenceTransformer('nomic-ai/nomic-embed-text-v1.5')` 初始化时请求 `huggingface.co`，`ConnectTimeoutError` 连续重试 5 次后抛出 `LocalEntryNotFoundError`。

### 修复
`trainingController.ts` spawn Python 进程时注入环境变量：

```typescript
const env = {
  ...process.env,
  HF_ENDPOINT: process.env.HF_ENDPOINT || 'https://hf-mirror.com',
  HF_HUB_ENABLE_HF_XET: '0',  // 禁用 XetHub，走 LFS 通道
};
```

- `HF_ENDPOINT`：将 HuggingFace Hub 请求重定向到 hf-mirror.com 镜像
- `HF_HUB_ENABLE_HF_XET=0`：nomic-embed-text-v1.5 的大文件（model.safetensors 547MB）存储在 XetHub（`cas-bridge.xethub.hf.co`），该地址国内同样无法访问；禁用后走 LFS 通道，hf-mirror.com 可正常代理

## 二、模型加载：trust_remote_code 和 einops

### 问题
1. 模型含自定义架构代码，需 `trust_remote_code=True` 授权
2. 依赖 `einops` 包未安装

### 修复
- `train_embedding.py`：`SentenceTransformer(model_path, trust_remote_code=True)`
- 安装 `einops` 包：`pip install einops`

## 三、训练脚本增强

`train_embedding.py` 新增：

- `--local-files-only` 选项：纯离线模式，仅使用本地缓存
- `--base-model` 支持本地目录路径
- 下载失败时的中文错误提示，指引用户设置镜像

## 四、训练任务删除后模型文件清理

### 问题
`model_output_path` 字段仅在训练**成功**后写入 DB。训练失败/中断的任务该字段为 NULL，删除时 `deleteTrainingJob` 无法定位目录。

### 修复
创建任务记录后立即将 `model_output_path` 写入 DB（第85-88行），与 `runPythonTraining` 中的路径公式保持一致：

```typescript
const modelOutputDir = path.resolve(__dirname, '../../data/models', `model_${jobId}`);
await db.prepare(
  'UPDATE sp_training_jobs SET model_output_path = $1 WHERE id = $2'
).run(modelOutputDir, jobId);
```

## 五、前端分页优化

`ModelTraining.vue` 数据集列表和已训练模型列表增加分页组件，避免长列表撑开页面。

## 验收清单

- [x] 训练任务成功通过 hf-mirror.com 下载基座模型
- [x] XetHub 大文件通过 LFS 通道正常下载
- [x] 模型加载成功（768维向量编码测试通过）
- [x] 训练任务删除后模型目录同步清理
- [x] 前端数据集/模型列表分页正常
