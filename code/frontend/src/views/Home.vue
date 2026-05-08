<script setup lang="ts">
import { useRouter } from 'vue-router'
import {
  Search, TrendCharts, Cpu, Monitor, Connection, MagicStick,
  Upload, Files, DataAnalysis, ChatDotRound,
  Right, CircleCheck
} from '@element-plus/icons-vue'

const router = useRouter()

const highlights = [
  {
    icon: Monitor, color: '#409eff', bg: '#ecf5ff',
    title: '多源智能爬取', desc: '支持智联招聘、51job 双源采集，IP代理池自动切换绕过WAF，浏览器级反爬对抗'
  },
  {
    icon: Cpu, color: '#67c23a', bg: '#f0f9eb',
    title: 'AI 数据增强', desc: 'LLM 自动标准化薪资、提取技能标签、分类职位/行业、规范化经验学历要求'
  },
  {
    icon: DataAnalysis, color: '#e6a23c', bg: '#fdf6ec',
    title: '多维智能分析', desc: '薪资分布/城市热度/技能图谱/企业性质等 7 维度图表，自动生成洞察报告'
  },
  {
    icon: ChatDotRound, color: '#f56c6c', bg: '#fef0f0',
    title: '自然语言查询', desc: '用中文提问即可查询数据，AI 自动生成 SQL JOIN 两张表返回全部关键字段'
  },
  {
    icon: Search, color: '#9b59b6', bg: '#f5f0ff',
    title: 'RAG 语义搜索', desc: '职位向量化索引 + 语义相似匹配，用描述搜到最匹配的岗位'
  },
  {
    icon: Connection, color: '#00b8ba', bg: '#e8fffe',
    title: 'IP 代理池', desc: '集成 jhao104/proxy_pool HTTP 正向代理，失效自动切换，健康检查保障可用率'
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
          <el-card shadow="hover" class="highlight-card" @click="goTo(item.title.includes('爬取') ? '/crawler' : item.title.includes('分析') ? '/analysis' : item.title.includes('查询') ? '/query' : item.title.includes('语义') ? '/rag' : item.title.includes('增强') ? '/crawler' : '/crawler')">
            <div class="highlight-top">
              <div class="highlight-icon" :style="{ background: item.bg, color: item.color }">
                <el-icon :size="24"><component :is="item.icon" /></el-icon>
              </div>
              <h3 class="highlight-title">{{ item.title }}</h3>
            </div>
            <p class="highlight-desc">{{ item.desc }}</p>
          </el-card>
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
