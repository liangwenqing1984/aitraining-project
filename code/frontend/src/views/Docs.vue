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
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
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
      { id: 'feat-rag', label: '语义搜索 (RAG)' },
      { id: 'feat-insights', label: 'AI 市场洞察' },
      { id: 'feat-query', label: '自然语言查询' },
      { id: 'feat-anticrawl', label: 'AI 反爬对抗' },
      { id: 'feat-llm-routing', label: 'LLM 任务路由' },
      { id: 'feat-embedding', label: '文本向量化' },
      { id: 'feat-proxy', label: 'IP 代理池' },
      { id: 'feat-resume', label: '简历筛选匹配' },
      { id: 'feat-prompts', label: '提示词工程' },
      { id: 'feat-aibot', label: 'AI 问答机器人' },
      { id: 'feat-doc-upload', label: '文档向量索引' },
      { id: 'feat-training', label: '语义模型训练' },
      { id: 'feat-dashboard', label: '数据看板与大屏' },
    ]
  },
  { id: 'tech-stack', label: '技术栈', icon: Setting },
  { id: 'architecture', label: '系统架构', icon: Connection },
  { id: 'quickstart', label: '快速开始', icon: Promotion },
  {
    id: 'api', label: 'API 概览', icon: List,
    children: [
      { id: 'api-tasks', label: '任务管理 (12)' },
      { id: 'api-files', label: '文件管理 (8)' },
      { id: 'api-analysis', label: '数据分析 (5)' },
      { id: 'api-dashboard', label: '数据看板 (5)' },
      { id: 'api-rag', label: 'RAG 知识库 (7)' },
      { id: 'api-chat', label: '对话文档 (10)' },
      { id: 'api-training', label: '模型训练 (9)' },
      { id: 'api-llm', label: 'AI 服务 (18)' },
      { id: 'api-auth', label: '认证 (7)' },
      { id: 'api-system', label: '系统管理 (23)' },
    ]
  },
  { id: 'database', label: '数据库表结构', icon: Folder },
  {
    id: 'guide', label: '使用指南', icon: Document,
    children: [
      { id: 'guide-crawl', label: '采集数据' },
      { id: 'guide-enrich', label: 'AI 增强数据' },
      { id: 'guide-rag', label: '语义搜索' },
      { id: 'guide-insights', label: 'AI 深度分析' },
      { id: 'guide-query', label: '自然语言查询' },
      { id: 'guide-config', label: 'AI 配置管理' },
      { id: 'guide-resume', label: '简历筛选' },
      { id: 'guide-training', label: '模型训练' },
      { id: 'guide-aibot', label: 'AI 问答' },
    ]
  },
  { id: 'websocket', label: 'WebSocket 事件', icon: Connection },
  { id: 'diagnostics', label: '系统诊断手册', icon: Files },
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
  <tr><td><strong>当前版本</strong></td><td>2.2.0</td></tr>
  <tr><td><strong>分支</strong></td><td>with-model-train</td></tr>
  <tr><td><strong>Node.js</strong></td><td>v24.14.0+</td></tr>
  <tr><td><strong>PostgreSQL</strong></td><td>SeaboxSQL 7300</td></tr>
  <tr><td><strong>Python</strong></td><td>3.8+ (模型训练)</td></tr>
  <tr><td><strong>ECharts</strong></td><td>6.0 + echarts-wordcloud 2.1</td></tr>
</table>`
  },

  // ========== 核心功能 ==========
  'feat-crawl': {
    title: '数据采集',
    content: `<table>
  <tr><th>功能</th><th>说明</th></tr>
  <tr><td>多平台支持</td><td>智联招聘、前程无忧（可扩展）</td></tr>
  <tr><td>批量任务</td><td>多关键词 × 多城市笛卡尔积组合</td></tr>
  <tr><td>断点续传</td><td>浏览器崩溃后从上次中断位置恢复，最大 10 次重启</td></tr>
  <tr><td>智能去重</td><td>基于职位 ID 自动去重</td></tr>
  <tr><td>反爬对抗</td><td>AI 页面分类 + 硬编码签名检测 + 指纹随机化 + IP 代理池 + 自动降级</td></tr>
  <tr><td>实时监控</td><td>WebSocket 推送进度条、分级彩色日志、详情页阶段状态</td></tr>
  <tr><td>Excel 导出</td><td>格式化 .xlsx 输出，带样式表头、冻结行、交替行颜色</td></tr>
</table>

<hr>

<h2>反爬策略总结</h2>

<h3>一、智联招聘 (zhilian.ts)</h3>

<h4>1.1 平台反爬机制</h4>
<table>
  <tr><th>层级</th><th>机制</th><th>表现</th></tr>
  <tr><td>WAF 防火墙</td><td>页面标题变为 <code>"Security Verification"</code></td><td>浏览器标签页标题异常，页面内容为空壳</td></tr>
  <tr><td>反爬空壳</td><td>body 被完全替换为空白</td><td><code>bodyLength === 0</code>，页面被 GeeTest 等反爬壳接管</td></tr>
  <tr><td>登录拦截</td><td>弹出登录框或跳转登录页</td><td>body 出现"登录"关键词、DOM 出现 <code>.need-login</code></td></tr>
  <tr><td>验证码</td><td>机器人验证页面</td><td>body 出现"验证"关键词、DOM 出现 <code>#verifyCode</code>/<code>.robot-check</code></td></tr>
  <tr><td>频率限制</td><td>高频访问触发限制</td><td>返回空数据或错误页面</td></tr>
</table>

<h4>1.2 我方应对策略</h4>

<h5>🖥️ 浏览器层伪装</h5>
<ul>
  <li><strong>随机视口</strong>：1366-1920 × 768-1080，每次 <code>newPage</code> 随机化</li>
  <li><strong>UA 轮换池</strong>：4 种 User-Agent（Chrome 129/130/131 + Firefox 132）</li>
  <li><strong>独立会话</strong>：每次启动浏览器使用 <code>zhilian_${Date.now()}</code> 独立 userDataDir，不留 cookie 痕迹</li>
  <li><strong>21 项 Chrome 启动参数</strong>：包括 <code>--disable-web-security</code>、<code>--disable-features=IsolateOrigins</code>、<code>--disable-sync</code> 等</li>
  <li><strong>资源拦截保留 CSS</strong>：只拦截 image/font/media，保留 CSS 加载避免 WAF 指纹识别</li>
</ul>

<h5>🕐 类人行为模拟</h5>
<ul>
  <li><strong>分级延迟</strong>：正常 2-4s；WAF 检测后升为 4-8s；WAF 降级模式 5-10s</li>
  <li><strong>批次间隔</strong>：批次间 8-10s 等待（浏览器 GC/内存恢复）</li>
  <li><strong>懒加载滚动</strong>：8 次渐进式滚动（每次 800ms），模拟人工浏览</li>
  <li><strong>搜索 URL 编码</strong>：使用查询参数 <code>?jl=622&kw=XX</code> 而非路径编码，规避路径特征检测</li>
</ul>

<h5>🔄 并发智能降级</h5>
<ul>
  <li><strong>最高并发 5</strong>，使用 <code>Promise.allSettled</code>（单条失败不中断批次）</li>
  <li><strong>互斥锁序列化 newPage</strong>：<code>pageCreateMutex</code> 防止 CDP 竞争崩溃，10s 超时孤儿页捕获</li>
  <li><strong>WAF 检测后自动降级串行</strong>：检测到反爬 → 删除坏代理 → 切串行 + 5-10s 大延迟</li>
  <li><strong>Tab 泄漏管理</strong>：批次前后清理孤儿标签页，>5 个 tab 主动回收</li>
</ul>

<h5>🌐 IP 代理池</h5>
<ul>
  <li><strong>代理健康验证</strong>：获取代理后先访问 <code>zhaopin.com</code> 验证可用性（8s 超时，仅 2xx 视为可用）</li>
  <li><strong>隧道失败自动切换</strong>：<code>ERR_TUNNEL_CONNECTION_FAILED</code> → 删代理 → 取新代理 → 浏览器重启</li>
  <li><strong>上限保护</strong>：单任务最多换代理 N 次（<code>maxProxySwitchesPerTask</code>）</li>
  <li><strong>降级直连</strong>：代理池耗尽时自动回退直连模式</li>
</ul>

<h5>🛠️ 浏览器级恢复</h5>
<ul>
  <li><strong>主动重启</strong>：每 5 个关键词/城市组合主动重启浏览器，刷新指纹</li>
  <li><strong>崩溃恢复</strong>：<code>BROWSER_RESTART_SCHEDULED</code> 携带断点坐标（组合索引 + 页码 + 职位索引）</li>
  <li><strong>指数退避</strong>：计划重启 30s 基数、崩溃 3s 基数 × 尝试次数，上限 120s</li>
  <li><strong>断点续传</strong>：配置存 JSONB，数据库级断点恢复</li>
  <li><strong>Frame detached 恢复</strong>：<code>page.reload()</code> 尝试恢复而非直接重启浏览器</li>
</ul>

<h5>🔑 关键绕过：API 直连逃逸</h5>
<ul>
  <li>智联 WAF 主要保护 <code>www.zhaopin.com</code> 的 HTML 页面</li>
  <li><strong>内部 API <code>fe-api.zhaopin.com/c/i/jobs/position-detail-new</code> 对直连更宽松</strong></li>
  <li>详情页优先 axios 直连 API（含 Referer/Origin 头），失败后才走代理 → 浏览器渲染</li>
</ul>

<hr>

<h3>二、前程无忧 / 51job (job51.ts)</h3>

<h4>2.1 平台反爬机制</h4>
<table>
  <tr><th>层级</th><th>机制</th><th>表现</th></tr>
  <tr><td>Aliyun WAF 滑动验证</td><td>Geetest 滑块 CAPTCHA</td><td>页面标题"滑动验证页面"，内容"访问验证"+"请按住滑块，拖动到最右边"</td></tr>
  <tr><td>Aliyun WAF JS 挑战</td><td>JS 混淆重定向脚本</td><td>HTML &lt; 1KB，含 <code>cf-app-waf.cfc.aliyuncs.com</code> 脚本</td></tr>
  <tr><td>旧版 JS 混淆保护</td><td><code>jobs.51job.com</code> 页面内容加密</td><td>26KB 密文，需浏览器执行 JS 解密后才能读取 DOM（axios 无法解析）</td></tr>
  <tr><td>频率限制</td><td>高频访问触发验证</td><td>返回"访问太频繁"或"请输入验证码"</td></tr>
  <tr><td>搜索参数校验</td><td>特定参数触发 WAF</td><td><code>pageSize</code> 等参数会直接命中 WAF 规则</td></tr>
</table>

<h4>2.2 我方应对策略</h4>

<h5>🖥️ 浏览器层伪装（Stealth 增强）</h5>
<ul>
  <li><strong>puppeteer-extra + StealthPlugin</strong>：专业反检测插件，修补 <code>navigator.webdriver</code>、Chrome runtime、权限等数十个检测向量</li>
  <li><strong><code>--disable-blink-features=AutomationControlled</code></strong>：二次确保 webdriver 标记不泄露</li>
  <li><strong>每页独立指纹</strong>：<code>setupPageFingerprint()</code> 随机视口 + UA 轮换 + 伪造 <code>navigator.plugins</code>（PDF Viewer/Native Client）+ 伪造 <code>window.chrome</code> + 伪造 <code>permissions.query</code></li>
  <li><strong>独立 userDataDir</strong>：每次会话 <code>job51_${Date.now()}</code> 干净环境</li>
  <li><strong>阻止非必要资源</strong>：image/font/media，保留 CSS/script/xhr</li>
</ul>

<h5>🔐 会话初始化（Cookie 建立）</h5>
<ul>
  <li>首次访问前先浏览 <code>www.51job.com</code> 首页：3-7s 停留 + 滚动 200-700px + 1.5-3.5s 等待</li>
  <li>建立合法 cookie 后再访问搜索页，降低 WAF 触发概率</li>
</ul>

<h5>🕵️ WAF 检测体系（双重防线）</h5>
<ol>
  <li><strong>硬编码签名检测（零延迟安全网）</strong>：在 AI 分类之前执行，覆盖 5 类签名：
    <ul>
      <li>HTML &lt; 1000B → 疑似 WAF</li>
      <li>"滑动验证页面" 标题 → Aliyun Geetest CAPTCHA</li>
      <li>"访问验证" + "请按住滑块" → 滑块验证文本</li>
      <li><code>cf-app-waf.cfc.aliyuncs.com</code> / <code>g.alicdn.com/AWSC/nc</code> → Aliyun JS 挑战脚本</li>
      <li>"访问太频繁" / "请输入验证码" → 51job 频率限制</li>
    </ul>
  </li>
  <li><strong>AI 页面分类</strong>：LLM 识别 6 种页面类型（normal/captcha/waf/login/error/empty），提供分类+置信度+应对建议</li>
</ol>

<h5>🔄 WAF 恢复三级策略</h5>
<table>
  <tr><th>策略</th><th>操作</th><th>等待</th><th>说明</th></tr>
  <tr><td>1. 快速重载</td><td><code>page.reload()</code></td><td>10s</td><td>尝试重新加载同一 URL（带 <code>reportType=1</code>）</td></tr>
  <tr><td>2. 长等待过期</td><td>原 URL 重导航</td><td>45-90s 随机</td><td>等待 WAF 封锁窗口自然过期</td></tr>
  <tr><td>3. 最后手段</td><td>去 <code>reportType</code> → 首页搜索回退</td><td>2-3s + 搜索时间</td><td>模拟人工从首页搜索的完整流程</td></tr>
</table>

<h5>📡 XHR 拦截主力提取</h5>
<ul>
  <li><strong>捕获内部 API</strong>：<code>page.on('response')</code> 拦截 <code>we.51job.com/api/job/search-pc</code> JSON 响应</li>
  <li><strong>text() 替代 json()</strong>：避免 CDP "body already consumed" 竞争错误</li>
  <li><strong>多层 API 结构适配</strong>：支持 <code>resultbody.job.items</code> / <code>data.results</code> / <code>items</code> 等多种响应结构</li>
  <li><strong>诊断计数器</strong>：记录 XHR 拦截总数/成功解析数/失败数，输出 API 响应字段名</li>
  <li><strong>DOM 降级 + AI 选择器推荐</strong>：XHR 和 DOM 都失败时，AI 分析 HTML 推荐新 CSS 选择器</li>
</ul>

<h5>🌐 IP 代理池（axios 回退路径）</h5>
<ul>
  <li><strong>仅用于 axios 详情页请求</strong>，不用于浏览器导航（免费代理都会触发 WAF）</li>
  <li><strong>死代理黑名单</strong>：<code>deadProxyCache: Set&lt;string&gt;</code>，404/ECONNRESET/ETIMEDOUT/&lt;1KB 响应的代理自动加入</li>
  <li><strong>连续失败保护</strong>：连续 5 次失败停止返回代理</li>
  <li><strong>注：51job 已跳过 axios 详情路径</strong>（直连返回 JS 混淆密文，代理返回 404），详情全部走浏览器渲染</li>
</ul>

<h5>⚡ 并发控制</h5>
<ul>
  <li><strong>最高并发 5</strong>（详情页抓取），互斥锁序列化 <code>newPage</code> + <code>goto</code></li>
  <li><strong>批次内错峰</strong>：0.8-2s 偏移避免同时冲击服务器</li>
  <li><strong>批次间隔</strong>：2-4s，<code>Promise.allSettled</code> 不因单条失败中断批次</li>
  <li><strong>浏览器健康哨兵</strong>：每次请求前检查 <code>browser.isConnected()</code></li>
</ul>

<h5>🛠️ 恢复机制</h5>
<ul>
  <li><strong>指数退避</strong>：连续 3 页反爬 → <code>30000 × 2^n</code> 退避，上限 5 分钟</li>
  <li><strong>BROWSER_RESTART</strong>：零产出+WAF 检测时触发浏览器重启（<code>shouldRestart</code> 信号）</li>
  <li><strong>详情页 3 次重试</strong>：WAF_DETECTED → 3-5s 延迟 → 重试，最终降级使用搜索 API 数据</li>
  <li><strong>搜索页重试</strong>：最多 2 次重试（共 3 次尝试），1-2s 间隔</li>
</ul>

<h5>⚙️ 关键绕过：reportType=1</h5>
<ul>
  <li>51job 搜索 URL 添加 <code>&reportType=1</code> 参数</li>
  <li>WAF 将其识别为"报表导出请求"（合法业务场景）从而放行</li>
  <li>不加此参数 → 7884 字节 WAF 页面；加上 → 642KB 正常页面</li>
</ul>

<hr>

<h3>三、对比总结</h3>
<table>
  <tr><th>维度</th><th>智联招聘</th><th>前程无忧 (51job)</th></tr>
  <tr><td>WAF 类型</td><td>自研反爬壳（空 body + Security Verification）</td><td>Aliyun WAF（Geetest 滑块 + JS 挑战）</td></tr>
  <tr><td>首要用 AI 分类</td><td>❌ 未使用（规则引擎）</td><td>✅ classifyPage 6 分类 + recommendAction</td></tr>
  <tr><td>硬编码检测</td><td>❌ 无</td><td>✅ hasCaptchaSignatures 5 类签名</td></tr>
  <tr><td>Stealth 方案</td><td>21 项 Chrome flags + UA/视口随机化</td><td>puppeteer-extra-stealth 插件 + 每页独立指纹</td></tr>
  <tr><td>WAF 恢复策略</td><td>代理切换 → 浏览器重启 → 断点续传</td><td>三级策略：重载(10s) → 长等(45-90s) → 首页回退</td></tr>
  <tr><td>详情页路径</td><td>axios API 直连优先 → 代理 → 浏览器渲染</td><td>纯浏览器渲染（axios 路径已移除）</td></tr>
  <tr><td>代理用途</td><td>浏览器级代理（--proxy-server）</td><td>仅 axios 回退（浏览器走直连）</td></tr>
  <tr><td>并发上限</td><td>5（WAF 后自动降串行）</td><td>5（互斥锁序列化 newPage）</td></tr>
  <tr><td>会话初始化</td><td>无需（直连参数编码绕过）</td><td>须先访问首页建 cookie</td></tr>
  <tr><td>关键绕过参数</td><td>查询参数编码 <code>?jl=622</code></td><td><code>reportType=1</code> 业务参数</td></tr>
  <tr><td>浏览器重启</td><td>5 组合主动重启 + 崩溃检测重启</td><td>零产出 + WAF 时触发重启</td></tr>
  <tr><td>断点续传</td><td>✅ 数据库 JSONB 存储断点</td><td>✅ 数据库 JSONB 存储断点</td></tr>
  <tr><td>进度日志粒度</td><td>批次级</td><td>详情页阶段级（加载/AI分类/提取）</td></tr>
</table>

<hr>

<h3>四、技术原理</h3>

<h4>Puppeteer 浏览器自动化</h4>
<ol>
  <li><strong>Browser 实例管理</strong>：每个爬虫维护一个 Browser，通过 <code>puppeteer.launch({ headless: "new" })</code> 启动，独立 <code>userDataDir</code> 隔离 cookie/缓存</li>
  <li><strong>Page 生命周期</strong>：搜索→列表→详情页，page 间通过 <code>pageCreateMutex</code> 互斥锁序列化 newPage + goto 防止 CDP 竞争崩溃</li>
  <li><strong>SPA 等待</strong>：<code>waitUntil: "networkidle2"</code> 等网络空闲 2s + 渐进式滚动触发懒加载 + <code>waitForSelector</code> 等目标 DOM</li>
  <li><strong>XHR 拦截</strong>（51job 主力）：<code>page.on("response")</code> 捕获内部 API JSON，<code>.text()</code> + <code>JSON.parse()</code> 避免 CDP 竞争，多层响应结构适配</li>
  <li><strong>API 直连</strong>（智联主力）：axios 直连 <code>fe-api.zhaopin.com</code> 内部 API，绕开 HTML 页面 WAF</li>
</ol>

<h4>AI 反爬体系（51job 专用）</h4>
<ol>
  <li><strong>双重防线</strong>：硬编码签名检测（零延迟）→ AI classifyPage（语义理解），硬编码作为 AI 异常时的安全网</li>
  <li><strong>LLM 分类</strong>：截取 HTML 前 3000 字符 → LLM 返回 <code>{ pageType, confidence }</code> → confidence ≥ 0.5 且非 normal 时触发应对</li>
  <li><strong>选择器推荐</strong>：DOM + XHR 均无数据时，AI 分析 HTML 推荐新 CSS 选择器，按置信度降序尝试</li>
  <li><strong>5 秒冷却</strong>：<code>lastClassifyTime</code> 防高频 LLM 调用</li>
  <li><strong>LLM 故障容错</strong>：异常/空响应/JSON解析失败 → 返回 normal（低置信度），不阻塞流程</li>
</ol>

<h4>并发控制与断点续传</h4>
<ul>
  <li><strong>互斥锁</strong>：覆盖 newPage + goto 全流程，唯一 page 执行浏览器密集操作，10s 超时孤儿页捕获</li>
  <li><strong>资源释放</strong>：搜索页提前 close 释放 request interception，防多 tab 竞争；批次前后清理孤儿标签页</li>
  <li><strong>崩溃恢复</strong>：捕获 <code>Connection closed</code>/<code>Target closed</code>/<code>detached Frame</code>，抛 <code>{ shouldRestart: true }</code> 携带断点坐标，外层指数退避重试</li>
  <li><strong>断点续传</strong>：配置存 JSONB（组合索引 + 页码 + 职位索引），崩溃后精确恢复，jobId 去重保证幂等</li>
  <li><strong>最大 10 次重启</strong>：防止无限重启递归爆炸</li>
</ul>

<h3>智联招聘爬取流程</h3>
<pre><code>┌──────────────────────────────────────────────────────────────────┐
│                        任务初始化                                  │
│  解析配置: 关键词[] × 城市[] → 总组合数 = keywords × cities        │
│  初始化代理池 → getCount() → getProxy() → checkHealth(zhaopin)    │
│  启动浏览器: 21 项 Chrome flags + 独立 userDataDir + 随机视口      │
└────────────────────────┬─────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────────┐
│                   遍历关键词 × 城市组合                             │
│  for keyword in keywords:                                        │
│    for city in cities:                                           │
│      ├─ 断点续传: 跳过已完成组合 / 恢复中断页码                     │
│      ├─ 构建搜索 URL: ?jl=城市代码&kw=关键词&p=页码                 │
│      └─ page.goto(searchUrl, waitUntil: "networkidle2")          │
└────────────────────────┬─────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────────┐
│                      搜索列表页处理                                │
│  ┌─ 等待 DOM: waitForSelector('.joblist-box__item')              │
│  ├─ 渐进式懒加载滚动: 8 次 × 800ms 模拟人工浏览                    │
│  ├─ 提取职位卡片: $$eval → { jobId, jobName, company, salary... } │
│  ├─ 智能去重: Set(jobId) 过滤已抓取记录                           │
│  ├─ 企业筛选: 公司名匹配 companyMatchMap（可选）                    │
│  └─ 提取详情 URL: 拼接 fe-api.zhaopin.com 直连 API 路径            │
└────────────────────────┬─────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────────┐
│                    详情页抓取 (axios 直连)                         │
│  ┌─ 优先: axios GET fe-api.zhaopin.com/c/i/jobs/position-detail  │
│  │   (API 直连对 WAF 更宽松，绕开 HTML 页面反爬)                   │
│  ├─ 携带: Referer + Origin 头伪装来源                             │
│  ├─ 失败 → 代理重试 (带代理的 axios)                               │
│  ├─ 还是失败 → 浏览器渲染 (page.goto + waitForSelector)            │
│  └─ 解析: cheerio 提取完整职位信息                                 │
└────────────────────────┬─────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────────┐
│                    数据保存 & 翻页                                 │
│  ├─ 去重入库: INSERT INTO sp_jobs ON CONFLICT DO NOTHING         │
│  ├─ 企业匹配: 根据 companyMatchSet 标记 targetCompany              │
│  ├─ 判断翻页: hasNextPage? → currentPage++ → 循环                  │
│  │   └─ 连续 N 页无匹配 → 提前终止 (智能判定)                      │
│  └─ 更新进度: WebSocket 推送 task:progress + task:log             │
└────────────────────────┬─────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────────┐
│                     异常恢复 & 继续                                │
│  ├─ WAF 检测: body 为空 / 标题 "Security Verification"             │
│  │   → 删除代理 → 降级串行 + 5-10s 大延迟                          │
│  ├─ 浏览器崩溃: ERR_TUNNEL_CONNECTION_FAILED                      │
│  │   → 删除代理 → 取新代理 → 重启浏览器 (携带断点坐标)              │
│  └─ 主动重启: 每 5 个组合后主动重启浏览器刷新指纹                   │
└──────────────────────────────────────────────────────────────────┘</code></pre>

<h3>前程无忧 (51job) 爬取流程</h3>
<pre><code>┌──────────────────────────────────────────────────────────────────┐
│                        任务初始化                                  │
│  解析配置: 关键词[] × 城市[] → 总组合数                             │
│  初始化代理池 (仅用于 axios 回退路径，浏览器走直连)                  │
│  puppeteer-extra + StealthPlugin: 隐藏自动化特征                   │
│  启动浏览器: 独立 userDataDir + 每页独立指纹 + UA 轮换              │
└────────────────────────┬─────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────────┐
│                    会话初始化 (Cookie 建立)                        │
│  访问 www.51job.com 首页                                          │
│  ├─ 停留 3-7s + 滚动 200-700px + 等待 1.5-3.5s                    │
│  └─ 建立合法 Cookie → 降低后续 WAF 触发概率                        │
└────────────────────────┬─────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────────┐
│                   遍历关键词 × 城市组合                             │
│  for keyword: for city:                                           │
│    ├─ 构建搜索 URL: we.51job.com/api/job/search-pc?               │
│    │   keyword=XX&city=XX&page=1&reportType=1&pageSize=50          │
│    ├─ page.goto(searchUrl, waitUntil: "networkidle2")             │
│    └─ 关键参数: reportType=1 (业务参数绕过 WAF)                    │
└────────────────────────┬─────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────────┐
│                  搜索页处理 (双重数据源)                            │
│                                                                   │
│  ┌─── 数据源 1: XHR 拦截 (主力) ───┐                               │
│  │ page.on("response") 监听网络     │                              │
│  │ ├─ 拦截 search-pc API JSON      │                              │
│  │ ├─ .text() 避免 CDP 竞争         │                              │
│  │ └─ JSON.parse() 提取 job list   │                              │
│  └─────────────────────────────────┘                              │
│                    ↓ (XHR 失败时降级)                              │
│  ┌─── 数据源 2: DOM 解析 (备用) ───┐                               │
│  │ page.$$eval 提取卡片元素         │                              │
│  │ ├─ cheerio 解析职位 HTML         │                              │
│  │ ├─ 硬编码 17 个选择器遍历        │                              │
│  │ └─ AI 选择器推荐 (都失败时)       │                              │
│  └─────────────────────────────────┘                              │
│                    ↓                                               │
│  诊断计数器: XHR 拦截数/成功数/失败数 + API 响应结构              │
└────────────────────────┬─────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────────┐
│                    WAF 检测 (双重防线)                             │
│  ┌─ 第一道: 硬编码签名检测 (零延迟)                                │
│  │   ├─ HTML &lt; 1000B → 疑似 WAF                                 │
│  │   ├─ 标题 "滑动验证页面" → Geetest CAPTCHA                     │
│  │   ├─ cf-app-waf.cfc.aliyuncs.com → Aliyun JS 挑战             │
│  │   └─ "访问太频繁" / "请输入验证码" → 频率限制                   │
│  └─ 第一道未命中 →                                                 │
│  ┌─ 第二道: AI 页面分类 (语义理解)                                  │
│  │   ├─ 截取 HTML 前 3000 字符 → LLM classifyPage                 │
│  │   └─ 返回: { pageType, confidence, indicators, reason }       │
│  └─ WAF 命中 → 三级恢复策略:                                       │
│      1. page.reload() → 等 10s                                    │
│      2. 原 URL 重导航 → 等 45-90s                                  │
│      3. 去 reportType → 首页搜索回退                               │
└────────────────────────┬─────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────────┐
│                    详情页抓取 (浏览器渲染)                          │
│  互斥锁序列化: pageCreateMutex → 防止 CDP 竞争崩溃                 │
│  ├─ newPage() + goto(51job详情URL)                                │
│  ├─ WAF_DETECTED? → 3-5s 延迟 → 重试 (最多 3 次)                  │
│  ├─ 等待关键元素: .job-detail / .jtag / .cn / .bmsg               │
│  ├─ cheerio 解析: 提取 17 个字段                                   │
│  │   ├─ 薪资/经验/学历/标签/福利/工作地点                           │
│  │   └─ 公司信息: 行业/性质/规模                                    │
│  ├─ 保存 HTML 快照: 用于诊断提取问题                                │
│  └─ page.close() 释放资源                                         │
└────────────────────────┬─────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────────┐
│                    数据保存 & 翻页                                 │
│  ├─ 去重入库: INSERT INTO sp_jobs ON CONFLICT DO NOTHING         │
│  ├─ 详情页失败: 使用搜索页列表数据兜底                              │
│  ├─ 翻页判断: 检查下一页按钮 → page++ → 循环                       │
│  ├─ 关闭搜索页: 释放浏览器资源 (防并发崩溃)                        │
│  └─ 进度推送: WebSocket task:progress + task:log                  │
└────────────────────────┬─────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────────┐
│                     异常恢复 & 继续                                │
│  ├─ 浏览器崩溃: 捕获 Connection closed / Target closed            │
│  │   → 指数退避 30s × 2^n → 重启 (最大 10 次)                     │
│  ├─ WAF 封锁: 零产出 + WAF 检测 → 触发 BROWSER_RESTART             │
│  ├─ 详情页重试: 单页最多 3 次 → 失败使用列表数据                   │
│  ├─ 并发控制: 详情页最高 5 并发 (Promise.allSettled)               │
│  └─ 批次间隔: 2-4s + 0.8-2s 错峰避免同时冲击服务器                │
└──────────────────────────────────────────────────────────────────┘</code></pre>

<hr>

<h2>场景问题</h2>

<h3>Q：reportType=1 绕过列表页分页限制是什么原理？</h3>

<p>正常浏览流程：用户在智联/51job 页面点击翻页，前端 JS 发起 XHR 请求到后端 API，例如 <code>/api/jobs?page=1&pageSize=20</code>。后端按 pageSize=20 返回一页数据，前端渲染成 DOM 列表。用户看到的翻页器最多允许翻到第 100 页（约 2000 条），这就是<strong>前端页面和后端 API 叠加的分页限制</strong>。</p>

<p>绕过原理：通过 Puppeteer 的 <code>page.on('response')</code> 拦截网络请求，在构造搜索 URL 时将 <code>reportType</code> 参数设为 <code>1</code>：</p>

<table>
  <tr><th>参数值</th><th>含义</th><th>行为</th></tr>
  <tr><td><code>reportType=0</code>（默认）</td><td>正常浏览模式</td><td>分页限制生效，pageSize 上限通常为 20-30，最多翻到 100 页</td></tr>
  <tr><td><code>reportType=1</code></td><td>报表/导出模式</td><td>分页限制放开，pageSize 可设为几百甚至上千，<strong>一次请求批量拉取</strong></td></tr>
</table>

<p>核心原因：后端 API 对 <code>reportType</code> 参数<strong>校验不严</strong>——页面 UI 上没有暴露这个值给用户选择（仅平台内部的报表导出功能使用），但后端实际支持。攻击者只需构造带 <code>reportType=1</code> 的 URL 即可获得<strong>批量导出级别的数据访问权限</strong>，而 51job 的 WAF 将其识别为"合法报表导出请求"从而放行。</p>

<p>实际效果对比：</p>
<pre><code>不加 reportType=1 → 7884 字节 WAF 拦截页面（被 Aliyun WAF 识别为爬虫）
加上 reportType=1 → 642KB 正常搜索结果（WAF 放行 + pageSize 可设为 50+）</code></pre>

<p>本质上是一种 <strong>参数利用</strong>：不涉及注入、XSS、越权等传统攻击方式，而是利用后端业务逻辑设计缺陷——同一个 API 端点根据 <code>reportType</code> 参数值切换了两种不同的权限模型，但未做授权校验。</p>

<hr>

<h3>Q：硬编码签名识别 + AI 驱动的页面分类双重防线是什么？</h3>

<p>51job 爬虫面对阿里云 WAF 的多变拦截策略，采用<strong>两道防线叠加</strong>的方式判断当前页面是否被反爬拦截，做到"已知快速拦截、未知智能识别"。</p>

<h4>第一道防线：硬编码签名识别（零延迟安全网）</h4>

<p>每次页面加载后<strong>先不调用 AI</strong>，直接用规则引擎检查 HTML 是否命中以下 5 类已知特征：</p>

<table>
  <tr><th>签名特征</th><th>对应含义</th></tr>
  <tr><td>HTML 总大小 &lt; 1000 字节</td><td>页面被 WAF 替换为空壳</td></tr>
  <tr><td>标题 = "滑动验证页面"</td><td>触发阿里云 Geetest 滑块 CAPTCHA</td></tr>
  <tr><td>正文含 "访问验证" + "请按住滑块"</td><td>滑块验证文本确认</td></tr>
  <tr><td>含 <code>cf-app-waf.cfc.aliyuncs.com</code> 等脚本域名</td><td>阿里云 JS 挑战脚本</td></tr>
  <tr><td>正文含 "访问太频繁" / "请输入验证码"</td><td>51job 自身频率限制</td></tr>
</table>

<p>这一步<strong>零延迟、零成本</strong>，瞬间拦截所有已知 WAF 模式。同时也是 AI 的<strong>安全网</strong>——AI 网络异常或返回垃圾时，硬编码规则仍然生效，不会阻塞爬取流程。</p>

<h4>第二道防线：AI 驱动页面分类（语义理解）</h4>

<p>如果硬编码签名没命中（说明不是已知 WAF 类型），系统将 HTML 前 3000 字符发给 LLM 做语义分析：</p>

<pre><code>输入: HTML 前 3000 字符
输出: { pageType: "normal" | "captcha" | "waf" | "login" | "error" | "empty", confidence: 0~1 }</code></pre>

<p>当 <code>confidence ≥ 0.5</code> 且类型不是 <code>normal</code> 时，触发应对策略。AI 能识别<strong>未知的、变种的</strong>反爬页面，补足硬编码只能识已知模式的短板。同时有 <strong>5 秒冷却机制</strong>防止高频 LLM 调用。</p>

<h4>两道防线如何配合</h4>

<pre><code>页面加载完成
    ↓
[第一道] 硬编码签名检测 → 命中？ → 触发恢复策略（重载/长等/回退）
    ↓ 未命中
[第二道] AI 页面分类 → confidence ≥ 0.5 且非 normal？ → 触发恢复策略
    ↓ 也未命中
正常提取数据</code></pre>

<ul>
  <li><strong>硬编码兜底</strong>：AI 故障时硬编码规则仍然生效</li>
  <li><strong>AI 扩展</strong>：硬编码只能识别已见过的 5 类，AI 能识别全新反爬形式</li>
  <li><strong>精准识别后规避</strong>：先判断当前页面是否被拦截、被哪种方式拦截，再选择对应策略（重载 10s / 长等 45-90s / 去参数首页回退）</li>
</ul>

<h4>常见问题</h4>

<h5>Q: "硬编码签名识别"和"AI 驱动页面分类"分别指什么？</h5>
<p><strong>硬编码签名识别</strong>：在爬虫代码中预先写死的关键词/特征匹配规则，用来快速检测反爬页面。例如检测页面中是否出现 <code>安全验证</code>、<code>captcha</code>、<code>滑块</code> 等关键词，或页面 body 是否为空（智联 WAF 拦截的典型特征）。这是毫秒级、零成本的快速初筛。</p>
<p><strong>AI 驱动页面分类</strong>：当硬编码签名命中后，调用 LLM（ANTI_CRAWL Prompt）对页面 HTML 内容进行语义分析，返回页面类型（<code>normal</code> / <code>captcha</code> / <code>waf</code> / <code>login</code> / <code>error</code> / <code>empty</code>）和置信度。这是秒级、消耗 token 的精准确认。</p>
<p>两者构成<strong>双重检测机制</strong>：硬编码做粗筛 → 命中后 AI 做精筛，兼顾抓取效率和检测准确率。硬编码还是 AI 的安全网——当 AI 网络异常或返回垃圾结果时，硬编码规则仍然生效，不会阻塞爬取流程。</p>
<table>
  <tr><th>层级</th><th>方式</th><th>特点</th></tr>
  <tr><td>第一道：硬编码签名识别</td><td>代码中预置的关键词/特征匹配</td><td>毫秒级，零成本，但可能误判</td></tr>
  <tr><td>第二道：AI 驱动页面分类</td><td>调用 LLM 分析页面 HTML 语义</td><td>秒级，消耗 token，更精准，能识别未知反爬形式</td></tr>
</table>

<h5>Q: CAPTCHA 是什么？</h5>
<p>CAPTCHA 全称 <em>Completely Automated Public Turing test to tell Computers and Humans Apart</em>，是一种区分人类和机器的<strong>自动图灵测试</strong>。最常见的形式包括"选出图中所有红绿灯"、输入图片中的扭曲字符、"按住滑块拖动到最右边"等。</p>
<p>在本项目的爬虫场景中，CAPTCHA 是目标网站（51job、智联招聘）最常用的反爬手段之一：</p>
<table>
  <tr><th>形式</th><th>本项目中对应的检测</th></tr>
  <tr><td>滑块验证（Geetest）</td><td>页面出现"滑块"、"请按住滑块，拖动到最右边"关键词</td></tr>
  <tr><td>图文验证码</td><td>页面出现"验证码"、"captcha"关键词</td></tr>
  <tr><td>JS 挑战（静默验证）</td><td>HTML 极小（&lt; 1KB），含阿里云 WAF 脚本</td></tr>
</table>
<p>系统通过<strong>硬编码签名检测</strong>这些关键词 + <strong>AI 语义分析</strong>双重确认，一旦判定触发 CAPTCHA 就会自动切换 IP 代理、降低请求频率或重启浏览器来绕过。</p>

<h5>Q: JS 挑战（静默验证）是什么？</h5>
<p>JS 挑战全称 <strong>JavaScript Challenge</strong>，是一种<strong>对用户不可见</strong>的验证方式。与滑块、图形验证码不同，它不需要用户手动操作——浏览器在后台静默执行一段被混淆的 JavaScript 代码，计算出验证 token 提交给服务器，通过后才加载真实页面。</p>
<p>在本项目中（51job 阿里云 WAF），表现如下：</p>
<table>
  <tr><th>特征</th><th>表现</th></tr>
  <tr><td>页面大小</td><td>HTML &lt; 1KB（几乎空白）</td></tr>
  <tr><td>内容</td><td>包含指向 <code>cf-app-waf.cfc.aliyuncs.com</code> 的混淆脚本</td></tr>
  <tr><td>行为</td><td>脚本在浏览器中执行 → 生成 token → 重定向到真实页面</td></tr>
</table>
<p>普通用户用浏览器正常访问时，浏览器自动执行 JS 完成验证，用户完全无感知。但对爬虫来说，如果 Puppeteer 没有正确执行这段 JS（例如被资源拦截策略跳过），就会被 WAF 拦截，获取不到真实数据。</p>`
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
</ul>

<h3>技术原理</h3>

<h4>LLM 批量增强流程</h4>
<ol>
  <li><strong>数据读取</strong>：从 Excel (<code>csv_files</code>) 读取原始职位记录，提取 <code>jobName</code>、<code>jobDescription</code>、<code>salaryRange</code> 等核心字段</li>
  <li><strong>Prompt 构建</strong>：拼接系统提示词 + 字段说明 + 标准化规则（薪资转月薪/学历归一化/行业 14 分类），组装单条职位 JSON</li>
  <li><strong>LLM 调用</strong>：<code>BATCH_SIZE=1</code> 逐条发送，500ms 间隔避免 API 限流；三次重试 + 递增 <code>temperature</code>（0.1→0.3→0.5）提高成功率</li>
  <li><strong>JSON 解析</strong>：3 层降级——直接 <code>JSON.parse</code> → 正则边界提取 <code>{...}</code> → 单引号/无引号 key 修复后解析</li>
  <li><strong>UPSERT 入库</strong>：<code>ON CONFLICT (task_id, job_id) DO UPDATE</code>，重复点击不产生重复数据</li>
</ol>

<h4>增强维度与输出 Schema</h4>
<table>
  <tr><th>维度</th><th>输出字段</th><th>标准化逻辑</th></tr>
  <tr><td>薪资</td><td><code>salary_monthly_min/max</code></td><td>"15K-20K·13薪" → 15000-20000；万/年 → ÷12；千/月 → ×1000</td></tr>
  <tr><td>职位分类</td><td><code>job_category_l1/l2</code></td><td>技术→后端开发；市场→品牌营销（14 大一级类 + 细分子类）</td></tr>
  <tr><td>公司行业</td><td><code>company_industry</code></td><td>互联网/金融/制造/医疗/教育等 14 类标准分类</td></tr>
  <tr><td>技能提取</td><td><code>key_skills</code> (JSONB)</td><td>必选项 + 加分项分离，技术栈关联分类</td></tr>
  <tr><td>学历</td><td><code>education_normalized</code></td><td>本科/硕士/博士/大专/高中及以下</td></tr>
  <tr><td>经验</td><td><code>experience_years_min/max</code></td><td>"3-5年" → 3-5；"应届" → 0-1</td></tr>
  <tr><td>福利</td><td><code>benefits</code> (JSONB)</td><td>五险一金/年终奖/双休/带薪年假等关键词识别</td></tr>
  <tr><td>工作模式</td><td><code>work_mode</code></td><td>远程/现场/混合 三分类</td></tr>
</table>

<h4>幂等设计</h4>
<ul>
  <li><strong>UPSERT 语义</strong>：<code>INSERT ... ON CONFLICT (task_id, job_id) DO UPDATE</code>，重跑自动覆盖旧值</li>
  <li><strong>失败重试</strong>：单条 3 次重试 + 递增 temperature，模型输出不稳时自动变换参数</li>
  <li><strong>静默跳过</strong>：已经过增强的记录不会重复调用 LLM（检查已有增强时间戳）</li>
</ul>`
  },
  'feat-rag': {
    title: '语义搜索 (RAG)',
    content: `<p>基于 <strong>pgvector 向量数据库</strong>实现职位知识库的语义相似搜索，支持自然语言描述的职位检索：</p>

<h4>RAG 架构</h4>
<pre><code>Excel 原始数据 (jobName, companyName, workCity)
        ↘
  job_enrichments (LLM 增强: 技能/分类/行业等)
        ↘
  buildJobText() → 拼接文本 → Ollama embedding (nomic-embed-text, 768维)
        ↘
  job_embeddings (pgvector vector(768) + IVFFlat 余弦索引)
        ↘
  semanticSearch() → 余弦相似度排序</code></pre>

<h4>核心特性</h4>
<ul>
  <li><strong>向量维度</strong>: 768 维（nomic-embed-text），IVFFlat 索引（100 个列表）</li>
  <li><strong>混合数据源</strong>: Excel 原始字段（职位名/公司名/城市）+ job_enrichments 增强字段</li>
  <li><strong>查询扩展</strong>: 短查询（≤10 字符）自动触发 30+ 术语映射表扩展，解决"Java"→"Java开发工程师"语义稀疏问题</li>
  <li><strong>幂等索引</strong>: <code>ON CONFLICT (task_id, job_id) DO UPDATE</code>，重复索引自动覆盖旧值</li>
  <li><strong>删除索引</strong>: 前端支持按任务删除向量索引数据，删除后需重新索引才能搜索</li>
  <li><strong>增强检查</strong>: 索引前自动检查任务是否已完成 AI 增强，未增强的任务提示先执行增强</li>
  <li><strong>相似度过滤</strong>: 默认阈值 0.5，前端可调 0.3-0.9，支持 <code>taskId</code> 范围限定</li>
  <li><strong>Ollama 本地推理</strong>: 数据不出本地，200ms 请求间隔避免过载</li>
</ul>

<h3>技术原理</h3>

<h4>向量索引架构</h4>
<ol>
  <li><strong>文本拼接</strong>：<code>buildJobText()</code> 将 Excel 原始字段（职位名/公司名/城市）+ <code>job_enrichments</code> 增强字段（技能/分类/行业/学历）拼接为自然语言段落</li>
  <li><strong>Embedding 生成</strong>：调用本地 Ollama <code>nomic-embed-text</code> 模型，输出 768 维浮点向量；200ms 间隔避免 Ollama 过载</li>
  <li><strong>向量存储</strong>：pgvector <code>vector(768)</code> 类型列，<code>INSERT INTO job_embeddings (embedding) VALUES ($1::vector)</code></li>
  <li><strong>IVFFlat 索引</strong>：<code>CREATE INDEX ON job_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)</code>，100 个聚类列表加速近似搜索</li>
  <li><strong>相似度计算</strong>：<code>1 - (embedding <=> query_vector::vector)</code> → 余弦相似度 (0-1)，默认阈值 0.3</li>
</ol>

<h4>pgvector 原理</h4>
<ul>
  <li><strong>IVFFlat 近似搜索</strong>：将向量空间划分为 100 个列表（lists），查询时只扫描最相关的几个列表，比全量 KNN 快 10-100 倍</li>
  <li><strong>余弦距离</strong>：<code>vector <=> vector</code> 运算符计算余弦距离 = 1 - cos(θ)，值越小越相似</li>
  <li><strong>ON CONFLICT UPSERT</strong>：<code>(task_id, job_id)</code> 唯一约束，重复索引自动更新旧向量</li>
  <li><strong>维度固定</strong>：768 维 nomic-embed-text，不可混用其他维度模型</li>
</ul>

<h4>搜索示例</h4>
<ul>
  <li>"需要5年以上经验的Java后端开发岗位"</li>
  <li>"北京地区薪资20K以上的数据分析师"</li>
  <li>"互联网行业本科学历的产品经理"</li>
</ul>`
  },
  'feat-insights': {
    title: 'AI 市场洞察 & 数据看板',
    content: `<p>系统提供两层数据分析能力：<strong>数据看板</strong>（实时汇总统计）和 <strong>AI 深度分析报告</strong>（LLM 生成专业洞察）。</p>

<h2>一、数据看板（Dashboard）</h2>

<h4>顶部统计卡片</h4>
<ul>
  <li><strong>5 个核心指标</strong>：总职位数、采集任务、企业数量、平均薪资、最高薪资</li>
  <li>每张卡片带左侧彩色图标（Briefcase/Monitor/OfficeBuilding/Coin/TrendCharts），配色与指标含义对应</li>
  <li>数据来自全库聚合 API（非当前页），随任务完成实时更新</li>
</ul>

<h4>黑龙江省区域分布</h4>
<ul>
  <li><strong>地图 + 明细双面板</strong>：左侧 ECharts 地图（GeoJSON 注册），右侧柱状图明细 Top 12</li>
  <li><strong>维度标签切换</strong>：城市分布 / 薪资分布 / 学历分布等（后端 API 动态维度）+ 经验年限 / 技能词云</li>
  <li><strong>经验年限</strong>：基于 dashboard 汇总数据的柱状图，标签切换时保留左侧地图</li>
  <li><strong>技能词云</strong>：echarts-wordcloud 圆形布局，字号 14-48，8 色随机，展示 Top 50 热门技能</li>
  <li>地图支持缩放漫游（roam），视觉映射（visualMap）按数值着色</li>
</ul>

<h4>技术实现</h4>
<ul>
  <li>GeoJSON 异步加载 + echarts.registerMap 注册</li>
  <li>标签切换：区域维度走 API 请求，经验/词云走 dashboard 缓存数据（零请求切换）</li>
  <li>ECharts 实例管理：切换标签时 dispose 旧实例避免内存泄漏</li>
  <li>响应式：window resize 时联动 resize 所有图表实例</li>
</ul>

<h2>二、AI 深度分析报告</h2>

<ul>
  <li>从 <code>job_enrichments</code> 表聚合：薪资分布、职位分类、技能排行、行业分布、学历/经验要求、工作模式</li>
  <li>LLM 输出结构化 JSON：<code>{ title, summary, sections[], charts_config[] }</code></li>
  <li>每个 section 包含标题、正文（Markdown）、关键发现</li>
  <li>charts_config 直接输出 ECharts option 对象，前端渲染</li>
  <li>支持报告历史查询与切换</li>
  <li>WebSocket 分阶段推送进度（构建统计 → 调用 AI → 解析 → 入库）</li>
  <li>前端 2 秒轮询 + WebSocket 双重保障报告加载</li>
</ul>

<h3>技术原理</h3>

<h4>多维度数据聚合</h4>
<ol>
  <li><strong>数据源</strong>：从 <code>job_enrichments</code> 表读取对应 <code>file_id</code> 下所有增强记录，JOIN <code>csv_files</code> 获取原始字段</li>
  <li><strong>统计维度</strong>：薪资分布（Min/Max/Avg/Median/P25/P75）、职位分类分布（L1+L2 交叉）、技能热度排序（TF 词频）、行业分布、学历要求占比、经验年限分布、工作模式比例</li>
  <li><strong>聚合 SQL</strong>：<code>SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY salary_monthly_min) ...</code> 计算百分位数分布</li>
</ol>

<h4>LLM 报告生成</h4>
<ol>
  <li><strong>Prompt 构建</strong>：将聚合统计数据注入 Prompt 模板，包含薪资分布表、技能 Top 20、行业占比等结构化数据</li>
  <li><strong>结构化输出</strong>：LLM 返回 JSON——<code>{ title, summary, sections: [{heading, body, key_findings}], charts_config: [{type, title, option}] }</code></li>
  <li><strong>分段解析</strong>：每个 section 独立 Markdown 正文 + 关键发现列表，charts_config 为 ECharts 完整 option 对象，前端直接渲染</li>
  <li><strong>失败降级</strong>：JSON 解析失败时，使用正则提取 Markdown 标题分段，回退为基础文本报告</li>
</ol>

<h4>前端可视化集成</h4>
<ul>
  <li>ECharts 6 渲染 AI 生成的 <code>charts_config</code>，支持柱状图/饼图/折线图/散点图/雷达图</li>
  <li>WebSocket 分阶段推送（构建统计→调用 AI→解析→入库），前端进度条实时反馈</li>
  <li>2 秒轮询 + WebSocket 双通道确保报告加载可靠性（WebSocket 可能断线）</li>
  <li>历史报告切换：<code>market_reports</code> 表按 <code>file_id</code> 存储多版本报告</li>
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
</ul>

<h3>技术原理</h3>

<h4>Text-to-SQL 全流程</h4>
<ol>
  <li><strong>意图解析</strong>：LLM 分析自然语言问题，提取实体（"Java"、"北京"）、条件（"5年以上"、"本科"）、聚合目标（"平均薪资"、"数量"、"Top 10"）</li>
  <li><strong>Schema 注入</strong>：System Prompt 注入 <code>job_enrichments</code> 完整表结构——字段名、类型、枚举值（如 <code>company_industry</code> 14 个合法值、<code>education_normalized</code> 5 个值），确保 SQL 字段名正确</li>
  <li><strong>SQL 生成</strong>：LLM 输出纯 SQL 字符串，支持 SELECT/JOIN/GROUP BY/ORDER BY/LIMIT/子查询</li>
  <li><strong>安全校验</strong>：白名单正则——仅允许 <code>SELECT</code> 语句，拦截 <code>INSERT/DROP/TRUNCATE/DELETE/ALTER/UPDATE</code>；<code>LIMIT 500</code> 自动追加；多语句分号截断</li>
  <li><strong>参数化执行</strong>：<code>pool.query(sql)</code>，错误捕获后返回友好提示</li>
  <li><strong>结果总结</strong>：LLM 用 2-3 句话中文总结查询结果，包含关键数值和趋势</li>
</ol>

<h4>安全白名单机制</h4>
<ul>
  <li><strong>语句级</strong>：正则 <code>/^(SELECT|WITH)\s/i</code> 验证，仅允许查询语句</li>
  <li><strong>关键字黑名单</strong>：<code>INSERT|DROP|TRUNCATE|DELETE|ALTER|UPDATE|CREATE|EXEC|GRANT|REVOKE</code> 任一匹配即拦截</li>
  <li><strong>LIMIT 强制</strong>：无 LIMIT 的查询自动追加 <code>LIMIT 500</code></li>
  <li><strong>多语句防护</strong>：分号分割后只取第一条，防止 <code>SELECT ...; DROP TABLE ...</code></li>
</ul>

<h4>结果缓存与历史</h4>
<ul>
  <li><strong>saved_queries 表</strong>：持久化原始问题 + 生成 SQL + 查询结果 + LLM 总结</li>
  <li><strong>历史回顾</strong>：按时间倒序展示查询历史，点击可查看完整结果</li>
  <li><strong>重新执行</strong>：历史查询可一键重新执行（SQL 可能因数据变化返回不同结果）</li>
</ul>

<hr>

<h2>常见问题</h2>

<h3>Q：处理流程中的「Schema 动态注入」是什么意思？</h3>

<p>LLM 本身不知道你的数据库有哪些表、哪些字段。如果直接问它"帮我把管理员的角色名称查出来"，它只能瞎编 SQL——编出 <code>SELECT role FROM admins</code> 这类不存在的字段。</p>

<p>Schema 动态注入在调用 LLM <strong>之前</strong>，动态查询数据库元信息（表名、字段名、字段类型、枚举值范围），将这些结构信息注入到 LLM 的 System Prompt 中，确保生成的 SQL 字段名全部真实存在。</p>

<table>
  <tr><th>方式</th><th>问题</th></tr>
  <tr><td><strong>写死 Schema 在代码里</strong></td><td>表结构一旦变更（加字段、改名），代码也要改；N 个查询场景分别对应不同表，每个都要维护一份</td></tr>
  <tr><td><strong>动态注入</strong></td><td>每次查询前实时从 PostgreSQL 的 <code>information_schema</code> 查表结构 → 拼进 Prompt → 发给 LLM，始终与当前数据库结构同步</td></tr>
</table>

<p>完整链路串联：</p>
<pre><code>用户输入: "北京 Java 岗位薪资 20K 以上的有哪些"
    ↓
① 意图精准解析: LLM 提取实体(Java、北京)、条件(20K以上)、目标(查询职位列表)
    ↓
② Schema 动态注入: 查 pg_catalog → 拼入 System Prompt → LLM 看到真实字段名
    ↓
③ 语义安全校验: 生成出的 SQL 过白名单(仅SELECT)、截断多语句、限 LIMIT 500
    ↓
④ 数据库执行 → 返回结果 → LLM 中文总结</code></pre>

<p>没有 Schema 动态注入，LLM 生成的 SQL 字段名十有八九是错的，查询直接报 <code>column does not exist</code>。</p>

<h3>Q：Schema 动态注入各步骤具体做了什么？</h3>

<h4>第一步：查 pg_catalog</h4>

<p>系统执行以下查询，从 PostgreSQL 系统目录提取表结构元数据：</p>

<pre><code>-- 获取指定表的所有字段信息
SELECT
    column_name,           -- 字段名，如 "salary_monthly_min"
    data_type,             -- 数据类型，如 "integer"
    is_nullable,           -- 是否可空
    column_default         -- 默认值
FROM information_schema.columns
WHERE table_name = 'job_enrichments'
ORDER BY ordinal_position;

-- 获取枚举值（通过查已有数据的 DISTINCT 值）
SELECT DISTINCT city, COUNT(*) AS cnt
FROM job_enrichments
GROUP BY city
ORDER BY cnt DESC
LIMIT 20;</code></pre>

<p>输出纯机器数据：<code>column: city | type: varchar | sample_values: [北京,上海,广州,深圳...]</code></p>

<h4>第二步：拼入 System Prompt</h4>

<p>把上一步的元数据拼成结构化表描述，注入到 Prompt 特定位置：</p>

<pre><code>你是一个 SQL 生成助手。

=== 以下内容每次查询前动态生成 ===

当前可用表结构（实时同步自数据库）：

表名: job_enrichments
┌───────────────────────────────────────┐
│ 字段名              类型      说明     │
│ id                  INT      主键      │
│ job_name            VARCHAR  职位名称  │
│ company_name        VARCHAR  公司名称  │
│ city                VARCHAR  城市      │
│   ↑ 常用值: 北京/上海/广州/深圳/...    │
│ salary_monthly_min  INT      月薪下限  │
│ salary_monthly_max  INT      月薪上限  │
│ education_normalized VARCHAR 学历      │
│   ↑ 枚举: 高中/大专/本科/硕士/博士     │
│ experience_years_min INT    经验下限   │
│ job_category_l1     VARCHAR  一级分类  │
│   ↑ 枚举: 技术/产品/设计/市场/...      │
│ ...                                    │
└───────────────────────────────────────┘

规则:
- 只生成 SELECT 语句
- 使用上述真实字段名，禁止编造字段
- 城市/学历/分类必须使用上述枚举值

=== 以上内容每次查询前动态生成 ===</code></pre>

<h4>第三步：LLM 看到真实字段名</h4>

<p>拼好的 Prompt 发给 LLM 后，用户问 <strong>"北京 Java 岗位薪资 20K 以上的有哪些"</strong>，LLM 推理：</p>

<pre><code>1. 北京 → city = '北京'               ← 用的是 Prompt 注入的真实字段名
2. Java  → job_category_l1 = '技术'
           且 job_name LIKE '%Java%'   ← 结合枚举值 + 模糊匹配
3. 20K以上 → salary_monthly_min >= 20000 ← 用的是注入的单位知识

生成 SQL:
SELECT job_name, company_name, city,
       salary_monthly_min, salary_monthly_max
FROM job_enrichments
WHERE city = '北京'
  AND (job_name LIKE '%Java%' OR job_category_l1 = '技术')
  AND salary_monthly_min >= 20000
ORDER BY salary_monthly_min DESC
LIMIT 50;</code></pre>

<p>关键效果：没有 Schema 注入时 LLM 可能编造 <code>job_title</code>、<code>location</code>、<code>min_salary</code> 等不存在的字段名导致报错。注入后字段命中率从约 30% 提升到接近 100%。</p>`
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
</ul>

<h3>技术原理</h3>

<h4>AI 页面分类</h4>
<ol>
  <li><strong>HTML 截断</strong>：取页面 HTML 前 3000 字符（含 title/meta/body 片断），减小 LLM token 消耗</li>
  <li><strong>Prompt 设计</strong>：System Prompt 定义 6 种反爬页面类型特征——captcha（验证码关键词）、waf（防火墙拦截标志）、login（登录表单）、error（HTTP 错误）、empty（无内容）、normal（正常）</li>
  <li><strong>LLM 分类</strong>：返回 <code>{ type: string, confidence: number }</code>，confidence &lt; 0.6 时标记为不确定</li>
  <li><strong>5 秒冷却</strong>：<code>lastClassifyTime</code> 时间戳缓存，避免高频重复调用 LLM（单任务可触发数十次检测）</li>
</ol>

<h4>选择器推荐</h4>
<ol>
  <li><strong>触发条件</strong>：DOM 解析返回 0 条结果时调用 <code>suggestSelectors</code></li>
  <li><strong>输入</strong>：页面 HTML 片断 + 目标描述（"职位列表容器"）</li>
  <li><strong>LLM 输出</strong>：<code>{ selectors: [{ cssSelector, description, confidence }] }</code>，推荐的 CSS 选择器按置信度排序</li>
  <li><strong>应用</strong>：按置信度降序尝试，首个命中即返回数据，替代硬编码选择器遍历</li>
</ol>

<h4>应对策略决策</h4>
<ol>
  <li><strong>输入</strong>：页面分类结果 + 当前重试次数 + 浏览器状态</li>
  <li><strong>策略映射</strong>：LLM 推荐——continue（继续）、wait（等待 N 秒）、retry（重试）、switch_ip（换 IP，预留）、abort（放弃）</li>
  <li><strong>执行</strong>：<code>wait</code> 按建议时长 setTimeout；<code>retry</code> 重回搜索页重新加载；<code>abort</code> 跳过当前组合</li>
</ol>

<h4>与传统规则对比</h4>
<table>
  <tr><th>维度</th><th>传统规则</th><th>AI 增强</th></tr>
  <tr><td>页面分类</td><td>htmlLength &lt; 5000 / 关键词匹配</td><td>LLM 理解页面语义（区分 captcha vs waf vs login）</td></tr>
  <tr><td>选择器</td><td>硬编码 17 个选择器逐个试</td><td>LLM 分析 HTML 推荐精确选择器</td></tr>
  <tr><td>应对</td><td>固定降级串行</td><td>LLM 根据分类+重试次数动态决策</td></tr>
  <tr><td>扩展性</td><td>新平台需手写规则</td><td>AI 自动适应反爬变化</td></tr>
</table>`
  },
  'feat-llm-routing': {
    title: 'LLM 任务路由',
    content: `<p>系统支持同时配置<strong>多个 AI 模型</strong>，不同任务类型自动选择对应模型执行。核心机制：每个 LLM 配置维护一个 <code>task_routing</code> JSONB 数组，声明该模型可处理哪些任务类型。支持 <strong>5 个模型提供商，6 种任务类型</strong>。</p>

<h3>六种任务类型</h3>
<table>
  <tr><th>任务类型</th><th>标识</th><th>说明</th><th>推荐模型</th></tr>
  <tr><td>数据增强</td><td><code>enrichment</code></td><td>逐条标准化职位数据（薪资/分类/技能/学历/行业）</td><td>DeepSeek V4 Pro</td></tr>
  <tr><td>智能洞察</td><td><code>insights</code></td><td>聚合统计 + 生成 Markdown 分析报告（含 ECharts 图表配置）</td><td>DeepSeek / GPT-4o</td></tr>
  <tr><td>NL 查询</td><td><code>query</code></td><td>自然语言 → SQL 转换（Text-to-SQL）</td><td>DeepSeek / 智谱 GLM</td></tr>
  <tr><td>反爬检测</td><td><code>anti-crawl</code></td><td>页面类型分类 + 反爬特征识别</td><td>Ollama qwen3:4b</td></tr>
  <tr><td>向量化</td><td><code>embedding</code></td><td>文本 → 768 维向量（简历/岗位/文档）</td><td>Ollama nomic-embed-text / 自训练模型</td></tr>
  <tr><td>简历解析</td><td><code>resume-parse</code></td><td>PDF/Word 简历 → 18 个结构化字段 JSON</td><td>DeepSeek V4 Pro</td></tr>
</table>

<h3>五个模型提供商</h3>
<p>系统内置 <strong>2 个 Provider 类</strong>，覆盖 5 个模型提供方：</p>
<table>
  <tr><th>Provider 类</th><th>覆盖提供方</th><th>调用方式</th></tr>
  <tr><td><code>CloudProvider</code></td><td>OpenAI / Anthropic / DeepSeek / 智谱</td><td>兼容 OpenAI 格式的 HTTP API</td></tr>
  <tr><td><code>LocalProvider</code></td><td>Ollama</td><td>本地 Ollama REST API（<code>/api/generate</code>、<code>/api/embeddings</code>）</td></tr>
</table>

<h3>路由选择逻辑</h3>
<p>当系统需要调用 LLM 时，通过 <strong>两条路径</strong> 之一获取配置：</p>

<h4>路径一：直接调用 <code>callLLM(systemPrompt, userPrompt, options)</code></h4>
<p>适用于问答机器人等场景，直接传入拼接好的 prompt 文本。</p>

<h4>路径二：提示词系统调用 <code>callLLMWithPrompts(category, userPromptVars, options)</code></h4>
<p>适用于数据增强、简历解析等业务场景，自动从 DB <code>sp_prompts</code> 表拉取该分类的活跃提示词，并用 <code>interpolateTemplate()</code> 替换模板变量后发送。</p>

<pre><code>// 核心路由代码（llm/index.ts）
async getConfigForTask(taskType: LLMTaskType): Promise&lt;LLMConfig | null&gt; {
  // 60s TTL 缓存检查，过期自动刷新
  if (Date.now() - this.configCacheTime > 60000) {
    await this.refreshConfigCache();
  }
  // 第一匹配：taskRouting 包含当前 taskType
  const config = this.configCache.find(c =>
    c.isActive !== false && Array.isArray(c.taskRouting) && c.taskRouting.includes(taskType)
  );
  // 兜底：返回首个 active 配置
  if (!config) {
    return this.configCache.find(c => c.isActive !== false) || null;
  }
  return config;
}</code></pre>

<h3>60 秒缓存机制</h3>
<ul>
  <li>配置列表缓存在 <code>configCache</code> 内存数组中（单例模式）</li>
  <li>每次 <code>getConfigForTask()</code> 调用检查时间戳，超过 60 秒自动刷新</li>
  <li>目的：减少数据库查询频率（单次任务可能触发数十次 LLM 调用）</li>
  <li>前端修改配置后通过 <code>POST /api/llm-config/refresh-cache</code> 强制刷新</li>
</ul>

<h3>路由示例</h3>
<p>假设系统配置了三个模型：</p>
<table>
  <tr><th>模型</th><th>provider</th><th>task_routing</th></tr>
  <tr><td>DeepSeek V4 Pro</td><td>deepseek</td><td>["enrichment", "insights", "query", "resume-parse"]</td></tr>
  <tr><td>Ollama qwen3:4b</td><td>ollama</td><td>["anti-crawl"]</td></tr>
  <tr><td>position-embed-model</td><td>ollama</td><td>["embedding"]</td></tr>
</table>

<p>当爬虫触发反爬检测时，<code>getConfigForTask("anti-crawl")</code> → Ollama qwen3:4b（低延迟本地推理）；<br>
当用户上传简历时，<code>getConfigForTask("resume-parse")</code> → DeepSeek V4 Pro（强结构化提取能力）；<br>
当生成语义向量时，<code>getConfigForTask("embedding")</code> → position-embed-model（领域微调 Embedding）。</p>

<h3>完整调用链</h3>
<pre><code>用户操作 / 爬虫事件 / 定时任务
        ↓
确定 taskType (enrichment|insights|query|anti-crawl|embedding|resume-parse)
        ↓
    ┌─ 路径一：callLLM(systemPrompt, userPrompt, options)
    │   └─ 问答机器人等直接拼装 prompt 的场景
    │
    └─ 路径二：callLLMWithPrompts(category, userPromptVars, options)
        └─ 数据增强/简历解析等 DB 提示词场景
            └─ resolvePrompts(category, userPromptVars)
                ├─ 查询 sp_prompts (category + isActive=true)
                │   ├─ 有 → 使用 DB 存储的提示词
                │   └─ 无 → 回退 prompts.ts 硬编码默认值
                └─ interpolateTemplate(userPrompt, userPromptVars)
                    └─ 正则 \${varName} 替换为实际数据
        ↓
llmService.getConfigForTask(taskType)
        ├─ 检查 configCache 时间戳 (60s TTL)
        ├─ 过期 → refreshConfigCache() 查 sp_llm_config
        ├─ 遍历 configs，匹配 taskRouting JSONB 数组
        ├─ 命中 → 返回对应 API Key + Base URL
        └─ 未命中 → 兜底返回首个 active 配置
        ↓
初始化 Provider (CloudProvider / LocalProvider)
        ↓
调用 LLM API → 返回结果</code></pre>

<h3>API Key 加密存储</h3>
<ul>
  <li>所有 API Key 使用 <strong>AES-256-GCM</strong> 加密后存入 <code>api_key_encrypted</code> 字段</li>
  <li>加密格式：<code>hex_iv:hex_auth_tag:hex_ciphertext</code>（共三段，冒号分隔）</li>
  <li>格式检测：<code>isEncrypted()</code> 正则校验 <code>/^[0-9a-f]{32}:[0-9a-f]{32}:[0-9a-f]+$/</code> 判断明文/密文</li>
  <li>存量明文 Key 在首次使用时自动兼容（<code>decrypt()</code> 返回原值）</li>
  <li>加密密钥从环境变量 <code>LLM_ENCRYPTION_KEY</code> 读取，无则使用内置默认密钥</li>
</ul>`
  },
  'feat-embedding': {
    title: '文本向量化',
    content: `<p>系统通过 <strong>Ollama 本地 Embedding 模型 + pgvector 向量数据库</strong> 实现职位数据的语义搜索。核心流程：将每条职位拼接为自然语言文本 → 生成 768 维向量 → 存入 pgvector → 余弦相似度搜索。</p>

<h3>完整流水线</h3>
<pre><code>sp_job_enrichments (AI 增强后的结构化数据)
        ↓
buildJobText() → 拼接为自然语言段落
        ↓
Ollama nomic-embed-text → 768 维浮点向量
        ↓
pgvector vector(768) → INSERT ON CONFLICT UPSERT
        ↓
IVFFlat 索引 (100 lists, vector_cosine_ops)
        ↓
semanticSearch() → 余弦相似度排序</code></pre>

<h3>一、文本拼接 (buildJobText)</h3>
<p>将职位相关字段拼接为自然语言段落，作为 Embedding 模型的输入：</p>

<pre><code>// embeddings.ts
function buildJobText(job: JobRecord): string {
  const parts: string[] = [];
  if (job.jobName) parts.push(\`职位名称: \${job.jobName}\`);
  if (job.companyName) parts.push(\`公司: \${job.companyName}\`);
  if (job.workCity) parts.push(\`城市: \${job.workCity}\`);
  if (job.jobCategoryL1) parts.push(\`分类: \${job.jobCategoryL1} &gt; \${job.jobCategoryL2}\`);
  if (job.companyIndustry) parts.push(\`行业: \${job.companyIndustry}\`);
  if (job.keySkills?.length) parts.push(\`技能: \${job.keySkills.join(', ')}\`);
  if (job.educationNormalized) parts.push(\`学历: \${job.educationNormalized}\`);
  if (job.salaryMonthlyMin) parts.push(\`薪资: \${job.salaryMonthlyMin}-\${job.salaryMonthlyMax}元/月\`);
  return parts.join('；');
}</code></pre>

<p>拼接示例输出：<br>
<code>"职位名称：Java高级开发工程师；公司：某科技有限公司；城市：北京；分类：技术 &gt; 后端开发；行业：互联网；技能：Java, Spring, MySQL, Redis；学历：本科；薪资：15000-25000元/月"</code></p>

<h3>二、Embedding 生成</h3>

<h4>模型信息</h4>
<table>
  <tr><th>属性</th><th>值</th></tr>
  <tr><td>模型</td><td><code>nomic-embed-text</code> (Ollama 内置)</td></tr>
  <tr><td>向量维度</td><td><strong>768 维</strong></td></tr>
  <tr><td>API 端点</td><td><code>POST /api/embeddings</code></td></tr>
  <tr><td>批量间隔</td><td>100ms（逐条生成）</td></tr>
  <tr><td>索引间隔</td><td>200ms（批量索引）</td></tr>
  <tr><td>输入</td><td>拼接后的自然语言文本</td></tr>
  <tr><td>输出</td><td><code>number[]</code> 768 维浮点数组</td></tr>
</table>

<h4>调用流程</h4>
<ol>
  <li>构造请求体：<code>{ model: "nomic-embed-text", prompt: textContent }</code></li>
  <li>发送 POST 到 Ollama API（默认 <code>http://localhost:11434</code>）</li>
  <li>解析响应中的 <code>embedding</code> 数组（768 个 float32）</li>
  <li>验证维度：数组长度必须等于 768，否则抛出异常</li>
  <li>格式化为 pgvector 兼容字符串：<code>[0.12, -0.34, ...]</code></li>
</ol>

<h4>批量生成优化</h4>
<ul>
  <li><strong>100ms 间隔</strong>：<code>generateEmbeddings()</code> 逐条请求间 sleep 100ms，避免 Ollama 过载</li>
  <li><strong>并发保护</strong>：单条失败不中断批次，记录错误后继续下一条</li>
  <li><strong>进度推送</strong>：通过 WebSocket <code>rag:index-progress</code> 事件实时推送索引进度</li>
</ul>

<h3>三、pgvector 存储与索引</h3>

<h4>表结构 (sp_job_embeddings)</h4>
<table>
  <tr><th>字段</th><th>类型</th><th>说明</th></tr>
  <tr><td><code>id</code></td><td>VARCHAR(255) PK</td><td>UUID</td></tr>
  <tr><td><code>job_id</code></td><td>VARCHAR(255)</td><td>职位 ID</td></tr>
  <tr><td><code>task_id</code></td><td>VARCHAR(255) FK</td><td>关联任务</td></tr>
  <tr><td><code>text_content</code></td><td>TEXT</td><td>拼接后的原文（调试/审计用）</td></tr>
  <tr><td><code>embedding</code></td><td><strong>vector(768)</strong></td><td>768 维向量</td></tr>
  <tr><td><code>job_name</code>/<code>company_name</code>/…</td><td>冗余字段</td><td>搜索返回时避免 JOIN</td></tr>
</table>
<table>
  <tr><th>唯一约束</th><td><code>UNIQUE(task_id, job_id)</code></td><td>幂等 UPSERT 基础</td></tr>
</table>

<h4>IVFFlat 索引</h4>
<pre><code>CREATE INDEX IF NOT EXISTS idx_job_embeddings_embedding
  ON sp_job_embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);</code></pre>

<ul>
  <li><strong>IVFFlat</strong>：将 768 维空间划分为 100 个聚类列表（lists），查询时只扫描最相关的几个列表</li>
  <li><strong>近似搜索</strong>：比全量 KNN 快 10-100 倍，适合万级以上数据</li>
  <li><strong>余弦距离</strong>：<code>vector_cosine_ops</code> 操作符类，<code>&lt;=&gt;</code> 运算符计算余弦距离 = 1 - cos(θ)</li>
  <li><strong>幂等 UPSERT</strong>：<code>ON CONFLICT (task_id, job_id) DO UPDATE</code>，重复索引自动覆盖旧值</li>
</ul>

<h3>四、语义搜索</h3>

<h4>搜索 SQL</h4>
<pre><code>SELECT
  job_id, job_name, company_name, work_city,
  salary_monthly_min, salary_monthly_max,
  job_category_l1, job_category_l2,
  company_industry, key_skills,
  1 - (embedding &lt;=&gt; $1::vector) AS similarity
FROM sp_job_embeddings
WHERE task_id = $2
  AND 1 - (embedding &lt;=&gt; $1::vector) &gt;= $3
ORDER BY similarity DESC
LIMIT $4;</code></pre>

<ul>
  <li><strong>余弦距离 → 相似度</strong>：<code>1 - (embedding &lt;=&gt; query_vector)</code>，值域 0~1，越大越相似</li>
  <li><strong>阈值过滤</strong>：默认 <code>minSimilarity = 0.3</code>，过滤低相关性结果</li>
  <li><strong>范围限定</strong>：可选按 <code>task_id</code> 限定搜索范围</li>
</ul>

<h3>五、查询扩展 (Query Expansion)</h3>
<p>针对用户输入过短（≤10 字符）导致的语义稀疏问题，系统内置 <strong>30+ 术语映射表</strong> 自动扩展查询：</p>

<h4>触发条件</h4>
<ul>
  <li>用户输入 ≤ 10 个字符（去除空格后）</li>
  <li>例如："Java"（4 字符）、"前端"（2 字符）、"产品经理"（4 字符）</li>
</ul>

<h4>扩展逻辑</h4>
<ol>
  <li>遍历映射表（30+ 条），查找用户输入中是否包含已知术语</li>
  <li>匹配到术语后，将对应描述文本追加到查询后面</li>
  <li>形成完整查询：<code>"Java Java开发工程师 后端开发 Spring框架 微服务架构"</code></li>
</ol>

<h4>术语映射示例</h4>
<table>
  <tr><th>用户输入</th><th>扩展后</th></tr>
  <tr><td>Java</td><td>Java Java开发工程师 后端开发 Spring框架 微服务架构</td></tr>
  <tr><td>前端</td><td>前端 前端开发工程师 Web前端 Vue React 网页开发</td></tr>
  <tr><td>Python</td><td>Python Python开发工程师 数据分析 机器学习 AI开发 Django</td></tr>
  <tr><td>产品经理</td><td>产品经理 产品设计 需求分析 项目管理 用户体验</td></tr>
</table>

<h4>扩展效果</h4>
<ul>
  <li>短查询的语义向量从稀疏变为丰富，搜索命中率显著提升</li>
  <li>扩展文本包含领域上下文（技能、职责、框架），使向量更精准</li>
  <li>非短查询（> 10 字符）不做扩展，保持用户原始语义</li>
</ul>

<h3>六、关键技术细节</h3>

<h4>为什么选择 nomic-embed-text？</h4>
<ul>
  <li>Ollama 官方推荐的中英文混合 Embedding 模型</li>
  <li>768 维在精度和存储之间取得平衡（每向量 ~3KB）</li>
  <li>本地推理，数据不出服务器，无需外部 API 费用</li>
  <li>单条推理延迟 ~50-200ms（视硬件而定）</li>
</ul>

<h4>为什么使用 IVFFlat 而非 HNSW？</h4>
<ul>
  <li>pgvector 的 IVFFlat 基于 PostgreSQL 原生索引引擎，稳定性好</li>
  <li>100 个列表在万级数据下提供足够的搜索精度（召回率 > 95%）</li>
  <li>索引构建速度快，适合数据频繁更新的场景</li>
</ul>

<h4>混合数据源设计</h4>
<ul>
  <li>向量嵌入同时包含 <strong>原始字段</strong>（职位名、公司名、城市）和 <strong>AI 增强字段</strong>（分类、技能、行业、学历）</li>
  <li>增强字段使语义搜索不仅能匹配职位名称，还能理解行业背景和技能要求</li>
  <li>例如搜索"金融行业的数据分析师"能匹配到：职位名=数据分析、行业=金融、技能=Python/SQL</li>
</ul>

<h4>依赖要求</h4>
<ul>
  <li>需要 PostgreSQL 安装 <strong>pgvector</strong> 扩展：<code>CREATE EXTENSION IF NOT EXISTS vector;</code></li>
  <li>需要 Ollama 运行 <strong>nomic-embed-text</strong> 模型（768 维）</li>
  <li>如果 pgvector 不可用，向量表创建会被跳过，RAG 语义搜索功能禁用</li>
  <li>首次索引会自动检查并尝试拉取 embedding 模型</li>
</ul>

<h3>七、常见问题</h3>

<h4>Q: 文本向量化用的是哪个大模型？</h4>
<p>使用的是 <strong>Ollama 本地部署的 nomic-embed-text 模型</strong>，<strong>不是云端大模型</strong>（如 DeepSeek/OpenAI）。这是一个专门用于文本向量化（Embedding）的小型模型，输出 <strong>768 维浮点向量</strong>。</p>

<h4>模型信息速览</h4>
<table>
  <tr><th>属性</th><th>值</th></tr>
  <tr><td>模型名称</td><td><code>nomic-embed-text</code></td></tr>
  <tr><td>运行环境</td><td>Ollama 本地服务（默认 <code>http://localhost:11434</code>）</td></tr>
  <tr><td>向量维度</td><td>768 维</td></tr>
  <tr><td>API 端点</td><td><code>POST /api/embeddings</code></td></tr>
  <tr><td>单条延迟</td><td>~50-200ms（视硬件配置而定）</td></tr>
  <tr><td>费用</td><td><strong>完全免费</strong>（本地推理，无 API 调用费）</td></tr>
</table>

<h4>Q: 如何调用的？完整链路是怎样的？</h4>
<ol>
  <li><strong>触发入口</strong>：前端「语义搜索」页面 → 选择任务 → 点击「开始索引」</li>
  <li><strong>API 请求</strong>：<code>POST /api/rag/index/:taskId</code> → <code>ragController.indexTask()</code></li>
  <li><strong>读取数据</strong>：从 <code>sp_job_enrichments</code> 读取 AI 增强后的结构化职位数据</li>
  <li><strong>文本拼接</strong>：<code>buildJobText()</code> 将职位的职位名称/公司/城市/分类/技能/行业/学历/薪资等多维字段拼接为一段自然语言文本<br/>
  <code>"职位: Java开发; 分类: 技术; 技能: Java, Spring; 行业: 互联网; 城市: 北京; ..."</code></li>
  <li><strong>调用 Ollama</strong>：<code>POST http://localhost:11434/api/embeddings</code>，Body: <code>{ model: "nomic-embed-text", prompt: text }</code></li>
  <li><strong>解析响应</strong>：从 Ollama 返回的 JSON 中提取 <code>embedding</code> 数组（768 个 float32）</li>
  <li><strong>写入 pgvector</strong>：将向量格式化为 PostgreSQL 兼容字符串，INSERT 到 <code>sp_job_embeddings</code> 表的 <code>vector(768)</code> 列</li>
  <li><strong>IVFFlat 索引</strong>：100 个聚类列表 + cosine_ops，加速后续相似搜索</li>
</ol>

<h4>Q: 为什么用 Ollama + nomic-embed-text 而不是调用 OpenAI/DeepSeek 的 Embedding API？</h4>
<ul>
  <li><strong>完全免费</strong>：本地运行，不产生任何 API 调用费用。如果索引上万条职位数据，云端 Embedding API 费用可观</li>
  <li><strong>数据不出服务器</strong>：职位数据（含公司名称/薪资等敏感信息）完全在本地处理，无需发送到第三方</li>
  <li><strong>无网络依赖</strong>：不依赖外部 API 可用性，离线环境也能正常工作</li>
  <li><strong>性能足够</strong>：nomic-embed-text 在 MTEB 基准测试中评分 62+，对于职位语义匹配场景完全够用</li>
  <li><strong>批量处理友好</strong>：逐条间隔 100ms 避免过载，适合后台批处理场景</li>
</ul>

<h4>Q: 如何确认 Ollama 和模型是否就绪？</h4>
<ol>
  <li>确认 Ollama 服务运行：<code>ollama list</code> 查看已安装模型</li>
  <li>如缺少模型，手动拉取：<code>ollama pull nomic-embed-text</code></li>
  <li>后端启动时也会自动检测并尝试拉取</li>
  <li>测试调用：<code>curl http://localhost:11434/api/embeddings -d '{"model":"nomic-embed-text","prompt":"测试文本"}'</code></li>
</ol>

<h4>Q: 文本向量化的原理是什么？</h4>
<p>文本向量化就是<strong>把一段文字映射成一个固定长度的数字数组（向量）</strong>，使得语义相近的文字在向量空间中的位置也相近。</p>

<h4>模型如何工作（以 nomic-embed-text 为例）</h4>
<p>核心是一个 <strong>Transformer 编码器</strong>，分三步：</p>
<ol>
  <li><strong>分词</strong>：将输入文本切分成 token（词元），如"Java开发工程师" → [Java, 开发, 工程师]</li>
  <li><strong>编码</strong>：每个 token 映射为初始向量，经过多层<strong>自注意力机制（Self-Attention）</strong>反复计算，让每个 token 的向量融入上下文信息</li>
  <li><strong>池化</strong>：将所有 token 的向量取平均（Mean Pooling），压缩成唯一的 <strong>768 维输出向量</strong>——这就是最终的 embedding</li>
</ol>
<pre><code>"Java开发工程师"  →  [0.12, -0.34, 0.78, ..., 0.45]  （768个数字）
"Java程序员"      →  [0.11, -0.33, 0.76, ..., 0.43]  （向量很接近）
"会计出纳"        →  [-0.52, 0.67, -0.21, ..., 0.88] （向量差很远）</code></pre>

<h4>在项目中的应用场景</h4>
<table>
  <tr><th>步骤</th><th>说明</th></tr>
  <tr><td>入库</td><td><code>buildJobText()</code> 将职位信息拼接为自然语言 → 调 embedding 转为 768 维向量 → 存入 pgvector IVFFlat 索引</td></tr>
  <tr><td>查询</td><td>用户输入自然语言问题 → 同样转为 768 维向量 → 在 pgvector 中做余弦相似度检索 → 返回语义最接近的 N 条职位</td></tr>
  <tr><td>交 LLM</td><td>将检索到的相关职位作为上下文，和用户问题一起发给大模型，让大模型基于真实数据回答</td></tr>
</table>

<h4>为什么用余弦相似度</h4>
<p>两个向量之间的<strong>余弦相似度</strong>反映它们在空间中的夹角：</p>
<ul>
  <li><strong>夹角越小（cos → 1）</strong>→ 语义越相近</li>
  <li><strong>夹角越大（cos → 0）</strong>→ 语义越无关</li>
  <li>pgvector 的 <code>&lt;=&gt;</code> 运算符算的是余弦距离（= 1 - 余弦相似度），所以 <code>ORDER BY embedding &lt;=&gt; query_vector</code> 按相似度从高到低排序</li>
</ul>

<h4>Q: pgvector 在本系统中的作用是什么？向量数据存在哪里？</h4>
<p><strong>pgvector</strong> 是 PostgreSQL 的向量扩展插件，本系统所有向量数据的<strong>存储和相似度检索</strong>都依赖它。统一使用 <strong>768 维向量 + 余弦相似度（cosine_ops）</strong>，共 4 张向量表支撑 3 大应用场景：</p>

<h4>四张向量表</h4>
<table>
  <tr><th>表名</th><th>向量列</th><th>存储内容</th><th>使用场景</th></tr>
  <tr><td><code>sp_job_embeddings</code></td><td><code>embedding vector(768)</code></td><td>职位增强后的自然语言文本向量</td><td>RAG 语义搜索</td></tr>
  <tr><td><code>sp_resumes</code></td><td><code>embedding vector(768)</code></td><td>简历结构化关键字段向量</td><td>简历人岗匹配</td></tr>
  <tr><td><code>sp_internal_jobs</code></td><td><code>embedding vector(768)</code></td><td>内部岗位（标题+描述+要求）向量</td><td>简历人岗匹配</td></tr>
  <tr><td><code>sp_doc_embeddings</code></td><td><code>embedding vector(768)</code></td><td>帮助文档/源代码/诊断文档分块向量</td><td>AI 问答 RAG</td></tr>
</table>

<h4>三大应用场景</h4>
<p><strong>1. RAG 语义搜索</strong>（<code>sp_job_embeddings</code>）</p>
<pre><code>职位文本 → nomic-embed-text → 768维向量 → IVFFlat 余弦索引
  → 用户输入 → 同样向量化 → cosine 相似度排序 → 返回最相关职位</code></pre>
<p><strong>2. 简历人岗匹配</strong>（<code>sp_resumes</code> + <code>sp_internal_jobs</code>）</p>
<pre><code>简历向量 ↔ 岗位向量 → 余弦相似度 × 0.4 → 语义匹配分（满分40）
  + 硬性规则分(40) + 技能加分(20) = 总分100</code></pre>
<p><strong>3. AI 问答 RAG</strong>（<code>sp_doc_embeddings</code>）</p>
<pre><code>用户提问 → 向量语义搜索 sp_doc_embeddings → Top6 相关文档片段
  → 注入 System Prompt 上下文 → LLM 生成回答 + 引用来源</code></pre>

<h4>索引加速</h4>
<p>系统使用 <strong>IVFFlat 索引</strong>（100 lists, vector_cosine_ops），比全量 KNN 暴力搜索快 <strong>10-100 倍</strong>。pgvector 的 <code>&lt;=&gt;</code> 运算符计算余弦距离（1 - 余弦相似度），值越小表示向量越接近。</p>

<h4>降级策略</h4>
<p>向量搜索和匹配功能均内置了<strong>多层降级</strong>：vector embedding 生成失败 → 回退预存向量 → 关键词兜底 → 纯规则匹配。即使 pgvector 不可用，核心匹配功能仍可通过关键词和硬性规则继续工作（AI 问答的内存关键词匹配始终作为兜底）。</p>`
  },
  'feat-proxy': {
    title: 'IP 代理池',
    content: `<p>系统集成第三方 <strong>HTTP 正向代理池</strong>（jhao104/proxy_pool），为爬虫提供动态 IP 轮换能力，绕过目标网站的反爬 IP 封锁。</p>

<h3>架构概览</h3>
<pre><code>┌─────────────────────────────────────────────────────┐
│                  proxy_pool (外部服务 :5010)           │
│  GET /get/  → 随机获取代理                            │
│  GET /pop/  → 获取并删除代理                           │
│  GET /delete/?proxy=xx → 删除指定代理                  │
│  GET /count  → 代理池数量                              │
│  GET /all/   → 全部代理列表                            │
└────────────────────┬────────────────────────────────┘
                     │ HTTP API
┌────────────────────▼────────────────────────────────┐
│              ProxyPool 类 (proxyPool.ts)              │
│  getProxy / popProxy / deleteProxy / checkHealth     │
│  formatProxyArg / getProxyArgs / isAvailable         │
└────────┬───────────────────────┬────────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐   ┌─────────────────────────────┐
│  Zhilian Crawler │   │   51job Crawler              │
│  浏览器级代理      │   │   axios 回退路径代理          │
│  --proxy-server   │   │  (浏览器走直连)               │
└─────────────────┘   └─────────────────────────────┘</code></pre>

<h3>一、ProxyPool 类核心设计</h3>

<h4>构造函数与配置</h4>
<pre><code>constructor(poolUrl: string = 'http://127.0.0.1:5010')</code></pre>
<ul>
  <li><strong>默认地址</strong>：<code>http://127.0.0.1:5010</code>（proxy_pool 服务默认端口）</li>
  <li><strong>连续失败保护</strong>：<code>maxConsecutiveFailures = 5</code>，连续 5 次失败后自动停止返回代理</li>
  <li><strong>请求超时</strong>：<code>requestTimeout = 5000ms</code></li>
</ul>

<h4>API 方法一览</h4>
<table>
  <tr><th>方法</th><th>说明</th><th>代理池 API</th></tr>
  <tr><td><code>getProxy(type?)</code></td><td>随机获取一个代理（不删除）</td><td><code>GET /get/</code></td></tr>
  <tr><td><code>popProxy(type?)</code></td><td>获取代理并从池中删除</td><td><code>GET /pop/</code></td></tr>
  <tr><td><code>deleteProxy(proxy)</code></td><td>删除指定代理</td><td><code>GET /delete/?proxy=</code></td></tr>
  <tr><td><code>getCount()</code></td><td>获取代理池当前数量</td><td><code>GET /count</code></td></tr>
  <tr><td><code>getAllProxies(type?)</code></td><td>获取全部代理列表</td><td><code>GET /all/</code></td></tr>
  <tr><td><code>checkHealth(proxy, testUrl)</code></td><td>验证代理可用性（核心方法）</td><td>直连目标站</td></tr>
</table>

<h3>二、代理健康检查 (checkHealth)</h3>
<p>获取代理后必须通过可用性验证，这是<strong>保证代理质量的核心机制</strong>：</p>

<pre><code>async checkHealth(proxy: string, testUrl: string): Promise&lt;boolean&gt; {
  const [host, port] = proxy.split(':');
  const resp = await axios.get(testUrl, {
    proxy: { host, port: parseInt(port), protocol: 'http' },
    timeout: 8000,                    // 8 秒超时
    maxRedirects: 0,                  // 不跟随重定向（3xx = 隧道失败）
    validateStatus: s => s >= 200 && s < 300,  // 仅 2xx 视为可用
  });
  return resp.status >= 200 && resp.status < 300;
}</code></pre>

<h4>验证策略</h4>
<table>
  <tr><th>策略</th><th>说明</th></tr>
  <tr><td>目标站验证</td><td>各爬虫传入各自的目标站 URL（智联用 zhaopin.com，51job 用 51job.com）</td></tr>
  <tr><td>仅 2xx 通过</td><td>3xx（重定向到登录/验证页）、4xx（禁止访问）、5xx（服务端错误）均视为不可用</td></tr>
  <tr><td>禁止重定向</td><td><code>maxRedirects: 0</code>，代理返回 3xx 说明隧道建立失败或目标站拒绝</td></tr>
  <tr><td>8 秒超时</td><td>超时/连接拒绝/DNS 失败/CONNECT 失败 → 均视为不可用</td></tr>
  <tr><td>最多 3 次尝试</td><td>获取代理后最多 3 次尝试找到可用代理，全部失败则降级直连</td></tr>
</table>

<h3>三、智联招聘：浏览器级代理</h3>
<p>智联使用 Puppeteer <strong>浏览器级代理</strong>，所有页面请求（包括 WebSocket、资源加载）均经过代理：</p>

<ol>
  <li><strong>启动前验证</strong>：从代理池获取代理 → 验证可用性（访问 zhaopin.com）→ 不可用则删除并重试（最多 3 次）</li>
  <li><strong>浏览器注入</strong>：通过 <code>--proxy-server=http://ip:port</code> 参数传递给 Chromium</li>
  <li><strong>隧道失败检测</strong>：监听浏览器错误事件，识别 <code>ERR_TUNNEL_CONNECTION_FAILED</code> / <code>ERR_PROXY_CONNECTION_FAILED</code> 等代理相关错误</li>
  <li><strong>自动切换</strong>：检测到隧道失败 → 删除死代理 → 从池中取新代理 → 重启浏览器（携带断点）</li>
  <li><strong>切换上限</strong>：<code>maxProxySwitchesPerTask</code> 限制单任务最大换代理次数，防止无限重启</li>
  <li><strong>降级直连</strong>：代理池耗尽或切换次数达上限 → 自动回退到浏览器直连模式</li>
</ol>

<h3>四、51job：axios 回退路径代理</h3>
<p>51job 使用不同的代理策略，因为<strong>免费代理 100% 触发 Aliyun WAF</strong>：</p>
<ul>
  <li><strong>浏览器不设代理</strong>：Puppeteer 浏览器直连，避免代理触发 WAF</li>
  <li><strong>axios 详情页代理</strong>：仅用于非浏览器请求路径（已废弃，因直连返回 JS 混淆密文，代理返回 404）</li>
  <li><strong>死代理黑名单</strong>：<code>deadProxyCache: Set&lt;string&gt;</code>，404/ECONNRESET/ETIMEDOUT/响应 &lt; 1KB 的代理自动加入</li>
  <li><strong>连续失败保护</strong>：连续 5 次失败停止返回代理</li>
</ul>

<h3>五、代理池配置</h3>

<h4>配置常量 (zhilian.ts / job51.ts)</h4>
<table>
  <tr><th>配置项</th><th>默认值</th><th>说明</th></tr>
  <tr><td><code>enabled</code></td><td><code>true</code></td><td>是否启用代理池</td></tr>
  <tr><td><code>poolUrl</code></td><td><code>http://127.0.0.1:5010</code></td><td>proxy_pool 服务地址</td></tr>
  <tr><td><code>maxProxySwitchesPerTask</code></td><td><code>3</code></td><td>单任务最大换代理次数</td></tr>
  <tr><td><code>healthCheckTimeout</code></td><td><code>8000ms</code></td><td>健康检查超时时间</td></tr>
</table>

<h4>部署 proxy_pool 服务</h4>
<pre><code># 克隆并启动代理池服务
git clone https://github.com/jhao104/proxy_pool.git
cd proxy_pool
docker-compose up -d         # Docker 部署
# 或
pip install -r requirements.txt && python run.py  # 手动部署

# 验证服务可用
curl http://127.0.0.1:5010/count
# → {"count": 15}</code></pre>

<h3>六、完整工作流</h3>
<pre><code>爬虫任务启动
        ↓
检查 PROXY_POOL_CONFIG.enabled
        ↓
  ┌─ 禁用 → 浏览器直连模式
  └─ 启用 → proxyPool.getCount() → 检查代理池数量
              ↓
        ┌─ 为空 → 降级直连
        └─ 有代理 → getProxy() → checkHealth(targetUrl)
                      ↓
                ┌─ 不可用 → deleteProxy() → 重试（最多 3 次）
                │              └─ 全部不可用 → 降级直连
                └─ 可用 → 设置 currentProxy → 浏览器 --proxy-server
                            ↓
                      爬取过程中监听错误事件
                            ↓
                ┌─ ERR_TUNNEL_CONNECTION_FAILED 触发
                │   → deleteProxy(deadProxy)
                │   → proxySwitchCount++
                │   → getProxy() + checkHealth()
                │   → 新代理可用 → 重启浏览器（携带断点坐标）
                │   → 新代理不可用 → 降级直连
                │   → 切换次数超限 → 降级直连
                └─ 正常完成 → 保持代理直到浏览器主动重启</code></pre>

<h3>七、容错与降级策略</h3>
<table>
  <tr><th>场景</th><th>策略</th><th>恢复方式</th></tr>
  <tr><td>代理池服务不可达</td><td>跳过代理，浏览器直连</td><td>任务结束后自动重试</td></tr>
  <tr><td>代理池为空</td><td>降级直连</td><td>等待代理池补充，下次任务可用</td></tr>
  <tr><td>连续 5 次获取代理失败</td><td><code>isAvailable()</code> 返回 false</td><td>调用 <code>resetFailures()</code> 手动重置</td></tr>
  <tr><td>隧道连接失败</td><td>自动切换代理 + 浏览器重启</td><td>切换上限内自动恢复</td></tr>
  <tr><td>所有代理不可用</td><td>降级直连模式</td><td>依赖浏览器自身的反爬能力</td></tr>
  <tr><td>代理速度过慢</td><td>8 秒超时自动淘汰</td><td>代理池自动补充新代理</td></tr>
</table>

<h3>八、两个平台代理策略对比</h3>
<table>
  <tr><th>维度</th><th>智联招聘</th><th>前程无忧 (51job)</th></tr>
  <tr><td>代理层级</td><td>浏览器级（--proxy-server）</td><td>axios 回退路径（浏览器直连）</td></tr>
  <tr><td>代理原因</td><td>WAF 封 IP，浏览器所有流量需代理</td><td>浏览器直连已够用，仅备用路径使用</td></tr>
  <tr><td>健康检查目标</td><td>zhaopin.com</td><td>51job.com</td></tr>
  <tr><td>死代理检测</td><td>ERR_TUNNEL_CONNECTION_FAILED</td><td>404 + ECONNRESET + ETIMEDOUT</td></tr>
  <tr><td>黑名单方式</td><td>实时 deleteProxy()</td><td>deadProxyCache Set + 连续失败计数</td></tr>
  <tr><td>切换上限</td><td>maxProxySwitchesPerTask</td><td>连续 5 次失败停止返回</td></tr>
  <tr><td>降级策略</td><td>直连模式（无代理浏览器）</td><td>axios 直连（可能触发 WAF）</td></tr>
</table>

<h3>九、扩展付费代理</h3>
<p>当前代理池默认使用 11 个免费代理源，代理质量低、可用率不到 5%。<strong>接入付费代理只需两步</strong>：</p>

<h4>第一步：在 <code>fetcher/proxyFetcher.py</code> 中添加方法</h4>
<pre><code># 示例 1：付费代理 API（token 鉴权）
@staticmethod
def paidProxy01():
    import requests
    resp = requests.get(
        "https://付费代理API地址/get_proxies",
        params={"token": "your_api_key"}
    )
    for item in resp.json():
        yield f"{item['host']}:{item['port']}"

# 示例 2：白名单 IP 提取（本地出口 IP 已在代理平台加入白名单）
@staticmethod
def paidProxy02():
    import requests
    # 付费代理平台通常提供一个固定 URL，每次返回不同 IP
    resp = requests.get("https://proxy-provider.com/dynamic-ip")
    # 返回格式可能是纯文本 ip:port 或 JSON
    yield resp.text.strip()</code></pre>

<h4>第二步：在 <code>setting.py</code> 注册</h4>
<pre><code>PROXY_FETCHER = [
    "freeProxy01",   # 站大爷
    "freeProxy02",   # 66代理
    # ... 原有 11 个免费源 ...
    "freeProxy11",   # 稻壳代理
    "paidProxy01",   # ← 新增付费源
    "paidProxy02",   # ← 新增付费源
]</code></pre>

<h4>关键要点</h4>
<table>
  <tr><th>要点</th><th>说明</th></tr>
  <tr><td>方法签名</td><td>必须是 <code>@staticmethod</code></td></tr>
  <tr><td>返回格式</td><td>必须用 <code>yield</code> 逐个返回 <code>host:port</code> 字符串</td></tr>
  <tr><td>命名</td><td>不能和已有 11 个方法重名</td></tr>
  <tr><td>注册</td><td><code>PROXY_FETCHER</code> 列表中的名字必须与方法名一致</td></tr>
  <tr><td>生效</td><td><code>schedule</code> 进程下次定时抓取时自动识别新方法</td></tr>
</table>

<h4>常用付费代理平台接入示例</h4>
<table>
  <tr><th>平台</th><th>API 方式</th><th>特点</th></tr>
  <tr><td>快代理 (私密代理)</td><td><code>GET /api/getproxy?secret_id=xx&num=10</code></td><td>高质量独享，支持白名单</td></tr>
  <tr><td>芝麻代理</td><td><code>GET /api/getip?appKey=xx&num=10</code></td><td>每次返回 JSON 含 expire 过期时间</td></tr>
  <tr><td>站大爷 (付费版)</td><td><code>GET /api/getip?api_key=xx&count=10</code></td><td>与免费源同一平台，付费质量更好</td></tr>
  <tr><td>Bright Data (国际)</td><td>REST API + Zone 管理</td><td>企业级，住宅 IP，覆盖全球</td></tr>
</table>

<p>接入付费代理后，<code>checkHealth()</code> 的实时验证依然有效——付费代理不会 100% 可用，健康检查保证只使用当前可连通的代理。</p>

<h3>十、常见问答</h3>

<h4>Q1: <code>/count</code> 返回的是可用代理数量吗？</h4>
<p><strong>不是。</strong><code>/count</code> 返回代理池 Redis 中<strong>已入库的全部代理总数</strong>（<code>{"total": 150, "https": 45}</code>），而不是实时可用的代理数量。</p>
<ul>
  <li>代理入库时经过一次验证，但验证是<strong>周期性</strong>的（非实时），从上次验证到当前期间代理可能已失效</li>
  <li>已入库的代理并不保证此刻 100% 可用——定时验证任务会扣分淘汰失效代理，但存在时间窗口</li>
  <li><strong>注</strong>：<code>getCount()</code> 早期版本曾错误地解析 <code>count</code> 字段（实际 API 返回 <code>total</code>），导致始终返回 0，已修复为正确解析 <code>total</code> 并兼容多种格式</li>
</ul>

<h4>Q2: <code>/get/</code> 返回的是可用代理吗？</h4>
<p><strong>不完全保证。</strong><code>/get/</code> 只返回 score 高于阈值的代理（已过滤掉多次验证失败的低分代理），但不保证当前时刻 100% 可用。</p>
<ul>
  <li>代理池按 score 评分机制维护：初始高分 → 验证失败扣分 → 低于阈值被排除</li>
  <li>但验证是周期性的，从上次验证到当前期间代理可能已失效</li>
  <li><strong>本项目的做法是正确的</strong>：<code>getProxy()</code> 之后立即调用 <code>checkHealth()</code> 做实时验证，不可用就 <code>deleteProxy()</code> 删除并换下一个，最多重试 3 次</li>
</ul>

<h4>Q3: <code>checkHealth()</code> 验证通过后就一定可用吗？</h4>
<p><strong>不能保证 100%。</strong><code>checkHealth()</code> 只能证明<strong>那一瞬间</strong>代理可用，实际爬取中仍可能因以下原因失败：</p>
<table>
  <tr><th>原因</th><th>说明</th></tr>
  <tr><td>时间窗口</td><td>健康检查通过后的几秒内，免费代理可能突然失效（极不稳定）</td></tr>
  <tr><td>协议差异</td><td>checkHealth 用 axios 发普通 GET，Puppeteer 走 HTTP CONNECT 隧道——代理能转发简单请求，不代表能承载浏览器 HTTPS + WebSocket 流量</td></tr>
  <tr><td>目标 URL 不同</td><td>健康检查只测首页（zhaopin.com），爬虫实际访问搜索 API、详情页等不同端点，代理 IP 可能已被具体接口封禁</td></tr>
  <tr><td>负载差异</td><td>单个 axios 请求 vs 浏览器多并发（页面资源、XHR、WebSocket），代理轻载通过、重载超时</td></tr>
</table>
<p>这是一个<strong>实用的分层防御</strong>，而非追求单点完美：</p>
<pre><code>checkHealth 通过 → 浏览器启动 → 爬取中 ERR_TUNNEL_CONNECTION_FAILED
                                    → deleteProxy → 换新代理 → 重启浏览器</code></pre>
<p><code>checkHealth()</code> 做快速初筛淘汰明显死代理，后续浏览器隧道失败时触发二次切换，形成多层保障。</p>

<h4>Q4: proxy_pool 日志中大量 <code>fail</code> 和 <code>pass</code> 是什么意思？</h4>
<p>这些是 jhao104/proxy_pool 内部的<strong>代理验证日志</strong>，来自 <code>check.py</code> 的 <code>RawProxyCheck</code> 多线程验证流程：</p>
<table>
  <tr><th>日志关键词</th><th>含义</th></tr>
  <tr><td><code>IP:PORT fail</code></td><td>代理验证失败（超时/拒绝连接/无响应），<strong>丢弃不入库</strong></td></tr>
  <tr><td><code>IP:PORT pass</code></td><td>代理验证通过，<strong>正式入库</strong>可供 <code>/get/</code> 获取</td></tr>
  <tr><td><code>IP:PORT exist</code></td><td>代理已存在于池中，<strong>跳过重复添加</strong></td></tr>
  <tr><td><code>Expecting value: ... (char 0)</code></td><td>验证目标 URL 返回空响应或非 JSON，JSON 解析失败</td></tr>
</table>
<p>实际观察中，<strong>免费代理的存活率极低</strong>——一批 20+ 个代理通常只有 1 个能通过验证（通过率不到 5%），绝大多数被发现时已经失效（端口关闭、IP 被回收、目标站封禁）。这恰恰解释了为什么本项目的 <code>checkHealth()</code> 二次验证至关重要——proxy_pool 的 <code>pass</code> 只证明代理能访问通用测试 URL，不代表能稳定连接我们的目标站。</p>

<h4>Q5: 爬虫从代理池获取的"代理"具体是什么？</h4>
<p>就是一个 <strong><code>IP:端口</code></strong> 字符串，代表一个 HTTP 正向代理服务器地址。</p>
<p><strong>数据结构</strong>（<code>ProxyInfo</code> 接口）：</p>
<pre><code>{
  proxy: "39.102.208.189:8081",  // IP:端口 — 核心内容
  type: "http",                   // 代理协议类型
  source: "freeProxy01",          // 来源（哪个免费代理源抓取的）
  score: 7,                       // 质量评分（高分优先）
  https: false                    // 是否支持 HTTPS CONNECT 隧道
}</code></pre>
<p><strong>使用方式</strong>：</p>
<table>
  <tr><th>场景</th><th>格式化方式</th><th>示例</th></tr>
  <tr><td>Puppeteer 浏览器</td><td><code>--proxy-server=http://ip:port</code></td><td><code>--proxy-server=http://39.102.208.189:8081</code></td></tr>
  <tr><td>axios HTTP 请求</td><td><code>{ host, port, protocol }</code></td><td><code>{ host: "39.102.208.189", port: 8081 }</code></td></tr>
</table>
<p>本质是<strong>一个中间人</strong>——你的流量先走到这个 IP:端口，再由它转发到目标站，目标站看到的来源 IP 是代理 IP 而非你的真实 IP。</p>

<h4>Q6: 11 个免费代理源具体是怎么定义的？</h4>
<p>代理源定义在 <code>d:/proxy_pool/fetcher/proxyFetcher.py</code>，注册在 <code>d:/proxy_pool/setting.py</code> 的 <code>PROXY_FETCHER</code> 列表中：</p>
<table>
  <tr><th>注册名</th><th>来源网站</th><th>抓取方式</th><th>特点</th></tr>
  <tr><td><code>freeProxy01</code></td><td>站大爷 zdaye.com</td><td>xpath 解析表格</td><td>只采 5 分钟内的更新</td></tr>
  <tr><td><code>freeProxy02</code></td><td>66代理 66ip.cn</td><td>xpath 解析第 3 个 table</td><td>结构简单</td></tr>
  <tr><td><code>freeProxy03</code></td><td>开心代理 kxdaili.com</td><td>xpath 解析表格</td><td>固定两个 URL</td></tr>
  <tr><td><code>freeProxy04</code></td><td>FreeProxyList freeproxylists.net</td><td>URL 解码 + 正则</td><td>IP 被 JS 编码，需先解码</td></tr>
  <tr><td><code>freeProxy05</code></td><td>快代理 kuaidaili.com</td><td>xpath 遍历两分类多页</td><td>必须 sleep 1s 防封</td></tr>
  <tr><td><code>freeProxy06</code></td><td>冰凌代理 binglx.cn</td><td>xpath 解析表格</td><td>更新最快（★★★）</td></tr>
  <tr><td><code>freeProxy07</code></td><td>云代理 ip3366.net</td><td>正则提取</td><td>两个页面（国内/国外）</td></tr>
  <tr><td><code>freeProxy08</code></td><td>小幻代理 ip.ihuan.me</td><td>正则提取</td><td>中文页面</td></tr>
  <tr><td><code>freeProxy09</code></td><td>免费代理库 ip.jiangxianli.com</td><td>xpath 遍历分页</td><td>更新较慢（☆）</td></tr>
  <tr><td><code>freeProxy10</code></td><td>89免费代理 89ip.cn</td><td>正则跨行匹配</td><td>更新较慢（☆）</td></tr>
  <tr><td><code>freeProxy11</code></td><td>稻壳代理 docip.net</td><td><strong>JSON API</strong></td><td>可用率最高（★★★）唯一 API 源</td></tr>
</table>
<p>注册配置（<code>setting.py</code>）：</p>
<pre><code>PROXY_FETCHER = [
    "freeProxy01", "freeProxy02", "freeProxy03", "freeProxy04",
    "freeProxy05", "freeProxy06", "freeProxy07", "freeProxy08",
    "freeProxy09", "freeProxy10", "freeProxy11"
]</code></pre>
<p><strong>注意</strong>：proxy_pool 默认验证目标站是 <code>httpbin.org</code> 和 <code>qq.com</code>，不是我们的 zhaopin.com / 51job.com，这也是为什么本项目的 <code>checkHealth()</code> 二次验证必须存在。</p>

<h4>Q7: 以站大爷为例，代理从源头到浏览器使用的完整链路是怎样的？</h4>
<p>以 <code>freeProxy01</code>（站大爷）为例，它<strong>不是通过付费 API</strong> 而是直接<strong>爬取论坛 HTML 页面</strong>获取代理：</p>
<pre><code># d:/proxy_pool/fetcher/proxyFetcher.py 第 28-47 行
@staticmethod
def freeProxy01():
    # 1. 先访问站大爷首页，找最新帖子链接
    start_url = "https://www.zdaye.com/dayProxy.html"
    html_tree = WebRequest().get(start_url, verify=False).tree

    # 2. 只处理 5 分钟内的新帖
    latest_page_time = html_tree.xpath("//span[@class='thread_time_info']/text()")[0]
    if interval.seconds &lt; 300:
        # 3. 进入帖子详情页，解析 IP 表格
        target_url = "https://www.zdaye.com/" + html_tree.xpath("//h3/a/@href")[0]
        while target_url:
            _tree = WebRequest().get(target_url, verify=False).tree
            for tr in _tree.xpath("//table//tr"):
                ip   = tr.xpath("./td[1]/text()")   # 第 1 列 → IP
                port = tr.xpath("./td[2]/text()")   # 第 2 列 → 端口
                yield "%s:%s" % (ip, port)
            # 4. 翻页继续
            next_page = _tree.xpath("//div[@class='page']/a[@title='下一页']/@href")
            target_url = next_page[0] if next_page else False
            sleep(5)</code></pre>
<p><strong>完整数据流（7 层链路）：</strong></p>
<pre><code>┌──────────────────────────────────────────────────────────────────┐
│ 1. 站大爷论坛 (zdaye.com/dayProxy.html)                           │
│    网友手动发帖分享公开代理 IP 表格                                 │
└────────────────────────┬─────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────────┐
│ 2. freeProxy01() 爬取 HTML                                        │
│    xpath 解析 &lt;table&gt; → 逐行提取 IP:端口 → yield "ip:port"        │
│    翻页间隔 sleep(5) 防止被 ban                                    │
└────────────────────────┬─────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────────┐
│ 3. RawProxyCheck 多线程验证 (proxy_pool 内部)                      │
│    访问 httpbin.org / qq.com 测试连通性                            │
│    pass → 存入 Redis    fail → 丢弃                               │
└────────────────────────┬─────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────────┐
│ 4. Redis (127.0.0.1:6379)                                         │
│    存储格式: use_proxy hash table                                  │
│    key: "39.102.208.189:8081"  value: {"score": 7, "https": false}│
└────────────────────────┬─────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────────┐
│ 5. GET /get/ API (proxy_pool :5010)                               │
│    随机返回一个 score > 0 的代理                                   │
│    Response: { "proxy": "39.102.208.189:8081", "type": "http" }   │
└────────────────────────┬─────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────────┐
│ 6. 本项目 ProxyPool.getProxy() + checkHealth(zhaopin.com)         │
│    获取后立即实时验证目标站可用性                                   │
│    通过 → 设为 currentProxy                                        │
│    失败 → deleteProxy() → 换下一个（最多 3 次）                    │
└────────────────────────┬─────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────────┐
│ 7. Puppeteer 浏览器使用代理                                       │
│    --proxy-server=http://39.102.208.189:8081                       │
│    目标站看到的来源 IP = 39.102.208.189（非本机 IP）               │
└──────────────────────────────────────────────────────────────────┘</code></pre>
<p><strong>核心问题</strong>：站大爷的代理本质是<strong>网友公开分享的免费 IP</strong>，不是付费 API 的结构化数据。一个 IP 被帖子公开后，全世界爬虫都会用，几分钟内就失效。如果要接入站大爷的付费 API（如 <code>http://open.zdaye.com/ShortProxy/GetIP/</code>），需参照"扩展付费代理"章节新增一个 <code>@staticmethod</code> 方法。</p>

<h4>Q8: Redis 在本系统中起什么作用？</h4>
<p>Redis 在本系统中<strong>只有一个用途</strong>：作为 <strong>IP 代理池（jhao104/proxy_pool）的后端存储数据库</strong>。</p>
<h5>架构关系</h5>
<pre><code>Node.js 爬虫 (zhilian.ts / job51.ts)
    → HTTP GET http://127.0.0.1:5010/get/
    → proxy_pool Python 项目 (API 端口 5010)
    → Redis (端口 6379，密码 pwd)</code></pre>
<ul>
  <li><strong>Redis</strong> 存储代理池采集到的 IP 列表、可用性评分（score）、历史状态等数据</li>
  <li><strong>proxy_pool</strong>（<a href="https://github.com/jhao104/proxy_pool" target="_blank">jhao104/proxy_pool</a>）是独立的 Python 项目，负责采集/验证/调度代理，以 Redis 作为数据库</li>
  <li><strong>Node.js 后端不直接连接 Redis</strong>，它通过 HTTP API（<code>127.0.0.1:5010</code>）从代理池获取代理</li>
</ul>
<h5>Redis 存储格式</h5>
<p>代理数据以 <strong>Hash 表</strong> 形式存储在 Redis 中：</p>
<pre><code># Redis key: use_proxy
# Field: "39.102.208.189:8081"  → Value: {"score": 7, "https": false}
# Field: "117.68.54.22:3128"    → Value: {"score": 5, "https": false}</code></pre>
<h5>验证流程中的位置</h5>
<pre><code>freeProxy 采集 → RawProxyCheck 多线程验证 → pass → 存入 Redis
                                                      ↓
                                              GET /get/ API (:5010)
                                                      ↓
                                              本项目 ProxyPool.getProxy()
                                                      ↓
                                              checkHealth() 二次实时验证
                                                      ↓
                                              浏览器 --proxy-server=...</code></pre>
<h5>Redis 启动方式</h5>
<p>Redis 在启动脚本中自动启动：</p>
<p><strong>Windows</strong>（<code>start-dev.bat</code>）：</p>
<pre><code>start "Redis-Server" /MIN "C:\Program Files\Redis\redis-server.exe" "C:\Program Files\Redis\redis.windows.conf"</code></pre>
<p><strong>Linux</strong>（<code>start-dev.sh</code>）：</p>
<pre><code># 方式一：使用系统服务
sudo systemctl start redis

# 方式二：手动启动
redis-server --daemonize yes</code></pre>
<p>配置文件（Windows: <code>redis.windows.conf</code>，Linux: <code>/etc/redis/redis.conf</code>）中设定了密码 <code>requirepass pwd</code>。</p>
<h5>如果 Redis 不可用</h5>
<ul>
  <li>代理池 API（端口 5010）无法启动 → <code>ProxyPool.isAvailable()</code> 返回 <code>false</code></li>
  <li>爬虫自动降级为<strong>直连模式</strong>（<code>PROXY_POOL_CONFIG.enabled = false</code>），不经过代理直接访问目标站</li>
  <li>不会导致爬虫崩溃，但缺少 IP 轮换能力后更容易触发目标站的反爬封禁</li>
</ul>
<p><strong>总结</strong>：Redis 在本系统中不是通用缓存层，而是代理池的专属存储引擎。即使 Redis 挂了，系统核心功能（认证、数据采集、AI 增强等）仍可正常运行，只是失去 IP 代理轮换能力。</p>`
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
│  sp_tasks │ sp_csv_files │ sp_job_enrichments │ sp_market_reports │
│  sp_llm_config │ sp_saved_queries │ sp_job_embeddings             │
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
    title: '任务管理 API（12 个端点）',
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
  <tr><td>GET</td><td><code>/stats</code></td><td>全库任务统计（total/running/completed/records）</td></tr>
</table>`
  },
  'api-files': {
    title: '文件管理 API（8 个端点）',
    content: `<p><strong>Base:</strong> <code>/api/files</code></p>
<table>
  <tr><th>方法</th><th>路径</th><th>说明</th></tr>
  <tr><td>GET</td><td><code>/</code></td><td>文件列表（分页/来源/关键词/任务ID筛选）<br/>Query: <code>?keyword=&source=&taskId=&page=&pageSize=</code></td></tr>
  <tr><td>GET</td><td><code>/:id</code></td><td>文件详情</td></tr>
  <tr><td>GET</td><td><code>/:id/analyze</code></td><td>深度分析（Excel 解析 + 统计）</td></tr>
  <tr><td>GET</td><td><code>/:id/preview</code></td><td>预览前 N 条数据（Query: <code>?limit=10</code>）</td></tr>
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
  'api-dashboard': {
    title: '数据看板 API（2 个端点）',
    content: `<p>汇总全库数据提供看板统计，不依赖单文件查询。</p>
<table>
  <tr><th>方法</th><th>路径</th><th>说明</th></tr>
  <tr><td>GET</td><td><code>/api/dashboard/overview</code></td><td>全库概览统计（总职位/任务/企业/薪资 + 6 维度分布 + 技能词云）</td></tr>
  <tr><td>GET</td><td><code>/api/regions/stats?dim=city</code></td><td>黑龙江省区域分布统计<br/>dim: city | district | salary | education<br/>返回地图数据 + 明细柱状图数据</td></tr>
</table>

<h4>/api/dashboard/overview 响应结构</h4>
<pre><code>{
  summary: { totalJobs, totalTasks, totalCompanies, avgSalary, maxSalary, minSalary },
  salaryDistribution: [{ range, count }],
  cityDistribution: [{ name, count }],
  educationDistribution: [{ name, count }],
  experienceDistribution: [{ name, count }],
  industryDistribution: [{ name, count, avgSalary }],
  categoryDistribution: [{ name, count }],
  topSkills: [{ name, count }],
  workModeDistribution: [{ name, count }]
}</code></pre>`
  },

  'api-rag': {
    title: 'RAG 知识库 API（5 个端点）',
    content: `<p><strong>Base:</strong> <code>/api/rag</code></p>
<table>
  <tr><th>方法</th><th>路径</th><th>说明</th></tr>
  <tr><td>POST</td><td><code>/index/:taskId</code></td><td>异步索引任务数据到向量库（WebSocket 推送进度）</td></tr>
  <tr><td>POST</td><td><code>/index/:taskId/sync</code></td><td>同步索引，直接返回结果（调试用）</td></tr>
	  <tr><td>DELETE</td><td><code>/index/:taskId</code></td><td>删除任务索引（清理向量数据）</td></tr>
  <tr><td>POST</td><td><code>/search</code></td><td>语义搜索<br/>Body: <code>{ query, taskId?, limit?, minSimilarity? }</code></td></tr>
  <tr><td>GET</td><td><code>/stats</code></td><td>查询向量库统计（按任务统计 + 总览）</td></tr>
</table>

<h4>搜索请求示例</h4>
<pre><code>POST /api/rag/search
{
  "query": "Java后端开发高级工程师",
  "taskId": "938a0a93...",
  "limit": 10,
  "minSimilarity": 0.3
}</code></pre>

<h4>搜索响应字段</h4>
<table>
  <tr><td>jobName</td><td>职位名称（来自 Excel）</td></tr>
  <tr><td>companyName</td><td>企业名称（来自 Excel）</td></tr>
  <tr><td>workCity</td><td>工作城市（来自 Excel）</td></tr>
  <tr><td>jobCategoryL1/L2</td><td>职位分类（来自增强）</td></tr>
  <tr><td>companyIndustry</td><td>公司行业（来自增强）</td></tr>
  <tr><td>salaryMonthlyMin/Max</td><td>月薪范围（来自增强）</td></tr>
  <tr><td>keySkills</td><td>关键技能（来自增强）</td></tr>
  <tr><td>similarity</td><td>余弦相似度 (0-1)</td></tr>
</table>`
  },
  'api-llm': {
    title: 'AI 服务 API（18 个端点）',
    content: `<p><strong>Base:</strong> <code>/api/llm</code></p>

<h4>LLM 配置管理</h4>
<table>
  <tr><td>GET</td><td><code>/config</code></td><td>配置列表（Key 脱敏）</td></tr>
  <tr><td>POST</td><td><code>/config</code></td><td>保存配置（自动加密 Key）</td></tr>
  <tr><td>DELETE</td><td><code>/config/:id</code></td><td>删除配置</td></tr>
  <tr><td>GET</td><td><code>/health</code></td><td>健康检查（models + latency）</td></tr>
  <tr><td>POST</td><td><code>/test</code></td><td>测试 LLM 调用</td></tr>
	  <tr><td>GET</td><td><code>/models/:provider</code></td><td>查询提供商可用模型列表</td></tr>
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
    title: '认证 API（7 个端点）',
    content: `<p><strong>Base:</strong> <code>/api/auth</code></p>
<table>
  <tr><th>方法</th><th>路径</th><th>说明</th></tr>
  <tr><td>GET</td><td><code>/authorize-url</code></td><td>获取 OAuth2 授权 URL</td></tr>
  <tr><td>GET</td><td><code>/callback</code></td><td>OAuth2 回调（交换 Token + 设置 Cookie）</td></tr>
  <tr><td>POST</td><td><code>/refresh-token</code></td><td>刷新 Access Token</td></tr>
  <tr><td>GET</td><td><code>/user-info</code></td><td>当前用户信息</td></tr>
  <tr><td>POST</td><td><code>/validate-token</code></td><td>验证 Token 有效性</td></tr>
  <tr><td>POST</td><td><code>/logout</code></td><td>登出（获取 logoutTicket + 清除 Cookie）</td></tr>
	  <tr><td>POST</td><td><code>/local-login</code></td><td>本地账号密码登录（系统管理用户）</td></tr>
</table>`
  },


  'api-system': {
    title: '系统管理 API（23 个端点）',
    content: `<p>RBAC 权限管理体系，包含用户、角色、权限、菜单四组 CRUD。</p>

<h4>用户管理 — <code>/api/users</code></h4>
<table>
  <tr><th>方法</th><th>路径</th><th>说明</th></tr>
  <tr><td>GET</td><td><code>/</code></td><td>用户列表（分页+搜索）</td></tr>
  <tr><td>GET</td><td><code>/:id</code></td><td>用户详情（含角色列表）</td></tr>
  <tr><td>POST</td><td><code>/</code></td><td>创建用户（密码 bcrypt 加密）</td></tr>
  <tr><td>PUT</td><td><code>/:id</code></td><td>更新用户</td></tr>
  <tr><td>DELETE</td><td><code>/:id</code></td><td>删除用户</td></tr>
  <tr><td>PUT</td><td><code>/:id/roles</code></td><td>更新用户角色关联</td></tr>
</table>

<h4>角色管理 — <code>/api/roles</code></h4>
<table>
  <tr><th>方法</th><th>路径</th><th>说明</th></tr>
  <tr><td>GET</td><td><code>/</code></td><td>角色列表（分页+搜索）</td></tr>
  <tr><td>GET</td><td><code>/all</code></td><td>全部角色（下拉选择用）</td></tr>
  <tr><td>GET</td><td><code>/:id</code></td><td>角色详情（含权限/菜单ID列表）</td></tr>
  <tr><td>POST</td><td><code>/</code></td><td>创建角色</td></tr>
  <tr><td>PUT</td><td><code>/:id</code></td><td>更新角色（含权限/菜单关联）</td></tr>
  <tr><td>DELETE</td><td><code>/:id</code></td><td>删除角色</td></tr>
</table>

<h4>权限管理 — <code>/api/permissions</code></h4>
<table>
  <tr><th>方法</th><th>路径</th><th>说明</th></tr>
  <tr><td>GET</td><td><code>/</code></td><td>权限列表（分页+搜索）</td></tr>
  <tr><td>GET</td><td><code>/all</code></td><td>全部权限（按 resource 分组返回）</td></tr>
  <tr><td>GET</td><td><code>/:id</code></td><td>权限详情</td></tr>
  <tr><td>POST</td><td><code>/</code></td><td>创建权限</td></tr>
  <tr><td>PUT</td><td><code>/:id</code></td><td>更新权限</td></tr>
  <tr><td>DELETE</td><td><code>/:id</code></td><td>删除权限</td></tr>
</table>

<h4>菜单管理 — <code>/api/menus</code></h4>
<table>
  <tr><th>方法</th><th>路径</th><th>说明</th></tr>
  <tr><td>GET</td><td><code>/</code></td><td>菜单列表（平铺表格展示）</td></tr>
  <tr><td>GET</td><td><code>/tree</code></td><td>菜单树（嵌套结构，用于前端渲染）</td></tr>
  <tr><td>GET</td><td><code>/:id</code></td><td>菜单详情</td></tr>
  <tr><td>POST</td><td><code>/</code></td><td>创建菜单</td></tr>
  <tr><td>PUT</td><td><code>/:id</code></td><td>更新菜单</td></tr>
  <tr><td>DELETE</td><td><code>/:id</code></td><td>删除菜单（有子菜单时禁止）</td></tr>
</table>`
  },
  // ========== 数据库 ==========
  database: {
    title: '数据库表结构',
    content: `<p>Schema: <code>liangwenqing</code>，共 <strong>23 张表</strong>（15 张业务表 + 5 张 RBAC 表 + 3 张关联表）。时区: <code>Asia/Shanghai</code>。

<h3>sp_tasks — 爬虫任务</h3>
<table>
  <tr><th>字段</th><th>类型</th><th>说明</th></tr>
  <tr><td>id</td><td>VARCHAR(255) PK</td><td>UUID</td></tr>
  <tr><td>name</td><td>VARCHAR(500)</td><td>任务名称</td></tr>
  <tr><td>source</td><td>VARCHAR(50)</td><td>zhilian / 51job / all</td></tr>
  <tr><td>config</td><td>JSONB</td><td>关键词/城市/企业/页数</td></tr>
  <tr><td>status</td><td>VARCHAR(20)</td><td>pending→running→completed/failed</td></tr>
  <tr><td>record_count</td><td>INTEGER</td><td>采集记录数</td></tr>
</table>

<h3>sp_jobs — 原始职位数据</h3>
<table>
  <tr><th>字段</th><th>类型</th><th>说明</th></tr>
  <tr><td>id</td><td>VARCHAR(255) PK</td><td>UUID</td></tr>
  <tr><td>task_id</td><td>VARCHAR(255) FK</td><td>关联任务</td></tr>
  <tr><td>job_id</td><td>VARCHAR(255)</td><td>职位 ID（平台原始 ID）</td></tr>
  <tr><td>data_source</td><td>VARCHAR(50)</td><td>zhilian / 51job</td></tr>
  <tr><td>company_name</td><td>VARCHAR(500)</td><td>企业名称</td></tr>
  <tr><td>job_name</td><td>VARCHAR(500)</td><td>职位名称</td></tr>
  <tr><td>work_city</td><td>VARCHAR(100)</td><td>工作城市</td></tr>
  <tr><td>salary_range</td><td>VARCHAR(100)</td><td>原始薪资文本</td></tr>
  <tr><td>education</td><td>VARCHAR(50)</td><td>原始学历要求</td></tr>
  <tr><td>work_experience</td><td>VARCHAR(100)</td><td>原始经验要求</td></tr>
  <tr><td>job_category</td><td>VARCHAR(200)</td><td>原始职位分类</td></tr>
  <tr><td>raw_data</td><td>JSONB</td><td>完整原始数据（含职位描述/标签/福利等）</td></tr>
  <tr><td>UNIQUE</td><td>(task_id, job_id)</td><td>任务+职位唯一去重</td></tr>
</table>

<h3>sp_csv_files — 导出文件</h3>
<table>
  <tr><td>id</td><td>VARCHAR(255) PK</td><td>UUID</td></tr>
  <tr><td>task_id</td><td>VARCHAR(255) FK</td><td>关联任务</td></tr>
  <tr><td>filepath</td><td>TEXT</td><td>文件路径</td></tr>
  <tr><td>record_count</td><td>INTEGER</td><td>记录数</td></tr>
</table>

<h3>sp_job_enrichments — AI 增强结果</h3>
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

<h3>sp_market_reports — AI 洞察报告</h3>
<table>
  <tr><td>file_id</td><td>VARCHAR(255) FK</td><td>关联文件</td></tr>
  <tr><td>title</td><td>VARCHAR(500)</td><td>报告标题</td></tr>
  <tr><td>content</td><td>TEXT</td><td>Markdown 正文</td></tr>
  <tr><td>summary</td><td>TEXT</td><td>摘要</td></tr>
  <tr><td>charts_config</td><td>JSONB</td><td>ECharts 图表配置</td></tr>
</table>

<h3>sp_llm_config — AI 模型配置</h3>
<table>
  <tr><td>provider</td><td>VARCHAR(50)</td><td>openai/deepseek/zhipu/ollama</td></tr>
  <tr><td>model_name</td><td>VARCHAR(100)</td><td>模型名称</td></tr>
  <tr><td>api_key_encrypted</td><td>TEXT</td><td>AES-256-GCM 加密</td></tr>
  <tr><td>task_routing</td><td>JSONB</td><td>任务类型路由</td></tr>
</table>

<h3>sp_job_embeddings — RAG 职位向量库</h3>
<table>
  <tr><td>task_id + job_id</td><td>UNIQUE</td><td>任务+职位唯一约束（UPSERT）</td></tr>
  <tr><td>text_content</td><td>TEXT</td><td>拼接后的职位全文（用于生成 embedding）</td></tr>
  <tr><td>embedding</td><td>vector(768)</td><td>nomic-embed-text 生成的 768 维向量</td></tr>
  <tr><td>job_name</td><td>VARCHAR(255)</td><td>职位名称（Excel 原始）</td></tr>
  <tr><td>job_category_l1/l2</td><td>VARCHAR(100)</td><td>一/二级分类（增强）</td></tr>
  <tr><td>company_name</td><td>VARCHAR(255)</td><td>企业名称（Excel 原始）</td></tr>
  <tr><td>company_industry</td><td>VARCHAR(100)</td><td>公司行业（增强）</td></tr>
  <tr><td>work_city</td><td>VARCHAR(50)</td><td>工作城市（Excel 原始）</td></tr>
  <tr><td>salary_monthly_min/max</td><td>INTEGER</td><td>月薪范围（增强）</td></tr>
  <tr><td>key_skills</td><td>JSONB</td><td>关键技能（增强）</td></tr>
</table>

<h4>pgvector 索引</h4>
<ul>
  <li><strong>IVFFlat 索引</strong>：<code>embedding vector_cosine_ops</code>，100 个列表</li>
  <li><strong>近似搜索</strong>：通过 <code>embedding &lt;=&gt; $1::vector</code> 计算余弦距离</li>
  <li><strong>相似度转换</strong>：<code>1 - (embedding &lt;=&gt; query)</code> 得到余弦相似度</li>
</ul>

<h3>sp_saved_queries — NL 查询历史</h3>
<table>
  <tr><td>user_query</td><td>TEXT</td><td>用户自然语言</td></tr>
  <tr><td>generated_sql</td><td>TEXT</td><td>AI 生成的 SQL</td></tr>
  <tr><td>result_summary</td><td>TEXT</td><td>LLM 总结</td></tr>
  <tr><td>result_data</td><td>JSONB</td><td>查询结果</td></tr>
</table>

<h3>sp_resumes — 简历结构化解析</h3>
<table>
  <tr><th>字段</th><th>类型</th><th>说明</th></tr>
  <tr><td>id</td><td>SERIAL PK</td><td>自增 ID</td></tr>
  <tr><td>original_filename / file_hash</td><td>VARCHAR</td><td>原始文件名 / SHA-256 去重哈希</td></tr>
  <tr><td>raw_text</td><td>TEXT</td><td>简历原始全文</td></tr>
  <tr><td>name / email / phone</td><td>VARCHAR</td><td>基本信息</td></tr>
  <tr><td>education_level / school / major / work_years</td><td>VARCHAR / INT</td><td>学历/院校/专业/工作年限</td></tr>
  <tr><td>skills / skill_levels</td><td>JSONB</td><td>技能列表 / 熟练度映射</td></tr>
  <tr><td>desired_position / desired_city</td><td>VARCHAR</td><td>求职意向</td></tr>
  <tr><td>projects / certifications / languages</td><td>JSONB</td><td>项目/证书/语言</td></tr>
  <tr><td>embedding</td><td>vector(768)</td><td>简历语义向量</td></tr>
  <tr><td>parse_confidence</td><td>REAL</td><td>LLM 解析置信度 0-1</td></tr>
</table>

<h3>sp_internal_jobs — 内部岗位 JD</h3>
<table>
  <tr><th>字段</th><th>类型</th><th>说明</th></tr>
  <tr><td>id</td><td>SERIAL PK</td><td>自增 ID</td></tr>
  <tr><td>title / department</td><td>VARCHAR</td><td>岗位名称 / 部门</td></tr>
  <tr><td>description / requirement</td><td>TEXT</td><td>岗位描述 / 任职要求</td></tr>
  <tr><td>required_skills / preferred_skills</td><td>JSONB</td><td>必备/加分技能，skill_match_mode 支持 all/any</td></tr>
  <tr><td>salary_min/max / headcount</td><td>INTEGER</td><td>月薪范围 / 招聘人数</td></tr>
  <tr><td>status</td><td>VARCHAR(20)</td><td>open 招聘中 / closed 已关闭</td></tr>
  <tr><td>embedding / embedding_text</td><td>vector(768) / TEXT</td><td>语义向量 / 向量化原文</td></tr>
</table>

<h3>sp_screening_results — 简历筛选结果</h3>
<table>
  <tr><th>字段</th><th>类型</th><th>说明</th></tr>
  <tr><td>id</td><td>SERIAL PK</td><td>自增 ID</td></tr>
  <tr><td>resume_id / internal_job_id</td><td>INT FK</td><td>简历/岗位外键</td></tr>
  <tr><td>total_score</td><td>REAL</td><td>综合得分（满分 100）</td></tr>
  <tr><td>recommendation</td><td>VARCHAR(20)</td><td>strong / moderate / weak / rejected</td></tr>
  <tr><td>hard_rules_passed / education_passed / experience_passed / skills_passed</td><td>BOOLEAN</td><td>硬性规则逐项检查</td></tr>
  <tr><td>similarity / skill_bonus</td><td>REAL</td><td>语义相似度 % / 技能加分</td></tr>
  <tr><td>score_breakdown / full_result</td><td>JSONB</td><td>评分明细 / 完整结果快照</td></tr>
  <tr><td>UNIQUE</td><td>(resume_id, internal_job_id)</td><td>同简历+同岗位仅保留最新</td></tr>
</table>

<h3>sp_prompts — 提示词模板</h3>
<table>
  <tr><th>字段</th><th>类型</th><th>说明</th></tr>
  <tr><td>id</td><td>SERIAL PK</td><td>自增 ID</td></tr>
  <tr><td>category / prompt_type</td><td>VARCHAR</td><td>分类（enrichment/insights/query/resume-parse/anti-crawl）/ 类型（system/user）</td></tr>
  <tr><td>name / content</td><td>VARCHAR / TEXT</td><td>模板名称 / 提示词内容</td></tr>
  <tr><td>variables</td><td>JSONB</td><td>模板变量（如 ["companyName","jobName"]）</td></tr>
  <tr><td>is_active</td><td>BOOLEAN</td><td>启用状态</td></tr>
</table>
<p>种子数据：初始化时自动填充 10 条（5 个场景 × system+user 各 1 条）。</p>

<h3>sp_doc_embeddings — 文档向量（pgvector）</h3>
<table>
  <tr><th>字段</th><th>类型</th><th>说明</th></tr>
  <tr><td>id</td><td>SERIAL PK</td><td>自增 ID</td></tr>
  <tr><td>section_id / section_title</td><td>VARCHAR</td><td>章节/文件标识 / 标题</td></tr>
  <tr><td>chunk_index</td><td>INT</td><td>文本片段序号</td></tr>
  <tr><td>text_content</td><td>TEXT</td><td>片段原文</td></tr>
  <tr><td>embedding</td><td>vector(768)</td><td>768 维向量</td></tr>
  <tr><td>source_type</td><td>VARCHAR(50)</td><td>来源：doc_section/user_doc/diagnostic/design_doc/backend_source/frontend_source</td></tr>
  <tr><td>file_path</td><td>VARCHAR(1000)</td><td>源文件路径</td></tr>
  <tr><td>UNIQUE</td><td>(section_id, chunk_index)</td><td>章节+片段唯一</td></tr>
</table>

<h3>sp_chat_sessions — AI 对话会话</h3>
<table>
  <tr><td>id</td><td>SERIAL PK</td><td>自增 ID</td></tr>
  <tr><td>title</td><td>VARCHAR(200)</td><td>会话标题（默认"新对话"）</td></tr>
</table>

<h3>sp_chat_messages — 对话消息</h3>
<table>
  <tr><td>id</td><td>SERIAL PK</td><td>自增 ID</td></tr>
  <tr><td>session_id</td><td>INT FK → sp_chat_sessions</td><td>关联会话（级联删除）</td></tr>
  <tr><td>role</td><td>VARCHAR(20)</td><td>user / assistant</td></tr>
  <tr><td>content</td><td>TEXT</td><td>消息内容</td></tr>
  <tr><td>sources</td><td>JSONB</td><td>引用文档来源</td></tr>
</table>

<h3>sp_training_jobs — 模型训练任务</h3>
<table>
  <tr><td>id</td><td>SERIAL PK</td><td>自增 ID</td></tr>
  <tr><td>name / base_model</td><td>VARCHAR</td><td>任务名称 / 基座模型</td></tr>
  <tr><td>dataset_config / params</td><td>JSONB</td><td>数据集配置 / 超参数（epochs/lr/batchSize）</td></tr>
  <tr><td>status / progress</td><td>VARCHAR / REAL</td><td>pending→running→completed/failed / 0-100</td></tr>
  <tr><td>metrics</td><td>JSONB</td><td>训练指标（loss 等）</td></tr>
  <tr><td>dataset_path / model_output_path</td><td>TEXT</td><td>数据/模型输出路径</td></tr>
</table>

<h3>RBAC 权限体系（8 张表）</h3>
<table>
  <tr><th>表名</th><th>用途</th><th>核心字段</th></tr>
  <tr><td>sp_users</td><td>系统用户</td><td>username, password_hash, real_name, email, phone, status</td></tr>
  <tr><td>sp_roles</td><td>角色</td><td>name, code, description, status</td></tr>
  <tr><td>sp_permissions</td><td>权限</td><td>name, code, resource, action, description</td></tr>
  <tr><td>sp_menus</td><td>菜单树</td><td>name, path, icon, parent_id（自引用）, sort_order, component, hidden</td></tr>
  <tr><td>sp_user_roles</td><td>用户-角色关联</td><td>(user_id, role_id) 联合主键，级联删除</td></tr>
  <tr><td>sp_role_permissions</td><td>角色-权限关联</td><td>(role_id, permission_id) 联合主键，级联删除</td></tr>
  <tr><td>sp_role_menus</td><td>角色-菜单关联</td><td>(role_id, menu_id) 联合主键，级联删除</td></tr>
  <tr><td>sp_saved_queries</td><td>NL 查询历史</td><td>user_query, generated_sql, result_summary, result_data</td></tr>
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
  <li>任务列表 <strong>点击任务名称</strong> 可跳转文件管理页查看该任务的文件</li>
  <li>实时监控：WebSocket 推送进度条 + 分级彩色日志 + 详情页阶段状态</li>
  <li>任务完成后可进入「数据看板」查看全库汇总统计</li>
</ol>
<blockquote>批量创建支持多关键词 × 多城市自动生成笛卡尔积组合任务。任务断点续传，最大 10 次崩溃恢复。</blockquote>`
  },
  'guide-enrich': {
    title: 'AI 增强数据',
    content: `<ol>
  <li>等待任务状态变为「已完成」</li>
  <li>在任务列表找到目标任务</li>
  <li>点击行右侧的 <strong>「AI 增强」</strong> 按钮</li>
  <li>确认后，系统逐条调用 LLM 处理每条职位数据（BATCH_SIZE=1 + 500ms 间隔 + 3 次重试）</li>
  <li>WebSocket 实时推送进度（<code>enrichment:progress</code> 事件）</li>
  <li>增强维度：薪资标准化 / 职位分类(14类) / 行业识别 / 技能提取 / 学历规范 / 经验年限 / 福利 / 工作模式</li>
  <li>增强完成后可在「数据看板」查看技能词云、经验分布等多维度图表</li>
</ol>
<blockquote>增强基于 ON CONFLICT UPSERT，重复点击不会产生重复数据，可安全重跑。支持 3 层 JSON 降级解析确保鲁棒性。</blockquote>`
  },
  'guide-rag': {
    title: '语义搜索',
    content: `<ol>
  <li>确保任务已完成爬取 + AI 增强（需要 <code>sp_job_enrichments</code> 数据）</li>
  <li>进入「语义搜索」页面</li>
  <li>在「选择要索引的任务」下拉框中选择目标任务</li>
  <li>点击「开始索引」按钮，系统自动：
    <ul>
      <li>从 Excel 读取原始职位字段（职位名称/企业/城市）</li>
      <li>从 <code>sp_job_enrichments</code> 读取增强字段（分类/技能/行业）</li>
      <li>调用 Ollama nomic-embed-text 生成 768 维向量</li>
      <li>存入 <code>sp_job_embeddings</code> 表（pgvector，IVFFlat 索引）</li>
    </ul>
  </li>
  <li>索引完成后，在搜索框输入自然语言查询（支持模糊语义匹配）</li>
  <li>结果按余弦相似度降序排列，显示职位名称/公司/城市/薪资/技能等完整信息</li>
  <li><strong>查询扩展</strong>：短查询（≤10字符）自动触发 30+ 术语映射表扩展，解决语义稀疏问题</li>
  <li>可点击 <strong>「删除索引」</strong> 清理向量数据重新索引</li>
</ol>
<blockquote>索引使用 ON CONFLICT UPSERT，重复索引会更新已有数据。建议每个任务仅需索引一次。</blockquote>

<h4>模型依赖</h4>
<ul>
  <li>需要 Ollama 运行 <code>nomic-embed-text</code> 模型（768 维）</li>
  <li>首次索引会自动检查并尝试拉取模型</li>
  <li>单条 200ms 间隔避免 Ollama 过载</li>
  <li>pgvector IVFFlat 索引（100 lists, cosine_ops），近似搜索比全量快 10-100 倍</li>
</ul>`
  },
  'guide-insights': {
    title: 'AI 深度分析',
    content: `<ol>
  <li><strong>数据看板（Dashboard）</strong>：首页汇总全库统计 — 5 张统计卡片 + 黑龙江省地图（城市/薪资/学历维度）+ 经验年限柱状图 + 技能词云</li>
  <li><strong>智能分析</strong>：从文件管理点击「分析」进入单文件分析页面</li>
  <li>展示基础图表（薪资分布/城市分布/学历分布等 7 种）</li>
  <li>点击 <strong>「🤖 AI 深度分析」</strong> 按钮</li>
  <li>系统自动检查增强数据是否存在 → 聚合多维度统计 → 调用 LLM 生成专业报告</li>
  <li>约 20-40 秒后自动展示：摘要 + 各维度分析 + AI 生成的可视化图表（含 ECharts 配置）</li>
  <li>支持历史报告切换查看（sp_market_reports 表按 file_id 存储多版本）</li>
</ol>
<blockquote>数据看板使用 ECharts 6.0 + echarts-wordcloud 2.1 渲染；Map 使用 GeoJSON 注册黑龙江地图。</blockquote>`
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
<table>
  <tr><th>事件</th><th>载荷</th><th>说明</th></tr>
  <tr><td><code>task:subscribe</code></td><td>{ taskId }</td><td>加入任务房间，接收实时推送（含增强进度重放）</td></tr>
  <tr><td><code>task:unsubscribe</code></td><td>{ taskId }</td><td>离开任务房间</td></tr>
  <tr><td><code>task:stop</code></td><td>{ taskId }</td><td>停止正在运行的任务</td></tr>
</table>

<h3>服务端 → 客户端</h3>
<table>
  <tr><th>事件</th><th>载荷</th><th>说明</th></tr>
  <tr><td><code>task:progress</code></td><td>{ taskId, progress, current, total }</td><td>采集进度更新</td></tr>
  <tr><td><code>task:status</code></td><td>{ taskId, status }</td><td>任务状态变更</td></tr>
  <tr><td><code>task:log</code></td><td>{ taskId, level, message }</td><td>实时分级日志（info/warn/error/success）</td></tr>
  <tr><td><code>task:completed</code></td><td>{ taskId, totalRecords }</td><td>任务采集完成</td></tr>
  <tr><td><code>task:failed</code></td><td>{ taskId, error }</td><td>任务采集失败</td></tr>
  <tr><td><code>task:stopped</code></td><td>{ taskId, task }</td><td>任务被手动停止</td></tr>
  <tr><td><code>task:combinationProgress</code></td><td>{ taskId, ... }</td><td>智联关键词×城市组合进度</td></tr>
  <tr><td><code>enrichment:progress</code></td><td>{ taskId, status, completed, total, message }</td><td>AI 增强进度（订阅时自动重放当前状态）</td></tr>
  <tr><td><code>insights:progress</code></td><td>{ fileId, message, timestamp }</td><td>AI 报告生成阶段进度</td></tr>
  <tr><td><code>insights:completed</code></td><td>{ fileId, reportId, title, summary }</td><td>AI 报告生成完成</td></tr>
</table>

<h4>连接说明</h4>
<ul>
  <li>WebSocket 端口：<strong>3004</strong>（独立于 HTTP 3002）</li>
  <li>传输方式：<code>transports: ['websocket']</code>（纯 WebSocket，无轮询降级）</li>
  <li>自动重连：断线后自动重连 + 指数退避</li>
  <li>房间机制：每个 taskId 一个 Socket.IO 房间，订阅即加入</li>
  <li>进度重放：订阅时若有运行中的增强任务，立即推送当前进度（解决刷新丢失）</li>
</ul>`
  },

  // ========== 系统诊断手册 ==========
  diagnostics: {
    title: '系统诊断手册',
    content: `<p>项目 <code>docs/diagnostics/</code> 目录下收录了 <strong>83 份诊断文档</strong>，按时间顺序记录了系统开发过程中的所有关键问题分析、根因定位和修复方案。</p>

<h3>文档分类</h3>
<table>
  <tr><th>编号范围</th><th>时间段</th><th>主题</th></tr>
  <tr><td>01-16</td><td>4/21-23</td><td>认证登录 / OAuth2 / 分析模块</td></tr>
  <tr><td>17-22</td><td>4/24</td><td>爬虫基础配置 + 日志持久化</td></tr>
  <tr><td>23-33</td><td>4/24 上午</td><td>任务进度问题分析（6 个任务逐一排查）</td></tr>
  <tr><td>34-44</td><td>4/24 下午</td><td>智联招聘解析器深度修复（职位提取/企业名称/链接）</td></tr>
  <tr><td>45-53</td><td>4/24 晚间</td><td>诊断日志补丁完善（策略 1/2/3 统计）</td></tr>
  <tr><td>54-66</td><td>4/27</td><td>并发/浏览器崩溃/反爬修复</td></tr>
  <tr><td>67-74</td><td>4/27</td><td>任务失败诊断 + 日志隔离</td></tr>
  <tr><td>75-79</td><td>4/27 晚</td><td>WAF 对抗增强 + 项目文件清理</td></tr>
  <tr><td>80-81</td><td>4/27</td><td>项目汇报 PPT + 核心技术总结</td></tr>
  <tr><td>82-83</td><td>4/28</td><td>RAG 知识库构建修复 + 浏览器崩溃记录数虚高修复</td></tr>
</table>

<h3>典型诊断案例</h3>
<ul>
  <li><strong>#72 浏览器崩溃恢复 Excel 二进制误读</strong>：<code>fs.readFileSync</code> 读取 .xlsx 二进制当文本导致 record_count 虚高（82→31）</li>
  <li><strong>#71 RAG 知识库 5 项修复</strong>：pgvector 类型找不到 / search_path 隔离 / workMode 类型遗漏 / Excel 字段缺失 / ON CONFLICT 被预检阻止</li>
  <li><strong>#56 并发模式浏览器崩溃最终修复</strong>：BrowserPool 资源竞争导致崩溃，改为单浏览器 + 页面池模式</li>
  <li><strong>#41 智联招聘 HTML 快照诊断</strong>：自动保存解析异常页面 HTML 用于离线 DOM 分析</li>
  <li><strong>#25 任务进度为 0 根因</strong>：db 变量未从 client 模块导入导致静默失败（159 条数据但进度始终为 0）</li>
</ul>

<blockquote>诊断文档仅供开发维护参考，记录了每个问题的完整排查链路和修复代码。截至 2026-05-14 共 157 篇。</blockquote>`
  },

  // ========== 核心功能扩展 ==========
  'feat-resume': {
    title: '简历筛选匹配',
    content: `<h4>两种处理模式</h4>
<p>页面顶部通过<strong>单选按钮组</strong>切换处理模式，两种模式共用同一上传入口：</p>
<table>
  <tr><th style="width:100px">模式</th><th>核心能力</th><th>适用场景</th></tr>
  <tr>
    <td><strong>内部筛选</strong></td>
    <td>简历上传后自动 LLM 解析 → 与公司<strong>内部岗位 JD</strong> 逐份做三级融合打分（硬性规则 + 向量语义 + 技能加分）→ 按简历分组展示匹配结果</td>
    <td>HR 批量筛简历，判断候选人是否符合内部岗位要求</td>
  </tr>
  <tr>
    <td><strong>结构解析</strong></td>
    <td>用 LLM（DeepSeek V4 Pro）从非结构化简历中<strong>提取 20+ 结构化字段</strong>（姓名/学历/技能/工作年限/项目经验/证书等），存入简历库并生成语义向量</td>
    <td>批量数字化简历，建立可搜索的人才库</td>
  </tr>
</table>

<div style="margin: 12px 0; padding: 8px 14px; background: #fdf6ec; border-left: 4px solid #e6a23c; border-radius: 0 4px 4px 0;">
<strong>注意：</strong>外部职位匹配（语义搜索）功能已迁移至 <strong>语义搜索 → 职位向量搜索</strong> 页面，不在本页面内。
</div>

<h4>内部筛选模式 — 操作流程</h4>
<ol>
  <li><strong>上传简历</strong>：拖拽或点击上传 .pdf / .docx / .doc / .txt 文件，支持多文件批量（单次最多 10 个，单文件 ≤ 10MB）。也可在下方文本框直接粘贴简历文本</li>
  <li><strong>配置筛选参数</strong>：可选指定目标岗位（下拉选择内部岗位，留空则匹配全部在招岗位）；调整返回数量（5~50，默认 20）</li>
  <li><strong>开始智能筛选</strong>：点击按钮后，多份简历<strong>逐份异步调用</strong>匹配引擎，每份简历的结果自动标注所属简历 ID 和姓名</li>
  <li><strong>分组结果展示</strong>：所有简历的匹配结果按简历分组，每组显示蓝色标题栏（用户图标 + 简历名 + 匹配数），组内按总分降序排列</li>
</ol>

<h4>三级融合打分引擎</h4>
<table>
  <tr><th>评分维度</th><th>满分</th><th>计算方式</th></tr>
  <tr>
    <td><strong>硬性规则</strong></td>
    <td>40 分</td>
    <td>学历等级比较（高中:1 ~ 博士:5）+ 工作年限阈值 + 必备技能匹配（支持 all/any 模式）。全部通过得 40 分，任一不通过得 0 分</td>
  </tr>
  <tr>
    <td><strong>语义相似度</strong></td>
    <td>40 分</td>
    <td>简历与岗位 JD 的向量余弦相似度 × 40，基于自训练 position-embed-model（nomic-embed-text 微调版）</td>
  </tr>
  <tr>
    <td><strong>技能加分</strong></td>
    <td>20 分</td>
    <td>必备技能每匹配一项 +3 分，加分技能每匹配一项 +2 分，20 分封顶</td>
  </tr>
</table>

<div style="margin: 12px 0; padding: 8px 14px; background: #f0f9eb; border-left: 4px solid #67c23a; border-radius: 0 4px 4px 0;">
<strong>综合得分：</strong> totalScore = hardRuleScore + similarityScore + skillBonus<br/>
<strong>推荐等级：</strong> ≥80 强烈推荐 | ≥60 一般推荐 | ≥40 勉强匹配 | &lt;40 不推荐
</div>

<h4>评分明细展开</h4>
<p>每条结果卡片内嵌<strong>可展开的评分明细面板</strong>，逐项展示：</p>
<ul>
  <li><strong>硬性规则检查</strong>：学历要求 vs 实际（✓/✗ 图标 + 文字说明）、工作年限阈值检查、必备技能匹配/缺失清单（绿色已匹配 + 红色缺失标签）</li>
  <li><strong>语义相似度</strong>：百分比 + 换算分数（相似度% × 0.4）</li>
  <li><strong>技能加分</strong>：匹配的技能标签 + 加分合计</li>
  <li><strong>综合得分</strong>：三项之和</li>
</ul>

<h4>多简历批量处理机制</h4>
<table>
  <tr><th>机制</th><th>说明</th></tr>
  <tr><td>逐份筛选</td><td>多份简历按顺序逐份调用 <code>/api/rag/resume/screen</code>，每份简历的结果自动附加 <code>_resumeId</code> 和 <code>_resumeName</code> 用于分组</td></tr>
  <tr><td>totalCompared 累加</td><td>多份简历的比较岗位总数使用 <code>+=</code> 累加，而非覆盖，确保提示语显示正确的总岗位数</td></tr>
  <tr><td>结果合并排序</td><td>所有简历的结果合并后统一按"硬性规则通过优先 → 总分降序"重排，再按简历分组渲染</td></tr>
  <tr><td>单份容错</td><td>某份简历筛选失败不影响其他简历，最终提示失败数量</td></tr>
  <tr><td>竞态去重</td><td>三层防护：<code>processingUids</code>（uid 级）+ <code>pendingFileKeys</code>（文件名+大小内容级）+ <code>batchClearDone</code> 标志位（新批次首个文件清空旧数据），防止 Element Plus 拖拽模式重复触发导致数据混入</td></tr>
</table>

<h4>简历库管理</h4>
<table>
  <tr><th>功能</th><th>说明</th></tr>
  <tr><td>批量导入</td><td>支持一次上传最多 10 份简历文件，自动 LLM 解析并入库</td></tr>
  <tr><td>搜索过滤</td><td>按姓名、期望岗位、技能模糊搜索</td></tr>
  <tr><td>字段编辑</td><td>人工修正 LLM 解析结果（学历/技能/项目等 20+ 字段）</td></tr>
  <tr><td>批量删除</td><td>勾选多条简历一键删除</td></tr>
  <tr><td>Excel 导出</td><td>导出简历库全部结构化字段为 Excel 文件</td></tr>
</table>

<h4>筛选历史与导出</h4>
<table>
  <tr><th>功能</th><th>说明</th></tr>
  <tr><td>保存到历史</td><td>筛选结果持久化到 <code>sp_screening_results</code> 表，多简历场景下每条结果携带各自的 <code>_resumeId</code></td></tr>
  <tr><td>历史查询</td><td>按简历/岗位筛选历史记录，分页展示</td></tr>
  <tr><td>Excel 导出</td><td>一键导出当前筛选结果为 Excel（自动先保存再导出，多简历时按 resumeIds 批量导出，含硬性规则逐项明细 + 推荐等级条件着色）</td></tr>
</table>

<h4>支持的简历格式</h4>
<ul>
  <li><strong>PDF</strong>（.pdf） — 使用 pdf-parse 库提取文本</li>
  <li><strong>Word</strong>（.docx / .doc） — 使用 mammoth 库提取文本</li>
  <li><strong>纯文本</strong>（.txt） — UTF-8 / GBK 自动编码检测</li>
  <li>单文件上限：10MB，单次最多 10 个文件</li>
</ul>

<h4>AI 模型配置</h4>
<ul>
  <li><strong>嵌入模型</strong>：Ollama 本地部署的 <strong>position-embed-model</strong>（基于 nomic-embed-text 微调），768 维向量；如加载失败自动回退 nomic-embed-text</li>
  <li><strong>解析模型</strong>：路由到 taskType='resume-parse' 的 LLM（推荐 DeepSeek V4 Pro），需设置 maxTokens ≥ 16384 防止推理 token 耗尽；简历文本截取前 4000 字符送入 LLM</li>
  <li><strong>相似度算子</strong>：pgvector <code><=></code> 余弦距离</li>
</ul>

<h4>常见问题</h4>

<div style="margin: 20px 0 8px; padding: 8px 12px; background: linear-gradient(135deg, #ecf5ff, #d9ecff); border-left: 4px solid #409eff; border-radius: 0 4px 4px 0; font-weight: 600; font-size: 14px; color: #303133;">
  Q1：语义相似度是拿什么做的文本向量化？
</div>
<div style="margin: 0 0 16px 12px; padding: 0 8px; border-left: 2px solid #e4e7ed; color: #606266; font-size: 13px; line-height: 1.8;">
<p style="margin: 6px 0;"><strong>三级回退策略：</strong>系统按优先级依次尝试三种文本来源生成向量，确保每次都尽可能实时计算而非使用陈旧预存值。</p>
<p style="margin: 6px 0;"><strong>第一优先 — 结构化区分文本：</strong>从简历的 <strong>18 个结构化字段</strong> 中拼接最关键的区分维度，构建一段约 200~800 字的中文摘要文本，包含：</p>
<ul style="margin: 6px 0; padding-left: 24px;">
  <li><strong>期望岗位</strong>（desiredPosition）— 最核心的区分维度</li>
  <li><strong>技能列表</strong>（skills[]）— 岗位方向的核心差异</li>
  <li><strong>学历 + 专业 + 毕业院校</strong></li>
  <li><strong>工作年限</strong></li>
  <li><strong>项目经验</strong>（取前 3 个，含项目名/角色/技术栈）</li>
  <li><strong>证书</strong>、<strong>期望城市</strong>、<strong>工作类型</strong></li>
</ul>
<p style="margin: 6px 0;">相比原始简历全文，这段结构化摘要<strong>聚焦岗位方向相关的关键差异字段</strong>，过滤掉冗余信息，让"Java 后端"和"销售经理"的向量产生更大的区分度。</p>
<p style="margin: 6px 0;"><strong>第二优先 — 原始简历文本：</strong>如果简历缺少结构化字段（旧数据未解析），截取 rawText 前 2000 字符 <strong>实时调用嵌入模型</strong> 生成向量，保证每次筛选都重新计算语义相似度。</p>
<p style="margin: 6px 0;"><strong>第三优先 — 预存向量兜底：</strong>仅当前两种来源都不可用时（既无结构化字段也无 rawText），才回退到数据库预存的 embedding 字段。</p>
<p style="margin: 6px 0;"><strong>岗位侧：</strong>岗位 JD 的向量由 <code>buildJobText()</code> 函数拼接：职位名称 + 分类 L1/L2 + 关键技能 + 公司行业 + 公司名 + 工作城市 + 学历要求 + 月薪范围 + 工作模式 + 职位描述（前 500 字符）。</p>
<p style="margin: 6px 0;"><strong>嵌入模型：</strong>使用 <strong>Ollama 本地部署的自训练模型</strong>（基于 nomic-embed-text 微调的 position-embed-model），输出 <strong>768 维浮点向量</strong>，余弦相似度 × 40 计入总分。</p>
</div>

<div style="margin: 20px 0 8px; padding: 8px 12px; background: linear-gradient(135deg, #ecf5ff, #d9ecff); border-left: 4px solid #409eff; border-radius: 0 4px 4px 0; font-weight: 600; font-size: 14px; color: #303133;">
  Q2：内部岗位的向量化结果存在哪里？
</div>
<div style="margin: 0 0 16px 12px; padding: 0 8px; border-left: 2px solid #e4e7ed; color: #606266; font-size: 13px; line-height: 1.8;">
  <p style="margin: 6px 0;">内部岗位的向量存储在 <strong><code>sp_internal_jobs</code></strong> 表自身，由 <code>internalJobService.ts</code> 中的 <code>generateInternalJobEmbedding()</code> 函数负责生成和写入：</p>

  <table style="margin: 8px 0; font-size: 13px; border-collapse: collapse;">
    <tr style="background: #f5f7fa;"><th style="padding: 4px 10px; text-align: left; border: 1px solid #e4e7ed;">列名</th><th style="padding: 4px 10px; text-align: left; border: 1px solid #e4e7ed;">类型</th><th style="padding: 4px 10px; text-align: left; border: 1px solid #e4e7ed;">说明</th></tr>
    <tr><td style="padding: 3px 10px; border: 1px solid #e4e7ed;"><code>embedding</code></td><td style="padding: 3px 10px; border: 1px solid #e4e7ed;">pgvector(768)</td><td style="padding: 3px 10px; border: 1px solid #e4e7ed;">768 维浮点向量，用于余弦相似度计算</td></tr>
    <tr style="background: #f5f7fa;"><td style="padding: 3px 10px; border: 1px solid #e4e7ed;"><code>embedding_text</code></td><td style="padding: 3px 10px; border: 1px solid #e4e7ed;">text</td><td style="padding: 3px 10px; border: 1px solid #e4e7ed;">被向量化的原始文本（前 2000 字符），用于调试追溯</td></tr>
  </table>

  <p style="margin: 10px 0 4px;"><strong>向量化流程</strong></p>
  <pre style="margin: 8px 0; padding: 10px; background: #2d2d2d; color: #e6e6e6; border-radius: 4px; font-size: 12px; line-height: 1.6;">
岗位 title + description + requirement
  → 用 \n\n 拼接成一段文本
    → 调用 generateEmbedding() 生成 768 维向量
      → UPDATE sp_internal_jobs SET embedding = '[0.12, -0.34, ...]'::vector</pre>

  <p style="margin: 10px 0 4px;"><strong>触发时机</strong></p>
  <p style="margin: 6px 0 0 16px;"><strong>创建岗位时</strong>：<code>createInternalJob()</code> INSERT 完成后异步调用 <code>generateInternalJobEmbedding()</code>，不阻塞接口响应。</p>
  <p style="margin: 6px 0 0 16px;"><strong>更新岗位时</strong>：仅当 <code>description</code> 或 <code>requirement</code> 字段有变更时才重新生成向量，避免无关更新浪费调用。</p>

  <p style="margin: 10px 0 4px;"><strong>与简历向量的区别</strong></p>
  <p style="margin: 6px 0 0 16px;">简历向量存储在 <code>sp_resumes</code> 表的 <code>embedding</code> 字段，但筛选匹配时 <strong>不使用预存向量</strong>，而是每次都实时调用模型重新生成（三级回退策略，见 Q1）。岗位向量则直接读取预存值，因为岗位由内部 HR 维护，更新频率远低于简历上传。</p>
</div>`
  },
  'feat-prompts': {
    title: '提示词工程',
    content: `<h3>系统提示词一览</h3>

<p>所有 LLM 调用的 System/User Prompt 均硬编码在 <code>code/backend/src/services/llm/prompts.ts</code>，共 5 套提示词模板，覆盖数据增强、市场分析、Text-to-SQL、简历解析、反爬检测 5 个场景。</p>

<h4>1. ENRICHMENT — 数据增强</h4>
<table>
  <tr><th>项目</th><th>说明</th></tr>
  <tr><td>触发入口</td><td>数据管理 → 任务列表 → 点击"AI增强"按钮</td></tr>
  <tr><td>System Prompt</td><td>招聘数据标准化专家角色，8项标准化规则</td></tr>
  <tr><td>User Prompt</td><td>动态拼接企业名称、职位名称、薪资范围、工作城市、经营范围等原始字段</td></tr>
  <tr><td>输出格式</td><td>JSON：salary_monthly_min/max、job_category_l1/l2、company_industry、key_skills、required_skills、preferred_skills、education_normalized、experience_years_min/max、benefits、work_mode</td></tr>
  <tr><td>模型路由</td><td>taskType='enrichment'，推荐 DeepSeek V4 Pro</td></tr>
</table>

<p><strong>System Prompt 核心规则：</strong></p>
<ul>
  <li>薪资标准化：将"10K-15K"、"1万-1.5万/月"等转换为月薪数值（元）</li>
  <li>职位分类：L1 含技术/产品/运营/市场/销售/设计/金融/人力资源/行政/客服/物流/教育/医疗/建筑/制造/其他 共 15 类</li>
  <li>公司行业：从经营范围、企业名称、职位标签综合推断（互联网/金融/教育/医疗/制造/房地产/零售/物流/能源/媒体/咨询/IT服务/建筑/其他）</li>
  <li>技能提取：key_skills 全部技能、required_skills 必备技能、preferred_skills 加分技能</li>
  <li>学历标准化：博士/硕士/本科/大专/高中/不限</li>
  <li>福利提取：五险一金、年终奖、带薪年假、双休、餐补、交通补贴、住房补贴、股票期权、弹性工作</li>
  <li>工作模式：远程/现场/混合（默认现场）</li>
</ul>

<h4>2. INSIGHTS — 市场洞察</h4>
<table>
  <tr><th>项目</th><th>说明</th></tr>
  <tr><td>触发入口</td><td>智能分析 → AI 市场洞察 → 选择文件 → 生成报告</td></tr>
  <tr><td>System Prompt</td><td>招聘市场分析专家角色</td></tr>
  <tr><td>分析维度</td><td>薪资水平、技能需求、行业对比、城市对比、学历/经验要求、关键趋势</td></tr>
  <tr><td>输出格式</td><td>JSON：title、summary（200字摘要）、sections（章节数组含 heading/body/key_insight）、charts_config（ECharts 图表配置数组含 chart_type 和 echarts_option）</td></tr>
</table>

<h4>3. NL_QUERY — 自然语言查询（Text-to-SQL）</h4>
<table>
  <tr><th>项目</th><th>说明</th></tr>
  <tr><td>触发入口</td><td>智能查询 → 数据问答 → 输入自然语言问题</td></tr>
  <tr><td>System Prompt</td><td>SQL 查询助手角色，含完整 DB schema（sp_job_enrichments、sp_tasks、sp_csv_files、sp_jobs 四张表的字段详解）</td></tr>
  <tr><td>安全约束</td><td>仅生成 SELECT 语句，绝对禁止 INSERT/UPDATE/DELETE/DROP，LIMIT 最多 500 条</td></tr>
  <tr><td>JOIN 规则</td><td>必须 LEFT JOIN sp_jobs e ON ... AND e.job_id = j.job_id 获取原始字段，禁止 SELECT *，必须显式列出全部字段</td></tr>
  <tr><td>JSONB 处理</td><td>数组字段用 <code>@></code> 操作符，不能用 = 比较</td></tr>
  <tr><td>输出格式</td><td>JSON：sql、params[]、explanation、needs_app_filter、app_filter_reason</td></tr>
</table>

<p><strong>System Prompt 中内置的完整 DB Schema：</strong></p>
<ul>
  <li><strong>sp_job_enrichments</strong> — AI 增强后的标准化数据：salary_monthly_min/max、salary_annual_estimate、job_category_l1/l2、company_industry、key_skills(JSONB)、required_skills(JSONB)、preferred_skills(JSONB)、education_normalized、experience_years_min/max、benefits(JSONB)、work_mode</li>
  <li><strong>sp_jobs</strong> — 原始爬取数据：company_name、job_name、work_city、salary_range、education、work_experience、job_category、data_source、raw_data(JSONB)</li>
  <li><strong>sp_tasks</strong> — 采集任务：id、name、source、config(JSONB)、status、progress、record_count</li>
  <li><strong>sp_csv_files</strong> — 上传文件：id、task_id、filename、filepath、record_count、source</li>
</ul>

<h4>4. RESUME_PARSE — 简历结构化解析</h4>
<table>
  <tr><th>项目</th><th>说明</th></tr>
  <tr><td>触发入口</td><td>场景应用 → HR助手 → 简历筛选 → 上传简历文件（PDF/Word）</td></tr>
  <tr><td>System Prompt</td><td>专业简历解析专家角色，18 个提取字段</td></tr>
  <tr><td>提取字段</td><td>name、email、phone、education_level（高中/大专/本科/硕士/博士）、school、major、graduation_year、work_years、skills[]、skill_levels{}、desired_position、desired_city、desired_salary_min/max、job_type、projects[]、certifications[]、languages[]、self_evaluation、parse_confidence</td></tr>
  <tr><td>关键规则</td><td>学历取最高值、技能去重统一大小写（react→React、nodejs→Node.js、spring boot→Spring Boot）、年薪÷12→月薪、输出纯 JSON 不含代码块标记</td></tr>
  <tr><td>文本限制</td><td>简历文本截取前 4000 字符送入 LLM，需设置 maxTokens ≥ 16384</td></tr>
</table>

<h4>5. ANTI_CRAWL — AI 反爬检测</h4>
<table>
  <tr><th>项目</th><th>说明</th></tr>
  <tr><td>触发入口</td><td>数据采集 → 爬虫运行中自动触发（检测目标网站反爬机制）</td></tr>
  <tr><td>System Prompt</td><td>网页安全分析专家角色</td></tr>
  <tr><td>分类类型</td><td>normal（正常页面）、captcha（验证码页）、waf（安全拦截页）、login（需登录）、error（错误页）、empty（空白页）</td></tr>
  <tr><td>输出格式</td><td>JSON：page_type、confidence(0-1)、indicators[]（可疑特征列表）、reason（判断理由）</td></tr>
  <tr><td>文本限制</td><td>HTML 截取前 5000 字符</td></tr>
</table>

<h4>提示词修改指南</h4>
<ol>
  <li>编辑 <code>code/backend/src/services/llm/prompts.ts</code> 中对应的 export 常量</li>
  <li>重启后端服务使修改生效（<code>npm run dev</code> 或 <code>pm2 restart</code>）</li>
  <li>如修改输出 JSON 格式，需同步更新对应 TS 类型定义和前端解析逻辑</li>
  <li>User Prompt 中的 <code>\${变量}</code> 为 TypeScript 模板字符串插值，动态拼接上下文数据</li>
</ol>

<h4>常见问题</h4>

<div style="margin: 20px 0 8px; padding: 8px 12px; background: linear-gradient(135deg, #ecf5ff, #d9ecff); border-left: 4px solid #409eff; border-radius: 0 4px 4px 0; font-weight: 600; font-size: 14px; color: #303133;">
  Q1：编辑提示词时各个字段分别是什么意思？
</div>
<div style="margin: 0 0 16px 12px; padding: 0 8px; border-left: 2px solid #e4e7ed; color: #606266; font-size: 13px; line-height: 1.8;">
  <p style="margin: 6px 0;">提示词编辑对话框共有 <strong>6 个表单字段</strong>，外加 1 个隐含的分类归属：</p>

  <p style="margin: 10px 0 4px;"><strong>1. 名称（name）</strong></p>
  <p style="margin: 0 0 8px 16px;">单行文本输入框，最长 100 字符。给提示词起一个辨识度高的名字，例如"数据增强系统提示词"、"简历解析用户提示词"。必填。</p>

  <p style="margin: 10px 0 4px;"><strong>2. 类型（promptType）</strong></p>
  <p style="margin: 0 0 8px 16px;">单选按钮，可选 <strong>System Prompt</strong> 或 <strong>User Prompt</strong>。System Prompt 设定 AI 的角色、行为边界、输出格式等，作为 system message 发送；User Prompt 作为 user message 发送，支持 <code>\${varName}</code> 模板变量占位符。必选。</p>

  <p style="margin: 10px 0 4px;"><strong>3. 启用（isActive）</strong></p>
  <p style="margin: 0 0 8px 16px;">开关控件。同一分类下仅一个 System 和一个 User Prompt 可同时启用——启用新提示词时系统会自动停用同类型的旧提示词。可用于临时禁用某个提示词而不是删除它，方便 A/B 测试或回滚。</p>

  <p style="margin: 10px 0 4px;"><strong>4. 提示词内容（content）</strong></p>
  <p style="margin: 0 0 8px 16px;">多行文本域（16 行高，等宽字体）。提示词的正文文本。对于 User Prompt 类型，可用 <code>\${变量名}</code> 语法嵌入占位符，例如 <code>\${resumeText}</code>，运行时会被替换为实际数据。必填。</p>

  <p style="margin: 10px 0 4px;"><strong>5. 模板变量（variables）</strong></p>
  <p style="margin: 0 0 8px 16px;">多选下拉框，支持手动输入新变量名后回车添加。声明该 User Prompt 中使用了哪些占位变量，仅对 User Prompt 有意义。例如提示词内容中有 <code>\${resumeText}</code> 和 <code>\${jobRequirements}</code>，就在这里添加 resumeText 和 jobRequirements。</p>

  <p style="margin: 10px 0 4px;"><strong>6. 描述（description）</strong></p>
  <p style="margin: 0 0 8px 16px;">单行文本，最长 255 字符。简要说明此提示词的用途、适用场景或注意事项，便于团队成员理解。可选填。</p>

  <p style="margin: 10px 0 4px;"><strong>隐含字段 — 分类（category）</strong></p>
  <p style="margin: 0 0 8px 16px;">从当前路由路径自动提取，不在表单中显示。系统预定义了 5 个分类，对应左侧标签页：</p>
  <table style="margin: 0 0 8px 16px; font-size: 13px;">
    <tr><th style="padding: 2px 12px; text-align: left;">路由路径</th><th style="padding: 2px 12px; text-align: left;">分类标识</th><th style="padding: 2px 12px; text-align: left;">用途</th></tr>
    <tr><td style="padding: 2px 12px;"><code>/system/prompts/enrichment</code></td><td style="padding: 2px 12px;">enrichment</td><td style="padding: 2px 12px;">数据增强</td></tr>
    <tr><td style="padding: 2px 12px;"><code>/system/prompts/insights</code></td><td style="padding: 2px 12px;">insights</td><td style="padding: 2px 12px;">智能洞察</td></tr>
    <tr><td style="padding: 2px 12px;"><code>/system/prompts/query</code></td><td style="padding: 2px 12px;">query</td><td style="padding: 2px 12px;">自然语言查询</td></tr>
    <tr><td style="padding: 2px 12px;"><code>/system/prompts/resume-parse</code></td><td style="padding: 2px 12px;">resume-parse</td><td style="padding: 2px 12px;">简历解析</td></tr>
    <tr><td style="padding: 2px 12px;"><code>/system/prompts/anti-crawl</code></td><td style="padding: 2px 12px;">anti-crawl</td><td style="padding: 2px 12px;">反爬检测</td></tr>
  </table>
  <p style="margin: 4px 0 0 16px;">切换左侧分类标签时，表格会自动加载对应分类下的提示词列表。新建提示词时，category 会自动设为当前选中的分类。</p>
</div>

<div style="margin: 20px 0 8px; padding: 8px 12px; background: linear-gradient(135deg, #ecf5ff, #d9ecff); border-left: 4px solid #409eff; border-radius: 0 4px 4px 0; font-weight: 600; font-size: 14px; color: #303133;">
  Q2：提示词中的 <code>\${变量}</code> 模板变量是如何被替换的？
</div>
<div style="margin: 0 0 16px 12px; padding: 0 8px; border-left: 2px solid #e4e7ed; color: #606266; font-size: 13px; line-height: 1.8;">
  <p style="margin: 6px 0;">替换机制在 <code>promptResolver.ts</code> 中，核心分 <strong>4 步</strong>：</p>

  <p style="margin: 10px 0 4px;"><strong>第1步：加载模板</strong></p>
  <p style="margin: 0 0 8px 16px;">调用 <code>resolvePrompts(category, userPromptVars)</code>。先查 <code>sp_prompts</code> 表中该分类启用中的提示词（数据库优先），没有则回退到 <code>prompts.ts</code> 硬编码默认值。结果缓存在内存 60 秒。</p>

  <p style="margin: 10px 0 4px;"><strong>第2步：正则替换</strong></p>
  <p style="margin: 0 0 8px 16px;">核心函数 <code>interpolateTemplate(template, vars)</code>：用正则 <code>/\$\{([^}]+)\}/g</code> 匹配所有 <code>\${...}</code> 占位符，然后按 <code>.</code> 拆分路径逐级取值，<strong>支持嵌套对象</strong>如 <code>\${job.companyName}</code>。未匹配到的变量替换为空字符串。</p>

  <p style="margin: 10px 0 4px;"><strong>第3步：调用方传入变量值</strong></p>
  <p style="margin: 0 0 8px 16px;">各业务模块调用 <code>callLLMWithPrompts()</code> 时传入 <code>userPromptVars</code> 对象。以数据增强为例，<code>prompts.ts</code> 中定义了含 <code>\${job.companyName}</code>、<code>\${job.jobName}</code>、<code>\${job.salaryRange}</code> 等 14 个占位符的模板，调用方传入带 <code>job</code> 属性的对象，属性值来自数据库中原始招聘数据的字段。</p>

  <p style="margin: 10px 0 4px;"><strong>第4步：最终拼装发送</strong></p>
  <p style="margin: 0 0 8px 16px;"><code>resolvePrompts()</code> 返回替换后的 <code>{ systemPrompt, userPrompt }</code>，再由 <code>callLLM()</code> 发给大模型。System Prompt 原样发送，User Prompt 中的 <code>\${...}</code> 已被替换为实际业务数据。</p>

  <p style="margin: 10px 0 4px;"><strong>流程图</strong></p>
  <pre style="margin: 0 0 8px 16px; padding: 8px 12px; background: #f5f7fa; border-radius: 4px; font-size: 12px; line-height: 1.6;">
DB sp_prompts 表 → (优先) → promptResolver 60s 缓存 → interpolateTemplate() → LLM
硬编码默认值     → (回退) →                      正则替换 \${xx}
                                                      ↑
                                            调用方传入 userPromptVars
  </pre>
</div>

<div style="margin: 20px 0 8px; padding: 8px 12px; background: linear-gradient(135deg, #ecf5ff, #d9ecff); border-left: 4px solid #409eff; border-radius: 0 4px 4px 0; font-weight: 600; font-size: 14px; color: #303133;">
  Q3：System Prompt 和 User Prompt 有什么区别？
</div>
<div style="margin: 0 0 16px 12px; padding: 0 8px; border-left: 2px solid #e4e7ed; color: #606266; font-size: 13px; line-height: 1.8;">

  <p style="margin: 6px 0;"><strong>角色定位对比</strong></p>
  <table style="margin: 0 0 12px 16px; font-size: 13px; border-collapse: collapse;">
    <tr style="background: #f5f7fa;"><th style="padding: 4px 12px; text-align: left; border: 1px solid #e4e7ed;">维度</th><th style="padding: 4px 12px; text-align: left; border: 1px solid #e4e7ed;">System Prompt</th><th style="padding: 4px 12px; text-align: left; border: 1px solid #e4e7ed;">User Prompt</th></tr>
    <tr><td style="padding: 4px 12px; border: 1px solid #e4e7ed;">发送位置</td><td style="padding: 4px 12px; border: 1px solid #e4e7ed;">作为 <code>system</code> role 发送</td><td style="padding: 4px 12px; border: 1px solid #e4e7ed;">作为 <code>user</code> role 发送</td></tr>
    <tr><td style="padding: 4px 12px; border: 1px solid #e4e7ed;">作用</td><td style="padding: 4px 12px; border: 1px solid #e4e7ed;">设定 AI 的<strong>角色、行为边界、输出格式</strong></td><td style="padding: 4px 12px; border: 1px solid #e4e7ed;">承载<strong>本次请求的具体任务和数据</strong></td></tr>
    <tr><td style="padding: 4px 12px; border: 1px solid #e4e7ed;">稳定性</td><td style="padding: 4px 12px; border: 1px solid #e4e7ed;">相对固定，定义"你是谁"</td><td style="padding: 4px 12px; border: 1px solid #e4e7ed;">每次调用动态变化，"这次做什么"</td></tr>
    <tr><td style="padding: 4px 12px; border: 1px solid #e4e7ed;">模板变量</td><td style="padding: 4px 12px; border: 1px solid #e4e7ed;">通常不含 <code>\${}</code> 占位符</td><td style="padding: 4px 12px; border: 1px solid #e4e7ed;">含 <code>\${varName}</code> 占位符，运行时替换</td></tr>
    <tr><td style="padding: 4px 12px; border: 1px solid #e4e7ed;">可见性</td><td style="padding: 4px 12px; border: 1px solid #e4e7ed;">对最终用户不可见</td><td style="padding: 4px 12px; border: 1px solid #e4e7ed;">用户可感知（问答类场景）</td></tr>
  </table>

  <p style="margin: 10px 0 4px;"><strong>实际例子：数据增强场景</strong></p>
  <p style="margin: 0 0 4px 16px;"><strong>System Prompt</strong> — 定义规则体系：</p>
  <pre style="margin: 0 0 8px 16px; padding: 8px 12px; background: #f5f7fa; border-radius: 4px; font-size: 12px; line-height: 1.6;">你是一个招聘数据标准化专家。你的任务是将原始的招聘信息转换为结构化数据。
规则：
1. 薪资标准化：将"10K-15K"转换为月薪数值...
2. 职位分类：L1含技术/产品/运营...共15类
请严格按照以下JSON格式输出，不要输出其他内容：
{ "salary_monthly_min": ..., "job_category_l1": ... }</pre>
  <p style="margin: 0 0 4px 16px;"><strong>User Prompt</strong> — 带入具体数据：</p>
  <pre style="margin: 0 0 8px 16px; padding: 8px 12px; background: #f5f7fa; border-radius: 4px; font-size: 12px; line-height: 1.6;">请分析以下职位信息并进行标准化：
企业名称：\${job.companyName}    → 运行时替换为 "XX科技公司"
职位名称：\${job.jobName}        → 运行时替换为 "Java开发工程师"
薪资范围：\${job.salaryRange}    → 运行时替换为 "15K-25K"</pre>

  <p style="margin: 10px 0 4px;"><strong>系统约束</strong></p>
  <p style="margin: 0 0 8px 16px;">编辑表单中明确提示：<strong>同一分类下仅一个 System 和一个 User 可同时启用</strong>。运行时每个业务分类只有一对生效的提示词——一个 System 定义框架，一个 User 带入数据，两者配合完成一次 LLM 调用。</p>

  <p style="margin: 10px 0 4px;"><strong>一句话总结</strong></p>
  <p style="margin: 0 0 8px 16px;">System Prompt 管<strong>"怎么想"</strong>（角色+规则+格式），User Prompt 管<strong>"处理什么"</strong>（具体数据+本次指令）。</p>
</div>`
  },
  'feat-aibot': {
    title: 'AI 问答机器人',
    content: `<table>
  <tr><th>功能</th><th>说明</th></tr>
  <tr><td>RAG 检索</td><td>基于项目文档和源代码的向量知识库</td></tr>
  <tr><td>多轮对话</td><td>支持会话管理，上下文记忆</td></tr>
  <tr><td>来源引用</td><td>回答引用具体文档章节或代码文件</td></tr>
</table>`
  },
  'feat-doc-upload': {
    title: '文档向量索引',
    content: `<table>
  <tr><th>功能</th><th>说明</th></tr>
  <tr><td>文件上传</td><td>支持 .txt/.md/.pdf/.docx，多文件批量上传（最多 20 个）</td></tr>
  <tr><td>自动索引</td><td>解析文本 → 智能分块 → 向量化 → 存入 sp_doc_embeddings</td></tr>
  <tr><td>文档管理</td><td>按来源类型筛选、关键字搜索、单条或批量删除</td></tr>
</table>`
  },
  'feat-training': {
    title: '语义模型训练',
    content: `<table>
  <tr><th>功能</th><th>说明</th></tr>
  <tr><td>数据构建</td><td>从增强数据提取对比学习训练对（正/负样本）</td></tr>
  <tr><td>模型微调</td><td>Python sentence-transformers 微调 Embedding 模型</td></tr>
  <tr><td>Ollama 部署</td><td>生成 Modelfile → Ollama create 部署领域专用模型</td></tr>
</table>

<h4>常见问题</h4>

<div style="margin: 20px 0 8px; padding: 8px 12px; background: linear-gradient(135deg, #ecf5ff, #d9ecff); border-left: 4px solid #409eff; border-radius: 0 4px 4px 0; font-weight: 600; font-size: 14px; color: #303133;">
  Q1：基于基座模型训练的原理是什么？
</div>
<div style="margin: 0 0 16px 12px; padding: 0 8px; border-left: 2px solid #e4e7ed; color: #606266; font-size: 13px; line-height: 1.8;">
<p style="margin: 6px 0;"><strong>为什么不从零训练？</strong>从头训练一个 embedding 模型需要海量数据（数十亿条）和巨量算力（数百 GPU/周）。基座模型（如 <code>nomic-embed-text-v1.5</code>）已经用互联网级语料学会了语言的基本理解能力——断句、词义、区分"Java工程师"和"销售经理"。我们要做的只是在它已有的语言能力上微调一小步，让它更理解"什么职位算同类"。</p>
<p style="margin: 6px 0;"><strong>微调改了什么？</strong>基座模型加载后有 1.37 亿个参数。每个 step 做的事情：输入 anchor + positive → 编码为向量 → 计算 loss → 反向传播 → 权重微调（幅度 = LR ≈ 0.00002）。形象理解：基座模型是读了万卷书的大学生（通用语言能力），微调相当于让他去招聘部门实习几天（426 对职位数据 × 3 轮），出来后就能精准区分职位相似度。</p>
<p style="margin: 6px 0;"><strong>参数冻结策略：</strong>并非全部参数都在动。底层 Transformer 层冻结不动（保留通用语言能力），仅微调上层和池化层（调整向量投影方向），通常只更新约 10%~30% 的参数。这样既保留通用能力，又学会领域判断。</p>
</div>

<div style="margin: 20px 0 8px; padding: 8px 12px; background: linear-gradient(135deg, #ecf5ff, #d9ecff); border-left: 4px solid #409eff; border-radius: 0 4px 4px 0; font-weight: 600; font-size: 14px; color: #303133;">
  Q2：多少训练数据才够？
</div>
<div style="margin: 0 0 16px 12px; padding: 0 8px; border-left: 2px solid #e4e7ed; color: #606266; font-size: 13px; line-height: 1.8;">
<p style="margin: 6px 0;"><strong>500 条可用，但离"好"还有距离。</strong>当前 426 条训练 / 107 条评估是典型小样本微调场景，能学会基本的行业/职能区分（Java vs 销售没问题），但细粒度区分（Java 后端 vs Java 架构）还不够。</p>
<table style="margin: 10px 0;">
  <tr style="background:#f5f7fa;"><th style="padding:4px 10px;text-align:left;">规模</th><th style="padding:4px 10px;text-align:left;">训练对数</th><th style="padding:4px 10px;text-align:left;">预期效果</th></tr>
  <tr><td style="padding:3px 10px;">起步</td><td style="padding:3px 10px;">200~500</td><td style="padding:3px 10px;">基本行业/职能区分 OK</td></tr>
  <tr style="background:#f5f7fa;"><td style="padding:3px 10px;">可用</td><td style="padding:3px 10px;">1,000~3,000</td><td style="padding:3px 10px;">二级分类（Java后端 vs 前端）能区分</td></tr>
  <tr><td style="padding:3px 10px;">良好</td><td style="padding:3px 10px;">5,000~10,000</td><td style="padding:3px 10px;">细粒度职级/方向区分</td></tr>
  <tr style="background:#f5f7fa;"><td style="padding:3px 10px;">优秀</td><td style="padding:3px 10px;">10,000+</td><td style="padding:3px 10px;">接近或超过通用基座模型在岗位领域的表现</td></tr>
</table>
<p style="margin: 6px 0;"><strong>比数量更重要的因素：</strong></p>
<ul style="margin: 4px 0;">
  <li><strong>覆盖度</strong>：数据覆盖了多少行业/职能？500 条全是 IT 岗，模型就只会招 IT</li>
  <li><strong>正样本质量</strong>：同一岗位不同 JD 写法差异大才是好正样本（两条几乎一样的 JD 学不到东西）</li>
  <li><strong>类别平衡</strong>：每个职能方向至少 30~50 对，太少的方向会被模型忽略</li>
</ul>
<p style="margin: 6px 0;"><strong>务实建议：</strong>当前 500 条先跑通流程验证 pipeline，确认没问题后扩充到 2,000~3,000 条覆盖更多行业和职能，Top-1 Accuracy 有望提升到 80%+。</p>
</div>

<div style="margin: 20px 0 8px; padding: 8px 12px; background: linear-gradient(135deg, #ecf5ff, #d9ecff); border-left: 4px solid #409eff; border-radius: 0 4px 4px 0; font-weight: 600; font-size: 14px; color: #303133;">
  Q3：训练数据长什么样？
</div>
<div style="margin: 0 0 16px 12px; padding: 0 8px; border-left: 2px solid #e4e7ed; color: #606266; font-size: 13px; line-height: 1.8;">
<p style="margin: 6px 0;">本系统使用 <strong>(anchor, positive) 三元组</strong>进行对比学习训练：</p>
<ul style="margin: 4px 0;">
  <li><strong>anchor</strong>（锚点）：一个职位描述，如"Java开发工程师，负责后端系统设计和开发..."</li>
  <li><strong>positive</strong>（正样本）：与 anchor 同类的职位，如"高级Java工程师，5年以上Spring Boot经验..."</li>
  <li><strong>negative</strong>（负样本）：与 anchor 不同类的职位，如"销售经理，负责团队管理和客户拓展..."</li>
</ul>
<p style="margin: 6px 0;">训练目标：让 anchor 和 positive 的向量越近越好。</p>
</div>

<div style="margin: 20px 0 8px; padding: 8px 12px; background: linear-gradient(135deg, #ecf5ff, #d9ecff); border-left: 4px solid #409eff; border-radius: 0 4px 4px 0; font-weight: 600; font-size: 14px; color: #303133;">
  Q4：Epoch（训练轮数）是什么意思？
</div>
<div style="margin: 0 0 16px 12px; padding: 0 8px; border-left: 2px solid #e4e7ed; color: #606266; font-size: 13px; line-height: 1.8;">
<p style="margin: 6px 0;">一个 epoch = 把所有训练数据都过一遍。系统默认 <code>epochs=3</code>，即同样的数据反复学习 3 轮。多轮训练让模型逐步优化参数，但太多轮会导致<strong>过拟合</strong>（死记硬背训练集，泛化能力反而下降）。Embedding 微调通常设 3~5 轮。</p>
</div>

<div style="margin: 20px 0 8px; padding: 8px 12px; background: linear-gradient(135deg, #ecf5ff, #d9ecff); border-left: 4px solid #409eff; border-radius: 0 4px 4px 0; font-weight: 600; font-size: 14px; color: #303133;">
  Q5：Batch Size（批大小）是什么意思？
</div>
<div style="margin: 0 0 16px 12px; padding: 0 8px; border-left: 2px solid #e4e7ed; color: #606266; font-size: 13px; line-height: 1.8;">
<p style="margin: 6px 0;">一次喂给模型多少条数据，默认 <code>batch_size=16</code>。Sentence-Transformers 采用 <strong>in-batch negatives</strong> 策略：同一个 batch 内的其他正样本自动作为负样本使用。所以 batch 越大 → 负样本越丰富 → 对比学习效果越好，但显存消耗也越大。</p>
</div>

<div style="margin: 20px 0 8px; padding: 8px 12px; background: linear-gradient(135deg, #ecf5ff, #d9ecff); border-left: 4px solid #409eff; border-radius: 0 4px 4px 0; font-weight: 600; font-size: 14px; color: #303133;">
  Q6：Step（训练步数）是什么意思？
</div>
<div style="margin: 0 0 16px 12px; padding: 0 8px; border-left: 2px solid #e4e7ed; color: #606266; font-size: 13px; line-height: 1.8;">
<p style="margin: 6px 0;">一个 step = 处理一个 batch 的数据（前向传播 → 计算损失 → 反向传播更新参数）。举例：426 条训练数据 ÷ batch_size 16 ≈ 27 steps/epoch，3 个 epoch 合计 81 steps。进度条中 <code>27/27</code> 表示当前 epoch 的 27 步已全部完成。</p>
</div>

<div style="margin: 20px 0 8px; padding: 8px 12px; background: linear-gradient(135deg, #ecf5ff, #d9ecff); border-left: 4px solid #409eff; border-radius: 0 4px 4px 0; font-weight: 600; font-size: 14px; color: #303133;">
  Q7：LR（学习率）是什么意思？
</div>
<div style="margin: 0 0 16px 12px; padding: 0 8px; border-left: 2px solid #e4e7ed; color: #606266; font-size: 13px; line-height: 1.8;">
<p style="margin: 6px 0;"><strong>LR = Learning Rate（学习率）</strong>，控制模型参数每次更新的步长。可以理解为"蒙眼下山时每一步迈多大"：</p>
<ul style="margin: 4px 0;">
  <li><strong>太大</strong>（如 <code>1e-3</code>）：一步跨太远，在最优解附近震荡，难以收敛</li>
  <li><strong>太小</strong>（如 <code>1e-7</code>）：小碎步挪，训练极慢，容易卡在局部最优</li>
  <li><strong>合适</strong>：Embedding 微调默认 <code>2e-5</code>（0.00002）是业界经验值，步子够小不会冲坏预训练权重，又能有效学习</li>
</ul>
<p style="margin: 6px 0;">系统默认 <code>2e-5</code>，配合 warmup 策略前 10% 步数从 0 线性爬到目标值，一般无需调整。</p>
</div>

<div style="margin: 20px 0 8px; padding: 8px 12px; background: linear-gradient(135deg, #ecf5ff, #d9ecff); border-left: 4px solid #409eff; border-radius: 0 4px 4px 0; font-weight: 600; font-size: 14px; color: #303133;">
  Q8：Warmup Steps（预热步数）是什么？
</div>
<div style="margin: 0 0 16px 12px; padding: 0 8px; border-left: 2px solid #e4e7ed; color: #606266; font-size: 13px; line-height: 1.8;">
<p style="margin: 6px 0;">训练初期，学习率从 0 线性增长到目标值（如 <code>2e-5</code>），预热步数 = 总步数 × 10%。目的是避免训练初期梯度剧烈震荡，把预训练权重冲坏。</p>
</div>

<div style="margin: 20px 0 8px; padding: 8px 12px; background: linear-gradient(135deg, #ecf5ff, #d9ecff); border-left: 4px solid #409eff; border-radius: 0 4px 4px 0; font-weight: 600; font-size: 14px; color: #303133;">
  Q9：训练完成后如何评估效果？
</div>
<div style="margin: 0 0 16px 12px; padding: 0 8px; border-left: 2px solid #e4e7ed; color: #606266; font-size: 13px; line-height: 1.8;">
<p style="margin: 6px 0;">评估数据来自训练集划分时预留的 <strong>107 对 eval 数据</strong>（训练 426 对 + 评估 107 对），评估过程不会用于训练，确保指标客观。</p>

<h5 style="margin: 12px 0 6px; color: #409eff; font-size: 13px;">Pearson 相关系数</h5>
<p style="margin: 6px 0;">把 107 对 eval 数据的 anchor 和 positive 分别编码成向量 → 计算每一对的余弦相似度 → 得到一个 107 个值的序列。理想情况下每对相似度都应该是 1.0（完全匹配），但实际上有高有低。<strong>Pearson 相关系数衡量的是"模型给的相似度排名"和"理想排名（全 1.0）"之间的线性相关程度</strong>，越接近 1.0 说明模型越能稳定判断"这对更像 vs 那对不太像"。</p>
<p style="margin: 6px 0; color: #909399; font-size: 12px;">注意：如果 eval 集合太小或数据过于相似，可能出现 scipy 的 ConstantInputWarning 警告（常量输入导致相关系数无定义），此时 Pearson 会显示为 0。这是 eval 数据质量问题，不是训练失败。</p>

<h5 style="margin: 12px 0 6px; color: #409eff; font-size: 13px;">Top-1 Accuracy（检索首项准确率）</h5>
<p style="margin: 6px 0;">模拟真实检索场景：对每个 anchor，把它和 <strong>1 个正确 positive + 10 个随机干扰项</strong> 混在一起编码 → 计算所有候选项与 anchor 的余弦相似度 → 看排名第一的是不是正确的 positive。例如 107 对中 85 对的 positive 排第一，Top-1 Accuracy = 85/107 ≈ 79.4%。</p>
<p style="margin: 6px 0;"><strong>这个指标直接回答"用户搜一个职位，最相关的排在第一的概率有多大"</strong>，比 Pearson 更直观易懂。</p>

<h5 style="margin: 12px 0 6px; color: #409eff; font-size: 13px;">如何解读</h5>
<table style="margin: 10px 0;">
  <tr style="background:#f5f7fa;"><th style="padding:4px 10px;text-align:left;">Pearson</th><th style="padding:4px 10px;text-align:left;">Top-1 Acc</th><th style="padding:4px 10px;text-align:left;">模型质量</th></tr>
  <tr><td style="padding:3px 10px;">> 0.8</td><td style="padding:3px 10px;">> 85%</td><td style="padding:3px 10px;">优秀，可直接用于生产</td></tr>
  <tr style="background:#f5f7fa;"><td style="padding:3px 10px;">0.6~0.8</td><td style="padding:3px 10px;">70%~85%</td><td style="padding:3px 10px;">良好，可用但建议扩充数据提升</td></tr>
  <tr><td style="padding:3px 10px;">0.4~0.6</td><td style="padding:3px 10px;">55%~70%</td><td style="padding:3px 10px;">一般，需增加训练数据或调整超参</td></tr>
  <tr style="background:#f5f7fa;"><td style="padding:3px 10px;">< 0.4</td><td style="padding:3px 10px;">< 55%</td><td style="padding:3px 10px;">较差，检查数据质量或训练是否崩溃</td></tr>
</table>
<p style="margin: 6px 0;">简单记：<strong>Pearson 看区分能力稳不稳定，Top-1 看实际搜索准不准</strong>，两个都高才是好模型。</p>
</div>

<div style="margin: 20px 0 8px; padding: 8px 12px; background: linear-gradient(135deg, #ecf5ff, #d9ecff); border-left: 4px solid #409eff; border-radius: 0 4px 4px 0; font-weight: 600; font-size: 14px; color: #303133;">
  Q10：系统用什么损失函数训练？
</div>
<div style="margin: 0 0 16px 12px; padding: 0 8px; border-left: 2px solid #e4e7ed; color: #606266; font-size: 13px; line-height: 1.8;">
<p style="margin: 6px 0;"><strong>MultipleNegativesRankingLoss</strong>。核心原理：在 batch 内将其他样本的 positive 当作当前样本的 negative，无需显式标注负样本。配合 in-batch negatives 策略，batch 越大效果越好。</p>
</div>

<div style="margin: 20px 0 8px; padding: 8px 12px; background: linear-gradient(135deg, #ecf5ff, #d9ecff); border-left: 4px solid #409eff; border-radius: 0 4px 4px 0; font-weight: 600; font-size: 14px; color: #303133;">
  Q11：训练完成的模型文件存放在哪里？什么格式？
</div>
<div style="margin: 0 0 16px 12px; padding: 0 8px; border-left: 2px solid #e4e7ed; color: #606266; font-size: 13px; line-height: 1.8;">
<p style="margin: 6px 0;">模型文件存放在 <code>code/backend/data/models/model_{任务ID}/</code> 目录，典型结构如下：</p>
<pre style="margin: 8px 0; padding: 10px; background: #2d2d2d; color: #e6e6e6; border-radius: 4px; font-size: 12px; line-height: 1.6;">
data/models/model_3/
├── config.json              ← 模型架构配置
├── model.safetensors        ← 微调后的权重（核心文件）
├── tokenizer.json           ← 分词器
├── special_tokens_map.json
├── sentence_bert_config.json
├── modules.json
├── 1_Pooling/               ← 池化层配置
├── Modelfile                ← Ollama 部署描述文件
└── metrics.json             ← 评估指标
</pre>
<table style="margin: 10px 0;">
  <tr style="background:#f5f7fa;"><th style="padding:4px 10px;text-align:left;">文件</th><th style="padding:4px 10px;text-align:left;">格式</th><th style="padding:4px 10px;text-align:left;">说明</th></tr>
  <tr><td style="padding:3px 10px;"><code>model.safetensors</code></td><td style="padding:3px 10px;">safetensors</td><td style="padding:3px 10px;">微调后的 1.37 亿参数权重，比 .bin 格式更安全</td></tr>
  <tr style="background:#f5f7fa;"><td style="padding:3px 10px;"><code>config.json</code></td><td style="padding:3px 10px;">JSON</td><td style="padding:3px 10px;">模型架构配置，记录向量维度等信息</td></tr>
  <tr><td style="padding:3px 10px;"><code>Modelfile</code></td><td style="padding:3px 10px;">纯文本</td><td style="padding:3px 10px;">Ollama 部署描述文件，指向基座模型并标注微调来源</td></tr>
  <tr style="background:#f5f7fa;"><td style="padding:3px 10px;"><code>metrics.json</code></td><td style="padding:3px 10px;">JSON</td><td style="padding:3px 10px;">评估结果，含 Pearson、Top-1 Accuracy、训练对数等</td></tr>
</table>
<p style="margin: 6px 0;">部署时系统读取 Modelfile 调用 <code>ollama create</code>，将模型注册到 Ollama 供语义搜索使用。</p>
</div>

<div style="margin: 20px 0 8px; padding: 8px 12px; background: linear-gradient(135deg, #ecf5ff, #d9ecff); border-left: 4px solid #409eff; border-radius: 0 4px 4px 0; font-weight: 600; font-size: 14px; color: #303133;">
  Q12：训练程序在哪？如何启动的？
</div>
<div style="margin: 0 0 16px 12px; padding: 0 8px; border-left: 2px solid #e4e7ed; color: #606266; font-size: 13px; line-height: 1.8;">

<h5 style="margin: 12px 0 6px; color: #409eff; font-size: 13px;">Python 训练脚本</h5>
<p style="margin: 6px 0;">位置：<code>code/backend/scripts/train_embedding.py</code>，约 230 行。</p>
<p style="margin: 6px 0;">核心流程：<strong>加载数据 → 划分训练/评估集 → 下载基座模型 → SentenceTransformer 微调 → 评估 → 保存</strong>。</p>

<h5 style="margin: 12px 0 6px; color: #409eff; font-size: 13px;">Node.js 启动器</h5>
<p style="margin: 6px 0;">位置：<code>code/backend/src/controllers/trainingController.ts</code> 的 <code>runPythonTraining()</code> 函数。</p>
<p style="margin: 6px 0;">前端点击"开始训练" → <code>POST /api/training/start</code> → <code>startTraining()</code> 插入数据库记录 → 立即返回响应 → <strong>后台异步</strong>用 <code>spawn()</code> 启动 Python 子进程：</p>
<pre style="margin: 8px 0; padding: 10px; background: #2d2d2d; color: #e6e6e6; border-radius: 4px; font-size: 12px; line-height: 1.6;">
spawn('python', [
  'train_embedding.py',
  '--dataset', datasetPath,
  '--base-model', baseModel,
  '--output', modelOutputDir,
  '--epochs', '3',
  '--batch-size', '16',
  '--lr', '2e-5',
], {
  env: {
    PYTHONUNBUFFERED: '1',       ← 强制无缓冲，日志实时输出
    PYTHONIOENCODING: 'utf-8',   ← 避免 Windows GBK 乱码
    HF_ENDPOINT: 'https://hf-mirror.com', ← 国内镜像
    HF_HUB_ENABLE_HF_XET: '0',   ← 禁用 XetHub
  }
})
</pre>

<h5 style="margin: 12px 0 6px; color: #409eff; font-size: 13px;">完整链路</h5>
<pre style="margin: 8px 0; padding: 10px; background: #2d2d2d; color: #e6e6e6; border-radius: 4px; font-size: 12px; line-height: 1.6;">
前端「开始训练」
  → POST /api/training/start
    → DB INSERT sp_training_jobs (status='running')
    → res.json({ jobId }) 立即返回
    → spawn('python', ['train_embedding.py', ...])
      → Python 输出 PROGRESS:xx 和日志
        → Node stdout.on('data') 捕获
          → sanitizeLog() 清理 tqdm 乱码
            → 每 2 秒 UPDATE DB (progress, log)
              → 前端 GET /api/training/status/:id 轮询展示
                → Python 退出
                  → Node 写最终状态 (completed/failed)
                    → 模型文件保存到 data/models/model_{id}/
</pre>
</div>

<div style="margin: 20px 0 8px; padding: 8px 12px; background: linear-gradient(135deg, #ecf5ff, #d9ecff); border-left: 4px solid #409eff; border-radius: 0 4px 4px 0; font-weight: 600; font-size: 14px; color: #303133;">
  Q13：sentence-transformers 和 torch 是什么？和本系统有什么关系？
</div>
<div style="margin: 0 0 16px 12px; padding: 0 8px; border-left: 2px solid #e4e7ed; color: #606266; font-size: 13px; line-height: 1.8;">

<h5 style="margin: 12px 0 6px; color: #409eff; font-size: 13px;">sentence-transformers</h5>
<p style="margin: 6px 0;">基于 PyTorch 的 Python 库，专门将<strong>句子/段落/文档转换成向量（embedding）</strong>。在本系统中的角色：</p>
<table style="margin: 8px 0; font-size: 12px;">
  <tr><th style="width: 140px;">功能</th><th>说明</th></tr>
  <tr><td>SentenceTransformer</td><td>加载预训练基座模型（如 all-MiniLM-L6-v2），把文本变成高维向量</td></tr>
  <tr><td>MultipleNegativesRankingLoss</td><td>对比学习损失函数，让"职位描述—简历"对在向量空间中靠近，不相关的远离</td></tr>
  <tr><td>InputExample</td><td>训练数据格式，构建正例对（text_a=JD, text_b=匹配简历）</td></tr>
  <tr><td>SentenceTransformerTrainer</td><td>3.x 版本的高级训练 API，封装了 Trainer、DataLoader、Evaluator</td></tr>
</table>
<p style="margin: 6px 0;">简单说：它是一个<strong>语义模型工厂</strong> — 你给它文本对，它产出"能判断 JD 和简历是否匹配"的向量模型。</p>

<h5 style="margin: 12px 0 6px; color: #409eff; font-size: 13px;">torch（PyTorch）</h5>
<p style="margin: 6px 0;">Meta 开源的<strong>深度学习框架</strong>，是 sentence-transformers 的底层引擎。在本系统中的角色：</p>
<table style="margin: 8px 0; font-size: 12px;">
  <tr><th style="width: 140px;">功能</th><th>说明</th></tr>
  <tr><td>张量运算</td><td>所有矩阵计算（向量内积、梯度反向传播）</td></tr>
  <tr><td>GPU 加速</td><td>若机器有 CUDA 显卡，model.to('cuda') 会将训练搬上 GPU</td></tr>
  <tr><td>自动微分</td><td>loss.backward() 自动算梯度，无需手写求导公式</td></tr>
  <tr><td>DataLoader</td><td>批量加载训练数据，高效喂入模型</td></tr>
</table>

<h5 style="margin: 12px 0 6px; color: #409eff; font-size: 13px;">两者关系</h5>
<p style="margin: 6px 0;"><code>torch</code> 是发动机，<code>sentence-transformers</code> 是装在发动机上的整车。本系统不直接调用 PyTorch API，而是通过 sentence-transformers 间接使用它——<code>train_embedding.py</code> 中所有训练逻辑都是 sentence-transformers 的高级封装，底层自动调用 torch 完成计算。</p>
</div>

<div style="margin: 20px 0 8px; padding: 8px 12px; background: linear-gradient(135deg, #ecf5ff, #d9ecff); border-left: 4px solid #409eff; border-radius: 0 4px 4px 0; font-weight: 600; font-size: 14px; color: #303133;">
  Q14：为什么评估结果只有 Top-1 准确率，没有 Pearson？
</div>
<div style="margin: 0 0 16px 12px; padding: 0 8px; border-left: 2px solid #e4e7ed; color: #606266; font-size: 13px; line-height: 1.8;">

<h5 style="margin: 12px 0 6px; color: #e6a23c; font-size: 13px;">现象</h5>
<p style="margin: 6px 0;">模型管理 → 评估指标列只显示「Top-1 准确率: 100.0%」，没有 Pearson 数值。即使重新评估也依然如此。</p>

<h5 style="margin: 12px 0 6px; color: #409eff; font-size: 13px;">根因</h5>
<p style="margin: 6px 0;"><strong>Pearson 相关系数要求标注分数有方差</strong>（不能全是同一个值）。旧版评估脚本仅将锚点-正样本对送入 <code>EmbeddingSimilarityEvaluator</code>，所有标注分数统一为 1.0，scipy 计算时因常量输入导致分母为 0，结果为 NaN。系统自动将 NaN 转为 null，前端检测到 null 就不显示。</p>
<p style="margin: 6px 0; color: #67c23a;"><strong>已修复</strong>：v2 版评估脚本同时纳入负样本对（标注 0.0），与正样本对（标注 1.0）混合评估，产生充足方差，Pearson 可正常计算。</p>

<h5 style="margin: 12px 0 6px; color: #409eff; font-size: 13px;">解决</h5>
<ul style="margin: 6px 0; padding-left: 20px;">
  <li><strong>使用新版评估脚本</strong>：最新 evaluate_model.py 自动使用正负样本混合评估，Pearson 不再为 NaN</li>
  <li><strong>扩充训练数据</strong>：建议至少构建 200~500 对，使评估指标更具统计意义</li>
</ul>
</div>

<div style="margin: 20px 0 8px; padding: 8px 12px; background: linear-gradient(135deg, #ecf5ff, #d9ecff); border-left: 4px solid #409eff; border-radius: 0 4px 4px 0; font-weight: 600; font-size: 14px; color: #303133;">
  Q15：Pearson 相似度和 Top-1 准确率分别代表什么？
</div>
<div style="margin: 0 0 16px 12px; padding: 0 8px; border-left: 2px solid #e4e7ed; color: #606266; font-size: 13px; line-height: 1.8;">

<h5 style="margin: 12px 0 6px; color: #409eff; font-size: 13px;">Pearson 相关系数</h5>
<p style="margin: 6px 0;">衡量模型预测的文本相似度与真实相似度之间的<strong>线性相关性</strong>，取值 -1 到 1：</p>
<table style="margin: 10px 0;">
  <tr style="background:#f5f7fa;"><th style="padding:4px 10px;text-align:left;">值</th><th style="padding:4px 10px;text-align:left;">含义</th></tr>
  <tr><td style="padding:3px 10px;"><strong>1.0</strong></td><td style="padding:3px 10px;">模型预测与真实标签完全正相关（理想状态）</td></tr>
  <tr style="background:#f5f7fa;"><td style="padding:3px 10px;"><strong>0.0</strong></td><td style="padding:3px 10px;">模型预测与真实标签无关（随机水平）</td></tr>
  <tr><td style="padding:3px 10px;"><strong>-1.0</strong></td><td style="padding:3px 10px;">模型预测与真实标签完全负相关（搞反了）</td></tr>
</table>
<p style="margin: 6px 0; color: #909399; font-size: 12px;">计算方式：将锚点-正样本对的预测余弦相似度序列，与标注分数序列做 Pearson 相关分析。<strong>要求标注分数有方差</strong>（不能全是同一值），否则分母为 0，结果为 NaN。</p>

<h5 style="margin: 12px 0 6px; color: #409eff; font-size: 13px;">Top-1 准确率</h5>
<p style="margin: 6px 0;">衡量模型在<strong>排序检索</strong>中的精准度：</p>
<ol style="margin: 6px 0; padding-left: 20px;">
  <li>取一个锚点文本 + 1 个正样本 + 10 个随机干扰样本（共 11 个候选）</li>
  <li>模型计算锚点与所有候选的向量相似度并排序</li>
  <li>如果<strong>排第一的是正样本</strong> → 正确；否则 → 错误</li>
  <li>正确数 / 总测试数 = Top-1 准确率</li>
</ol>
<p style="margin: 6px 0;"><strong>含义</strong>：用户搜索时，最相关的结果排在第一位的概率。例如 Top-1 为 85%，表示 100 次搜索中有 85 次最优匹配排在首位。</p>

<h5 style="margin: 12px 0 6px; color: #409eff; font-size: 13px;">两者对比</h5>
<table style="margin: 10px 0;">
  <tr style="background:#f5f7fa;"><th style="padding:4px 10px;text-align:left;"></th><th style="padding:4px 10px;text-align:left;">Pearson</th><th style="padding:4px 10px;text-align:left;">Top-1</th></tr>
  <tr><td style="padding:3px 10px;">测什么</td><td style="padding:3px 10px;">相似度分数的校准度</td><td style="padding:3px 10px;">排序检索的精准度</td></tr>
  <tr style="background:#f5f7fa;"><td style="padding:3px 10px;">需要什么</td><td style="padding:3px 10px;">有方差的多级标注</td><td style="padding:3px 10px;">正负样本对比即可</td></tr>
  <tr><td style="padding:3px 10px;">受数据集大小影响</td><td style="padding:3px 10px;">敏感（需要足够样本）</td><td style="padding:3px 10px;">相对鲁棒</td></tr>
</table>
<p style="margin: 6px 0;">两者互补：<strong>Pearson 高说明分数可信，Top-1 高说明排序准</strong>。实际使用需要足够的训练数据（建议 200 对以上）才能得到有参考价值的指标。</p>
</div>

<div style="margin: 20px 0 8px; padding: 8px 12px; background: linear-gradient(135deg, #ecf5ff, #d9ecff); border-left: 4px solid #409eff; border-radius: 0 4px 4px 0; font-weight: 600; font-size: 14px; color: #303133;">
  Q16：模型训练用的是原始爬取字段还是数据增强后的字段？为什么？
</div>
<div style="margin: 0 0 16px 12px; padding: 0 8px; border-left: 2px solid #e4e7ed; color: #606266; font-size: 13px; line-height: 1.8;">

  <p style="margin: 6px 0;">训练数据源自 <code>trainingData.ts</code> 的 SQL 查询，<strong>以增强表为主，仅从原始表取 3 个标识性字段</strong>：</p>

  <pre style="margin: 8px 0; padding: 10px; background: #2d2d2d; color: #e6e6e6; border-radius: 4px; font-size: 12px; line-height: 1.6;">
SELECT
  e.job_id, e.job_category_l1, e.job_category_l2,      -- 增强表
  e.company_industry, e.key_skills, e.education_normalized, -- 增强表
  e.salary_monthly_min, e.salary_monthly_max, e.work_mode,  -- 增强表
  j.job_name, j.company_name, j.work_city               -- 原始表
FROM sp_job_enrichments e
LEFT JOIN sp_jobs j ON e.job_id = j.job_id AND e.task_id = j.task_id</pre>

  <p style="margin: 10px 0 4px;"><strong>字段来源对照</strong></p>
  <table style="margin: 8px 0; font-size: 13px; border-collapse: collapse;">
    <tr style="background: #f5f7fa;"><th style="padding: 4px 10px; text-align: left; border: 1px solid #e4e7ed;">来源</th><th style="padding: 4px 10px; text-align: left; border: 1px solid #e4e7ed;">字段</th><th style="padding: 4px 10px; text-align: left; border: 1px solid #e4e7ed;">用途</th></tr>
    <tr><td style="padding: 3px 10px; border: 1px solid #e4e7ed;">增强表</td><td style="padding: 3px 10px; border: 1px solid #e4e7ed;"><code>job_category_l1/l2</code></td><td style="padding: 3px 10px; border: 1px solid #e4e7ed;">职位分类（正负样本分组依据）</td></tr>
    <tr style="background: #f5f7fa;"><td style="padding: 3px 10px; border: 1px solid #e4e7ed;">增强表</td><td style="padding: 3px 10px; border: 1px solid #e4e7ed;"><code>company_industry</code></td><td style="padding: 3px 10px; border: 1px solid #e4e7ed;">公司行业分类</td></tr>
    <tr><td style="padding: 3px 10px; border: 1px solid #e4e7ed;">增强表</td><td style="padding: 3px 10px; border: 1px solid #e4e7ed;"><code>key_skills</code></td><td style="padding: 3px 10px; border: 1px solid #e4e7ed;">AI 提取的关键技能</td></tr>
    <tr style="background: #f5f7fa;"><td style="padding: 3px 10px; border: 1px solid #e4e7ed;">增强表</td><td style="padding: 3px 10px; border: 1px solid #e4e7ed;"><code>education_normalized</code></td><td style="padding: 3px 10px; border: 1px solid #e4e7ed;">学历标准化</td></tr>
    <tr><td style="padding: 3px 10px; border: 1px solid #e4e7ed;">增强表</td><td style="padding: 3px 10px; border: 1px solid #e4e7ed;"><code>salary_monthly_min/max</code></td><td style="padding: 3px 10px; border: 1px solid #e4e7ed;">薪资标准化数值</td></tr>
    <tr style="background: #f5f7fa;"><td style="padding: 3px 10px; border: 1px solid #e4e7ed;">增强表</td><td style="padding: 3px 10px; border: 1px solid #e4e7ed;"><code>work_mode</code></td><td style="padding: 3px 10px; border: 1px solid #e4e7ed;">工作模式</td></tr>
    <tr><td style="padding: 3px 10px; border: 1px solid #e4e7ed;">原始表</td><td style="padding: 3px 10px; border: 1px solid #e4e7ed;"><code>job_name</code></td><td style="padding: 3px 10px; border: 1px solid #e4e7ed;">职位名称标识</td></tr>
    <tr style="background: #f5f7fa;"><td style="padding: 3px 10px; border: 1px solid #e4e7ed;">原始表</td><td style="padding: 3px 10px; border: 1px solid #e4e7ed;"><code>company_name</code></td><td style="padding: 3px 10px; border: 1px solid #e4e7ed;">公司名称标识</td></tr>
    <tr><td style="padding: 3px 10px; border: 1px solid #e4e7ed;">原始表</td><td style="padding: 3px 10px; border: 1px solid #e4e7ed;"><code>work_city</code></td><td style="padding: 3px 10px; border: 1px solid #e4e7ed;">工作城市</td></tr>
  </table>

  <p style="margin: 10px 0 4px;"><strong>为什么必须用增强字段</strong></p>
  <p style="margin: 6px 0 0 16px;"><strong>1. 正负样本分组依赖增强字段</strong>：正样本 = 同 L2 分类（如都是"Java开发"），负样本 = 不同 L1 分类（如"技术" vs "销售"）。原始爬取数据根本没有 L1/L2 分类标签，不增强就分不了组。</p>
  <p style="margin: 6px 0 0 16px;"><strong>2. 原始字段格式不统一</strong>：薪资可能是 "10K-15K"、"1万-1.5万/月"、"面议"；技能可能混在职位描述里未提取。没有 AI 增强的标准化就无法生成可对比的训练文本。</p>
  <p style="margin: 6px 0 0 16px;"><strong>3. buildJobText() 需要 10 个维度</strong>：该函数拼接的训练文本包含 职位名+分类+子分类+技能+行业+公司+城市+学历+薪资+工作模式，其中 7 个维度来自增强表，仅 3 个来自原始表。</p>
</div>

<div style="margin: 20px 0 8px; padding: 8px 12px; background: linear-gradient(135deg, #ecf5ff, #d9ecff); border-left: 4px solid #409eff; border-radius: 0 4px 4px 0; font-weight: 600; font-size: 14px; color: #303133;">
  Q17：为什么训练完成的模型文件 500+MB，部署到 Ollama 后只有 200+MB？
</div>
<div style="margin: 0 0 16px 12px; padding: 0 8px; border-left: 2px solid #e4e7ed; color: #606266; font-size: 13px; line-height: 1.8;">
<p style="margin: 6px 0;">这是<strong>正常现象</strong>，两个数字代表不同含义：</p>

<h5 style="margin: 12px 0 6px; color: #409eff; font-size: 13px;">磁盘 500+MB — 完整训练产物</h5>
<p style="margin: 6px 0;"><code>data/models/model_{id}/</code> 目录包含训练过程的所有文件：</p>
<table style="margin: 10px 0;">
  <tr style="background:#f5f7fa;"><th style="padding:4px 10px;text-align:left;">文件/目录</th><th style="padding:4px 10px;text-align:left;">说明</th></tr>
  <tr><td style="padding:3px 10px;"><code>model.safetensors</code></td><td style="padding:3px 10px;">FP32 全精度模型权重（~500MB+）</td></tr>
  <tr style="background:#f5f7fa;"><td style="padding:3px 10px;"><code>optimizer.pt</code></td><td style="padding:3px 10px;">优化器状态（Adam 动量等，仅训练需要）</td></tr>
  <tr><td style="padding:3px 10px;"><code>scheduler.pt</code></td><td style="padding:3px 10px;">学习率调度器状态</td></tr>
  <tr style="background:#f5f7fa;"><td style="padding:3px 10px;"><code>tokenizer.json</code> + <code>vocab.txt</code></td><td style="padding:3px 10px;">分词器文件</td></tr>
  <tr><td style="padding:3px 10px;"><code>1_Pooling/</code>、<code>2_Dense/</code></td><td style="padding:3px 10px;">sentence-transformers 模块子目录</td></tr>
  <tr style="background:#f5f7fa;"><td style="padding:3px 10px;">中间检查点</td><td style="padding:3px 10px;">训练过程中的 snapshot</td></tr>
</table>

<h5 style="margin: 12px 0 6px; color: #409eff; font-size: 13px;">Ollama 200+MB — 纯推理格式</h5>
<p style="margin: 6px 0;">部署到 Ollama 时发生两件事：</p>
<p style="margin: 6px 0 0 16px;"><strong>1. 格式转换</strong>：PyTorch/SafeTensors → GGUF（Ollama 原生格式），丢掉优化器状态、调度器、检查点等训练专用文件，保留纯权重。</p>
<p style="margin: 6px 0 0 16px;"><strong>2. 自动量化压缩</strong>：FP32（32位浮点）→ Q4_K_M 或 Q4_0（4位整数），体积约缩到 <strong>1/2</strong>。例如 522.6MB 的 FP32 模型量化后约 270-280MB。</p>

<h5 style="margin: 12px 0 6px; color: #409eff; font-size: 13px;">结论</h5>
<pre style="margin: 8px 0; padding: 10px; background: #2d2d2d; color: #e6e6e6; border-radius: 4px; font-size: 12px; line-height: 1.6;">
522.6MB (磁盘)  = 训练完整产物（含优化器状态、检查点、全精度权重）
  274MB (Ollama) = 纯推理模型（GGUF格式 + 4bit量化，仅权重）
</pre>
<p style="margin: 6px 0;">两者精度差异在 embedding 场景下通常很小（余弦相似度下降 &lt;0.5%），不影响实际使用。训练产物保留在磁盘可以随时重新部署或以不同精度量化。</p>
</div>`
  },
  'feat-dashboard': {
    title: '数据看板与大屏',
    content: `<table>
  <tr><th>功能</th><th>说明</th></tr>
  <tr><td>数据看板</td><td>核心指标卡片、采集趋势、AI 增强覆盖率</td></tr>
  <tr><td>AI 全量洞察</td><td>一键生成综合数据洞察报告</td></tr>
  <tr><td>数据大屏</td><td>科技蓝全屏可视化大屏，适合投屏展示</td></tr>
</table>`
  },

  // ========== API 新分组 ==========
  'api-chat': {
    title: '对话与文档索引 (10)',
    content: `<table>
  <tr><th>路径</th><th>方法</th><th>说明</th></tr>
  <tr><td>/api/chat/send</td><td>POST</td><td>发送消息</td></tr>
  <tr><td>/api/chat/sessions</td><td>GET</td><td>会话列表</td></tr>
  <tr><td>/api/chat/sessions/:id</td><td>GET/DELETE</td><td>会话详情/删除</td></tr>
  <tr><td>/api/docs/index</td><td>POST</td><td>全量文档索引</td></tr>
  <tr><td>/api/docs/index/status</td><td>GET</td><td>索引统计</td></tr>
  <tr><td>/api/docs/index/records</td><td>GET</td><td>分页列表</td></tr>
  <tr><td>/api/docs/index/file</td><td>POST</td><td>上传文件索引</td></tr>
  <tr><td>/api/docs/index/source/:type</td><td>DELETE</td><td>按类型删除</td></tr>
  <tr><td>/api/docs/index/:sectionId</td><td>DELETE</td><td>按章节删除</td></tr>
</table>`
  },
  'api-training': {
    title: '模型训练 (9)',
    content: `<table>
  <tr><th>路径</th><th>方法</th><th>说明</th></tr>
  <tr><td>/api/training/dataset/build</td><td>POST</td><td>构建训练数据</td></tr>
  <tr><td>/api/training/dataset/list</td><td>GET</td><td>数据集列表</td></tr>
  <tr><td>/api/training/dataset/:id/preview</td><td>GET</td><td>预览样本</td></tr>
  <tr><td>/api/training/start</td><td>POST</td><td>启动训练</td></tr>
  <tr><td>/api/training/status/:id</td><td>GET</td><td>训练状态</td></tr>
  <tr><td>/api/training/list</td><td>GET</td><td>训练任务列表</td></tr>
  <tr><td>/api/training/:id</td><td>DELETE</td><td>删除任务</td></tr>
  <tr><td>/api/training/models</td><td>GET</td><td>模型列表</td></tr>
  <tr><td>/api/training/models/deploy</td><td>POST</td><td>部署模型</td></tr>
</table>`
  },

  // ========== 使用指南扩展 ==========
  'guide-resume': {
    title: '简历筛选',
    content: `<p>简历筛选提供三种处理模式，覆盖从"匹配外部职位"到"内部 HR 精准筛选"的完整链路。入口：<strong>语义搜索 → 简历筛选</strong>。</p>

<h4>模式一：职位匹配（外部职位搜索）</h4>
<ol>
  <li>在顶部切换开关选择「<strong>职位匹配</strong>」模式</li>
  <li>上传简历文件（PDF / DOCX / TXT）<strong>或</strong>直接粘贴简历文本</li>
  <li>调整参数：「返回数量」控制结果条数（5~50），「相似度」过滤低分结果（建议 ≥ 0.6）</li>
  <li>点击「<strong>开始匹配职位</strong>」</li>
  <li>右侧展示按相似度降序的职位卡片：职位名、公司、行业/城市标签、匹配度百分比、岗位 JD 摘要</li>
</ol>

<h4>模式二：结构解析（简历数字化）</h4>
<ol>
  <li>在顶部切换开关选择「<strong>结构解析</strong>」模式</li>
  <li>上传一份或多份简历文件（支持拖拽批量上传，最多 10 个文件）</li>
  <li>系统自动调用 LLM 提取结构化信息，存入简历库</li>
  <li>右侧展示解析结果：<strong>基本信息</strong>（姓名/学历/联系方式/学校）、<strong>求职意向</strong>（期望岗位/城市/薪资）、<strong>技能标签</strong>（含熟练度）、<strong>项目经验</strong>（可折叠面板）、<strong>证书/语言</strong>、<strong>自我评价</strong></li>
  <li>解析完成后简历自动生成语义向量，可用于后续匹配</li>
</ol>
<div style="margin: 8px 0; padding: 8px 14px; background: #fdf6ec; border-left: 4px solid #e6a23c; border-radius: 0 4px 4px 0;">
<strong>注意：</strong>若使用 DeepSeek 推理模型，需确保 LLM 配置的 maxTokens ≥ 16384，否则可能因推理 token 耗尽导致解析失败（报 REASONING_EXHAUSTED 错误）。
</div>

<h4>模式三：内部筛选（HR 精准打分）</h4>
<ol>
  <li>在顶部切换开关选择「<strong>内部筛选</strong>」模式</li>
  <li><strong>必须先上传简历</strong>：上传后系统自动完成结构解析（同模式二）</li>
  <li>在「目标岗位」下拉框中选择要匹配的内部岗位（可选"全部岗位"），下拉框数据来自「系统管理 → 内部岗位」中状态为"招聘中"的岗位</li>
  <li>点击「<strong>开始智能筛选</strong>」，系统执行三级融合打分</li>
  <li>右侧展示卡片含：
    <ul>
      <li><strong>总分大数字</strong>（按等级着色：绿≥80 / 黄≥60 / 灰≥40 / 红&lt;40）</li>
      <li><strong>推荐等级标签</strong>：强烈推荐 / 一般推荐 / 勉强匹配 / 不推荐</li>
      <li><strong>评分明细</strong>（点击展开）：硬性规则逐项检查（学历 ✓/✗、工作年限 ✓/✗、必备技能匹配/缺失清单）、语义相似度百分比 + 分数、技能加分明细、综合得分计算</li>
    </ul>
  </li>
  <li>筛选完成后可「<strong>保存到历史</strong>」或「<strong>导出 Excel</strong>」</li>
</ol>

<h4>内部岗位管理（前置准备）</h4>
<p>内部筛选模式依赖已录入的内部岗位数据。在「<strong>系统管理 → 内部岗位</strong>」中：</p>
<ol>
  <li>点击「新增」创建岗位，填写岗位名称、部门、描述、要求</li>
  <li>配置硬性筛选规则：学历要求、工作年限下限/上限、必备技能、加分技能、技能匹配模式（all=全部满足 / any=任一满足）</li>
  <li>设置招聘信息：期望城市、薪资范围、招聘人数、岗位状态</li>
  <li>保存后系统自动生成岗位语义向量（用于相似度匹配）</li>
</ol>

<h4>简历库管理</h4>
<p>所有通过结构解析或内部筛选模式上传的简历，自动存入简历库。入口：「<strong>语义搜索 → 简历库</strong>」：</p>
<ol>
  <li>表格展示全部简历（姓名/学历/工龄/技能/期望岗位/电话/解析置信度等）</li>
  <li>支持搜索（姓名/期望岗位/技能模糊匹配）</li>
  <li>点击「详情」查看完整 18 字段 + 项目经验折叠面板</li>
  <li>点击「编辑」人工修正 LLM 解析结果（学历/技能/项目等）</li>
  <li>「批量导入」一次上传最多 20 个文件并自动解析入库</li>
  <li>「导出 Excel」下载简历库全部数据（20 列含技能/证书展开文本）</li>
  <li>支持勾选 +「批量删除」</li>
</ol>

<h4>筛选历史</h4>
<p>内部筛选模式下点击「保存到历史」后，结果存入 <code>sp_screening_results</code> 表：</p>
<ol>
  <li>可通过 API <code>GET /api/rag/resume/screening/history</code> 查询历史记录</li>
  <li>导出 API <code>GET /api/rag/resume/screening/export</code> 生成含条件着色的 Excel 文件</li>
</ol>`
  },
  'guide-training': {
    title: '模型训练',
    content: `<ol>
  <li>进入「系统管理 → 模型训练」</li>
  <li>训练数据 Tab：选择已完成的任务，设置正样本策略，点击"构建数据集"</li>
  <li>训练任务 Tab：选择数据集和基座模型，设置 epochs/batch_size/lr，点击"开始训练"</li>
  <li>训练完成后在模型管理 Tab 点击"部署"，模型将加载到 Ollama</li>
  <li>注意：部署后向量维度可能变化，需要重新索引职位数据</li>
</ol>
<p><strong>前置条件</strong>：需要 Python 3.10+ 环境并安装 sentence-transformers 和 torch。</p>`
  },
  'guide-aibot': {
    title: 'AI 问答',
    content: `<ol>
  <li>进入「系统帮助 → 问答机器人」页面</li>
  <li>输入技术问题（如"如何配置新的 LLM 提供商？"）</li>
  <li>AI 基于项目文档和源代码进行 RAG 检索回答</li>
  <li>回答会引用相关的文档章节或代码文件路径</li>
  <li>支持多轮对话，左侧可切换历史会话</li>
</ol>`
  },

  // ========== 常见问题 ==========
  faq: {
    title: '常见问题',
    content: `<h4>Q: AI 增强只成功部分记录？</h4>
<p>检查后端日志，通常是 LLM 返回非标准 JSON 导致解析失败。系统已内置 3 层降级解析 + 3 次重试机制，重新点击 AI 增强即可补全。</p>

<h4>Q: 数据看板的技能词云不显示？</h4>
<p>需要安装 <code>echarts-wordcloud</code> 依赖。如遇 peer dependency 冲突，使用 <code>npm install echarts-wordcloud --legacy-peer-deps</code> 安装。</p>

<h4>Q: 黑龙江地图无法加载？</h4>
<p>确保 <code>public/230000_full.json</code> GeoJSON 文件存在。该文件在前端启动时通过 fetch 加载并注册到 ECharts。</p>

<h4>Q: 文件管理分页不准确？</h4>
<p>PostgreSQL 的 <code>pg</code> 驱动将 <code>COUNT(*)</code> 返回为字符串类型，前端已使用 <code>Number()</code> 转换处理。</p>

<h4>Q: 自然语言查询返回无关数据？</h4>
<p>确保 LLM 配置中任务路由包含 <code>query</code> 类型，且 Prompt 中已包含 <code>job_enrichments</code> 表结构。</p>

<h4>Q: 爬虫被反爬拦截？</h4>
<p>系统内置 WAF 检测 + 自动降级串行 + AI 页面分类。查看任务监控日志可看到拦截详情和三级恢复策略。</p>

<h4>Q: DeepSeek 推理模型返回空内容？</h4>
<p>推理模型（如 deepseek-v4-pro）的 thinking tokens 会占用 <code>max_tokens</code>。数据增强已设置 <code>maxTokens: 8192</code> 并移除 <code>response_format</code> 约束。</p>

<h4>Q: Playwright 内存占用高？</h4>
<p>限制并发任务数 ≤ 3，或使用 <code>node --max-old-space-size=4096</code> 增加内存。系统已配置孤儿标签页清理和资源拦截优化。</p>

<h4>Q: 代理池获取不到可用代理？</h4>
<p>代理健康检查仅允许 2xx 响应，拒绝 3xx/4xx/5xx。连续 5 次失败自动停止返回代理，系统回退直连模式。可检查 proxy_pool 服务是否正常运行。</p>

<h4>Q: 如何添加新的 LLM 提供商？</h4>
<ol>
  <li>在 <code>types/index.ts</code> 的 <code>LLMProvider</code> 类型中添加新值</li>
  <li>如需特殊 API 格式，在 <code>providers/</code> 下新建类</li>
  <li>在 <code>llmService.initialize()</code> 中注册</li>
</ol>

<h4>Q: 数据库表如何迁移？</h4>
<p>所有表在 <code>config/database.ts</code> 中通过 <code>CREATE TABLE IF NOT EXISTS</code> 自动迁移，后端启动时自动执行。目前共 19 张表。</p>

<h4>Q: 什么是 RBAC 系统管理？</h4>
<p>侧边栏「系统管理」提供用户/角色/权限/菜单的完整 CRUD 管理。支持本地账号密码登录（bcrypt 加密），角色可分配权限和菜单，实现细粒度访问控制。</p>`
  },
}

// ==================== 响应式状态 ====================
const route = useRoute()
const activeSection = ref('intro')

onMounted(() => {
  const section = route.query.section as string
  if (section && docs[section]) {
    activeSection.value = section
  }
})

watch(() => route.query.section, (section) => {
  if (section && docs[section as string]) {
    activeSection.value = section as string
  }
})

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
