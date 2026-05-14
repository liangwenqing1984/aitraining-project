# API 参考手册

> 基准地址：`http://localhost:3001/api`
> 响应格式：`{ success: boolean, data?: T, error?: string, message?: string }`

## 一、认证 (Auth)

### `GET /auth/authorize-url`
获取 OAuth2 授权 URL。

**响应**：`{ success: true, data: { url: string } }`

### `GET /auth/callback?code=xxx&state=xxx`
OAuth2 回调，用 code 换取 access token。

**响应**：设置 Cookie 后重定向到首页。

### `POST /auth/local-login`
本地用户名密码登录。

**请求体**：`{ username: string, password: string }`

**响应**：`{ success: true, data: { token, user } }`

### `POST /auth/refresh-token`
刷新 access token。

### `GET /auth/user-info`
获取当前登录用户信息。

### `POST /auth/validate-token`
验证 token 有效性。

### `POST /auth/logout`
登出，清除 Cookie。

---

## 二、任务管理 (Tasks)

### `GET /tasks`
获取任务列表。

**查询参数**：`?page=1&pageSize=10&keyword=xxx`

**响应**：`{ success: true, data: { list: Task[], total: number } }`

### `GET /tasks/:id`
获取单个任务详情。

### `POST /tasks`
创建爬虫任务。

**请求体**：
```json
{
  "name": "任务名称",
  "source": "zhilian|job51",
  "config": {
    "keyword": "Java",
    "city": "北京",
    "totalPages": 5,
    "concurrency": 2
  }
}
```

### `POST /tasks/:id/start`
启动任务。

### `POST /tasks/:id/stop`
停止任务。

### `POST /tasks/:id/pause`
暂停任务。

### `POST /tasks/:id/resume`
恢复任务。

### `PUT /tasks/:id/config`
更新任务配置（不启动）。

### `DELETE /tasks/:id`
删除任务及其关联数据。

### `GET /tasks/regions/list`
获取省市列表（用于创建任务时选择城市）。

---

## 三、文件管理 (Files)

### `GET /files`
文件列表。`?taskId=xxx` 按任务筛选。

### `GET /files/:id`
文件详情。

### `GET /files/:id/download`
下载 CSV 文件。

### `GET /files/:id/preview`
预览文件内容（前 N 行）。

### `GET /files/:id/analyze`
分析 CSV 列结构。

### `DELETE /files/:id`
删除文件。

### `POST /files/batch-delete`
批量删除。`{ ids: string[] }`

---

## 四、智能分析 (Analysis)

### `POST /analysis/analyze`
执行分析。

### `GET /analysis/salary/:fileId`
薪资分布（区间统计）。

### `GET /analysis/city/:fileId`
城市分布。

### `GET /analysis/education/:fileId`
学历分布。

### `GET /analysis/experience/:fileId`
经验要求分布。

---

## 五、LLM 配置与管理

### `GET /llm/config`
获取所有 LLM 配置。

**响应**：`{ success: true, data: LLMConfig[] }`

### `POST /llm/config`
保存 LLM 配置。

**请求体**：
```json
{
  "id": 1,
  "provider": "openai|anthropic|ollama|deepseek|zhipu|qwen|baidu|bytedance|moonshot",
  "modelName": "gpt-4o",
  "apiKeyEncrypted": "sk-xxx",
  "baseUrl": "https://api.openai.com/v1",
  "isActive": true,
  "taskRouting": ["enrichment", "insights", "query", "anti-crawl"]
}
```

### `DELETE /llm/config/:id`
删除配置。

### `GET /llm/models/:provider`
获取指定提供商的可用模型列表。

- Ollama：直接调用 `http://localhost:11434/api/tags`
- 云端模型：调用 `/v1/models` 端点

### `GET /llm/health?provider=openai`
健康检查，返回 `{ ok: boolean, models: string[], latency: number }`。

### `POST /llm/test`
测试 LLM 调用。

**请求体**：`{ systemPrompt: string, userPrompt: string, taskType: string }`

**响应**：`{ content, model, provider, tokensUsed, duration }`

---

## 六、数据增强 (Enrichment)

### `POST /llm/enrich/:taskId`
启动异步数据增强（标准化薪资、分类、技能提取等）。立即返回，通过 WebSocket 推送进度。

### `GET /llm/enrich/:taskId/status`
获取增强状态。

**响应**：`{ exists, total, lastEnrichedAt, isRunning, runningProgress }`

### `GET /llm/enrich/:taskId/result`
获取增强结果列表。

---

## 七、市场洞察 (Insights)

### `POST /llm/insights/:fileId`
异步生成市场洞察报告。完成后通过 WebSocket `insights:completed` 事件通知。

### `GET /llm/insights/:fileId/history`
获取该文件的报告历史列表。

### `GET /llm/insights/report/:reportId`
获取单个报告详情（含 Markdown 内容和图表配置）。

---

## 八、自然语言查询 (NL Query)

### `POST /llm/query`
执行自然语言查询。

**请求体**：`{ question: string, taskId?: string }`

**响应**：
```json
{
  "id": "uuid",
  "userQuery": "北京 Java 薪资 20K 以上的岗位",
  "generatedSql": "SELECT * FROM sp_jobs WHERE ...",
  "resultSummary": "共找到 42 条记录...",
  "resultData": [...],
  "resultCount": 42,
  "modelUsed": "deepseek-chat",
  "createdAt": "2026-05-08 10:30:00"
}
```

### `GET /llm/query/history`
查询历史列表。

### `DELETE /llm/query/:id`
删除一条查询记录。

---

## 九、AI 反爬 (Anti-Crawl)

### `POST /llm/anti-crawl/classify`
页面类型分类。

**请求体**：`{ html: string, url: string }`

**响应**：
```json
{
  "pageType": "normal|captcha|waf|login|error|empty",
  "confidence": 0.95,
  "indicators": ["验证码图片", "滑块验证"],
  "reason": "检测到极验滑块验证组件"
}
```

### `POST /llm/anti-crawl/selectors`
CSS 选择器推荐。

**请求体**：`{ html: string, target: string }`（target 如 "job_title", "company_name"）

### `POST /llm/anti-crawl/action`
应对策略推荐。

**请求体**：`{ classification: PageClassification }`

---

## 十、RAG 语义搜索

### `POST /rag/index/:taskId`
启动异步向量化索引。

### `POST /rag/index/:taskId/sync`
同步向量化索引，直接返回结果。

**响应**：`{ total, indexed, skipped, errors }`

### `POST /rag/search`
语义搜索。

**请求体**：
```json
{
  "query": "Python 后端开发岗位",
  "limit": 20,
  "taskId": "xxx",
  "minSimilarity": 0.7
}
```

**响应**：
```json
{
  "query": "Python 后端开发岗位",
  "results": [{
    "jobId": "xxx", "jobName": "...", "companyName": "...",
    "workCity": "北京", "salaryMonthlyMin": 15000,
    "keySkills": ["Python", "Django"],
    "similarity": 0.92
  }],
  "count": 15
}
```

### `GET /rag/stats?taskId=xxx`
向量化统计信息。

### `GET /rag/index/records?taskId=&keyword=&page=&pageSize=`
职位向量分页列表。

### `POST /rag/resume/upload`
上传简历文件并自动匹配。

**请求**：`multipart/form-data`，字段 `file`（PDF/DOCX/TXT）

**响应**：`{ resumeText, matches: [{ jobId, jobName, similarity, ... }] }`

### `POST /rag/resume/match`
用文本直接匹配。

**请求体**：`{ resumeText: string, limit?: number, minSimilarity?: number }`

---

## 十一、系统管理 (RBAC)

### 用户管理 `/users`

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/users?page=1&pageSize=10&keyword=` | 分页列表 |
| `GET` | `/users/:id` | 详情（含角色） |
| `POST` | `/users` | 创建 |
| `PUT` | `/users/:id` | 更新 |
| `DELETE` | `/users/:id` | 删除 |
| `PUT` | `/users/:id/roles` | 更新角色关联 `{ roleIds: number[] }` |

### 角色管理 `/roles`

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/roles?page=1&pageSize=10&keyword=` | 分页列表 |
| `GET` | `/roles/all` | 全部角色（下拉选择） |
| `GET` | `/roles/:id` | 详情（含权限/菜单 ID） |
| `POST` | `/roles` | 创建 `{ name, code, permissionIds, menuIds }` |
| `PUT` | `/roles/:id` | 更新 |
| `DELETE` | `/roles/:id` | 删除 |

### 权限管理 `/permissions`

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/permissions?page=1&pageSize=10&keyword=` | 分页列表 |
| `GET` | `/permissions/all` | 全部权限（按 resource 分组） |
| `POST` | `/permissions` | 创建 `{ name, code, resource, action }` |
| `PUT` | `/permissions/:id` | 更新 |
| `DELETE` | `/permissions/:id` | 删除 |

### 菜单管理 `/menus`

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/menus?page=1&pageSize=50&keyword=` | 平铺列表 |
| `GET` | `/menus/tree` | 树形结构（嵌套 children） |
| `POST` | `/menus` | 创建 `{ name, path, icon, parentId, sortOrder, component, hidden }` |
| `PUT` | `/menus/:id` | 更新 |
| `DELETE` | `/menus/:id` | 删除（有子菜单时禁止） |

---

## 十二、数据看板 (Dashboard)

### `GET /dashboard/overview`
获取数据看板概览指标。

### `POST /dashboard/insights`
生成 AI 全量洞察报告。

### `GET /dashboard/insights/history`
洞察报告历史列表。

### `GET /dashboard/insights/report/:reportId`
获取报告详情。

### `GET /dashboard/insights/report/:reportId/pdf`
下载报告 PDF。

---

## 十三、对话与文档索引 (Chat & Docs)

### 对话 `/chat`

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/chat/send` | 发送消息 `{ message, sessionId? }` |
| `GET` | `/chat/sessions` | 会话列表 |
| `GET` | `/chat/sessions/:id` | 会话消息 |
| `DELETE` | `/chat/sessions/:id` | 删除会话 |

### 文档索引 `/docs`

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/docs/index` | 全量索引 `{ sourceTypes? }` |
| `GET` | `/docs/index/status` | 索引统计 |
| `GET` | `/docs/index/records` | 分页列表 `?sourceType=&keyword=&page=&pageSize=` |
| `POST` | `/docs/index/file` | 上传文件索引（multipart，最多 20 个） |
| `DELETE` | `/docs/index/source/:sourceType` | 按类型批量删除 |
| `DELETE` | `/docs/index/:sectionId` | 按章节删除 |

---

## 十四、模型训练 (Training)

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/training/dataset/build` | 构建训练数据集 `{ taskIds[], strategy }` |
| `GET` | `/training/dataset/list` | 数据集列表 |
| `GET` | `/training/dataset/:id/preview` | 预览样本 |
| `POST` | `/training/start` | 启动训练 `{ datasetPath, baseModel, params }` |
| `GET` | `/training/status/:id` | 训练状态/进度/日志 |
| `GET` | `/training/list` | 训练任务列表 |
| `DELETE` | `/training/:id` | 删除训练任务 |
| `GET` | `/training/models` | 模型列表（本地 + Ollama） |
| `POST` | `/training/models/deploy` | 部署到 Ollama `{ modelPath, modelName }` |

---

## 通用说明

### 错误响应格式

```json
{
  "success": false,
  "error": "错误描述信息"
}
```

### HTTP 状态码

| 状态码 | 含义 |
|--------|------|
| 200 | 成功 |
| 400 | 参数校验失败 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

### 认证

除 `/auth/*` 和 `/login` 外，其他接口需要登录态（通过 Cookie 或 Token 验证）。
