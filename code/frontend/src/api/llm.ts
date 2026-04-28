import api from './index'
import type { ApiResponse } from './task'

export interface LLMConfig {
  id?: number
  provider: 'openai' | 'anthropic' | 'ollama' | 'deepseek' | 'zhipu'
  modelName: string
  apiKeyEncrypted?: string
  baseUrl?: string
  isActive: boolean
  taskRouting: string[]
}

export interface HealthCheckResult {
  ok: boolean
  models: string[]
  latency: number
  error?: string
}

export interface TestCallResult {
  content: string
  model: string
  provider: string
  tokensUsed?: { prompt: number; completion: number; total: number }
  duration: number
}

// 获取所有LLM配置
export function listLLMConfigs(): Promise<ApiResponse<LLMConfig[]>> {
  return api.get('/llm/config')
}

// 保存LLM配置
export function saveLLMConfig(config: LLMConfig): Promise<ApiResponse<LLMConfig>> {
  return api.post('/llm/config', config)
}

// 删除LLM配置
export function deleteLLMConfig(id: number): Promise<ApiResponse<void>> {
  return api.delete(`/llm/config/${id}`)
}

// 健康检查
export function checkLLMHealth(provider: string): Promise<ApiResponse<HealthCheckResult>> {
  return api.get('/llm/health', { params: { provider } })
}

// 测试调用
export function testLLMCall(data: {
  systemPrompt?: string
  userPrompt: string
  taskType: string
}): Promise<ApiResponse<TestCallResult>> {
  return api.post('/llm/test', data)
}

// 触发数据增强
export function startEnrichment(taskId: string): Promise<ApiResponse<void>> {
  return api.post(`/llm/enrich/${taskId}`)
}

// 获取增强状态
export function getEnrichmentStatus(taskId: string): Promise<ApiResponse<{ exists: boolean; total: number; lastEnrichedAt: string | null }>> {
  return api.get(`/llm/enrich/${taskId}/status`)
}

// 获取增强结果
export function getEnrichmentResults(taskId: string): Promise<ApiResponse<any[]>> {
  return api.get(`/llm/enrich/${taskId}/result`)
}
