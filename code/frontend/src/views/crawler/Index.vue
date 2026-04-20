<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useCrawlerStore } from '@/stores/crawler'
import { fileApi } from '@/api/file'
import { Plus, Loading, Document, VideoPlay, CircleCheck, DataAnalysis } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const router = useRouter()
const crawlerStore = useCrawlerStore()

onMounted(() => {
  crawlerStore.connectSocket()
  crawlerStore.loadTasks()
})

function goToCreate() {
  router.push('/crawler/create')
}

function goToMonitor(taskId: string) {
  router.push(`/crawler/monitor/${taskId}`)
}

function goToEdit(taskId: string) {
  router.push(`/crawler/edit/${taskId}`)
}

// 🔧 新增：下载任务结果文件
async function downloadTaskFile(taskId: string) {
  try {
    // 1. 根据taskId获取文件信息
    const res = await fileApi.getFileByTaskId(taskId)
    
    if (!res.data) {
      ElMessage.warning('该任务暂无结果文件')
      return
    }
    
    const fileId = res.data.id
    const filename = res.data.filename
    
    // 2. 下载文件
    const blobRes = await fileApi.downloadFile(fileId)
    // 🔧 修复：blobRes已经是Blob对象，直接使用
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

// 🔧 新增：分析任务数据
async function analyzeTask(taskId: string) {
  try {
    // 1. 根据taskId获取文件信息
    const res = await fileApi.getFileByTaskId(taskId)
    
    if (!res.data) {
      ElMessage.warning('该任务暂无结果文件')
      return
    }
    
    const fileId = res.data.id
    
    // 2. 跳转到分析页面，传递fileId参数
    router.push({
      path: '/analysis',
      query: { fileId }
    })
  } catch (error: any) {
    console.error('[Analyze] Error:', error)
    ElMessage.error(error.response?.data?.error || '无法获取文件信息')
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

// 🔧 安全的时间格式化函数
function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
  
  try {
    const date = new Date(dateStr)
    
    // 检查日期是否有效
    if (isNaN(date.getTime())) {
      console.warn('[FormatDateTime] Invalid date:', dateStr)
      return '-'
    }
    
    // 格式化为本地时间字符串
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
</script>

<template>
  <div class="crawler-page">
    <!-- 美化后的统计卡片 -->
    <el-row :gutter="20" class="stats-row">
      <!-- 总任务数 -->
      <el-col :span="6">
        <div class="stat-card stat-card-total">
          <div class="stat-icon">
            <el-icon :size="32"><Document /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ crawlerStore.statistics.total }}</div>
            <div class="stat-label">总任务数</div>
          </div>
        </div>
      </el-col>
      
      <!-- 运行中 -->
      <el-col :span="6">
        <div class="stat-card stat-card-running">
          <div class="stat-icon">
            <el-icon :size="32" class="running-icon"><VideoPlay /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ crawlerStore.statistics.running }}</div>
            <div class="stat-label">运行中</div>
          </div>
        </div>
      </el-col>
      
      <!-- 已完成 -->
      <el-col :span="6">
        <div class="stat-card stat-card-completed">
          <div class="stat-icon">
            <el-icon :size="32"><CircleCheck /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ crawlerStore.statistics.completed }}</div>
            <div class="stat-label">已完成</div>
          </div>
        </div>
      </el-col>
      
      <!-- 总数据量 -->
      <el-col :span="6">
        <div class="stat-card stat-card-records">
          <div class="stat-icon">
            <el-icon :size="32"><DataAnalysis /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ crawlerStore.statistics.records }}</div>
            <div class="stat-label">总数据量</div>
          </div>
        </div>
      </el-col>
    </el-row>

    <el-card class="task-list-card">
      <template #header>
        <div class="card-header">
          <span>任务列表</span>
          <el-button type="primary" :icon="Plus" @click="goToCreate">创建任务</el-button>
        </div>
      </template>

      <el-table :data="crawlerStore.tasks" stripe>
        <el-table-column prop="name" label="任务名称" min-width="200" />
        <el-table-column prop="source" label="数据来源" width="120">
          <template #default="{ row }">
            <el-tag>{{ row.source === 'zhilian' ? '智联招聘' : row.source === '51job' ? '前程无忧' : '全部' }}</el-tag>
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
        <el-table-column label="操作" width="420" fixed="right">
          <template #default="{ row }">
            <!-- 任务控制按钮 -->
            <el-button v-if="row.status === 'pending'" type="success" link @click="crawlerStore.startTask(row.id)">开始爬取</el-button>
            <el-button v-if="row.status === 'running'" type="danger" link @click="crawlerStore.stopTask(row.id)">停止</el-button>
            <el-button v-if="row.status === 'paused'" type="success" link @click="crawlerStore.resumeTask(row.id)">恢复</el-button>
            
            <!-- 监控/详情按钮 -->
            <el-button v-if="row.status === 'running' || row.status === 'paused'" type="primary" link @click="goToMonitor(row.id)">监控</el-button>
            <el-button v-else type="primary" link @click="goToMonitor(row.id)">详情</el-button>
            
            <!-- ✅ 配置按钮：所有状态都可配置（除了正在运行和暂停的任务） -->
            <el-button 
              v-if="row.status !== 'running' && row.status !== 'paused'" 
              type="warning" 
              link 
              @click="goToEdit(row.id)"
            >
              配置
            </el-button>
            
            <!-- 下载和分析按钮（仅completed状态可用） -->
            <el-button 
              v-if="row.status === 'completed'" 
              type="success" 
              link 
              @click="downloadTaskFile(row.id)"
            >
              下载
            </el-button>
            <el-button 
              v-if="row.status === 'completed'" 
              type="warning" 
              link 
              @click="analyzeTask(row.id)"
            >
              分析
            </el-button>
            
            <!-- 删除按钮 -->
            <el-button type="info" link @click="crawlerStore.deleteTask(row.id)">删除</el-button>
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
  margin-bottom: 24px;
}

/* 统计卡片基础样式 - 采用简约现代风格 */
.stat-card {
  background: #ffffff;
  border-radius: 12px;
  padding: 24px;
  display: flex;
  align-items: center;
  gap: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  border: 1px solid #e8eaed;
  transition: all 0.3s ease;
  cursor: pointer;
  position: relative;
  overflow: hidden;
}

/* 卡片悬停效果 - 轻微上浮和阴影加深 */
.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  border-color: #d0d3d9;
}

/* 左侧彩色装饰条 */
.stat-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  transition: width 0.3s ease;
}

.stat-card:hover::before {
  width: 6px;
}

/* 图标区域 - 浅色背景 */
.stat-icon {
  width: 56px;
  height: 56px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.3s ease;
}

.stat-card:hover .stat-icon {
  transform: scale(1.05);
}

/* 内容区域 */
.stat-content {
  flex: 1;
}

/* 数值样式 - 深色粗体 */
.stat-value {
  font-size: 32px;
  font-weight: 700;
  line-height: 1;
  margin-bottom: 6px;
  color: #1a1a1a;
  letter-spacing: -0.5px;
}

/* 标签样式 - 灰色中等字重 */
.stat-label {
  font-size: 14px;
  color: #6b7280;
  font-weight: 500;
  letter-spacing: 0.3px;
}

/* ===== 不同卡片的主题色 ===== */

/* 总任务数 - 蓝色系 */
.stat-card-total::before {
  background: linear-gradient(180deg, #3b82f6 0%, #2563eb 100%);
}

.stat-card-total .stat-icon {
  background: #eff6ff;
  color: #3b82f6;
}

.stat-card-total:hover .stat-icon {
  background: #dbeafe;
}

/* 运行中 - 橙色系 */
.stat-card-running::before {
  background: linear-gradient(180deg, #f59e0b 0%, #d97706 100%);
}

.stat-card-running .stat-icon {
  background: #fffbeb;
  color: #f59e0b;
}

.stat-card-running:hover .stat-icon {
  background: #fef3c7;
}

/* 已完成 - 绿色系 */
.stat-card-completed::before {
  background: linear-gradient(180deg, #10b981 0%, #059669 100%);
}

.stat-card-completed .stat-icon {
  background: #ecfdf5;
  color: #10b981;
}

.stat-card-completed:hover .stat-icon {
  background: #d1fae5;
}

/* 总数据量 - 紫色系 */
.stat-card-records::before {
  background: linear-gradient(180deg, #8b5cf6 0%, #7c3aed 100%);
}

.stat-card-records .stat-icon {
  background: #f5f3ff;
  color: #8b5cf6;
}

.stat-card-records:hover .stat-icon {
  background: #ede9fe;
}

/* 运行中图标的脉冲动画 - 更柔和 */
.running-icon {
  animation: gentle-pulse 2.5s ease-in-out infinite;
}

@keyframes gentle-pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.85;
    transform: scale(1.08);
  }
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.loading {
  animation: rotate 1s linear infinite;
}

@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
