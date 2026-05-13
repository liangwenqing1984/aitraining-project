import api from './index'

export interface TrainingDataset {
  name: string
  path: string
  pairCount: number
  size: string
}

export interface TrainingJob {
  id: number
  name: string
  datasetConfig: any
  baseModel: string
  params: any
  status: 'pending' | 'running' | 'completed' | 'failed'
  progress: number
  metrics: any
  datasetPath: string
  modelOutputPath: string
  log: string
  startedAt: string
  finishedAt: string
  createdAt: string
}

export interface TrainingModel {
  name: string
  path: string
  metrics: any
  hasModelfile: boolean
  createdAt: string
}

// 数据集
export function buildDataset(data: { taskIds: string[]; positiveStrategy?: string }): Promise<ApiResponse<{ filePath: string; pairCount: number; jobCount: number }>> {
  return api.post('/training/dataset/build', data)
}

export function listDatasets(): Promise<ApiResponse<TrainingDataset[]>> {
  return api.get('/training/dataset/list')
}

export function previewDataset(path: string): Promise<ApiResponse<{ samples: any[] }>> {
  return api.get(`/training/dataset/${encodeURIComponent(path.split('/').pop() || '')}/preview`)
}

// 训练任务
export function startTraining(data: { datasetPath: string; baseModel: string; params?: any }): Promise<ApiResponse<{ jobId: number; status: string; message: string }>> {
  return api.post('/training/start', data)
}

export function getTrainingStatus(id: number): Promise<ApiResponse<TrainingJob>> {
  return api.get(`/training/status/${id}`)
}

export function listTrainingJobs(params?: { page?: number; pageSize?: number }): Promise<ApiResponse<{ list: TrainingJob[]; total: number }>> {
  return api.get('/training/list', { params })
}

export function deleteTrainingJob(id: number): Promise<ApiResponse<any>> {
  return api.delete(`/training/${id}`)
}

// 模型管理
export function listModels(): Promise<ApiResponse<TrainingModel[]>> {
  return api.get('/training/models')
}

export function deployModel(data: { modelPath: string; modelName: string }): Promise<ApiResponse<{ modelName: string; message: string }>> {
  return api.post('/training/models/deploy', data)
}
