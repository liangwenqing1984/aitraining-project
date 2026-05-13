<script setup lang="ts">
import { ref, nextTick, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ChatDotRound, User, Cpu, Promotion, Plus, Delete, Document, RefreshRight } from '@element-plus/icons-vue'
import { marked } from 'marked'
import {
  sendMessage,
  listSessions,
  getSessionMessages,
  deleteSession,
  getDocIndexStatus,
  triggerDocIndex,
  type ChatSession,
  type ChatMessage,
  type DocSource,
} from '@/api/chat'

interface UIMessage {
  role: 'user' | 'assistant'
  content: string
  sources?: DocSource[]
}

const loading = ref(false)
const inputText = ref('')
const messages = ref<UIMessage[]>([])
const sessions = ref<ChatSession[]>([])
const currentSessionId = ref<number | undefined>()
const chatContainer = ref<HTMLElement>()
const indexing = ref(false)
const indexStatus = ref<{ sectionCount: number; chunkCount: number; sourceBreakdown?: Record<string, number> }>({ sectionCount: 0, chunkCount: 0 })

const SOURCE_TYPE_LABELS: Record<string, string> = {
  doc_section: '帮助文档',
  user_doc: '用户手册',
  diagnostic: '诊断文档',
  design_doc: '设计文档',
  backend_source: '后端源代码',
  frontend_source: '前端源代码',
}

const SOURCE_TYPE_COLORS: Record<string, string> = {
  doc_section: '',
  user_doc: 'success',
  diagnostic: 'warning',
  design_doc: '',
  backend_source: 'danger',
  frontend_source: 'info',
}

const quickQuestions = [
  '系统支持哪些招聘平台？',
  '如何配置 AI 模型？',
  '数据采集支持哪些功能？',
  '什么是语义搜索 (RAG)？',
  '反爬策略有哪些？',
]

function formatTime(ts: string | undefined) {
  if (!ts) return ''
  const d = new Date(ts)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  if (isToday) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function renderMarkdown(text: string): string {
  try {
    return marked.parse(text, { breaks: true }) as string
  } catch {
    return text.replace(/\n/g, '<br>')
  }
}

async function doSend() {
  const q = inputText.value.trim()
  if (!q || loading.value) return

  loading.value = true
  messages.value.push({ role: 'user', content: q })
  inputText.value = ''

  await nextTick()
  scrollToBottom()

  try {
    const res = await sendMessage(q, currentSessionId.value)
    if (res.success && res.data) {
      currentSessionId.value = res.data.sessionId
      messages.value.push({
        role: 'assistant',
        content: res.data.message.content,
        sources: res.data.message.sources,
      })
      loadSessions()
    } else {
      ElMessage.error(res.error || '发送失败')
    }
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.error || '发送失败，请检查 AI 服务配置')
  } finally {
    loading.value = false
    await nextTick()
    scrollToBottom()
  }
}

function askQuestion(q: string) {
  inputText.value = q
  doSend()
}

function scrollToBottom() {
  if (chatContainer.value) {
    chatContainer.value.scrollTop = chatContainer.value.scrollHeight
  }
}

async function loadSessions() {
  try {
    const res = await listSessions()
    if (res.success) {
      sessions.value = res.data || []
    }
  } catch { /* ignore */ }
}

async function selectSession(session: ChatSession) {
  currentSessionId.value = session.id
  try {
    const res = await getSessionMessages(session.id!)
    if (res.success) {
      messages.value = (res.data || []).map((m: ChatMessage) => ({
        role: m.role,
        content: m.content,
        sources: m.sources,
      }))
      await nextTick()
      scrollToBottom()
    }
  } catch {
    ElMessage.error('加载会话消息失败')
  }
}

async function newChat() {
  currentSessionId.value = undefined
  messages.value = []
  inputText.value = ''
}

async function confirmDelete(session: ChatSession) {
  try {
    await ElMessageBox.confirm(`确定删除会话"${session.title}"？`, '删除确认', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    })
    await deleteSession(session.id!)
    if (currentSessionId.value === session.id) {
      newChat()
    }
    await loadSessions()
    ElMessage.success('会话已删除')
  } catch { /* cancelled */ }
}

async function handleIndexDocs() {
  indexing.value = true
  try {
    const res = await triggerDocIndex()
    if (res.success && res.data) {
      ElMessage.success(`索引完成：${res.data.indexed} 个章节，${res.data.skipped} 跳过`)
      await loadIndexStatus()
    } else {
      ElMessage.error(res.error || '索引失败')
    }
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.error || '索引失败，请检查 AI 服务和 pgvector 是否可用')
  } finally {
    indexing.value = false
  }
}

async function loadIndexStatus() {
  try {
    const res = await getDocIndexStatus()
    if (res.success && res.data) {
      indexStatus.value = res.data
    }
  } catch { /* ignore */ }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    doSend()
  }
}

onMounted(() => {
  loadSessions()
  loadIndexStatus()
})
</script>

<template>
  <div class="aibot-page">
    <!-- 左侧：会话列表 -->
    <aside class="session-sidebar">
      <div class="sidebar-header">
        <el-button type="primary" :icon="Plus" size="small" @click="newChat" style="width: 100%">
          新建对话
        </el-button>
      </div>

      <div class="session-list">
        <div
          v-for="session in sessions"
          :key="session.id"
          class="session-item"
          :class="{ active: currentSessionId === session.id }"
          @click="selectSession(session)"
        >
          <div class="session-info">
            <span class="session-title">{{ session.title }}</span>
            <span class="session-time">{{ formatTime(session.updatedAt) }}</span>
          </div>
          <el-button
            class="session-delete"
            :icon="Delete"
            text
            size="small"
            @click.stop="confirmDelete(session)"
          />
        </div>
        <el-empty v-if="sessions.length === 0" description="暂无对话" :image-size="48" />
      </div>

      <!-- 文档索引状态 -->
      <div class="index-status">
        <div class="index-info">
          <el-icon :size="14"><Document /></el-icon>
          <span v-if="indexStatus.sectionCount > 0">
            已索引 {{ indexStatus.chunkCount }} 片段
            <el-tooltip v-if="indexStatus.sourceBreakdown" placement="top">
              <template #content>
                <div v-for="(count, type) in indexStatus.sourceBreakdown" :key="type" style="line-height: 1.6">
                  {{ SOURCE_TYPE_LABELS[type] || type }}：{{ count }} 章节
                </div>
              </template>
              <span class="breakdown-hint">（{{ Object.keys(indexStatus.sourceBreakdown).length }} 类源）</span>
            </el-tooltip>
          </span>
          <span v-else class="not-indexed">文档未索引</span>
        </div>
        <el-button
          :icon="RefreshRight"
          text
          size="small"
          :loading="indexing"
          @click="handleIndexDocs"
          title="重新索引文档"
        />
      </div>
    </aside>

    <!-- 右侧：聊天区域 -->
    <div class="chat-panel">
      <!-- 消息区域 -->
      <div class="chat-messages" ref="chatContainer">
        <!-- 欢迎页 -->
        <div v-if="messages.length === 0" class="welcome-area">
          <el-icon :size="56" color="#409EFF"><ChatDotRound /></el-icon>
          <h2>AI 智能问答助手</h2>
          <p>基于帮助文档回答系统使用问题</p>
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

        <!-- 消息列表 -->
        <div
          v-for="(msg, idx) in messages"
          :key="idx"
          class="message-row"
          :class="msg.role"
        >
          <div class="message-avatar">
            <el-icon v-if="msg.role === 'user'" :size="18"><User /></el-icon>
            <el-icon v-else :size="18"><Cpu /></el-icon>
          </div>
          <div class="message-body">
            <div
              class="message-content"
              :class="msg.role"
              v-html="renderMarkdown(msg.content)"
            ></div>
            <!-- 引用来源 -->
            <div v-if="msg.sources && msg.sources.length > 0" class="message-sources">
              <span class="sources-label">参考来源：</span>
              <el-tag
                v-for="src in msg.sources"
                :key="src.sectionId"
                size="small"
                :type="(SOURCE_TYPE_COLORS[src.sourceType || ''] as any) || 'info'"
                class="source-tag"
              >
                <template v-if="src.sourceType">
                  <span class="source-type-badge">{{ SOURCE_TYPE_LABELS[src.sourceType] || src.sourceType }}</span>
                </template>
                {{ src.sectionTitle }}
              </el-tag>
            </div>
          </div>
        </div>

        <!-- 加载状态 -->
        <div v-if="loading" class="message-row assistant">
          <div class="message-avatar">
            <el-icon :size="18"><Cpu /></el-icon>
          </div>
          <div class="message-body">
            <div class="thinking-indicator">
              <span class="dot"></span><span class="dot"></span><span class="dot"></span>
              正在思考...
            </div>
          </div>
        </div>
      </div>

      <!-- 输入区域 -->
      <div class="chat-input">
        <el-input
          v-model="inputText"
          placeholder="输入问题，按 Enter 发送（Shift+Enter 换行）"
          @keydown="handleKeydown"
          :disabled="loading"
          type="textarea"
          :rows="2"
          resize="none"
        >
          <template #append>
            <el-button
              @click="doSend"
              :loading="loading"
              :icon="Promotion"
              type="primary"
            />
          </template>
        </el-input>
      </div>
    </div>
  </div>
</template>

<style scoped>
.aibot-page {
  height: 100%;
  display: flex;
  background: #f5f7fa;
}

/* ========== 左侧会话列表 ========== */
.session-sidebar {
  width: 260px;
  min-width: 260px;
  background: #fff;
  border-right: 1px solid #e4e7ed;
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  padding: 12px;
  border-bottom: 1px solid #e4e7ed;
}

.session-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.session-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
  margin-bottom: 4px;
}

.session-item:hover {
  background: #f0f2f5;
}

.session-item.active {
  background: #ecf5ff;
}

.session-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.session-title {
  font-size: 13px;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.session-time {
  font-size: 11px;
  color: #c0c4cc;
}

.session-delete {
  opacity: 0;
  transition: opacity 0.15s;
}

.session-item:hover .session-delete {
  opacity: 1;
}

/* 索引状态 */
.index-status {
  padding: 10px 12px;
  border-top: 1px solid #e4e7ed;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: #909399;
}

.index-info {
  display: flex;
  align-items: center;
  gap: 6px;
}

.not-indexed {
  color: #f56c6c;
}

/* ========== 右侧聊天区域 ========== */
.chat-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
}

/* 欢迎页 */
.welcome-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 12px;
}

.welcome-area h2 {
  font-size: 22px;
  color: #303133;
  margin: 0;
}

.welcome-area p {
  font-size: 14px;
  color: #909399;
  margin: 0;
}

.quick-questions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
  margin-top: 8px;
  max-width: 480px;
}

.quick-tag {
  cursor: pointer;
  transition: all 0.2s;
}

.quick-tag:hover {
  background: #409eff;
  color: #fff;
  border-color: #409eff;
}

/* 消息行 */
.message-row {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  max-width: 80%;
}

.message-row.user {
  margin-left: auto;
  flex-direction: row-reverse;
}

.message-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: #e8eaed;
}

.message-row.user .message-avatar {
  background: #409eff;
  color: #fff;
}

.message-row.assistant .message-avatar {
  background: #f0f2f5;
  color: #606266;
}

.message-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.message-content {
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.6;
  word-break: break-word;
}

.message-content.user {
  background: #409eff;
  color: #fff;
  border-top-right-radius: 4px;
}

.message-content.user :deep(p) { margin: 4px 0; }
.message-content.user :deep(code) {
  background: rgba(255,255,255,0.2);
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 13px;
}
.message-content.user :deep(pre) {
  background: rgba(0,0,0,0.15);
  padding: 8px;
  border-radius: 6px;
  overflow-x: auto;
  font-size: 13px;
}
.message-content.user :deep(pre code) {
  background: transparent;
  padding: 0;
}
.message-content.user :deep(table) { display: none; }

.message-content.assistant {
  background: #fff;
  color: #303133;
  border-top-left-radius: 4px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}

.message-content.assistant :deep(h3) {
  font-size: 16px;
  margin: 12px 0 6px;
}
.message-content.assistant :deep(h4) {
  font-size: 14px;
  margin: 10px 0 4px;
}
.message-content.assistant :deep(p) { margin: 6px 0; }
.message-content.assistant :deep(ul), .message-content.assistant :deep(ol) {
  padding-left: 20px;
  margin: 6px 0;
}
.message-content.assistant :deep(li) { margin: 3px 0; }
.message-content.assistant :deep(code) {
  background: #f5f7fa;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 13px;
  color: #e6a23c;
}
.message-content.assistant :deep(pre) {
  background: #282c34;
  padding: 12px;
  border-radius: 6px;
  overflow-x: auto;
  font-size: 13px;
}
.message-content.assistant :deep(pre code) {
  background: transparent;
  padding: 0;
  color: #abb2bf;
}
.message-content.assistant :deep(table) {
  border-collapse: collapse;
  margin: 8px 0;
  font-size: 13px;
}
.message-content.assistant :deep(th), .message-content.assistant :deep(td) {
  border: 1px solid #dcdfe6;
  padding: 6px 10px;
  text-align: left;
}
.message-content.assistant :deep(th) {
  background: #f5f7fa;
  font-weight: 600;
}
.message-content.assistant :deep(strong) { color: #303133; }

/* 引用来源 */
.message-sources {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  font-size: 12px;
}

.sources-label {
  color: #909399;
  white-space: nowrap;
}

.source-tag {
  cursor: default;
}

.source-type-badge {
  font-weight: 600;
}

.source-type-badge::after {
  content: ' · ';
  font-weight: 400;
  color: #c0c4cc;
}

.breakdown-hint {
  font-size: 11px;
  color: #409eff;
  cursor: pointer;
  margin-left: 2px;
}

/* 思考动画 */
.thinking-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 14px;
  background: #fff;
  border-radius: 12px;
  font-size: 13px;
  color: #909399;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}

.dot {
  width: 6px;
  height: 6px;
  background: #c0c4cc;
  border-radius: 50%;
  animation: dotPulse 1.4s infinite ease-in-out both;
}

.dot:nth-child(1) { animation-delay: -0.32s; }
.dot:nth-child(2) { animation-delay: -0.16s; }
.dot:nth-child(3) { animation-delay: 0s; }

@keyframes dotPulse {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
  40% { transform: scale(1); opacity: 1; }
}

/* 输入区域 */
.chat-input {
  padding: 12px 20px 16px;
  background: #fff;
  border-top: 1px solid #e4e7ed;
}

.chat-input :deep(.el-textarea__inner) {
  border-radius: 8px;
}

.chat-input :deep(.el-input-group__append) {
  border-radius: 0 8px 8px 0;
  padding: 0 6px;
}

@media (max-width: 768px) {
  .session-sidebar { display: none; }
  .message-row { max-width: 95%; }
}
</style>
