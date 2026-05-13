# 简历文件上传解析与 Embedding 截断修复

## 概述

本次变更包含两个核心改进：简历筛选支持直接上传 Word/PDF/TXT 文件自动解析匹配，以及修复 Ollama Embedding 超长文本导致的 500 错误。

---

## 一、简历文件上传解析

### 需求/问题
原简历筛选仅支持手动粘贴文本，HR 需要从简历文件手动复制粘贴，效率低。

### 实现

**新增依赖**：
- `mammoth` — 解析 .docx/.doc 提取纯文本
- `pdf-parse@1.1.1` — 解析 PDF 提取纯文本
- `multer` — 处理 multipart/form-data 文件上传（内存存储，10MB 上限）

**resumeParser.ts** — 通用文本提取工具：
- 根据文件扩展名 / MIME 类型自动选择解析器
- .docx → mammoth.extractRawText
- .pdf → pdfParse (v1 API)
- .txt → 直接 Buffer 解码（utf-8 优先，回退 latin1）

**ragController.ts** — 新增 `uploadAndMatch` 接口：
- multer 中间件接收文件 → resumeParser 提取文本 → generateEmbedding → 余弦相似度匹配
- 返回 `{ fileName, resumeText, fullTextLength, results }`
- 文件格式白名单：.docx/.doc/.pdf/.txt
- 文件大小限制：10MB

**ragRoutes.ts** — 注册 `POST /resume/upload`

**ResumeScreening.vue** — 前端上传区改造：
- 新增 Element Plus `<el-upload drag>` 拖拽上传区
- 接受 .docx/.doc/.pdf/.txt
- 上传即自动解析+匹配，结果直接展示
- 保留下方 textarea 供手动粘贴
- 文件解析成功后显示文件名和文本长度

**api/llm.ts** — 新增 `uploadResume(file, options)` FormData 上传

---

## 二、Ollama Embedding 超长文本截断修复

### 需求/问题
上传 PDF/Word 后，解析出的文本经常超过 embedding 模型的上下文窗口（nomic-embed-text 为 8192 tokens），Ollama API 返回 500: "the input length exceeds the context length"。

### 根因
Ollama 的 `/api/embeddings` 端点在 v0.1.0+ 支持 `truncate: true` 参数，会让模型按 token 级别自动截断超长输入再向量化。但代码中两处调用均未传此参数。

### 修复

| 文件 | 修改 |
|------|------|
| `embeddings.ts` — `fallbackOllamaEmbedding` | 请求体增加 `truncate: true` |
| `local.ts` — Ollama provider `embed` | 请求体增加 `truncate: true` |

两处覆盖了所有 Ollama embedding 调用（回退方案 + 显式配置方案）。

**附加防护**：在 `ragController.ts` 中传入 embedding 前增加 3000 字符手动截断作为网络层保护，实际 token 级截断由 Ollama 完成。

**注意**：`truncate` 参数由 Ollama v0.1.0+ 支持（官方文档确认 `/api/embeddings` 端点支持），旧版本会忽略此参数并继续报错——此时需升级 Ollama 服务端。

---

## 验收清单
- [x] 简历筛选页支持拖拽/点击上传 Word (.docx/.doc) 文件
- [x] 简历筛选页支持上传 PDF 文件
- [x] 简历筛选页支持上传 TXT 文件
- [x] 上传非支持格式时后端返回明确错误提示
- [x] 上传后自动解析文本 + 匹配职位，结果正常展示
- [x] 文本粘贴匹配保持正常工作
- [x] 超长简历文本不再导致 Ollama 500 错误
- [x] 前后端编译通过
