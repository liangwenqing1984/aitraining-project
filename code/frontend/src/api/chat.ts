import api from './index'

export interface ChatSession {
  id?: number
  title: string
  createdAt?: string
  updatedAt?: string
}

export interface DocSource {
  sectionId: string
  sectionTitle: string
  similarity: number
  sourceType?: string
}

export interface ChatMessage {
  id?: number
  sessionId: number
  role: 'user' | 'assistant'
  content: string
  sources?: DocSource[]
  createdAt?: string
}

export interface SendMessageResponse {
  sessionId: number
  message: ChatMessage
}

export interface DocIndexStatus {
  sectionCount: number
  chunkCount: number
  lastIndexed: string | null
  sourceBreakdown?: Record<string, number>
}

export function sendMessage(message: string, sessionId?: number) {
  return api.post('/chat/send', { message, sessionId }, { timeout: 120000 }) as Promise<{ success: boolean; data: SendMessageResponse; error?: string }>
}

export function listSessions() {
  return api.get('/chat/sessions') as Promise<{ success: boolean; data: ChatSession[]; error?: string }>
}

export function getSessionMessages(sessionId: number) {
  return api.get(`/chat/sessions/${sessionId}`) as Promise<{ success: boolean; data: ChatMessage[]; error?: string }>
}

export function deleteSession(sessionId: number) {
  return api.delete(`/chat/sessions/${sessionId}`) as Promise<{ success: boolean; error?: string }>
}

export function triggerDocIndex(sourceTypes?: string[]) {
  return api.post('/docs/index', { sourceTypes }) as Promise<{ success: boolean; data: { total: number; indexed: number; skipped: number; errors: number }; error?: string }>
}

export function getDocIndexStatus() {
  return api.get('/docs/index/status') as Promise<{ success: boolean; data: DocIndexStatus; error?: string }>
}

// ==================== 文档向量管理 ====================

export function listDocEmbeddings(params?: { sourceType?: string; keyword?: string; page?: number; pageSize?: number }) {
  return api.get('/docs/index/records', { params }) as Promise<{ success: boolean; data: { list: any[]; total: number; page: number; pageSize: number }; error?: string }>
}

export function deleteDocBySourceType(sourceType: string) {
  return api.delete(`/docs/index/source/${encodeURIComponent(sourceType)}`) as Promise<{ success: boolean; data: { sourceType: string; deletedCount: number }; error?: string }>
}

export function deleteDocBySection(sectionId: string) {
  return api.delete(`/docs/index/${encodeURIComponent(sectionId)}`) as Promise<{ success: boolean; data: { sectionId: string; deletedCount: number }; error?: string }>
}

export function uploadDocFiles(files: File[]) {
  const formData = new FormData()
  files.forEach(f => formData.append('files', f))
  return api.post('/docs/index/file', formData, {
  }) as Promise<{ success: boolean; data: { results: Array<{ fileName: string; sectionId: string; chunks: number; errors: number; textLength: number }>; failures: Array<{ fileName: string; error: string }>; totalFiles: number; successCount: number; failCount: number }; error?: string }>
}
