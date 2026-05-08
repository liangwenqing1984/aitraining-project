<script setup lang="ts">
import { useRouter } from 'vue-router'
import {
  Search, TrendCharts, Cpu, Monitor, Connection, MagicStick,
  Upload, Files, DataAnalysis, ChatDotRound,
  Right, CircleCheck, InfoFilled
} from '@element-plus/icons-vue'

const router = useRouter()

const highlights = [
  {
    icon: Monitor, color: '#409eff', bg: '#ecf5ff',
    title: '多源智能爬取', desc: '支持智联招聘、51job 双源采集，IP代理池自动切换绕过WAF，浏览器级反爬对抗', docSection: 'feat-crawl',
    detail: `<p>基于 <strong>Puppeteer 浏览器自动化</strong> 实现真实浏览器环境下的数据采集，覆盖智联招聘和前程无忧两大主流招聘平台。</p>
<table>
  <tr><td>🖥️ 浏览器伪装</td><td>随机视口 + UA 轮换池 + 独立 userDataDir + 21 项 Chrome 启动参数 + Stealth 插件</td></tr>
  <tr><td>🕐 类人行为</td><td>分级延迟 2-10s + 渐进式懒加载滚动 + 批次间隔等待</td></tr>
  <tr><td>🔄 并发控制</td><td>最高并发 5 + 互斥锁序列化 newPage + WAF 检测后自动降级串行</td></tr>
  <tr><td>🛡️ WAF 对抗</td><td>AI 页面分类（6 种类型）+ 硬编码签名检测 + 三级恢复策略 + reportType=1 业务参数绕过</td></tr>
  <tr><td>🔁 断点续传</td><td>JSONB 存储断点坐标（组合索引+页码+职位索引），崩溃后精确恢复，最大 10 次重启</td></tr>
</table>`
  },
  {
    icon: Cpu, color: '#67c23a', bg: '#f0f9eb',
    title: 'AI 数据增强', desc: 'LLM 自动标准化薪资、提取技能标签、分类职位/行业、规范化经验学历要求', docSection: 'feat-enrich',
    detail: `<p>爬取完成后，通过 <strong>LLM 大模型</strong> 逐条对原始职位数据进行 8 个维度的结构化增强处理。</p>
<table>
  <tr><td>💰 薪资标准化</td><td>"15K-20K·13薪" → 月薪 15000-20000；支持万/年、千/月等格式归一化</td></tr>
  <tr><td>🏷️ 职位分类</td><td>14 个一级大类 + 细分子类，如"技术 > 后端开发"</td></tr>
  <tr><td>🏭 行业识别</td><td>互联网/金融/制造/医疗/教育等 14 类标准分类</td></tr>
  <tr><td>🔧 技能提取</td><td>必备技能 + 加分技能分离，技术栈关联分类</td></tr>
  <tr><td>🎓 学历规范</td><td>"本科及以上" → 本科；"硕士" → 硕士（5 级归一化）</td></tr>
  <tr><td>📅 经验年限</td><td>"3-5年经验" → 3-5；"应届生" → 0-1</td></tr>
</table>
<p style="margin-top:8px;color:#909399;font-size:12px">BATCH_SIZE=1 逐条处理 + 500ms 间隔 + 3 次重试 + 3 层 JSON 降级解析 + ON CONFLICT UPSERT 幂等</p>`
  },
  {
    icon: DataAnalysis, color: '#e6a23c', bg: '#fdf6ec',
    title: '多维智能分析', desc: '薪资分布/城市热度/技能图谱/企业性质等 7 维度图表，自动生成洞察报告', docSection: 'feat-insights',
    detail: `<p>基于 AI 增强后的结构化数据，自动聚合多维度统计并调用 LLM 生成<strong>专业市场洞察报告</strong>。</p>
<table>
  <tr><td>📊 7 维度图表</td><td>薪资分布(箱线图) + 城市热度(地图) + 技能词云 + 学历占比(饼图) + 经验分布(柱状图) + 行业占比 + 工作模式</td></tr>
  <tr><td>📈 ECharts 渲染</td><td>AI 直接输出 ECharts option 对象，前端无缝渲染，支持柱状图/饼图/折线图/散点图/雷达图</td></tr>
  <tr><td>📝 AI 报告</td><td>LLM 聚合统计 → 生成 Markdown 专业报告（含摘要+分段分析+关键发现+图表配置）</td></tr>
  <tr><td>📂 历史管理</td><td>sp_market_reports 表按 file_id 存储多版本报告，支持历史切换查看</td></tr>
  <tr><td>⚡ 实时反馈</td><td>WebSocket 分阶段推送进度 + 2 秒轮询双重保障报告加载</td></tr>
</table>`
  },
  {
    icon: ChatDotRound, color: '#f56c6c', bg: '#fef0f0',
    title: '自然语言查询', desc: '用中文提问即可查询数据，AI 自动生成 SQL JOIN 两张表返回全部关键字段', docSection: 'feat-query',
    detail: `<p>用户用 <strong>自然语言中文提问</strong>，系统自动完成 Text-to-SQL 全流程：解析意图 → 生成 SQL → 安全校验 → 执行查询 → LLM 总结。</p>
<table>
  <tr><td>🧠 智能解析</td><td>LLM 分析问题提取实体（Java、北京）、条件（5年以上）、聚合目标（平均薪资/Top 10）</td></tr>
  <tr><td>🗄️ Schema 注入</td><td>System Prompt 注入 job_enrichments 完整表结构（字段名/类型/枚举值），确保 SQL 字段正确</td></tr>
  <tr><td>🔒 安全白名单</td><td>仅允许 SELECT，拦截 INSERT/DROP/TRUNCATE 等危险操作；自动 LIMIT 500；多语句分号截断</td></tr>
  <tr><td>📋 结果总结</td><td>LLM 用 2-3 句话中文总结查询结果，包含关键数值和趋势</td></tr>
  <tr><td>📜 历史记录</td><td>saved_queries 表持久化原始问题 + 生成 SQL + 查询结果，支持回顾和重新执行</td></tr>
</table>
<p style="margin-top:8px;color:#909399;font-size:12px">示例："北京 Java 岗位薪资 20K 以上的有哪些"、"各城市前端岗位平均薪资对比"</p>`
  },
  {
    icon: Search, color: '#9b59b6', bg: '#f5f0ff',
    title: 'RAG 语义搜索', desc: '职位向量化索引 + 语义相似匹配，用描述搜到最匹配的岗位', docSection: 'feat-rag',
    detail: `<p>基于 <strong>pgvector 向量数据库 + Ollama Embedding</strong> 实现职位知识库的语义相似搜索，支持模糊语义匹配。</p>
<table>
  <tr><td>🧬 向量化</td><td>buildJobText() 拼接职位全文 → Ollama nomic-embed-text 生成 768 维向量</td></tr>
  <tr><td>🗂️ pgvector</td><td>vector(768) 类型存储 + IVFFlat 索引（100 lists, cosine_ops），近似搜索比全量快 10-100 倍</td></tr>
  <tr><td>📐 余弦相似度</td><td>1 - (embedding <=> query) 计算相似度 0~1，默认阈值 0.3</td></tr>
  <tr><td>🔍 查询扩展</td><td>短查询(≤10字符)自动触发 30+ 术语映射表扩展，解决语义稀疏问题</td></tr>
  <tr><td>🔄 幂等索引</td><td>ON CONFLICT (task_id, job_id) DO UPDATE，重复索引自动覆盖旧值</td></tr>
</table>
<p style="margin-top:8px;color:#909399;font-size:12px">示例搜索："需要5年以上经验的Java后端开发"、"金融行业本科学历的数据分析师"</p>`
  },
  {
    icon: Connection, color: '#00b8ba', bg: '#e8fffe',
    title: 'IP 代理池', desc: '集成 jhao104/proxy_pool HTTP 正向代理，失效自动切换，健康检查保障可用率', docSection: 'feat-proxy',
    detail: `<p>集成第三方 <strong>HTTP 正向代理池</strong>，为爬虫提供动态 IP 轮换能力，绕过目标网站的反爬 IP 封锁。</p>
<table>
  <tr><td>🌐 代理获取</td><td>从 proxy_pool API 获取匿名代理，获取后先验证可用性（访问目标站 8s 超时，仅 2xx 视为可用）</td></tr>
  <tr><td>🩺 健康检查</td><td>代理使用前必须通过连通性验证，拒绝 3xx/4xx/5xx 响应</td></tr>
  <tr><td>🗑️ 死代理黑名单</td><td>deadProxyCache Set 缓存失效代理，404/ECONNRESET/ETIMEDOUT/&lt;1KB 响应自动拉黑</td></tr>
  <tr><td>🔄 自动切换</td><td>ERR_TUNNEL_CONNECTION_FAILED 自动删代理 → 取新代理 → 浏览器重启</td></tr>
  <tr><td>⬇️ 降级直连</td><td>代理池耗尽时自动回退直连模式；连续 5 次失败停止返回代理</td></tr>
</table>
<p style="margin-top:8px;color:#909399;font-size:12px">智联使用浏览器级代理（--proxy-server），51job 仅 axios 回退路径使用代理</p>`
  },
]

const steps = [
  { key: 'create', title: '创建爬取任务', desc: '配置数据来源、关键词、城市等参数，支持批量创建' },
  { key: 'crawl', title: '自动采集数据', desc: '浏览器自动化爬取，断点续传，实时进度监控' },
  { key: 'enrich', title: 'AI 增强数据', desc: 'LLM 标准化薪资/技能/行业/学历，从原始文本提取结构化字段' },
  { key: 'analyze', title: '智能分析', desc: '查看 7 维度分析图表，AI 自动生成市场洞察报告' },
  { key: 'query', title: '自由查询', desc: '用自然语言提问，或通过语义搜索精准匹配职位' },
]

function goTo(route: string) {
  router.push(route)
}
function goToDoc(section: string) {
  router.push({ path: '/docs', query: { section } })
}
</script>

<template>
  <div class="home-page">
    <!-- 系统核心亮点 -->
    <section class="section">
      <div class="section-header">
        <h2>系统核心亮点</h2>
        <p class="section-subtitle">一站式招聘数据采集、增强、分析与智能检索平台</p>
      </div>
      <el-row :gutter="16">
        <el-col v-for="item in highlights" :key="item.title" :span="8" style="margin-bottom: 16px">
          <el-popover
            placement="bottom-start"
            :width="720"
            trigger="hover"
            :show-after="200"
            :hide-after="300"
            popper-class="highlight-detail-popover"
          >
            <template #reference>
              <el-card shadow="hover" class="highlight-card" @click="goTo(item.title.includes('爬取') ? '/crawler' : item.title.includes('分析') ? '/analysis' : item.title.includes('查询') ? '/query' : item.title.includes('语义') ? '/rag' : item.title.includes('增强') ? '/crawler' : '/crawler')">
                <div class="highlight-top">
                  <div class="highlight-icon" :style="{ background: item.bg, color: item.color }">
                    <el-icon :size="24"><component :is="item.icon" /></el-icon>
                  </div>
                  <h3 class="highlight-title">{{ item.title }}</h3>
                  <span class="highlight-info-icon" @click.stop="goToDoc(item.docSection)">
                    <el-icon :size="15"><InfoFilled /></el-icon>
                  </span>
                </div>
                <p class="highlight-desc">{{ item.desc }}</p>
              </el-card>
            </template>
            <div class="detail-content" v-html="item.detail"></div>
          </el-popover>
        </el-col>
      </el-row>
    </section>

    <!-- 操作流程指引 -->
    <section class="section">
      <div class="section-header">
        <h2>操作流程指引</h2>
        <p class="section-subtitle">5 步完成从数据采集到智能分析的全流程</p>
      </div>
      <el-card shadow="hover" class="flow-card">
        <div class="flow-steps">
          <div
            v-for="(step, index) in steps"
            :key="step.key"
            class="flow-step"
          >
            <div class="step-number">
              <span>{{ index + 1 }}</span>
            </div>
            <div class="step-content">
              <h4 class="step-title">{{ step.title }}</h4>
              <p class="step-desc">{{ step.desc }}</p>
            </div>
            <div v-if="index < steps.length - 1" class="step-arrow">
              <el-icon :size="20" color="#c0c4cc"><Right /></el-icon>
            </div>
          </div>
        </div>

        <el-divider />

        <!-- 快速入口 -->
        <div class="quick-entry">
          <span class="entry-label">快速开始：</span>
          <el-button type="primary" :icon="Monitor" @click="goTo('/crawler')">任务列表</el-button>
          <el-button type="success" :icon="Files" @click="goTo('/files')">文件管理</el-button>
          <el-button type="warning" :icon="DataAnalysis" @click="goTo('/analysis')">智能分析</el-button>
          <el-button type="danger" :icon="ChatDotRound" @click="goTo('/query')">智能查询</el-button>
          <el-button :icon="Search" style="color:#9b59b6;border-color:#9b59b6" @click="goTo('/rag')">语义搜索</el-button>
        </div>
      </el-card>
    </section>
  </div>
</template>

<style scoped>
.home-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 8px 0;
}

.section {
  margin-bottom: 28px;
}
.section-header {
  margin-bottom: 16px;
}
.section-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text-primary);
}
.section-subtitle {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--color-text-secondary);
}

/* 核心亮点卡片 */
.highlight-card {
  cursor: pointer;
  border-radius: var(--radius-lg) !important;
  transition: transform 0.2s, box-shadow 0.2s;
  height: 100%;
}
.highlight-card:hover {
  transform: translateY(-2px);
}
.highlight-top {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}
.highlight-icon {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.highlight-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary);
}
.highlight-desc {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--color-text-secondary);
}
.highlight-info-icon {
  margin-left: auto;
  flex-shrink: 0;
  color: #c0c4cc;
  cursor: pointer;
  display: flex;
  align-items: center;
  transition: color 0.2s;
}
.highlight-info-icon:hover {
  color: #409eff;
}

/* 操作流程 */
.flow-card {
  border-radius: var(--radius-lg) !important;
}
.flow-steps {
  display: flex;
  align-items: flex-start;
  padding: 8px 0;
}
.flow-step {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  flex: 1;
  min-width: 0;
}
.step-number {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, #409eff, #337ecc);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  flex-shrink: 0;
}
.step-content {
  min-width: 0;
}
.step-title {
  margin: 0 0 4px;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
  white-space: nowrap;
}
.step-desc {
  margin: 0;
  font-size: 12px;
  color: var(--color-text-secondary);
  line-height: 1.5;
}
.step-arrow {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  padding-top: 6px;
  margin: 0 4px;
}

/* 快速入口 */
.quick-entry {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.entry-label {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin-right: 4px;
}
</style>

<style>
/* popover 挂载在 body，需要非 scoped 样式 */
.highlight-detail-popover {
  padding: 4px 0 !important;
  background: #f0f7ff !important;
}
.detail-content {
  max-height: 620px;
  overflow-y: auto;
  font-size: 13px;
  line-height: 1.7;
  color: #303133;
}
.detail-content p {
  margin: 0 0 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid #ebeef5;
}
.detail-content table {
  width: 100%;
  border-collapse: collapse;
  margin: 8px 0;
  font-size: 12px;
}
.detail-content td {
  padding: 6px 8px;
  border-bottom: 1px solid #f0f0f0;
  vertical-align: top;
}
.detail-content td:first-child {
  white-space: nowrap;
  font-weight: 600;
  color: #606266;
  width: 90px;
}
.detail-content td:last-child {
  color: #303133;
}
</style>