import api from './index'

export interface CsvFile {
  id: string
  taskId: string
  filename: string
  filepath: string
  fileSize: number
  recordCount: number
  source: string
  createdAt: string
}

export const fileApi = {
  getFiles(params?: { source?: string; page?: number; pageSize?: number }) {
    return api.get('/files', { params })
  },

  getFile(id: string) {
    return api.get(`/files/${id}`)
  },

  // 🔧 新增：根据taskId获取文件信息
  getFileByTaskId(taskId: string) {
    return api.get(`/files/task/${taskId}`)
  },

  // 🔧 新增：分析CSV文件数据
  analyzeFile(id: string) {
    return api.get(`/files/${id}/analyze`)
  },

  downloadFile(id: string) {
    return api.get(`/files/${id}/download`, { responseType: 'blob' })
  },

  previewFile(id: string, rows?: number) {
    return api.get(`/files/${id}/preview`, { params: { rows } })
  },

  deleteFile(id: string) {
    return api.delete(`/files/${id}`)
  },

  batchDelete(ids: string[]) {
    return api.post('/files/batch-delete', { ids })
  }
}
