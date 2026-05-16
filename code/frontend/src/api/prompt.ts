import api from './index'
import type { ApiResponse } from './task'

export interface PromptRecord {
  id?: number
  category: 'enrichment' | 'insights' | 'query' | 'resume-parse' | 'anti-crawl'
  promptType: 'system' | 'user'
  name: string
  content: string
  variables: string[]
  description?: string
  isActive: boolean
  sortOrder: number
  createdAt?: string
  updatedAt?: string
}

export const CATEGORY_LABELS: Record<string, string> = {
  'enrichment': '数据增强',
  'insights': '市场洞察',
  'query': 'NL查询',
  'resume-parse': '简历解析',
  'anti-crawl': '反爬检测',
}

export function listPrompts(category: string): Promise<ApiResponse<PromptRecord[]>> {
  return api.get('/prompts', { params: { category } })
}

export function getPrompt(id: number): Promise<ApiResponse<PromptRecord>> {
  return api.get(`/prompts/${id}`)
}

export function createPrompt(data: Partial<PromptRecord>): Promise<ApiResponse<PromptRecord>> {
  return api.post('/prompts', data)
}

export function updatePrompt(id: number, data: Partial<PromptRecord>): Promise<ApiResponse<PromptRecord>> {
  return api.put(`/prompts/${id}`, data)
}

export function deletePrompt(id: number): Promise<ApiResponse<void>> {
  return api.delete(`/prompts/${id}`)
}

export function resetDefault(category: string, promptType: string): Promise<ApiResponse<PromptRecord>> {
  return api.post('/prompts/reset-default', { category, promptType })
}
