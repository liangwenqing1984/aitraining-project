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

// 获取指定提供商的可用模型列表（Ollama 返回本地部署的模型）
export function fetchProviderModels(provider: string): Promise<ApiResponse<string[]>> {
  return api.get(`/llm/models/${provider}`)
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
export function getEnrichmentStatus(taskId: string): Promise<ApiResponse<{
  exists: boolean; total: number; lastEnrichedAt: string | null;
  isRunning: boolean; runningProgress: { total: number; completed: number; failed: number; message: string } | null
}>> {
  return api.get(`/llm/enrich/${taskId}/status`)
}

// 获取增强结果
export function getEnrichmentResults(taskId: string): Promise<ApiResponse<any[]>> {
  return api.get(`/llm/enrich/${taskId}/result`)
}

// ==================== 市场洞察 ====================

// 生成市场洞察报告
export function generateInsights(fileId: string): Promise<ApiResponse<void>> {
  return api.post(`/llm/insights/${fileId}`)
}

// 获取报告历史
export function getInsightsHistory(fileId: string): Promise<ApiResponse<any[]>> {
  return api.get(`/llm/insights/${fileId}/history`)
}

// 获取单个报告
export function getInsightsReport(reportId: string): Promise<ApiResponse<any>> {
  return api.get(`/llm/insights/report/${reportId}`)
}

// ==================== 自然语言查询 ====================

export interface NLQueryResult {
  id: string
  userQuery: string
  generatedSql: string
  resultSummary: string
  resultData: any[]
  resultCount: number
  modelUsed: string
  createdAt: string
}

// 执行自然语言查询
export function executeNLQuery(question: string, taskId?: string): Promise<ApiResponse<NLQueryResult>> {
  return api.post('/llm/query', { question, taskId })
}

// 获取查询历史
export function getNLQueryHistory(): Promise<ApiResponse<NLQueryResult[]>> {
  return api.get('/llm/query/history')
}

// 删除查询记录
export function deleteNLQuery(id: string): Promise<ApiResponse<void>> {
  return api.delete(`/llm/query/${id}`)
}

// ==================== AI 反爬 ====================

export interface PageClassification {
  pageType: 'normal' | 'captcha' | 'waf' | 'login' | 'error' | 'empty'
  confidence: number
  indicators: string[]
  reason: string
}

// 页面分类
export function classifyPage(html: string, url: string): Promise<ApiResponse<PageClassification>> {
  return api.post('/llm/anti-crawl/classify', { html, url })
}

// 选择器推荐
export function suggestSelectors(html: string, target: string): Promise<ApiResponse<any[]>> {
  return api.post('/llm/anti-crawl/selectors', { html, target })
}

// 应对策略推荐
export function recommendAction(classification: PageClassification): Promise<ApiResponse<any>> {
  return api.post('/llm/anti-crawl/action', { classification })
}

// ==================== RAG 语义搜索 ====================

export interface RAGSearchResult {
  id: string
  jobId: string
  taskId: string
  jobName: string
  jobCategoryL1: string
  jobCategoryL2: string
  companyName: string
  companyIndustry: string
  workCity: string
  salaryMonthlyMin: number
  salaryMonthlyMax: number
  keySkills: string[]
  similarity: number
}

export interface RAGIndexResult {
  total: number
  indexed: number
  skipped: number
  errors: number
}

// 启动向量化索引（异步）
export function startRAGIndex(taskId: string): Promise<ApiResponse<{ status: string }>> {
  return api.post(`/rag/index/${taskId}`)
}

// 同步向量化索引
export function syncRAGIndex(taskId: string): Promise<ApiResponse<RAGIndexResult>> {
  return api.post(`/rag/index/${taskId}/sync`)
}

// 语义搜索
export function ragSearch(query: string, options?: {
  limit?: number
  taskId?: string
  minSimilarity?: number
}): Promise<ApiResponse<{ query: string; results: RAGSearchResult[]; count: number }>> {
  return api.post('/rag/search', { query, ...options })
}

// 获取向量化统计
export function getRAGStats(taskId?: string): Promise<ApiResponse<any>> {
  return api.get('/rag/stats', { params: taskId ? { taskId } : {} })
}

// 删除指定任务的向量索引
export function deleteRAGIndex(taskId: string): Promise<ApiResponse<{ taskId: string; deletedCount: number }>> {
  return api.delete(`/rag/index/${taskId}`)
}

// 职位向量列表（管理页用）
export function listJobEmbeddings(params?: { taskId?: string; keyword?: string; page?: number; pageSize?: number }): Promise<ApiResponse<{ list: any[]; total: number }>> {
  return api.get('/rag/index/records', { params })
}

// ==================== 增强数据管理 CRUD ====================

export function listEnrichments(params?: { taskId?: string; keyword?: string; page?: number; pageSize?: number }): Promise<ApiResponse<{ list: any[]; total: number; page: number; pageSize: number }>> {
  return api.get('/llm/enrich', { params })
}

export function getEnrichment(taskId: string, jobId: string): Promise<ApiResponse<any>> {
  return api.get(`/llm/enrich/${encodeURIComponent(taskId)}/${encodeURIComponent(jobId)}`)
}

export function updateEnrichment(taskId: string, jobId: string, data: any): Promise<ApiResponse<any>> {
  return api.put(`/llm/enrich/${encodeURIComponent(taskId)}/${encodeURIComponent(jobId)}`, data)
}

export function deleteEnrichmentsByTask(taskId: string): Promise<ApiResponse<{ taskId: string; deletedCount: number }>> {
  return api.delete(`/llm/enrich/${encodeURIComponent(taskId)}`)
}

export function deleteEnrichment(taskId: string, jobId: string): Promise<ApiResponse<any>> {
  return api.delete(`/llm/enrich/${encodeURIComponent(taskId)}/${encodeURIComponent(jobId)}`)
}

// ==================== 简历筛选 ====================

// 简历文本匹配职位
export function matchResume(resumeText: string, options?: {
  limit?: number
  minSimilarity?: number
}): Promise<ApiResponse<{ resumeText: string; results: RAGSearchResult[]; count: number }>> {
  return api.post('/rag/resume/match', { resumeText, ...options })
}
