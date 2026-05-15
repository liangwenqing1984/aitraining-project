import api from './index'
import type { ApiResponse } from './index'

export interface InternalJob {
  id?: number
  title: string
  department?: string
  description: string
  requirement?: string
  educationRequired?: string
  experienceYearsMin?: number
  experienceYearsMax?: number
  requiredSkills: string[]
  preferredSkills: string[]
  skillMatchMode: 'all' | 'any'
  cityPreferred: string[]
  jobCategory?: string
  headcount: number
  salaryMin?: number
  salaryMax?: number
  jobType: string
  status: 'open' | 'closed' | 'filled'
  createdAt?: string
  updatedAt?: string
}

export function listInternalJobs(params?: {
  keyword?: string; status?: string; page?: number; pageSize?: number
}): Promise<ApiResponse<{ list: InternalJob[]; total: number; page: number; pageSize: number }>> {
  return api.get('/internal-jobs', { params })
}

export function getInternalJob(id: number): Promise<ApiResponse<InternalJob>> {
  return api.get(`/internal-jobs/${id}`)
}

export function createInternalJob(data: Partial<InternalJob>): Promise<ApiResponse<{ id: number }>> {
  return api.post('/internal-jobs', data)
}

export function updateInternalJob(id: number, data: Partial<InternalJob>): Promise<ApiResponse<any>> {
  return api.put(`/internal-jobs/${id}`, data)
}

export function deleteInternalJob(id: number): Promise<ApiResponse<any>> {
  return api.delete(`/internal-jobs/${id}`)
}
