import api from './index'

// 通用API响应类型（拦截器已经提取了data）
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface TaskConfig {
  sites: ('zhilian' | '51job')[]
  province?: string
  city?: string
  keyword?: string
  company?: string
  // 支持多个关键词、企业和城市
  keywords?: string[]
  companies?: string[]
  cities?: string[]
  maxPages?: number
  delay?: [number, number]
  concurrency?: number
}

export interface Task {
  id: string
  name: string
  source: string
  config: string
  status: 'pending' | 'running' | 'paused' | 'completed' | 'stopped' | 'failed'
  progress: number
  total: number
  current: number
  recordCount: number
  errorCount: number
  errorMessage?: string
  csvPath?: string
  startTime?: string
  endTime?: string
  createdAt: string
  updatedAt: string
}

export const taskApi = {
  createTask(config: TaskConfig): Promise<ApiResponse<{ taskId: string; name: string }>> {
    return api.post('/tasks', config) as any
  },

  getTasks(params?: { status?: string; page?: number; pageSize?: number }): Promise<ApiResponse<{ list: Task[]; total: number }>> {
    return api.get('/tasks', { params }) as any
  },

  getTask(id: string): Promise<ApiResponse<Task>> {
    return api.get(`/tasks/${id}`) as any
  },

  startTask(id: string): Promise<ApiResponse> {
    return api.post(`/tasks/${id}/start`) as any
  },

  stopTask(id: string): Promise<ApiResponse> {
    return api.post(`/tasks/${id}/stop`) as any
  },

  pauseTask(id: string): Promise<ApiResponse> {
    return api.post(`/tasks/${id}/pause`) as any
  },

  resumeTask(id: string): Promise<ApiResponse> {
    return api.post(`/tasks/${id}/resume`) as any
  },

  deleteTask(id: string): Promise<ApiResponse> {
    return api.delete(`/tasks/${id}`) as any
  },

  getRegions(): Promise<ApiResponse> {
    return api.get('/tasks/regions/list') as any
  }
}
