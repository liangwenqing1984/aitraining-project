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
  return api.post('/chat/send', { message, sessionId }) as Promise<{ success: boolean; data: SendMessageResponse; error?: string }>
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
