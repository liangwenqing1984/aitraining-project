<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCrawlerStore } from '@/stores/crawler'
import { taskApi } from '@/api/task'
import { ElMessage } from 'element-plus'
import { Connection, CloseBold } from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()
const crawlerStore = useCrawlerStore()

const taskId = route.params.id as string
const logContainer = ref<HTMLElement>()
const taskConfig = ref<any>(null)

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

onMounted(async () => {
  crawlerStore.connectSocket()
  crawlerStore.subscribeTask(taskId)
  await crawlerStore.loadTasks()
  
  // 确保 tasks.value 是数组后再调用 find
  const task = Array.isArray(crawlerStore.tasks) 
    ? crawlerStore.tasks.find(t => t.id === taskId) || null 
    : null
  
  console.log('[TaskMonitor] onMounted - 找到的任务对象:', task)
  console.log('[TaskMonitor] onMounted - taskLogs Map大小:', crawlerStore.taskLogs.size)
  console.log('[TaskMonitor] onMounted - taskLogs Map keys:', Array.from(crawlerStore.taskLogs.keys()))
  
  // 🔧 修复: 使用setCurrentTask方法,确保日志数组被初始化
  crawlerStore.setCurrentTask(task)
  
  console.log('[TaskMonitor] onMounted - 设置后的currentTask:', crawlerStore.currentTask?.id)
  console.log('[TaskMonitor] onMounted - 当前任务日志数量:', crawlerStore.logs.length)
  console.log('[TaskMonitor] onMounted - logs数组引用:', crawlerStore.logs)
  
  // 🔧 新增: 加载历史日志(从后端读取)
  await loadHistoricalLogs()
  
  // 加载任务配置
  if (crawlerStore.currentTask) {
    try {
      const res: any = await taskApi.getTask(taskId)
      if (res.success && res.data) {
        // 后端返回的config可能已经是对象，也可能是字符串
        taskConfig.value = typeof res.data.config === 'string' 
          ? JSON.parse(res.data.config) 
          : res.data.config
      }
    } catch (error) {
      console.error('加载任务配置失败:', error)
    }
  } else {
    console.warn('[TaskMonitor] 未找到任务,taskId:', taskId)
    ElMessage.warning('任务不存在或数据加载失败')
  }
})

// 🔧 新增: 加载历史日志
async function loadHistoricalLogs() {
  try {
    console.log('[TaskMonitor] 📋 开始加载历史日志...')
    const res: any = await taskApi.getTaskLogs(taskId)
    
    if (res.success && res.data) {
      const historicalLogs = res.data.logs || []
      console.log(`[TaskMonitor] ✅ 成功加载 ${historicalLogs.length} 条历史日志`)
      
      // 将历史日志添加到 store 中
      historicalLogs.forEach((log: any) => {
        crawlerStore.addLogToTask(
          taskId, 
          log.level, 
          log.message,
          new Date(log.timestamp).toLocaleTimeString('zh-CN', { hour12: false })
        )
      })
      
      // 滚动到底部
      nextTick(() => {
        if (logContainer.value) {
          logContainer.value.scrollTop = logContainer.value.scrollHeight
        }
      })
    }
  } catch (error) {
    console.error('[TaskMonitor] ❌ 加载历史日志失败:', error)
    // 不显示错误提示,因为可能是新任务还没有日志
  }
}

// 🔧 修复：记录组件是否仍然挂载
let isComponentMounted = true

onUnmounted(() => {
  isComponentMounted = false
  
  // 🔧 关键修复：只有在任务已完成/失败/中止时才取消订阅
  // 如果任务仍在运行，保持WebSocket连接，让用户在其他页面也能看到进度
  const task = crawlerStore.tasks.find(t => t.id === taskId)
  const shouldUnsubscribe = !task || 
                           ['completed', 'failed', 'cancelled', 'stopped'].includes(task.status)
  
  if (shouldUnsubscribe) {
    console.log('[TaskMonitor] ✅ 任务已结束，取消WebSocket订阅')
    crawlerStore.unsubscribeTask(taskId)
  } else {
    console.log('[TaskMonitor] ⚠️ 任务仍在运行，保持WebSocket连接 (status:', task?.status, ')')
    // 不取消订阅，让Socket继续接收进度更新
  }
})

// 自动滚动日志 - 🔧 修复: 监听taskLogs Map而不是logs计算属性
watch(
  () => {
    if (!taskId) return 0
    const taskLogList = crawlerStore.taskLogs.get(taskId)
    return taskLogList ? taskLogList.length : 0
  },
  () => {
    nextTick(() => {
      if (logContainer.value) {
        logContainer.value.scrollTop = logContainer.value.scrollHeight
      }
    })
  }
)

function startTask() {
  crawlerStore.startTask(taskId)
}

function stopTask() {
  crawlerStore.stopTask(taskId)
}

function pauseTask() {
  crawlerStore.pauseTask(taskId)
}

function resumeTask() {
  crawlerStore.resumeTask(taskId)
}

function goBack() {
  router.push('/crawler')
}

function goToEdit() {
  router.push(`/crawler/edit/${taskId}`)
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

// 🔧 新增：WebSocket连接状态相关函数
function getConnectionStatusType() {
  if (crawlerStore.isConnected) {
    return 'success'
  } else if (crawlerStore.reconnectAttempts > 0 && crawlerStore.reconnectAttempts < crawlerStore.maxReconnectAttempts) {
    return 'warning'
  } else {
    return 'danger'
  }
}

function getConnectionStatusText() {
  if (crawlerStore.isConnected) {
    return '实时连接'
  } else if (crawlerStore.reconnectAttempts > 0 && crawlerStore.reconnectAttempts < crawlerStore.maxReconnectAttempts) {
    return `重连中 (${crawlerStore.reconnectAttempts}/${crawlerStore.maxReconnectAttempts})`
  } else if (crawlerStore.reconnectAttempts >= crawlerStore.maxReconnectAttempts) {
    return '连接失败'
  } else {
    return '未连接'
  }
}

</script>

<template>
  <div class="task-monitor-page" v-if="crawlerStore.currentTask">
    <!-- 页面操作栏 -->
    <el-card class="action-bar">
      <div class="actions">
        <el-button
          v-if="crawlerStore.currentTask.status === 'pending'"
          type="success"
          @click="startTask"
        >
          启动任务
        </el-button>
        <el-button
          v-if="crawlerStore.currentTask.status === 'pending' || crawlerStore.currentTask.status === 'stopped' || crawlerStore.currentTask.status === 'failed'"
          type="primary"
          @click="goToEdit"
        >
          配置任务
        </el-button>
        <el-button @click="goBack">返回列表</el-button>
      </div>
    </el-card>

    <!-- 任务基本信息 -->
    <el-row :gutter="16" class="info-row">
      <el-col :span="24">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>{{ crawlerStore.currentTask.name }}</span>
              <div class="header-tags">
                <!-- 🔧 新增：WebSocket连接状态指示器 -->
                <el-tooltip 
                  :content="getConnectionStatusText()" 
                  placement="top"
                >
                  <el-tag 
                    :type="getConnectionStatusType()" 
                    size="small"
                    effect="dark"
                    class="connection-status-tag"
                  >
                    <el-icon v-if="crawlerStore.isConnected" class="is-loading"><Connection /></el-icon>
                    <el-icon v-else><CloseBold /></el-icon>
                    {{ getConnectionStatusText() }}
                  </el-tag>
                </el-tooltip>
                
                <el-tag :type="getStatusType(crawlerStore.currentTask.status)">
                  {{ getStatusName(crawlerStore.currentTask.status) }}
                </el-tag>
              </div>
            </div>
          </template>

          <el-descriptions :column="3" border>
            <el-descriptions-item label="任务ID">{{ crawlerStore.currentTask.id }}</el-descriptions-item>
            <el-descriptions-item label="数据来源">
              <el-tag>{{ crawlerStore.currentTask.source === 'zhilian' ? '智联招聘' : crawlerStore.currentTask.source === '51job' ? '前程无忧' : '全部' }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="已采集">{{ crawlerStore.currentTask?.recordCount || 0 }} 条</el-descriptions-item>
            <el-descriptions-item label="创建时间">
              {{ formatDateTime(crawlerStore.currentTask.createdAt) }}
            </el-descriptions-item>
            <el-descriptions-item label="关键词" v-if="taskConfig">
              {{ taskConfig.keyword || '无' }}
            </el-descriptions-item>
            <el-descriptions-item label="城市" v-if="taskConfig">
              {{ taskConfig.city || taskConfig.province || '不限' }}
            </el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-col>
    </el-row>

    <!-- 爬取进度 -->
    <el-row :gutter="16" class="progress-row">
      <el-col :span="24">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>爬取进度</span>
              <div class="header-actions">
                <el-button
                  v-if="crawlerStore.currentTask.status === 'running'"
                  type="warning"
                  size="small"
                  @click="pauseTask"
                >
                  暂停
                </el-button>
                <el-button
                  v-if="crawlerStore.currentTask.status === 'paused'"
                  type="success"
                  size="small"
                  @click="resumeTask"
                >
                  恢复
                </el-button>
                <el-button
                  v-if="crawlerStore.currentTask.status === 'running' || crawlerStore.currentTask.status === 'paused'"
                  type="danger"
                  size="small"
                  @click="stopTask"
                >
                  停止
                </el-button>
              </div>
            </div>
          </template>
          
          <el-progress
            :percentage="crawlerStore.currentTask.progress"
            :status="crawlerStore.currentTask.status === 'completed' ? 'success' : undefined"
            :stroke-width="32"
          >
            <template #default="{ percentage }">
              <span style="color: white; font-size: 16px; font-weight: bold">{{ percentage }}%</span>
            </template>
          </el-progress>
          
          <div class="progress-details">
            <div class="progress-item">
              <span class="label">当前采集:</span>
              <span class="value">{{ crawlerStore.currentTask.current }}</span>
            </div>
            <div class="progress-item">
              <span class="label">已保存记录:</span>
              <span class="value">{{ crawlerStore.currentTask?.recordCount || 0 }}</span>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 实时日志 -->
    <el-card class="log-card">
      <template #header>
        <div class="log-header">
          <span>实时日志</span>
          <el-button type="primary" link @click="crawlerStore.clearLogs">清空</el-button>
        </div>
      </template>
      <div class="log-container" ref="logContainer">
        <div
          v-for="(log, index) in crawlerStore.logs"
          :key="index"
          :class="['log-item', log.level]"
        >
          <span class="log-time">{{ log.time }}</span>
          <span class="log-message">{{ log.message }}</span>
        </div>
        <div v-if="crawlerStore.logs.length === 0" class="log-empty">
          暂无日志，{{ crawlerStore.currentTask.status === 'pending' ? '请点击"启动任务"开始爬取' : '等待任务执行...' }}
        </div>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.task-monitor-page {
  padding: 0;
}

.action-bar {
  margin-bottom: 16px;
}

.actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.info-row {
  margin-bottom: 16px;
}

.progress-row {
  margin-bottom: 16px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

/* 🔧 新增：头部标签容器样式 */
.header-tags {
  display: flex;
  gap: 8px;
  align-items: center;
}

.connection-status-tag {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
}

.connection-status-tag .el-icon {
  font-size: 14px;
}

.header-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.progress-details {
  margin-top: 20px;
  display: flex;
  justify-content: space-around;
  padding: 16px;
  background: var(--color-bg-page);
  border-radius: var(--radius-md);
}

.progress-item {
  text-align: center;
}

.progress-item .label {
  display: block;
  color: var(--color-text-placeholder);
  font-size: var(--font-size-sm);
  margin-bottom: 4px;
}

.progress-item .value {
  display: block;
  color: var(--color-text-regular);
  font-size: 20px;
  font-weight: bold;
}

.log-card {
  margin-bottom: 16px;
}

.log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.log-container {
  height: 500px;
  overflow-y: auto;
  background: #f5f5f5;
  padding: var(--spacing-sm);
  border-radius: var(--radius-sm);
  font-family: 'Courier New', monospace;
  font-size: var(--font-size-sm);
}

.log-item {
  display: flex;
  gap: 12px;
  padding: 6px 0;
  border-bottom: 1px solid #e0e0e0;
  line-height: 1.6;
}

.log-item:last-child {
  border-bottom: none;
}

.log-time {
  color: #999;
  font-size: var(--font-size-xs);
  min-width: 80px;
  flex-shrink: 0;
}

.log-message {
  flex: 1;
  word-break: break-all;
}

.log-item.info .log-message {
  color: #333;
}

.log-item.success .log-message {
  color: #67c23a;
}

.log-item.warning .log-message {
  color: #e6a23c;
}

.log-item.error .log-message {
  color: #f56c6c;
}

.log-empty {
  text-align: center;
  color: #999;
  padding: 40px 0;
}
</style>
