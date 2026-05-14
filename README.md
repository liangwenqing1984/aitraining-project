# 智能招聘数据爬虫与 AI 分析平台

<div align="center">

![Version](https://img.shields.io/badge/version-2.2.0-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0-brightgreen.svg)
![PostgreSQL](https://img.shields.io/badge/postgresql-%3E%3D14-blue.svg)
![Vue](https://img.shields.io/badge/vue-3.5-42b883.svg)
![TypeScript](https://img.shields.io/badge/typescript-5.3-3178c6.svg)
![Python](https://img.shields.io/badge/python-3.8%2B-yellow.svg)
![AI](https://img.shields.io/badge/AI-LLM%20%E9%9B%86%E6%88%90-purple.svg)

**集数据采集、AI 增强、RAG 语义搜索、简历筛选、AI 问答、模型训练于一体的全栈职位数据平台**

</div>

---

## 目录

- [项目简介](#项目简介)
- [核心功能](#核心功能)
- [技术栈](#技术栈)
- [系统架构](#系统架构)
- [快速开始](#快速开始)
- [项目结构](#项目结构)
- [API 概览](#api-概览)
- [数据库表结构](#数据库表结构)
- [使用指南](#使用指南)
- [WebSocket 事件](#websocket-事件)
- [配置参考](#配置参考)
- [常见问题](#常见问题)

---

## 项目简介

本系统可从智联招聘、前程无忧等主流招聘平台自动采集职位数据，并通过 **AI 大模型** 进行智能增强、RAG 语义搜索、简历智能匹配、AI 问答、模型微调训练等全链路处理。

### 适用场景

- 人力资源市场调研与薪酬分析
- 技术岗位技能需求趋势追踪
- 企业招聘策略数据支撑
- 简历智能筛选与职位匹配
- AI 全栈开发实战培训（含 Embedding 模型微调）

---

## 核心功能

### 数据采集

| 功能 | 说明 |
|------|------|
| 多平台支持 | 智联招聘、前程无忧（可扩展） |
| 批量任务 | 多关键词 × 多城市笛卡尔积组合 |
| 断点续传 | 浏览器崩溃后从上次中断位置恢复 |
| 智能去重 | 基于职位 ID 自动去重 |
| WAF 对抗 | 反爬检测自动降级串行 + 随机延迟 + 指纹随机化 |
| 实时监控 | WebSocket 推送进度条、分级彩色日志 |

### AI 数据增强

| 增强维度 | 输出字段 |
|----------|----------|
| 薪资标准化 | `salary_monthly_min/max` — "15K-20K" → 15000-20000 |
| 职位分类 | `job_category_l1/l2` — 技术 > 后端开发 / 产品 > 产品经理 |
| 公司行业 | `company_industry` — 互联网/金融/制造/教育等 14 类 |
| 技能提取 | `key_skills / required_skills / preferred_skills` |
| 学历规范 | `education_normalized` — 本科/硕士/博士/大专/不限 |
| 经验年限 | `experience_years_min/max` |
| 福利识别 | `benefits` — 五险一金/年终奖/双休等 |
| 工作模式 | `work_mode` — 远程/现场/混合 |

### AI 市场洞察

- 基于增强数据自动构建多维度统计
- LLM 生成深度分析报告（Markdown + ECharts 图表配置）
- 支持报告历史查看与切换
- WebSocket 实时进度推送

### 自然语言查询

- Text-to-SQL：自然语言自动转 PostgreSQL 查询
- SQL 安全白名单校验（仅允许 SELECT）
- 查询结果 LLM 智能总结
- 对话式交互界面 + 查询历史

### AI 反爬对抗

- 页面类型智能分类（正常/验证码/WAF/登录/错误/空白）
- CSS 选择器自动推荐 + 应对策略决策引擎
- 硬编码签名检测（零延迟安全网）

### RAG 语义搜索与简历筛选

- 职位向量化索引（nomic-embed-text 768 维）
- 自然语言语义搜索，按相似度排序
- 上传简历文件（PDF/DOCX/TXT）自动匹配相似职位

### AI 问答机器人

- 基于项目文档和源代码的 RAG 知识库
- 多轮对话 + 会话管理 + 来源引用

### 数据看板与大屏

- 核心指标卡片 + 采集趋势图 + AI 增强覆盖率
- 科技蓝风格全屏数据大屏，适合投屏展示

### 语义模型训练

- 从增强数据构建对比学习训练对（正/负样本）
- Python sentence-transformers 微调 Embedding 模型
- Ollama 部署领域专用模型

---

## 技术栈

### 前端

| 技术 | 用途 |
|------|------|
| Vue 3 (Composition API) | 核心框架 |
| Element Plus | UI 组件库 |
| Pinia | 状态管理 |
| Vue Router | 路由 |
| ECharts 6 | 数据可视化 |
| Socket.IO Client | WebSocket 实时通信 |
| Axios | HTTP 客户端 |
| Vite | 构建工具 |

### 后端

| 技术 | 用途 |
|------|------|
| Node.js + Express | Web 服务框架 |
| TypeScript | 类型安全 |
| PostgreSQL (SeaboxSQL) | 数据存储 |
| Playwright + Puppeteer | 浏览器自动化爬虫 |
| Socket.IO | 实时推送 |
| ExcelJS | Excel 文件读写 |
| Multer | 文件上传处理 |
| bcrypt | 密码哈希 |
| Python 3.8+ | 模型训练 |

### AI 模型支持

| 提供商 | 类型 | 适用任务 |
|--------|------|----------|
| DeepSeek (deepseek-v4-pro) | 云端 | 数据增强 / 报告生成 |
| OpenAI (GPT-4o) | 云端 | 自然语言查询 / 反爬检测 |
| 智谱 (GLM) | 云端 | 通用 |
| Anthropic (Claude) | 云端 | 通用 |
| Ollama (Qwen/Llama) | 本地 | 批量增强 / Embedding 向量化 |
| 自定义微调模型 | 本地 | 岗位领域专用 Embedding |

---

## 系统架构

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Vue 3 :3002)                 │
│  ┌──────────┐ ┌────────────┐ ┌────────┐ ┌───────────┐  │
│  │ 数据采集  │ │ 智能查询(NL)│ │ 智能分析│ │ AI 配置    │  │
│  │ RAG 搜索 │ │ 简历筛选   │ │ 数据看板│ │ 数据大屏   │  │
│  │ AI 问答  │ │ 模型训练   │ │ 文档管理│ │ 系统管理   │  │
│  └──────────┘ └────────────┘ └────────┘ └───────────┘  │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP REST + WebSocket
┌──────────────────────▼──────────────────────────────────┐
│                   Backend (Express :3001)                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │ Task API │ │ File API │ │Analysis  │ │ LLM API  │  │
│  │ RAG API  │ │ Chat API │ │Training  │ │Dashboard │  │
│  │ Auth API │ │System API│ │Region API│ │          │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
│  ┌──────────────────────────────────────────────────┐   │
│  │              LLM Service Core                      │   │
│  │  CloudProvider (OpenAI/DeepSeek/Anthropic/Zhipu) │   │
│  │  LocalProvider (Ollama)                           │   │
│  │  Task Router (任务类型 → 模型映射)                  │   │
│  └──────────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────────┘
                       │ SQL
┌──────────────────────▼──────────────────────────────────┐
│           PostgreSQL (SeaboxSQL :7300)                    │
│  sp_tasks │ sp_csv_files │ sp_jobs │ sp_job_enrichments         │
│  sp_llm_config │ sp_market_reports │ sp_saved_queries           │
│  sp_job_embeddings │ sp_doc_embeddings (pgvector)               │
│  sp_chat_sessions │ sp_chat_messages │ sp_training_jobs         │
│  sp_users │ sp_roles │ sp_permissions │ sp_menus (RBAC)         │
└──────────────────────────────────────────────────────────┘
                       │ Browser Automation
┌──────────────────────▼──────────────────────────────────┐
│              Playwright + Puppeteer                        │
│  智联招聘 (zhilian.ts) │ 前程无忧 (job51.ts)              │
└──────────────────────────────────────────────────────────┘
```

---

## 快速开始

### 环境要求

- **Node.js** >= 18.0
- **PostgreSQL** >= 14（本系统连接 `10.1.1.113:7300`）
- **Chrome/Chromium**（Playwright 自动下载）
- **npm** >= 9
- **Python** >= 3.8（模型训练，可选）

### 安装与启动

```bash
# 1. 克隆项目
git clone <repo-url> aitraining
cd aitraining

# 2. 安装前端依赖
cd code/frontend && npm install

# 3. 安装后端依赖
cd ../backend && npm install

# 4. 启动后端（端口 3001）
cd code/backend
npm run dev

# 5. 新终端，启动前端（端口 3002）
cd code/frontend
npm run dev

# 6. 访问 http://localhost:3002
```

> **Windows 用户** 可直接双击根目录 `start-dev.bat` 一键启动。

### 配置 LLM

**联系人：** 侧边栏「AI 配置」
2. 点击「添加配置」，选择提供商（DeepSeek / OpenAI 等）
3. 填入 API Key 和 Base URL
4. 在「任务路由」中勾选需要使用的任务类型
5. 点击「测试连接」验证

---

## 项目结构

```
aitraining/
├── code/
│   ├── frontend/                    # Vue 3 前端
│   │   └── src/
│   │       ├── api/                 # API 接口层 (8 个文件)
│   │       │   ├── index.ts         #   Axios 实例 + 拦截器
│   │       │   ├── llm.ts           #   LLM 配置/增强/洞察/查询/反爬
│   │       │   ├── task.ts          #   任务 CRUD
│   │       │   ├── chat.ts          #   对话 + 文档索引
│   │       │   ├── training.ts      #   模型训练
│   │       │   ├── system.ts        #   RBAC 系统管理
│   │       │   └── file.ts          #   文件管理
│   │       ├── views/               # 26 个页面组件
│   │       │   ├── crawler/         # 数据采集 (4 页)
│   │       │   ├── rag/             # 语义搜索 + 简历筛选 (2 页)
│   │       │   ├── system/          # 系统管理 (7 页)
│   │       │   │   ├── Users.vue / Roles.vue / Permissions.vue / Menus.vue
│   │       │   │   ├── EnrichmentData.vue / VectorData.vue / ModelTraining.vue
│   │       │   ├── analysis/        # 智能分析
│   │       │   ├── query/           # 自然语言查询
│   │       │   ├── dashboard/       # 数据看板
│   │       │   ├── daping/          # 数据大屏
│   │       │   ├── aibot/           # AI 问答机器人
│   │       │   ├── settings/        # 模型配置
│   │       │   ├── files/           # 文件管理
│   │       │   ├── Docs.vue         # 帮助文档
│   │       │   └── Login.vue        # 登录页
│   │       ├── layouts/             # 布局组件
│   │       └── router/              # 路由 + 认证守卫
│   │
│   ├── backend/                    # Express 后端
│   │   └── src/
│   │       ├── services/            # 27 个服务文件
│   │       │   ├── crawler/         # 爬虫实现 (4 文件)
│   │       │   │   ├── index.ts     #   基类
│   │       │   │   ├── zhilian.ts   #   智联招聘
│   │       │   │   ├── job51.ts     #   前程无忧
│   │       │   │   └── proxyPool.ts #   IP 代理池
│   │       │   ├── llm/             # LLM 服务 (11 文件)
│   │       │   │   ├── index.ts / enrichment.ts / insights.ts
│   │       │   │   ├── query.ts / rag.ts / antiCrawl.ts
│   │       │   │   ├── embeddings.ts / prompts.ts / resumeParser.ts
│   │       │   │   ├── trainingData.ts
│   │       │   │   └── providers/ (cloud.ts / local.ts)
│   │       │   ├── docIndexService.ts   # 文档向量化
│   │       │   ├── chatService.ts       # AI 对话
│   │       │   ├── userService.ts       # 用户管理
│   │       │   ├── roleService.ts       # 角色管理
│   │       │   ├── permissionService.ts # 权限管理
│   │       │   ├── menuService.ts       # 菜单管理
│   │       │   ├── taskService.ts       # 任务编排
│   │       │   ├── authService.ts       # OAuth2 认证
│   │       │   └── seedService.ts       # 初始数据填充
│   │       ├── routes/              # 路由定义 (11 模块)
│   │       ├── controllers/         # 请求处理 (15 控制器)
│   │       ├── config/database.ts   # 数据库连接 + 19 表自动迁移
│   │       └── types/               # TypeScript 类型
│   │
│   └── scripts/                    # 工具脚本
│       ├── train_embedding.py       # Python 模型训练脚本
│       ├── exportDatabase.ts        # 数据库备份导出
│       └── generateSampleResume.ts  # 样本简历生成
│
├── docs/                            # 系统文档
│   ├── README.md                    #   文档索引
│   ├── 系统架构概述.md / 数据库设计文档.md / API参考手册.md
│   ├── 快速开始指南.md / 用户使用手册.md / 部署运维指南.md
│   └── diagnostics/                 #   157 篇诊断报告
│
├── doc/                             # 项目设计文档 (40+ 篇)
│
├── start-dev.bat                    # 一键启动脚本
└── README.md
```

---

## API 概览

**Base URL:** `http://localhost:3001/api` · **11 个路由模块 · 70+ 个端点**

### 任务管理 `/api/tasks` — 11 个端点

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/` | 创建任务 |
| GET | `/` | 任务列表 (分页/筛选) |
| GET | `/:id` | 任务详情 |
| GET | `/:id/logs` | 任务日志 |
| POST | `/:id/start` | 启动任务 |
| POST | `/:id/stop` | 停止任务 |
| POST | `/:id/pause` | 暂停任务 |
| POST | `/:id/resume` | 恢复任务 |
| DELETE | `/:id` | 删除任务 |
| PUT | `/:id/config` | 更新配置 |
| GET | `/regions/list` | 省市列表 |

### 文件管理 `/api/files` — 8 个端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/` | 文件列表 |
| GET | `/:id` | 文件详情 |
| GET | `/:id/analyze` | 深度分析 (Excel) |
| GET | `/:id/preview` | 预览内容 |
| GET | `/:id/download` | 下载文件 |
| GET | `/task/:taskId` | 按任务查询 |
| DELETE | `/:id` | 删除文件 |
| POST | `/batch-delete` | 批量删除 |

### 数据分析 `/api/analysis` — 5 个端点

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/analyze` | 分析文件 |
| GET | `/salary/:fileId` | 薪资分布 |
| GET | `/city/:fileId` | 城市分布 |
| GET | `/education/:fileId` | 学历分布 |
| GET | `/experience/:fileId` | 经验分布 |

### AI 服务 `/api/llm` — 17 个端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/config` | LLM 配置列表 |
| POST | `/config` | 保存配置 |
| DELETE | `/config/:id` | 删除配置 |
| GET | `/health` | 健康检查 |
| POST | `/test` | 测试调用 |
| POST | `/enrich/:taskId` | 启动数据增强 |
| GET | `/enrich/:taskId/status` | 增强状态 |
| GET | `/enrich/:taskId/result` | 增强结果 |
| POST | `/insights/:fileId` | 生成市场洞察报告 |
| GET | `/insights/:fileId/history` | 报告历史 |
| GET | `/insights/report/:reportId` | 报告详情 |
| POST | `/query` | 自然语言查询 |
| GET | `/query/history` | 查询历史 |
| DELETE | `/query/:id` | 删除查询 |
| POST | `/anti-crawl/classify` | AI 页面分类 |
| POST | `/anti-crawl/selectors` | 选择器推荐 |
| POST | `/anti-crawl/action` | 应对策略 |

### 认证 `/api/auth` — 6 个端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/authorize-url` | 获取 OAuth2 授权 URL |
| GET | `/callback` | OAuth2 回调 |
| POST | `/refresh-token` | 刷新 Token |
| GET | `/user-info` | 当前用户信息 |
| POST | `/validate-token` | 验证 Token |
| POST | `/logout` | 登出 |

### RAG 语义搜索 `/api/rag` — 7 个端点

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/index/:taskId` | 启动向量化索引 |
| POST | `/index/:taskId/sync` | 同步索引 |
| POST | `/search` | 语义搜索 |
| POST | `/resume/upload` | 上传简历匹配 |
| POST | `/resume/match` | 文本匹配简历 |
| DELETE | `/index/:taskId` | 删除索引 |
| GET | `/stats` | 索引统计 |

### 对话与文档 `/api/chat` + `/api/docs` — 10 个端点

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/chat/send` | 发送消息 |
| GET | `/chat/sessions` | 会话列表 |
| GET/DELETE | `/chat/sessions/:id` | 会话详情/删除 |
| POST | `/docs/index` | 全量文档索引 |
| GET | `/docs/index/status` | 索引状态 |
| GET | `/docs/index/records` | 分页列表 |
| POST | `/docs/index/file` | 上传文件索引（多文件） |
| DELETE | `/docs/index/source/:type` | 按类型删除 |
| DELETE | `/docs/index/:sectionId` | 按章节删除 |

### 模型训练 `/api/training` — 9 个端点

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/dataset/build` | 构建训练数据 |
| GET | `/dataset/list` | 数据集列表 |
| GET | `/dataset/:id/preview` | 预览样本 |
| POST | `/start` | 启动训练 |
| GET | `/status/:id` | 训练状态 |
| GET | `/list` | 训练任务列表 |
| DELETE | `/:id` | 删除训练任务 |
| GET | `/models` | 模型列表 |
| POST | `/models/deploy` | 部署到 Ollama |

### 数据看板 `/api/dashboard` — 5 个端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/overview` | 概览指标 |
| POST | `/insights` | 生成洞察报告 |
| GET | `/insights/history` | 报告历史 |
| GET | `/insights/report/:id` | 报告详情 |
| GET | `/insights/report/:id/pdf` | 下载 PDF |

### RBAC 系统管理 `/api/users` `/api/roles` `/api/permissions` `/api/menus` — 23 个端点

| 模块 | 端点 | 说明 |
|------|------|------|
| 用户 | GET/POST/PUT/DELETE | CRUD + 角色分配 |
| 角色 | GET/POST/PUT/DELETE | CRUD + 权限/菜单分配 |
| 权限 | GET/POST/PUT/DELETE | resource:action 格式 |
| 菜单 | GET/POST/PUT/DELETE | 树形结构管理 |

**总计: 70+ 个 API 端点**

---

## 数据库表结构

Schema: `liangwenqing`，共 19 张表（含 pgvector 向量库和 RBAC 权限体系）。

### `sp_tasks` — 爬虫任务

| 核心字段 | 类型 | 说明 |
|----------|------|------|
| id | VARCHAR(255) PK | UUID |
| name | VARCHAR(500) | 任务名称 |
| source | VARCHAR(50) | zhilian / 51job / all |
| config | JSONB | 关键词/城市/企业/页数配置 |
| status | VARCHAR(20) | pending→running→completed/failed |
| record_count | INTEGER | 采集记录数 |
| csv_path | TEXT | 输出 Excel 路径 |

### `sp_csv_files` — 导出文件

| 核心字段 | 类型 | 说明 |
|----------|------|------|
| id | VARCHAR(255) PK | UUID |
| task_id | VARCHAR(255) FK | 关联任务 |
| filepath | TEXT | 文件路径 |
| record_count | INTEGER | 记录数 |

### `sp_job_enrichments` — AI 增强结果

| 核心字段 | 类型 | 说明 |
|----------|------|------|
| task_id + job_id | UNIQUE | 任务+职位唯一 |
| salary_monthly_min/max | INTEGER | 标准化月薪 (元) |
| job_category_l1/l2 | VARCHAR | 一/二级职位分类 |
| company_industry | VARCHAR(100) | 公司行业 |
| key_skills | JSONB | 技能列表 |
| education_normalized | VARCHAR(20) | 学历标准化 |
| experience_years_min/max | INTEGER | 经验年限 |
| benefits | JSONB | 福利列表 |
| work_mode | VARCHAR(20) | 远程/现场/混合 |
| model_used | VARCHAR(100) | 增强所用模型 |

### `sp_market_reports` — AI 洞察报告

| 核心字段 | 类型 | 说明 |
|----------|------|------|
| file_id | VARCHAR(255) FK | 关联文件 |
| title | VARCHAR(500) | 报告标题 |
| content | TEXT | Markdown 正文 |
| summary | TEXT | 200 字摘要 |
| charts_config | JSONB | ECharts 图表配置 |

### `sp_llm_config` — AI 模型配置

| 核心字段 | 类型 | 说明 |
|----------|------|------|
| provider | VARCHAR(50) | openai/deepseek/zhipu/ollama |
| model_name | VARCHAR(100) | 模型名称 |
| api_key_encrypted | TEXT | AES-256-GCM 加密 |
| task_routing | JSONB | 任务类型路由 |

### `sp_saved_queries` — NL 查询历史

| 核心字段 | 类型 | 说明 |
|----------|------|------|
| user_query | TEXT | 用户自然语言 |
| generated_sql | TEXT | AI 生成的 SQL |
| result_summary | TEXT | LLM 总结 |
| result_data | JSONB | 查询结果 |

### `sp_job_embeddings` — RAG 职位向量库

| 核心字段 | 类型 | 说明 |
|----------|------|------|
| task_id + job_id | UNIQUE | 任务+职位唯一约束 |
| text_content | TEXT | 拼接后的职位全文 |
| embedding | vector(768) | nomic-embed-text 768维向量 |
| job_name / company_name / work_city | VARCHAR | 原始职位/企业/城市信息 |
| key_skills | JSONB | 关键技能列表 |
| source_metadata | JSONB | 来源元数据 |

> 需要 pgvector 扩展。通过 IVFFlat 索引加速近似最近邻搜索，使用余弦距离计算相似度。

### `sp_doc_embeddings` — 文档向量索引

| 核心字段 | 类型 | 说明 |
|----------|------|------|
| section_id | VARCHAR(255) UNIQUE | 文档章节唯一标识 |
| source_type | VARCHAR(50) | 来源：docs/diagnostics/code |
| embedding | vector(768) | 文本块向量 |
| chunk_index / total_chunks | INTEGER | 分块序号/总数 |
| text_content | TEXT | 原始文本内容 |

### `sp_chat_sessions` — AI 对话会话

| 核心字段 | 类型 | 说明 |
|----------|------|------|
| id | VARCHAR(255) PK | UUID |
| title | VARCHAR(500) | 会话标题（自动生成） |
| model_used | VARCHAR(100) | 使用的 LLM 模型 |
| message_count | INTEGER | 消息数量 |

### `sp_chat_messages` — AI 对话消息

| 核心字段 | 类型 | 说明 |
|----------|------|------|
| session_id | VARCHAR(255) FK | 关联会话 |
| role | VARCHAR(20) | user / assistant |
| content | TEXT | 消息内容 |
| sources | JSONB | 引用文档来源 |

### `sp_training_jobs` — 模型训练任务

| 核心字段 | 类型 | 说明 |
|----------|------|------|
| id | VARCHAR(255) PK | UUID |
| model_name | VARCHAR(200) | 模型名称 |
| status | VARCHAR(20) | pending→training→completed/failed |
| config | JSONB | 训练超参数（epochs/batch_size/lr） |
| metrics | JSONB | 训练指标（loss/accuracy） |
| dataset_path | TEXT | 训练数据路径 |

### RBAC 权限体系（7 张表）

| 表名 | 说明 |
|------|------|
| `sp_users` | 用户表（username/password_hash/email/status） |
| `sp_roles` | 角色表（name/description） |
| `sp_permissions` | 权限表（resource:action 格式） |
| `sp_menus` | 菜单表（树形结构，含图标/路径/排序） |
| `sp_user_roles` | 用户-角色关联 |
| `sp_role_permissions` | 角色-权限关联 |
| `sp_role_menus` | 角色-菜单关联 |

### `sp_jobs` — 原始职位数据

| 核心字段 | 类型 | 说明 |
|----------|------|------|
| id | VARCHAR(255) PK | 职位 ID |
| task_id | VARCHAR(255) FK | 关联任务 |
| job_name | VARCHAR(500) | 职位名称 |
| company_name | VARCHAR(500) | 公司名称 |
| salary_text | VARCHAR(200) | 原始薪资文本 |
| work_city | VARCHAR(100) | 工作城市 |
| crawl_time | TIMESTAMP | 采集时间 |

---

## 使用指南

### 1. 采集数据

1. 进入「数据采集」→「创建任务」
2. 输入关键词（如 `Java开发`）→ **点击添加按钮**
3. 选择目标城市（可多选）
4. 设置最大页数 → 点击「创建」

> 批量创建支持多关键词 × 多城市自动生成组合任务。

### 2. AI 增强数据

1. 等待任务状态变为「已完成」
2. 点击任务行右侧的 **「AI 增强」** 按钮
3. WebSocket 实时推送进度，增强完成自动通知
4. 进入「智能分析」查看增强后的标准化数据

### 3. AI 深度分析

1. 从文件管理点击「分析」进入智能分析页
2. 此时已展示基础图表（薪资/城市/学历等分布）
3. 点击 **「AI 深度分析」** 按钮
4. 系统先检查增强数据是否存在 → 聚合统计 → 调用 LLM 生成报告
5. 20-40 秒后自动展示：摘要 + 各维度分析 + AI 生成的可视化图表

### 4. 自然语言查询

1. 进入「智能查询」页面
2. 可选：顶部下拉框选择目标任务限定范围
3. 输入问题，如：
   - "薪资最高的 10 个岗位"
   - "互联网行业本科学历岗位数量"
   - "各城市 Java 岗位平均薪资对比"
4. 系统自动生成 SQL → 执行查询 → LLM 总结结果

### 5. RAG 语义搜索

1. 采集并增强数据后，进入「语义搜索」→「向量索引」
2. 点击「开始索引」，系统自动将职位文本向量化存入 pgvector
3. 索引完成后，输入自然语言描述（如"需要3年经验的远程后端开发"）
4. 系统返回语义相似度最高的职位列表

### 6. 简历筛选

1. 进入「语义搜索」→「简历筛选」
2. 上传简历文件（PDF/DOCX/TXT）或直接粘贴简历文本
3. 系统自动提取关键信息并匹配最相似的职位
4. 按匹配度排序展示，支持查看职位详情

### 7. AI 问答机器人

1. 进入「AI 问答」页面
2. 输入关于本系统的问题（如"如何配置 LLM 模型？"）
3. AI 基于项目文档和源代码 RAG 检索后回答
4. 支持多轮对话、会话管理、来源引用

### 8. 文档向量管理

1. 进入「系统管理」→「文本向量管理」
2. 支持全量文档索引（一键索引所有 docs/ 文档）
3. 支持上传单个或多个文件（.md/.txt/.pdf/.docx）
4. 查看索引记录、按来源类型/章节删除

### 9. 模型训练

1. 进入「系统管理」→「模型训练」
2. 从增强数据构建正/负样本对比学习训练集
3. 启动 Python sentence-transformers 微调训练
4. 训练完成后一键部署到 Ollama，前端自动显示新模型

### 10. 数据看板与大屏

1. 进入「数据看板」查看核心指标卡片 + 采集趋势图 + AI 增强覆盖率
2. 进入「数据大屏」查看全屏科技蓝风格可视化，适合投屏展示

### 11. AI 配置管理

1. 进入「AI 配置」页面
2. 添加模型配置（支持 OpenAI / DeepSeek / 智谱 / Ollama）
3. 在「任务路由」中指定该模型用于哪些任务类型
4. 点击「测试连接」验证连通性

---

## 开发指南

### 分支策略

| 分支 | 说明 |
|------|------|
| `main` | 稳定版本 |
| `with-ip-proxy-pool` | IP 代理池 + 爬虫增强（当前开发分支） |
| `with-model-train` | 模型训练 + 文档向量管理 |
| `with-dashboard` | 数据看板 + 数据大屏 |
| `with-rbac` | RBAC 权限体系 |
| `with-ai-enrichment` | AI 数据增强全流程 |

### 添加新 LLM 提供商

1. 如需特殊 API 格式，在 `providers/` 下新建类（参照 `cloud.ts`）
2. 在 `types/index.ts` 的 `LLMProvider` 联合类型中添加新值
3. 在 `llmService.initialize()` 中注册

### 添加新爬虫平台

1. 在 `services/crawler/` 下新建爬虫类（参照 `zhilian.ts`）
2. 实现 `async *crawl(config, signal): AsyncGenerator<JobData>` 方法
3. 在 `taskService.ts` 中注册新 source

### 数据库迁移

表结构在 `config/database.ts` 中通过 `CREATE TABLE IF NOT EXISTS` 自动迁移，服务启动时自动执行。

---

## WebSocket 事件

### 客户端 → 服务端

```javascript
socket.emit('task:subscribe', { taskId: 'xxx' })
socket.emit('task:unsubscribe', { taskId: 'xxx' })
```

### 服务端 → 客户端

| 事件 | 载荷 | 说明 |
|------|------|------|
| `task:progress` | `{taskId, progress, current, total}` | 爬虫任务进度 |
| `task:status` | `{taskId, status}` | 状态变更 |
| `task:log` | `{taskId, level, message, timestamp}` | 分级彩色实时日志 |
| `task:completed` | `{taskId, totalRecords}` | 任务完成 |
| `task:error` | `{taskId, error}` | 任务异常 |
| `enrichment:progress` | `{taskId, status, completed, total, message}` | AI 增强进度 |
| `enrichment:completed` | `{taskId, successCount, failCount}` | AI 增强完成 |
| `insights:progress` | `{fileId, message, stage}` | 报告生成进度 |
| `insights:completed` | `{fileId, reportId, title, summary}` | 报告生成完成 |
| `training:progress` | `{jobId, epoch, loss, step}` | 模型训练进度 |
| `training:completed` | `{jobId, modelName, metrics}` | 训练完成 |
| `chat:message` | `{sessionId, role, content, sources?}` | AI 对话消息 |

---

## 配置参考

### 数据库连接

`code/backend/src/config/database.ts`:

```typescript
host: '10.1.1.113', port: 7300
database: 'training_exercises'
user/password: 'liangwenqing'
schema: 'liangwenqing'
pool max: 50
```

### 服务端口

| 服务 | 端口 |
|------|------|
| 前端 Vite | 3002 |
| 后端 Express | 3001 |
| PostgreSQL | 7300 |
| Ollama (本地) | 11434 |

### OAuth2 认证

使用 `leaf-auth-server.dev.jinxin.cloud` 作为认证服务器，授权码模式。Token 通过 Cookie 传递。

---

## 常见问题

**Q: AI 增强只成功部分记录？**
A: 检查后端日志，通常是 LLM 返回非标准 JSON 导致解析失败。系统已内置 3 层降级解析 + 3 次重试机制。

**Q: 自然语言查询返回无关数据？**
A: 确保 LLM 配置中任务路由包含 `query` 类型。系统会自动将查询路由到对应模型。

**Q: 爬虫被反爬拦截？**
A: 系统内置 WAF 检测 + 自动降级串行 + AI 页面分类 + IP 代理池自动切换。可在任务监控日志中查看拦截详情。

**Q: Playwright 浏览器内存占用高？**
A: 限制并发任务数 ≤ 3，或使用 `node --max-old-space-size=4096` 增加内存。定时清理残留 Chromium 进程：`pkill -f chromium`。

**Q: 前端启动报 "Cannot find module '@element-plus/icons-vue'？**
A: `cd code/frontend && npm install` 重新安装依赖。

**Q: Ollama 模型列表为空？**
A: 确认 Ollama 服务已启动（`ollama serve`），且已拉取模型（`ollama list`）。

**Q: RAG 语义搜索不可用？**
A: 检查 pgvector 扩展是否安装成功，确认后端启动日志中有 `✅ pgvector 扩展已就绪`。

**Q: 模型训练功能需要什么环境？**
A: 需要 Python 3.8+，安装 `sentence-transformers` 和 `torch`：`pip install sentence-transformers torch`。

---

<div align="center">

**AI 驱动的智能招聘数据分析平台**

</div>
