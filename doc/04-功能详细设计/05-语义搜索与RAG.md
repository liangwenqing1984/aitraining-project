# 语义搜索与 RAG

## 功能目标

基于 pgvector 向量数据库 + Ollama nomic-embed-text 模型，实现职位数据的语义向量搜索。用户输入自然语言查询 → 检索语义最相近的职位 → 返回排序结果。

## 业务流程

```
采集完成 + AI增强完成 → 启动向量化索引
  → buildJobText() 拼接职位名/公司/城市/技能/行业为自然语言段落
  → Ollama nomic-embed-text → 768维浮点向量
  → INSERT INTO sp_job_embeddings (embedding) VALUES ($1::vector)
  → IVFFlat 索引加速
  → 用户输入查询 → 同样向量化 → 余弦相似度排序 → 返回Top N
```

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/rag/index/:taskId` | 启动异步向量化索引 |
| `POST` | `/api/rag/index/:taskId/sync` | 同步向量化索引（等待完成） |
| `POST` | `/api/rag/search` | 语义相似搜索 |
| `DELETE` | `/api/rag/index/:taskId` | 删除指定任务的向量索引 |
| `GET` | `/api/rag/stats` | 获取向量化统计 |
| `GET` | `/api/rag/index/records` | 职位向量列表（管理页） |

### 语义搜索请求

```json
POST /api/rag/search
{
  "query": "北京 Java 后端开发",
  "limit": 10,
  "taskId": "optional-task-id",
  "minSimilarity": 0.3
}
```

### 语义搜索响应

```json
{
  "success": true,
  "data": {
    "query": "北京 Java 后端开发",
    "count": 5,
    "results": [
      {
        "jobId": "xxx",
        "jobName": "Java高级开发工程师",
        "companyName": "某科技公司",
        "workCity": "北京",
        "similarity": 0.92,
        "textContent": "职位名称：Java高级开发工程师..."
      }
    ]
  }
}
```

## 业务规则

- **索引前置检查**：任务必须已完成 AI 增强（sp_job_enrichments 有数据），否则返回错误提示
- **短查询扩展**：≤10 字符的查询自动触发术语映射扩展（30+ 映射表）
  - 例：`Java` → `Java开发 Spring 微服务`
  - 例：`前端` → `Vue React Web前端 网页开发`
- **相似度阈值**：默认 0.3（余弦相似度 0-1），低于阈值的结果不返回
- **幂等索引**：ON CONFLICT UPSERT（同 job_id + task_id 重复索引会覆盖更新向量）
- **长查询**：>10 字符的查询不做扩展，保留原意

## 数据关联

- `sp_job_enrichments` → 拼接 buildJobText() → 向量化 → `sp_job_embeddings`
- `sp_job_embeddings` 核心字段：
  - `id`: job_id 作为主键
  - `task_id`: 关联任务
  - `text_content`: 被向量化的原始文本（用于展示）
  - `embedding`: vector(768)，pgvector 向量
  - `job_name`, `company_name`, `job_category_l1`, `job_category_l2`, `work_city`: 冗余字段加速查询

## 技术实现

### 向量化函数 (src/services/llm/embeddings.ts)

```typescript
generateEmbedding(text: string): Promise<{ embedding: number[] }>
```

- 调用 Ollama `/api/embeddings` 接口
- 模型：`nomic-embed-text`（768维）
- 请求间隔：200ms（避免 Ollama 过载）
- 失败重试：3 次，指数退避

### 相似度计算 (SQL)

```sql
SELECT *, 1 - (embedding <=> $1::vector) AS similarity
FROM sp_job_embeddings
WHERE 1 - (embedding <=> $1::vector) >= 0.3
ORDER BY embedding <=> $1::vector
LIMIT 10
```

- `<=>` 运算符：pgvector 余弦距离（= 1 - 余弦相似度）
- `1 - (<=>)`：转换为相似度（0-1，越大越相似）
- IVFFlat 索引：100 个聚类列表，比全量 KNN 快 10-100 倍

### 实时通知

- 索引完成后通过 WebSocket 推送：
  - `rag:indexCompleted` — 索引成功（含索引数量）
  - `rag:indexFailed` — 索引失败（含错误信息）

## 异常处理

- pgvector 扩展未安装 → 索引和搜索接口返回 500 `"pgvector 扩展未安装"`
- 任务无增强数据 → 返回 400 `"该任务尚未进行AI数据增强"`
- Ollama 服务不可达 → embedding 生成失败，返回错误
- 向量维度不匹配 → INSERT 时 pgvector 抛出类型错误

## 验收标准

- [ ] 完成增强的任务可以成功创建向量索引
- [ ] 搜索结果按语义相关性排序（非关键词匹配）
- [ ] 短查询自动扩展（输入"Java"能搜到"Java开发工程师"）
- [ ] IVFFlat 索引加速生效（100+ 条时搜索 < 1s）
- [ ] 重复索引不产生重复数据
- [ ] 删除索引后 sp_job_embeddings 对应记录清空
