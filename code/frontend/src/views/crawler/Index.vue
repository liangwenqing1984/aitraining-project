<script setup lang="ts">
import { onMounted, computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useCrawlerStore } from '@/stores/crawler'
import { fileApi } from '@/api/file'
import { startEnrichment as startEnrichApi, getEnrichmentStatus } from '@/api/llm'
import { Plus, Document, VideoPlay, CircleCheck, DataAnalysis, Download, TrendCharts, Setting, Delete } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { Task } from '@/api/task'
import StatCard from '@/components/StatCard.vue'

const router = useRouter()
const crawlerStore = useCrawlerStore()

onMounted(() => {
  crawlerStore.connectSocket()
  crawlerStore.loadTasks()
})

function goToCreate() {
  router.push('/crawler/create')
}

function goToBatchCreate() {
  router.push('/crawler/batch-create')
}

function goToMonitor(taskId: string) {
  router.push(`/crawler/monitor/${taskId}`)
}

function goToEdit(taskId: string) {
  router.push(`/crawler/edit/${taskId}`)
}

// 下载任务结果文件
async function downloadTaskFile(taskId: string) {
  try {
    const res = await fileApi.getFileByTaskId(taskId)
    
    if (!res.data) {
      ElMessage.warning('该任务暂无结果文件')
      return
    }
    
    const fileId = res.data.id
    const filename = res.data.filename
    
    const blobRes = await fileApi.downloadFile(fileId)
    const url = window.URL.createObjectURL(blobRes as any)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    
    ElMessage.success('文件下载成功')
  } catch (error: any) {
    console.error('[Download] Error:', error)
    ElMessage.error(error.response?.data?.error || '下载失败')
  }
}

// 分析任务数据
async function analyzeTask(taskId: string) {
  try {
    const res = await fileApi.getFileByTaskId(taskId)
    
    if (!res.data) {
      ElMessage.warning('该任务暂无结果文件')
      return
    }
    
    const fileId = res.data.id
    
    router.push({
      path: '/analysis',
      query: { fileId }
    })
  } catch (error: any) {
    console.error('[Analyze] Error:', error)
    ElMessage.error(error.response?.data?.error || '无法获取文件信息')
  }
}

// AI 增强状态追踪
const enrichingTasks = ref<Record<string, boolean>>({})

async function enrichTask(taskId: string) {
  try {
    await ElMessageBox.confirm(
      '将使用 AI 对职位数据进行标准化增强（薪资标准化、技能提取、行业分类等），是否继续？',
      '确认 AI 增强',
      { confirmButtonText: '开始增强', cancelButtonText: '取消', type: 'info' }
    )
    enrichingTasks.value[taskId] = true
    await startEnrichApi(taskId)
    ElMessage.success('数据增强已启动，处理完成后将自动更新')
    // 延迟刷新增强状态
    setTimeout(() => checkEnrichStatus(taskId), 3000)
  } catch (e: any) {
    if (e !== 'cancel') {
      ElMessage.error(e.response?.data?.error || e.message || '启动增强失败')
    }
    enrichingTasks.value[taskId] = false
  }
}

async function checkEnrichStatus(taskId: string) {
  try {
    const res = await getEnrichmentStatus(taskId)
    if (res.data?.exists) {
      enrichingTasks.value[taskId] = false
      ElMessage.success(`数据增强完成，共 ${res.data.total} 条记录`)
    } else {
      // 还未完成，继续等待
      setTimeout(() => checkEnrichStatus(taskId), 5000)
    }
  } catch {
    enrichingTasks.value[taskId] = false
  }
}

function getStatusType(status: string) {
  const types: Record<string, any> = {
    pending: 'info',
    running: 'warning',
    paused: 'info',
    completed: 'success',
    stopped: 'info',
    failed: 'danger'
  }
  return types[status] || 'info'
}

function getStatusName(status: string) {
  const names: Record<string, string> = {
    pending: '待执行',
    running: '爬取中',
    paused: '已暂停',
    completed: '已完成',
    stopped: '已停止',
    failed: '执行失败'
  }
  return names[status] || status
}

// 安全的时间格式化函数
function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
  
  try {
    const date = new Date(dateStr)
    
    if (isNaN(date.getTime())) {
      console.warn('[FormatDateTime] Invalid date:', dateStr)
      return '-'
    }
    
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    })
  } catch (error) {
    console.error('[FormatDateTime] Error formatting date:', error, dateStr)
    return '-'
  }
}

// 解析任务配置并生成关键词详情
interface KeywordDetailInfo {
  keywords: string[]
  cities: string[]
  companies: string[]
  displayText: string
}

// 辅助函数：截断数组并添加省略提示
function truncateArray(arr: string[], maxCount: number = 3): { items: string[], hasMore: boolean } {
  if (arr.length <= maxCount) {
    return { items: arr, hasMore: false }
  }
  return { 
    items: arr.slice(0, maxCount), 
    hasMore: true 
  }
}

function getKeywordDetails(task: Task): KeywordDetailInfo {
  try {
    const config = typeof task.config === 'string' ? JSON.parse(task.config) : task.config
    
    const keywords = config.keywords || (config.keyword ? [config.keyword] : [])
    const cities = config.cities || (config.city ? [config.city] : [])
    const companies = config.companies || (config.company ? [config.company] : [])
    
    const parts = []
    
    if (keywords.length > 0) {
      const truncated = truncateArray(keywords, 3)
      const keywordText = truncated.items.join(',')
      parts.push(`职位:${keywordText}${truncated.hasMore ? '...' : ''}`)
    }
    
    if (cities.length > 0) {
      const truncated = truncateArray(cities, 3)
      const cityText = truncated.items.join(',')
      parts.push(`城市:${cityText}${truncated.hasMore ? '...' : ''}`)
    }
    
    if (companies.length > 0) {
      const truncated = truncateArray(companies, 3)
      const companyText = truncated.items.join(',')
      parts.push(`企业:${companyText}${truncated.hasMore ? '...' : ''}`)
    }
    
    const displayText = parts.length > 0 ? parts.join(' | ') : '-'
    
    return { keywords, cities, companies, displayText }
  } catch (error) {
    console.error('[KeywordDetails] Error parsing config:', error)
    return { keywords: [], cities: [], companies: [], displayText: '-' }
  }
}

// 缓存关键词详情，避免模板中重复调用
const keywordDetailsCache = computed(() => {
  const cache: Record<string, KeywordDetailInfo> = {}
  if (Array.isArray(crawlerStore.tasks)) {
    for (const task of crawlerStore.tasks) {
      cache[task.id] = getKeywordDetails(task)
    }
  }
  return cache
})

function getCachedKeywordDetails(task: Task): KeywordDetailInfo {
  return keywordDetailsCache.value[task.id] || { keywords: [], cities: [], companies: [], displayText: '-' }
}

// 删除任务 - 带确认弹窗
async function handleDeleteTask(taskId: string) {
  try {
    await ElMessageBox.confirm('确定要删除此任务吗？删除后无法恢复。', '确认删除', {
      confirmButtonText: '确定删除',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await crawlerStore.deleteTask(taskId)
    ElMessage.success('任务已删除')
  } catch {
    // 用户取消
  }
}

</script>

<template>
  <div class="crawler-page">
    <!-- 统计卡片 -->
    <el-row :gutter="20" class="stats-row">
      <el-col :xs="12" :sm="12" :md="6">
        <StatCard :value="crawlerStore.statistics.total" label="总任务数" :icon="Document" theme="primary" />
      </el-col>
      <el-col :xs="12" :sm="12" :md="6">
        <StatCard :value="crawlerStore.statistics.running" label="运行中" :icon="VideoPlay" theme="warning" />
      </el-col>
      <el-col :xs="12" :sm="12" :md="6">
        <StatCard :value="crawlerStore.statistics.completed" label="已完成" :icon="CircleCheck" theme="success" />
      </el-col>
      <el-col :xs="12" :sm="12" :md="6">
        <StatCard :value="crawlerStore.statistics.records" label="总数据量" :icon="DataAnalysis" theme="info" />
      </el-col>
    </el-row>

    <el-card class="task-list-card">
      <template #header>
        <div class="card-header">
          <span>任务列表</span>
          <div class="header-actions">
            <el-button type="success" @click="goToBatchCreate">
              批量创建
            </el-button>
            <el-button type="primary" :icon="Plus" @click="goToCreate">创建任务</el-button>
          </div>
        </div>
      </template>

      <!-- 空状态 -->
      <el-empty v-if="!crawlerStore.tasks || crawlerStore.tasks.length === 0" description="暂无任务">
        <el-button type="primary" @click="goToCreate">创建第一个任务</el-button>
      </el-empty>

      <el-table v-else :data="crawlerStore.tasks" stripe>
        <el-table-column prop="name" label="任务名称" min-width="150" />
        <el-table-column prop="source" label="数据来源" width="120">
          <template #default="{ row }">
            <el-tag>{{ row.source === 'zhilian' ? '智联招聘' : row.source === '51job' ? '前程无忧' : '全部' }}</el-tag>
          </template>
        </el-table-column>
        
        <!-- 职位关键词列 -->
        <el-table-column label="职位关键词" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">
            <el-popover
              placement="top"
              :width="450"
              trigger="hover"
              popper-class="keyword-detail-popover-wrapper"
            >
              <template #reference>
                <div class="keyword-summary">
                  {{ getCachedKeywordDetails(row).displayText }}
                </div>
              </template>
              
              <!-- 悬浮详情内容 -->
              <div class="keyword-detail-popover">
                <template v-if="getCachedKeywordDetails(row).keywords.length > 0 || getCachedKeywordDetails(row).cities.length > 0 || getCachedKeywordDetails(row).companies.length > 0">
                  <div v-if="getCachedKeywordDetails(row).keywords.length > 0" class="detail-section">
                    <div class="detail-label">
                      <el-icon class="label-icon"><Document /></el-icon>
                      职位关键词（{{ getCachedKeywordDetails(row).keywords.length }}个）：
                    </div>
                    <div class="detail-tags">
                      <el-tag 
                        v-for="(kw, index) in getCachedKeywordDetails(row).keywords" 
                        :key="'kw-' + index" 
                        size="small" 
                        effect="plain"
                        class="keyword-tag"
                      >
                        {{ kw }}
                      </el-tag>
                    </div>
                  </div>
                  
                  <el-divider v-if="getCachedKeywordDetails(row).keywords.length > 0 && (getCachedKeywordDetails(row).cities.length > 0 || getCachedKeywordDetails(row).companies.length > 0)" style="margin: 8px 0" />
                  
                  <div v-if="getCachedKeywordDetails(row).cities.length > 0" class="detail-section">
                    <div class="detail-label">
                      <el-icon class="label-icon"><DataAnalysis /></el-icon>
                      城市（{{ getCachedKeywordDetails(row).cities.length }}个）：
                    </div>
                    <div class="detail-tags">
                      <el-tag 
                        v-for="(city, index) in getCachedKeywordDetails(row).cities" 
                        :key="'city-' + index" 
                        size="small" 
                        type="success"
                        effect="plain"
                        class="city-tag"
                      >
                        {{ city }}
                      </el-tag>
                    </div>
                  </div>
                  
                  <el-divider v-if="getCachedKeywordDetails(row).cities.length > 0 && getCachedKeywordDetails(row).companies.length > 0" style="margin: 8px 0" />
                  
                  <div v-if="getCachedKeywordDetails(row).companies.length > 0" class="detail-section">
                    <div class="detail-label">
                      <el-icon class="label-icon"><Setting /></el-icon>
                      目标企业（{{ getCachedKeywordDetails(row).companies.length }}个）：
                    </div>
                    <div class="detail-tags">
                      <el-tag 
                        v-for="(comp, index) in getCachedKeywordDetails(row).companies" 
                        :key="'comp-' + index" 
                        size="small" 
                        type="warning"
                        effect="plain"
                        class="company-tag"
                      >
                        {{ comp }}
                      </el-tag>
                    </div>
                  </div>
                </template>
                
                <div v-else class="detail-empty">
                  <el-empty description="暂无配置信息" :image-size="60" />
                </div>
              </div>
            </el-popover>
          </template>
        </el-table-column>
        
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">{{ getStatusName(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="进度" width="150">
          <template #default="{ row }">
            <el-progress :percentage="row.progress" :status="row.status === 'completed' ? 'success' : undefined" />
          </template>
        </el-table-column>
        <el-table-column label="记录数" width="100">
          <template #default="{ row }">
            {{ row.recordCount || 0 }}
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDateTime(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="320" fixed="right">
          <template #default="{ row }">
            <div class="action-buttons">
            <!-- 任务控制按钮 -->
            <el-button v-if="row.status === 'pending'" type="success" link size="small" @click="crawlerStore.startTask(row.id)">开始</el-button>
            <el-button v-if="row.status === 'running'" type="danger" link size="small" @click="crawlerStore.stopTask(row.id)">停止</el-button>
            <el-button v-if="row.status === 'paused'" type="success" link size="small" @click="crawlerStore.resumeTask(row.id)">恢复</el-button>
            
            <!-- 监控/详情按钮 -->
            <el-button v-if="row.status === 'running' || row.status === 'paused'" type="primary" link size="small" @click="goToMonitor(row.id)">监控</el-button>
            <el-button v-else type="primary" link size="small" @click="goToMonitor(row.id)">详情</el-button>
            
            <!-- 配置按钮 -->
            <el-button 
              v-if="row.status !== 'running' && row.status !== 'paused'" 
              type="warning" 
              link 
              size="small"
              @click="goToEdit(row.id)"
            >
              配置
            </el-button>
            
            <!-- 下载和分析按钮 -->
            <el-button
              v-if="row.status === 'completed'"
              type="success"
              link
              size="small"
              @click="downloadTaskFile(row.id)"
            >
              <el-icon class="action-icon"><Download /></el-icon>下载
            </el-button>
            <el-button
              v-if="row.status === 'completed'"
              type="warning"
              link
              size="small"
              @click="analyzeTask(row.id)"
            >
              <el-icon class="action-icon"><TrendCharts /></el-icon>分析
            </el-button>
            <el-button
              v-if="row.status === 'completed'"
              type="success"
              link
              size="small"
              :loading="enrichingTasks[row.id]"
              @click="enrichTask(row.id)"
            >
              <el-icon class="action-icon"><DataAnalysis /></el-icon>AI 增强
            </el-button>
            
            <!-- 删除按钮 - 带确认 -->
            <el-button type="info" link size="small" @click="handleDeleteTask(row.id)">
              <el-icon class="action-icon"><Delete /></el-icon>删除
            </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<style scoped>
.crawler-page {
  padding: 0;
}

/* 统计卡片容器 */
.stats-row {
  margin-bottom: var(--spacing-lg);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

/* 关键词详情样式 */
.keyword-summary {
  cursor: pointer;
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
  color: var(--color-text-regular);
  font-size: var(--font-size-sm);
  line-height: 1.6;
  background-color: #fafafa;
  border: 1px solid transparent;
}

.keyword-summary:hover {
  background-color: var(--color-bg-hover);
  border-color: var(--color-border-light);
  color: var(--color-text-primary);
}

.keyword-detail-popover {
  padding: 4px 0;
  max-height: 400px;
  overflow-y: auto;
}

.detail-section {
  margin-bottom: 12px;
  padding: 0 4px;
}

.detail-section:last-child {
  margin-bottom: 0;
}

.detail-label {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-regular);
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.label-icon {
  font-size: 16px;
  display: inline-block;
}

.detail-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding-left: 22px;
}

/* 职位关键词标签样式 */
.keyword-tag {
  background-color: #ecf5ff;
  border-color: #d9ecff;
  color: #409eff;
  font-weight: 500;
  transition: all var(--transition-fast);
}

.keyword-tag:hover {
  background-color: #d9ecff;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(64, 158, 255, 0.2);
}

/* 城市标签样式 */
.city-tag {
  background-color: #f0f9ff;
  border-color: #e1f3ff;
  color: var(--color-success);
  font-weight: 500;
  transition: all var(--transition-fast);
}

.city-tag:hover {
  background-color: #e1f3ff;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(16, 185, 129, 0.2);
}

/* 企业标签样式 */
.company-tag {
  background-color: #fdf6ec;
  border-color: #faecd8;
  color: #e6a23c;
  font-weight: 500;
  transition: all var(--transition-fast);
}

.company-tag:hover {
  background-color: #faecd8;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(230, 162, 60, 0.2);
}

.detail-empty {
  text-align: center;
  color: var(--color-text-placeholder);
  font-size: var(--font-size-sm);
  padding: 20px 0;
}

/* 自定义滚动条样式 */
.keyword-detail-popover::-webkit-scrollbar {
  width: 6px;
}

.keyword-detail-popover::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.keyword-detail-popover::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.keyword-detail-popover::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

/* 操作按钮一行显示 */
.action-buttons {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 2px;
  white-space: nowrap;
}

/* 操作图标样式 */
.action-icon {
  margin-right: 2px;
  font-size: 13px;
}
</style>
