<template>
  <div class="nl-query-page">
    <div class="query-layout">
      <!-- 左侧：查询历史 -->
      <div class="history-panel">
        <div class="panel-header">
          <h3>查询历史</h3>
          <el-button size="small" text @click="loadHistory">刷新</el-button>
        </div>
        <div class="history-list">
          <div
            v-for="item in history"
            :key="item.id"
            class="history-item"
            :class="{ active: currentQuery?.id === item.id }"
            @click="selectHistory(item)"
          >
            <div class="history-query">{{ item.userQuery }}</div>
            <div class="history-meta">{{ item.resultCount }} 条结果 · {{ formatTime(item.createdAt) }}</div>
          </div>
          <el-empty v-if="history.length === 0" description="暂无查询记录" :image-size="60" />
        </div>
      </div>

      <!-- 右侧：对话区域 -->
      <div class="chat-panel">
        <div class="chat-header">
          <h3>智能数据查询</h3>
          <span class="chat-subtitle">用自然语言查询职位数据</span>
          <el-select
            v-model="selectedTaskId"
            placeholder="选择任务（可选）"
            clearable
            size="small"
            style="width: 220px; margin-left: auto;"
            :loading="loadingTasks"
          >
            <el-option
              v-for="t in taskList"
              :key="t.id"
              :label="t.name + ' (' + t.recordCount + '条)'"
              :value="t.id"
            />
          </el-select>
        </div>

        <div class="chat-messages" ref="chatContainer">
          <div v-if="messages.length === 0" class="welcome-area">
            <el-icon :size="48" color="#409EFF"><ChatDotRound /></el-icon>
            <h2>招聘数据智能查询助手</h2>
            <p>你可以用自然语言询问任何关于职位数据的问题</p>
            <div class="quick-questions">
              <el-tag
                v-for="q in quickQuestions"
                :key="q"
                class="quick-tag"
                @click="askQuestion(q)"
              >
                {{ q }}
              </el-tag>
            </div>
          </div>

          <div
            v-for="(msg, idx) in messages"
            :key="idx"
            class="message"
            :class="msg.role"
          >
            <div class="message-avatar">
              <el-icon v-if="msg.role === 'user'" :size="20"><User /></el-icon>
              <el-icon v-else :size="20"><Cpu /></el-icon>
            </div>
            <div class="message-body">
              <div class="message-text" v-html="msg.content"></div>
              <div v-if="msg.data && msg.data.length > 0" class="message-table">
                <el-table :data="msg.data.slice(0, 10)" border size="small" max-height="300">
                  <el-table-column
                    v-for="col in getTableColumns(msg.data)"
                    :key="col"
                    :prop="col"
                    :label="col"
                    min-width="120"
                    show-overflow-tooltip
                  />
                </el-table>
                <div v-if="msg.totalCount > 10" class="table-footer">
                  仅显示前 10 条，共 {{ msg.totalCount }} 条结果
                </div>
              </div>
              <div v-if="msg.sql" class="message-sql">
                <el-text type="info" size="small">SQL: {{ msg.sql }}</el-text>
              </div>
            </div>
          </div>

          <div v-if="loading" class="message assistant">
            <div class="message-avatar">
              <el-icon :size="20"><Cpu /></el-icon>
            </div>
            <div class="message-body">
              <div class="thinking-indicator">
                <span class="dot"></span><span class="dot"></span><span class="dot"></span>
                正在分析...
              </div>
            </div>
          </div>
        </div>

        <div class="chat-input">
          <el-input
            v-model="inputText"
            placeholder="输入查询问题，例如：薪资最高的10个岗位"
            @keyup.enter="sendQuery"
            :disabled="loading"
          >
            <template #append>
              <el-button @click="sendQuery" :loading="loading" :icon="Promotion" />
            </template>
          </el-input>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { ChatDotRound, User, Cpu, Promotion } from '@element-plus/icons-vue'
import { executeNLQuery, getNLQueryHistory, getEnrichmentStatus, type NLQueryResult } from '@/api/llm'
import { taskApi } from '@/api/task'

interface Message {
  role: 'user' | 'assistant'
  content: string
  data?: any[]
  totalCount?: number
  sql?: string
}

const loading = ref(false)
const inputText = ref('')
const messages = ref<Message[]>([])
const history = ref<NLQueryResult[]>([])
const currentQuery = ref<NLQueryResult | null>(null)
const chatContainer = ref<HTMLElement>()
const taskList = ref<any[]>([])
const selectedTaskId = ref<string>('')
const loadingTasks = ref(false)

const quickQuestions = [
  '薪资最高的10个岗位是哪些？',
  '各城市的岗位数量分布',
  '本科学历要求的岗位有多少个？',
  '热门技能排行前10名',
  '互联网行业的平均薪资范围',
]

function formatTime(ts: string) {
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

function getTableColumns(data: any[]) {
  if (!data || data.length === 0) return []
  const cols = new Set<string>()
  // Collect top 6 columns
  for (const row of data) {
    for (const key of Object.keys(row)) {
      cols.add(key)
      if (cols.size >= 6) break
    }
    if (cols.size >= 6) break
  }
  return [...cols]
}

async function sendQuery() {
  const q = inputText.value.trim()
  if (!q || loading.value) return

  loading.value = true
  messages.value.push({ role: 'user', content: q })
  inputText.value = ''

  await nextTick()
  scrollToBottom()

  try {
    const res: any = await executeNLQuery(q, selectedTaskId.value || undefined)
    if (res.success && res.data) {
      const d = res.data
      const summary = d.resultSummary || `共 ${d.resultCount} 条结果`
      messages.value.push({
        role: 'assistant',
        content: summary,
        data: d.resultData || [],
        totalCount: d.resultCount,
        sql: d.generatedSql,
      })
      currentQuery.value = d
      loadHistory()
    } else {
      ElMessage.error(res.error || '查询失败')
    }
  } catch (e: any) {
    ElMessage.error(e.response?.data?.error || '查询失败')
    messages.value.push({ role: 'assistant', content: '抱歉，查询出错了，请重试。' })
  } finally {
    loading.value = false
    await nextTick()
    scrollToBottom()
  }
}

function askQuestion(q: string) {
  inputText.value = q
  sendQuery()
}

function selectHistory(item: NLQueryResult) {
  currentQuery.value = item
  messages.value = [
    { role: 'user', content: item.userQuery },
    {
      role: 'assistant',
      content: item.resultSummary,
      data: item.resultData || [],
      totalCount: item.resultCount,
      sql: item.generatedSql,
    },
  ]
}

async function loadHistory() {
  try {
    const res: any = await getNLQueryHistory()
    if (res.success) {
      history.value = res.data || []
    }
  } catch {}
}

function scrollToBottom() {
  if (chatContainer.value) {
    chatContainer.value.scrollTop = chatContainer.value.scrollHeight
  }
}

async function loadTasks() {
  loadingTasks.value = true
  try {
    const res: any = await taskApi.listTasks({ page: 1, pageSize: 50 })
    if (res.success && res.data) {
      taskList.value = (res.data.tasks || res.data.rows || res.data || []).filter(
        (t: any) => t.recordCount > 0
      )
    }
  } catch { /* ignore */ }
  loadingTasks.value = false
}

onMounted(() => {
  loadHistory()
  loadTasks()
})
</script>

<style scoped>
.nl-query-page { height: calc(100vh - 64px); display: flex; flex-direction: column; }
.query-layout { display: flex; height: 100%; gap: 0; }

.history-panel {
  width: 260px; min-width: 260px; border-right: 1px solid #e4e7ed;
  background: #fafafa; display: flex; flex-direction: column;
}
.panel-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px 16px; border-bottom: 1px solid #e4e7ed;
}
.panel-header h3 { margin: 0; font-size: 14px; }
.history-list { flex: 1; overflow-y: auto; padding: 8px; }
.history-item {
  padding: 10px 12px; border-radius: 6px; cursor: pointer; margin-bottom: 4px;
  transition: background 0.2s;
}
.history-item:hover { background: #e8f4ff; }
.history-item.active { background: #d9ecff; }
.history-query { font-size: 13px; color: #303133; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.history-meta { font-size: 11px; color: #909399; margin-top: 4px; }

.chat-panel { flex: 1; display: flex; flex-direction: column; }
.chat-header {
  padding: 12px 20px; border-bottom: 1px solid #e4e7ed;
  display: flex; align-items: baseline; gap: 12px;
}
.chat-header h3 { margin: 0; font-size: 16px; }
.chat-subtitle { font-size: 12px; color: #909399; }

.chat-messages { flex: 1; overflow-y: auto; padding: 20px; }

.welcome-area { text-align: center; padding: 60px 20px; }
.welcome-area h2 { margin: 16px 0 8px; font-size: 20px; }
.welcome-area p { color: #909399; margin-bottom: 24px; }
.quick-questions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
.quick-tag { cursor: pointer; padding: 6px 14px; }
.quick-tag:hover { background: #409EFF; color: white; border-color: #409EFF; }

.message { display: flex; gap: 12px; margin-bottom: 20px; }
.message.user { flex-direction: row-reverse; }
.message-avatar {
  width: 32px; height: 32px; border-radius: 50%; display: flex;
  align-items: center; justify-content: center; flex-shrink: 0;
  background: #e8f4ff; color: #409EFF;
}
.message.user .message-avatar { background: #409EFF; color: white; }
.message-body { max-width: 75%; }
.message-text { line-height: 1.6; white-space: pre-wrap; }
.message-table { margin-top: 12px; }
.table-footer { text-align: center; color: #909399; font-size: 12px; margin-top: 8px; }
.message-sql { margin-top: 8px; padding: 8px 12px; background: #f5f7fa; border-radius: 4px; }

.thinking-indicator { color: #909399; display: flex; align-items: center; gap: 4px; }
.dot { width: 6px; height: 6px; border-radius: 50%; background: #409EFF; animation: blink 1.4s infinite both; }
.dot:nth-child(2) { animation-delay: 0.2s; }
.dot:nth-child(3) { animation-delay: 0.4s; }
@keyframes blink { 0%, 80%, 100% { opacity: 0; } 40% { opacity: 1; } }

.chat-input { padding: 12px 20px; border-top: 1px solid #e4e7ed; }
</style>
