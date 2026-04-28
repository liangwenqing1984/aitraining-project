<template>
  <div class="docs-layout">
    <!-- 左侧文档菜单 -->
    <aside class="docs-sidebar">
      <div class="sidebar-header">
        <h3>📖 项目文档</h3>
      </div>
      <el-menu
        :default-active="activeSection"
        class="docs-menu"
        @select="handleSelect"
      >
        <template v-for="group in menuGroups" :key="group.id">
          <el-sub-menu v-if="group.children" :index="group.id">
            <template #title>
              <el-icon v-if="group.icon"><component :is="group.icon" /></el-icon>
              <span>{{ group.label }}</span>
            </template>
            <el-menu-item
              v-for="child in group.children"
              :key="child.id"
              :index="child.id"
            >
              {{ child.label }}
            </el-menu-item>
          </el-sub-menu>
          <el-menu-item v-else :index="group.id">
            <el-icon v-if="group.icon"><component :is="group.icon" /></el-icon>
            <span>{{ group.label }}</span>
          </el-menu-item>
        </template>
      </el-menu>
    </aside>

    <!-- 右侧文档内容 -->
    <main class="docs-content">
      <div class="content-header">
        <h2>{{ currentTitle }}</h2>
      </div>
      <div class="markdown-body" v-html="currentContent"></div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  InfoFilled, Monitor, DataAnalysis, TrendCharts,
  Setting, Document, Folder, Connection, ChatDotRound,
  Key, List, Files, Promotion
} from '@element-plus/icons-vue'

// ==================== 文档菜单结构 ====================
const menuGroups = [
  { id: 'intro', label: '项目简介', icon: InfoFilled },
  {
    id: 'features', label: '核心功能', icon: Monitor,
    children: [
      { id: 'feat-crawl', label: '数据采集' },
      { id: 'feat-enrich', label: 'AI 数据增强' },
      { id: 'feat-insights', label: 'AI 市场洞察' },
      { id: 'feat-query', label: '自然语言查询' },
      { id: 'feat-anticrawl', label: 'AI 反爬对抗' },
    ]
  },
  { id: 'tech-stack', label: '技术栈', icon: Setting },
  { id: 'architecture', label: '系统架构', icon: Connection },
  { id: 'quickstart', label: '快速开始', icon: Promotion },
  {
    id: 'api', label: 'API 概览', icon: List,
    children: [
      { id: 'api-tasks', label: '任务管理 (11)' },
      { id: 'api-files', label: '文件管理 (8)' },
      { id: 'api-analysis', label: '数据分析 (5)' },
      { id: 'api-llm', label: 'AI 服务 (17)' },
      { id: 'api-auth', label: '认证 (6)' },
    ]
  },
  { id: 'database', label: '数据库表结构', icon: Folder },
  {
    id: 'guide', label: '使用指南', icon: Document,
    children: [
      { id: 'guide-crawl', label: '采集数据' },
      { id: 'guide-enrich', label: 'AI 增强数据' },
      { id: 'guide-insights', label: 'AI 深度分析' },
      { id: 'guide-query', label: '自然语言查询' },
      { id: 'guide-config', label: 'AI 配置管理' },
    ]
  },
  { id: 'websocket', label: 'WebSocket 事件', icon: Connection },
  { id: 'faq', label: '常见问题', icon: ChatDotRound },
]

// ==================== 文档内容 ====================
const docs: Record<string, { title: string; content: string }> = {

  // ========== 项目简介 ==========
  intro: {
    title: '项目简介',
    content: `<p>本系统可从<strong>智联招聘、前程无忧</strong>等主流招聘平台自动采集职位数据，并通过 <strong>AI 大模型</strong> 对数据进行智能增强（薪资标准化、技能提取、行业分类）、深度分析报告生成、自然语言查询等高级处理。</p>

<h3>适用场景</h3>
<ul>
  <li>人力资源市场调研与薪酬分析</li>
  <li>技术岗位技能需求趋势追踪</li>
  <li>企业招聘策略数据支撑</li>
  <li>AI 全栈开发实战培训</li>
</ul>

<h3>版本信息</h3>
<table>
  <tr><td><strong>当前版本</strong></td><td>2.0.0</td></tr>
  <tr><td><strong>分支</strong></td><td>with-ai</td></tr>
  <tr><td><strong>Node.js</strong></td><td>v24.14.0+</td></tr>
  <tr><td><strong>PostgreSQL</strong></td><td>SeaboxSQL 7300</td></tr>
</table>`
  },

  // ========== 核心功能 ==========
  'feat-crawl': {
    title: '数据采集',
    content: `<table>
  <tr><th>功能</th><th>说明</th></tr>
  <tr><td>多平台支持</td><td>智联招聘、前程无忧（可扩展）</td></tr>
  <tr><td>批量任务</td><td>多关键词 × 多城市笛卡尔积组合</td></tr>
  <tr><td>断点续传</td><td>浏览器崩溃后从上次中断位置恢复</td></tr>
  <tr><td>智能去重</td><td>基于职位 ID 自动去重</td></tr>
  <tr><td>WAF 对抗</td><td>反爬检测自动降级串行 + 随机延迟 + 指纹随机化</td></tr>
  <tr><td>实时监控</td><td>WebSocket 推送进度条、分级彩色日志</td></tr>
  <tr><td>Excel 导出</td><td>格式化 .xlsx 输出，带样式表头、冻结行、交替行颜色</td></tr>
</table>`
  },
  'feat-enrich': {
    title: 'AI 数据增强',
    content: `<p>爬取完成后，通过 LLM 自动对每条职位数据进行标准化处理，输出结构化增强数据：</p>

<table>
  <tr><th>增强维度</th><th>输出字段</th><th>示例</th></tr>
  <tr><td>薪资标准化</td><td><code>salary_monthly_min/max</code></td><td>"15K-20K" → 15000-20000</td></tr>
  <tr><td>职位分类</td><td><code>job_category_l1/l2</code></td><td>技术 → 后端开发</td></tr>
  <tr><td>公司行业</td><td><code>company_industry</code></td><td>互联网/金融/制造等 14 类</td></tr>
  <tr><td>技能提取</td><td><code>key_skills / required / preferred</code></td><td>["Java","Spring","MySQL"]</td></tr>
  <tr><td>学历规范</td><td><code>education_normalized</code></td><td>本科/硕士/博士/大专</td></tr>
  <tr><td>经验年限</td><td><code>experience_years_min/max</code></td><td>3-5 年</td></tr>
  <tr><td>福利识别</td><td><code>benefits</code></td><td>五险一金/年终奖/双休</td></tr>
  <tr><td>工作模式</td><td><code>work_mode</code></td><td>远程/现场/混合</td></tr>
</table>

<h4>技术特点</h4>
<ul>
  <li>BATCH_SIZE=1 逐条处理，500ms 间隔避免 API 限流</li>
  <li>3 层降级 JSON 解析（直接解析 → 边界提取 → 单引号/无引号修复）</li>
  <li>3 次重试 + 递增 temperature 提高成功率</li>
  <li>WebSocket 实时推送增强进度</li>
  <li>ON CONFLICT UPSERT 保证幂等可重跑</li>
</ul>`
  },
  'feat-insights': {
    title: 'AI 市场洞察',
    content: `<p>基于增强数据自动聚合统计，调用 LLM 生成深度分析报告：</p>

<ul>
  <li>从 <code>job_enrichments</code> 表聚合：薪资分布、职位分类、技能排行、行业分布、学历/经验要求、工作模式</li>
  <li>LLM 输出结构化 JSON：<code>{ title, summary, sections[], charts_config[] }</code></li>
  <li>每个 section 包含标题、正文（Markdown）、关键发现</li>
  <li>charts_config 直接输出 ECharts option 对象，前端渲染</li>
  <li>支持报告历史查询与切换</li>
  <li>WebSocket 分阶段推送进度（构建统计 → 调用 AI → 解析 → 入库）</li>
  <li>前端 2 秒轮询 + WebSocket 双重保障报告加载</li>
</ul>`
  },
  'feat-query': {
    title: '自然语言查询',
    content: `<p>聊天式界面，用户用自然语言查询职位数据，系统自动完成 Text-to-SQL + 执行 + 总结全流程：</p>

<h4>处理流程</h4>
<ol>
  <li><strong>解析意图</strong>：LLM 分析用户问题，提取关键条件</li>
  <li><strong>生成 SQL</strong>：基于 <code>job_enrichments</code> 表结构生成 PostgreSQL 查询</li>
  <li><strong>安全校验</strong>：白名单验证——仅允许 SELECT，拦截 INSERT/DROP/TRUNCATE 等</li>
  <li><strong>执行查询</strong>：参数化执行，LIMIT 500</li>
  <li><strong>智能总结</strong>：LLM 用 2-3 句话总结查询结果</li>
</ol>

<h4>快捷提问示例</h4>
<ul>
  <li>"薪资最高的 10 个岗位是哪些？"</li>
  <li>"各城市 Java 岗位平均薪资对比"</li>
  <li>"本科学历要求的岗位有多少个？"</li>
  <li>"互联网行业的平均薪资范围"</li>
</ul>`
  },
  'feat-anticrawl': {
    title: 'AI 反爬对抗',
    content: `<p>在传统规则检测之上，引入 LLM 智能分类与应对能力：</p>

<table>
  <tr><th>能力</th><th>说明</th></tr>
  <tr><td>页面分类</td><td>6 种类型：normal / captcha / waf / login / error / empty</td></tr>
  <tr><td>CSS 选择器推荐</td><td>当 DOM 解析失效时，AI 分析 HTML 建议新选择器</td></tr>
  <tr><td>应对策略</td><td>根据分类自动推荐：continue / wait / retry / switch_ip / abort</td></tr>
  <tr><td>冷却机制</td><td>5 秒冷却避免频繁调用 LLM</td></tr>
</table>

<h4>API 端点</h4>
<ul>
  <li><code>POST /api/llm/anti-crawl/classify</code> — 页面分类</li>
  <li><code>POST /api/llm/anti-crawl/selectors</code> — 选择器推荐</li>
  <li><code>POST /api/llm/anti-crawl/action</code> — 应对策略</li>
</ul>`
  },

  // ========== 技术栈 ==========
  'tech-stack': {
    title: '技术栈',
    content: `<h3>前端</h3>
<table>
  <tr><th>技术</th><th>用途</th></tr>
  <tr><td>Vue 3 (Composition API)</td><td>核心框架</td></tr>
  <tr><td>Element Plus</td><td>UI 组件库</td></tr>
  <tr><td>Pinia</td><td>状态管理</td></tr>
  <tr><td>Vue Router</td><td>路由</td></tr>
  <tr><td>ECharts 6</td><td>数据可视化</td></tr>
  <tr><td>Socket.IO Client</td><td>WebSocket 通信</td></tr>
  <tr><td>Axios</td><td>HTTP 客户端</td></tr>
  <tr><td>Vite</td><td>构建工具</td></tr>
  <tr><td>marked</td><td>Markdown 渲染</td></tr>
</table>

<h3>后端</h3>
<table>
  <tr><th>技术</th><th>用途</th></tr>
  <tr><td>Node.js + Express</td><td>Web 服务框架</td></tr>
  <tr><td>TypeScript</td><td>类型安全</td></tr>
  <tr><td>PostgreSQL (SeaboxSQL)</td><td>数据存储</td></tr>
  <tr><td>Puppeteer</td><td>浏览器自动化爬虫</td></tr>
  <tr><td>Socket.IO</td><td>实时推送</td></tr>
  <tr><td>ExcelJS</td><td>Excel 读写</td></tr>
  <tr><td>AES-256-GCM</td><td>API Key 加密存储</td></tr>
</table>

<h3>AI 模型支持</h3>
<table>
  <tr><th>提供商</th><th>类型</th><th>适用任务</th></tr>
  <tr><td>DeepSeek (v4-pro)</td><td>云端</td><td>数据增强 / 报告生成</td></tr>
  <tr><td>OpenAI (GPT-4o)</td><td>云端</td><td>NL 查询 / 反爬检测</td></tr>
  <tr><td>智谱 (GLM)</td><td>云端</td><td>通用</td></tr>
  <tr><td>Anthropic (Claude)</td><td>云端</td><td>通用</td></tr>
  <tr><td>Ollama (Qwen/Llama)</td><td>本地</td><td>批量增强（数据不出本地）</td></tr>
</table>`
  },

  // ========== 系统架构 ==========
  architecture: {
    title: '系统架构',
    content: `<pre><code>┌─────────────────────────────────────────────────────────┐
│                    Frontend (Vue 3 :3000)                 │
│  ┌──────────┐ ┌────────────┐ ┌────────┐ ┌───────────┐  │
│  │ 数据采集  │ │ 智能查询(NL)│ │ 智能分析│ │ AI 配置    │  │
│  └──────────┘ └────────────┘ └────────┘ └───────────┘  │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP REST + WebSocket
┌──────────────────────▼──────────────────────────────────┐
│                   Backend (Express :3004)                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │ Task API │ │ File API │ │Analysis  │ │ LLM API  │  │
│  │ (11 ep)  │ │ (8 ep)   │ │ API (5)  │ │ (17 ep)  │  │
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
│  tasks │ csv_files │ job_enrichments │ market_reports    │
│  llm_config │ saved_queries                              │
└──────────────────────────────────────────────────────────┘
                       │ Browser Automation
┌──────────────────────▼──────────────────────────────────┐
│              Puppeteer (Headless Chrome)                  │
│  智联招聘 (zhilian.ts) │ 前程无忧 (job51.ts)              │
└──────────────────────────────────────────────────────────┘</code></pre>

<h3>关键设计</h3>
<ul>
  <li><strong>LLM 任务路由</strong>：不同任务类型自动选择对应模型（enrichment/insights/query/anti-crawl）</li>
  <li><strong>加密存储</strong>：API Key 使用 AES-256-GCM 加密，格式检测自动兼容明文/密文</li>
  <li><strong>WebSocket 房间</strong>：每个任务独立 Socket.IO room (<code>task:&lt;id&gt;</code>)</li>
  <li><strong>幂等增强</strong>：ON CONFLICT UPSERT 支持安全重跑</li>
</ul>`
  },

  // ========== 快速开始 ==========
  quickstart: {
    title: '快速开始',
    content: `<h3>环境要求</h3>
<ul>
  <li><strong>Node.js</strong> >= 18.0</li>
  <li><strong>PostgreSQL</strong> >= 14（本系统连接 10.1.1.113:7300）</li>
  <li><strong>Chrome/Chromium</strong>（Puppeteer 自动下载）</li>
  <li><strong>npm</strong> >= 9</li>
</ul>

<h3>安装与启动</h3>
<pre><code># 1. 克隆项目
git clone &lt;repo-url&gt; aitraining
cd aitraining

# 2. 安装前端依赖
cd code/frontend && npm install

# 3. 安装后端依赖
cd ../backend && npm install

# 4. 启动后端（端口 3004）
cd code/backend
npm run dev

# 5. 新终端，启动前端（端口 3000）
cd code/frontend
npm run dev

# 6. 访问 http://localhost:3000</code></pre>

<h4>Windows 用户</h4>
<p>可直接双击根目录 <code>start-dev.bat</code> 一键启动。</p>

<h3>配置 LLM</h3>
<ol>
  <li>访问系统 → 侧边栏「AI 配置」</li>
  <li>点击「添加配置」，选择提供商（DeepSeek / OpenAI 等）</li>
  <li>填入 API Key 和 Base URL</li>
  <li>在「任务路由」中勾选需要使用的任务类型</li>
  <li>点击「测试连接」验证</li>
</ol>`
  },

  // ========== API 概览 ==========
  'api-tasks': {
    title: '任务管理 API（11 个端点）',
    content: `<p><strong>Base:</strong> <code>/api/tasks</code></p>
<table>
  <tr><th>方法</th><th>路径</th><th>说明</th></tr>
  <tr><td>POST</td><td><code>/</code></td><td>创建任务</td></tr>
  <tr><td>GET</td><td><code>/</code></td><td>任务列表（分页/状态筛选）</td></tr>
  <tr><td>GET</td><td><code>/:id</code></td><td>任务详情</td></tr>
  <tr><td>GET</td><td><code>/:id/logs</code></td><td>任务日志（文件系统读取）</td></tr>
  <tr><td>POST</td><td><code>/:id/start</code></td><td>启动任务</td></tr>
  <tr><td>POST</td><td><code>/:id/stop</code></td><td>停止任务</td></tr>
  <tr><td>POST</td><td><code>/:id/pause</code></td><td>暂停任务</td></tr>
  <tr><td>POST</td><td><code>/:id/resume</code></td><td>恢复任务</td></tr>
  <tr><td>DELETE</td><td><code>/:id</code></td><td>删除任务及关联文件</td></tr>
  <tr><td>PUT</td><td><code>/:id/config</code></td><td>更新任务配置</td></tr>
  <tr><td>GET</td><td><code>/regions/list</code></td><td>省市列表</td></tr>
</table>`
  },
  'api-files': {
    title: '文件管理 API（8 个端点）',
    content: `<p><strong>Base:</strong> <code>/api/files</code></p>
<table>
  <tr><th>方法</th><th>路径</th><th>说明</th></tr>
  <tr><td>GET</td><td><code>/</code></td><td>文件列表（分页/来源/关键词筛选）</td></tr>
  <tr><td>GET</td><td><code>/:id</code></td><td>文件详情</td></tr>
  <tr><td>GET</td><td><code>/:id/analyze</code></td><td>深度分析（Excel 解析 + 统计）</td></tr>
  <tr><td>GET</td><td><code>/:id/preview</code></td><td>预览前 100 条数据</td></tr>
  <tr><td>GET</td><td><code>/:id/download</code></td><td>下载文件</td></tr>
  <tr><td>GET</td><td><code>/task/:taskId</code></td><td>按任务查询文件</td></tr>
  <tr><td>DELETE</td><td><code>/:id</code></td><td>删除文件</td></tr>
  <tr><td>POST</td><td><code>/batch-delete</code></td><td>批量删除</td></tr>
</table>`
  },
  'api-analysis': {
    title: '数据分析 API（5 个端点）',
    content: `<p><strong>Base:</strong> <code>/api/analysis</code></p>
<table>
  <tr><th>方法</th><th>路径</th><th>说明</th></tr>
  <tr><td>POST</td><td><code>/analyze</code></td><td>分析 CSV/Excel 文件</td></tr>
  <tr><td>GET</td><td><code>/salary/:fileId</code></td><td>薪资区间分布</td></tr>
  <tr><td>GET</td><td><code>/city/:fileId</code></td><td>城市分布 Top 10</td></tr>
  <tr><td>GET</td><td><code>/education/:fileId</code></td><td>学历要求分布</td></tr>
  <tr><td>GET</td><td><code>/experience/:fileId</code></td><td>经验要求分布</td></tr>
</table>`
  },
  'api-llm': {
    title: 'AI 服务 API（17 个端点）',
    content: `<p><strong>Base:</strong> <code>/api/llm</code></p>

<h4>LLM 配置管理</h4>
<table>
  <tr><td>GET</td><td><code>/config</code></td><td>配置列表（Key 脱敏）</td></tr>
  <tr><td>POST</td><td><code>/config</code></td><td>保存配置（自动加密 Key）</td></tr>
  <tr><td>DELETE</td><td><code>/config/:id</code></td><td>删除配置</td></tr>
  <tr><td>GET</td><td><code>/health</code></td><td>健康检查（models + latency）</td></tr>
  <tr><td>POST</td><td><code>/test</code></td><td>测试 LLM 调用</td></tr>
</table>

<h4>数据增强</h4>
<table>
  <tr><td>POST</td><td><code>/enrich/:taskId</code></td><td>启动增强（异步）</td></tr>
  <tr><td>GET</td><td><code>/enrich/:taskId/status</code></td><td>增强进度</td></tr>
  <tr><td>GET</td><td><code>/enrich/:taskId/result</code></td><td>增强结果列表</td></tr>
</table>

<h4>市场洞察</h4>
<table>
  <tr><td>POST</td><td><code>/insights/:fileId</code></td><td>生成报告</td></tr>
  <tr><td>GET</td><td><code>/insights/:fileId/history</code></td><td>报告历史</td></tr>
  <tr><td>GET</td><td><code>/insights/report/:reportId</code></td><td>报告详情</td></tr>
</table>

<h4>自然语言查询</h4>
<table>
  <tr><td>POST</td><td><code>/query</code></td><td>执行查询</td></tr>
  <tr><td>GET</td><td><code>/query/history</code></td><td>查询历史</td></tr>
  <tr><td>DELETE</td><td><code>/query/:id</code></td><td>删除记录</td></tr>
</table>

<h4>AI 反爬</h4>
<table>
  <tr><td>POST</td><td><code>/anti-crawl/classify</code></td><td>页面分类</td></tr>
  <tr><td>POST</td><td><code>/anti-crawl/selectors</code></td><td>选择器推荐</td></tr>
  <tr><td>POST</td><td><code>/anti-crawl/action</code></td><td>应对策略</td></tr>
</table>`
  },
  'api-auth': {
    title: '认证 API（6 个端点）',
    content: `<p><strong>Base:</strong> <code>/api/auth</code></p>
<table>
  <tr><th>方法</th><th>路径</th><th>说明</th></tr>
  <tr><td>GET</td><td><code>/authorize-url</code></td><td>获取 OAuth2 授权 URL</td></tr>
  <tr><td>GET</td><td><code>/callback</code></td><td>OAuth2 回调（交换 Token + 设置 Cookie）</td></tr>
  <tr><td>POST</td><td><code>/refresh-token</code></td><td>刷新 Access Token</td></tr>
  <tr><td>GET</td><td><code>/user-info</code></td><td>当前用户信息</td></tr>
  <tr><td>POST</td><td><code>/validate-token</code></td><td>验证 Token 有效性</td></tr>
  <tr><td>POST</td><td><code>/logout</code></td><td>登出（获取 logoutTicket + 清除 Cookie）</td></tr>
</table>`
  },

  // ========== 数据库 ==========
  database: {
    title: '数据库表结构',
    content: `<p>Schema: <code>liangwenqing</code>，共 <strong>6 张表</strong>。

<h3>tasks — 爬虫任务</h3>
<table>
  <tr><th>字段</th><th>类型</th><th>说明</th></tr>
  <tr><td>id</td><td>VARCHAR(255) PK</td><td>UUID</td></tr>
  <tr><td>name</td><td>VARCHAR(500)</td><td>任务名称</td></tr>
  <tr><td>source</td><td>VARCHAR(50)</td><td>zhilian / 51job / all</td></tr>
  <tr><td>config</td><td>JSONB</td><td>关键词/城市/企业/页数</td></tr>
  <tr><td>status</td><td>VARCHAR(20)</td><td>pending→running→completed/failed</td></tr>
  <tr><td>record_count</td><td>INTEGER</td><td>采集记录数</td></tr>
</table>

<h3>csv_files — 导出文件</h3>
<table>
  <tr><td>id</td><td>VARCHAR(255) PK</td><td>UUID</td></tr>
  <tr><td>task_id</td><td>VARCHAR(255) FK</td><td>关联任务</td></tr>
  <tr><td>filepath</td><td>TEXT</td><td>文件路径</td></tr>
  <tr><td>record_count</td><td>INTEGER</td><td>记录数</td></tr>
</table>

<h3>job_enrichments — AI 增强结果</h3>
<table>
  <tr><td>task_id + job_id</td><td>UNIQUE</td><td>任务+职位唯一约束</td></tr>
  <tr><td>salary_monthly_min/max</td><td>INTEGER</td><td>标准化月薪（元）</td></tr>
  <tr><td>job_category_l1/l2</td><td>VARCHAR</td><td>一/二级分类</td></tr>
  <tr><td>company_industry</td><td>VARCHAR(100)</td><td>公司行业</td></tr>
  <tr><td>key_skills</td><td>JSONB</td><td>技能列表</td></tr>
  <tr><td>education_normalized</td><td>VARCHAR(20)</td><td>学历标准化</td></tr>
  <tr><td>experience_years_min/max</td><td>INTEGER</td><td>经验年限</td></tr>
  <tr><td>benefits</td><td>JSONB</td><td>福利列表</td></tr>
  <tr><td>work_mode</td><td>VARCHAR(20)</td><td>远程/现场/混合</td></tr>
  <tr><td>model_used</td><td>VARCHAR(100)</td><td>增强所用模型</td></tr>
</table>

<h3>market_reports — AI 洞察报告</h3>
<table>
  <tr><td>file_id</td><td>VARCHAR(255) FK</td><td>关联文件</td></tr>
  <tr><td>title</td><td>VARCHAR(500)</td><td>报告标题</td></tr>
  <tr><td>content</td><td>TEXT</td><td>Markdown 正文</td></tr>
  <tr><td>summary</td><td>TEXT</td><td>摘要</td></tr>
  <tr><td>charts_config</td><td>JSONB</td><td>ECharts 图表配置</td></tr>
</table>

<h3>llm_config — AI 模型配置</h3>
<table>
  <tr><td>provider</td><td>VARCHAR(50)</td><td>openai/deepseek/zhipu/ollama</td></tr>
  <tr><td>model_name</td><td>VARCHAR(100)</td><td>模型名称</td></tr>
  <tr><td>api_key_encrypted</td><td>TEXT</td><td>AES-256-GCM 加密</td></tr>
  <tr><td>task_routing</td><td>JSONB</td><td>任务类型路由</td></tr>
</table>

<h3>saved_queries — NL 查询历史</h3>
<table>
  <tr><td>user_query</td><td>TEXT</td><td>用户自然语言</td></tr>
  <tr><td>generated_sql</td><td>TEXT</td><td>AI 生成的 SQL</td></tr>
  <tr><td>result_summary</td><td>TEXT</td><td>LLM 总结</td></tr>
  <tr><td>result_data</td><td>JSONB</td><td>查询结果</td></tr>
</table>`
  },

  // ========== 使用指南 ==========
  'guide-crawl': {
    title: '采集数据',
    content: `<ol>
  <li>进入「数据采集」→「创建任务」</li>
  <li>输入关键词（如 <code>Java开发</code>）→ <strong>点击添加按钮</strong></li>
  <li>选择目标城市（可多选）</li>
  <li>可选：指定目标企业列表过滤</li>
  <li>设置最大页数 → 点击「创建」</li>
</ol>
<blockquote>批量创建支持多关键词 × 多城市自动生成笛卡尔积组合任务。</blockquote>`
  },
  'guide-enrich': {
    title: 'AI 增强数据',
    content: `<ol>
  <li>等待任务状态变为「已完成」</li>
  <li>在任务列表找到目标任务</li>
  <li>点击行右侧的 <strong>「AI 增强」</strong> 按钮</li>
  <li>确认后，系统逐条调用 LLM 处理每条职位数据</li>
  <li>WebSocket 实时推送进度（后端日志 + 前端通知）</li>
  <li>增强完成后进入「智能分析」查看标准化数据</li>
</ol>
<blockquote>增强基于 ON CONFLICT UPSERT，重复点击不会产生重复数据，可安全重跑。</blockquote>`
  },
  'guide-insights': {
    title: 'AI 深度分析',
    content: `<ol>
  <li>从文件管理点击「分析」进入智能分析页面</li>
  <li>此时已展示基础图表（薪资分布/城市分布/学历分布等 7 种）</li>
  <li>点击 <strong>「🤖 AI 深度分析」</strong> 按钮</li>
  <li>系统自动检查增强数据是否存在 → 聚合多维度统计 → 调用 LLM 生成报告</li>
  <li>约 20-40 秒后自动展示：摘要 + 各维度分析 + AI 生成的可视化图表</li>
  <li>支持历史报告切换查看</li>
</ol>`
  },
  'guide-query': {
    title: '自然语言查询',
    content: `<ol>
  <li>进入「智能查询」页面</li>
  <li>可选：顶部下拉框选择目标任务限定查询范围</li>
  <li>输入自然语言问题，例如：
    <ul>
      <li>"薪资最高的 10 个岗位"</li>
      <li>"互联网行业本科学历岗位数量"</li>
      <li>"各城市 Java 岗位平均薪资对比"</li>
    </ul>
  </li>
  <li>系统自动：生成 SQL → 安全校验 → 执行查询 → LLM 总结结果</li>
  <li>结果展示：自然语言总结 + 数据表格 + 生成的 SQL</li>
</ol>`
  },
  'guide-config': {
    title: 'AI 配置管理',
    content: `<ol>
  <li>进入「AI 配置」页面</li>
  <li>点击「添加配置」</li>
  <li>选择提供商：DeepSeek / OpenAI / 智谱 / Anthropic / Ollama</li>
  <li>填入：
    <ul>
      <li><strong>模型名称</strong>：如 deepseek-v4-pro / gpt-4o / qwen3:14b</li>
      <li><strong>API Key</strong>：自动 AES-256-GCM 加密存储</li>
      <li><strong>Base URL</strong>：API 端点地址</li>
    </ul>
  </li>
  <li>在「任务路由」中勾选该模型用于哪些任务类型</li>
  <li>点击「测试连接」验证连通性和延迟</li>
</ol>`
  },

  // ========== WebSocket ==========
  websocket: {
    title: 'WebSocket 事件',
    content: `<h3>客户端 → 服务端</h3>
<pre><code>socket.emit('task:subscribe', { taskId: 'xxx' })
socket.emit('task:unsubscribe', { taskId: 'xxx' })</code></pre>

<h3>服务端 → 客户端</h3>
<table>
  <tr><th>事件</th><th>载荷</th><th>说明</th></tr>
  <tr><td><code>task:progress</code></td><td>{taskId, progress, current, total}</td><td>任务进度</td></tr>
  <tr><td><code>task:status</code></td><td>{taskId, status}</td><td>状态变更</td></tr>
  <tr><td><code>task:log</code></td><td>{taskId, level, message}</td><td>实时分级日志</td></tr>
  <tr><td><code>task:completed</code></td><td>{taskId, totalRecords}</td><td>任务完成</td></tr>
  <tr><td><code>task:error</code></td><td>{taskId, error}</td><td>任务异常</td></tr>
  <tr><td><code>enrichment:progress</code></td><td>{taskId, status, completed, total, message}</td><td>AI 增强进度</td></tr>
  <tr><td><code>insights:progress</code></td><td>{fileId, message}</td><td>报告生成进度</td></tr>
  <tr><td><code>insights:completed</code></td><td>{fileId, reportId, title, summary}</td><td>报告生成完成</td></tr>
</table>`
  },

  // ========== 常见问题 ==========
  faq: {
    title: '常见问题',
    content: `<h4>Q: AI 增强只成功部分记录？</h4>
<p>检查后端日志，通常是 LLM 返回非标准 JSON 导致解析失败。系统已内置 3 层降级解析 + 3 次重试机制，重新点击 AI 增强即可补全。</p>

<h4>Q: 自然语言查询返回无关数据？</h4>
<p>确保 LLM 配置中任务路由包含 <code>query</code> 类型，且 Prompt 中已包含 <code>job_enrichments</code> 表结构。</p>

<h4>Q: 爬虫被反爬拦截？</h4>
<p>系统内置 WAF 检测 + 自动降级串行 + AI 页面分类。查看任务监控日志可看到拦截详情和应对策略。</p>

<h4>Q: DeepSeek 推理模型返回空内容？</h4>
<p>推理模型（如 deepseek-v4-pro）的 thinking tokens 会占用 <code>max_tokens</code>。数据增强已设置 <code>maxTokens: 8192</code> 并移除 <code>response_format</code> 约束。</p>

<h4>Q: Puppeteer 内存占用高？</h4>
<p>限制并发任务数 ≤ 3，或使用 <code>node --max-old-space-size=4096</code> 增加内存。系统已配置孤儿标签页清理和资源拦截优化。</p>

<h4>Q: 如何添加新的 LLM 提供商？</h4>
<ol>
  <li>在 <code>types/index.ts</code> 的 <code>LLMProvider</code> 类型中添加新值</li>
  <li>如需特殊 API 格式，在 <code>providers/</code> 下新建类</li>
  <li>在 <code>llmService.initialize()</code> 中注册</li>
</ol>

<h4>Q: 数据库表如何迁移？</h4>
<p>所有表在 <code>config/database.ts</code> 中通过 <code>CREATE TABLE IF NOT EXISTS</code> 自动迁移，后端启动时自动执行。</p>`
  },
}

// ==================== 响应式状态 ====================
const activeSection = ref('intro')

const currentTitle = computed(() =>
  docs[activeSection.value]?.title || '项目文档'
)

const currentContent = computed(() =>
  docs[activeSection.value]?.content || '<p>请从左侧菜单选择文档章节</p>'
)

function handleSelect(index: string) {
  if (docs[index]) {
    activeSection.value = index
  }
}
</script>

<style scoped>
.docs-layout {
  display: flex;
  height: calc(100vh - 64px);
}

/* 左侧菜单 */
.docs-sidebar {
  width: 240px;
  min-width: 240px;
  border-right: 1px solid #e4e7ed;
  background: #fafafa;
  overflow-y: auto;
}
.sidebar-header {
  padding: 16px;
  border-bottom: 1px solid #e4e7ed;
}
.sidebar-header h3 {
  margin: 0;
  font-size: 16px;
  color: #303133;
}
.docs-menu {
  border-right: none;
  background: transparent;
}

/* 右侧内容 */
.docs-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px 32px;
}
.content-header {
  margin-bottom: 24px;
  padding-bottom: 12px;
  border-bottom: 2px solid #e4e7ed;
}
.content-header h2 {
  margin: 0;
  font-size: 22px;
  color: #303133;
}

/* Markdown 样式 */
.markdown-body {
  line-height: 1.8;
  color: #303133;
  font-size: 15px;
  max-width: 900px;
}
.markdown-body :deep(h3) {
  font-size: 19px;
  margin: 28px 0 12px;
  padding-bottom: 6px;
  border-bottom: 1px solid #ebeef5;
}
.markdown-body :deep(h4) {
  font-size: 17px;
  margin: 20px 0 10px;
}
.markdown-body :deep(p) { margin: 10px 0; }
.markdown-body :deep(ul), .markdown-body :deep(ol) { padding-left: 22px; margin: 10px 0; }
.markdown-body :deep(li) { margin: 4px 0; }
.markdown-body :deep(code) {
  background: #f5f7fa;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 13px;
  color: #e6a23c;
}
.markdown-body :deep(pre) {
  background: #282c34;
  padding: 14px;
  border-radius: 6px;
  overflow-x: auto;
  font-size: 13px;
  line-height: 1.5;
}
.markdown-body :deep(pre code) {
  background: transparent;
  padding: 0;
  color: #abb2bf;
}
.markdown-body :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 14px 0;
}
.markdown-body :deep(th), .markdown-body :deep(td) {
  border: 1px solid #dcdfe6;
  padding: 8px 12px;
  text-align: left;
  font-size: 13px;
}
.markdown-body :deep(th) {
  background: #f5f7fa;
  font-weight: 600;
}
.markdown-body :deep(tr:nth-child(even)) { background: #fafafa; }
.markdown-body :deep(blockquote) {
  border-left: 3px solid #409eff;
  padding: 10px 14px;
  margin: 14px 0;
  background: #f4f4f5;
  border-radius: 4px;
  color: #606266;
}
.markdown-body :deep(strong) { color: #303133; }

@media (max-width: 768px) {
  .docs-sidebar { width: 200px; min-width: 200px; }
  .docs-content { padding: 16px; }
}
</style>
