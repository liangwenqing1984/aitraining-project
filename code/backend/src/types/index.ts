// 任务状态类型
export type TaskStatus = 'pending' | 'running' | 'paused' | 'completed' | 'stopped' | 'failed';

// 爬虫任务配置
export interface TaskConfig {
  sites: ('zhilian' | '51job')[];
  province?: string;
  city?: string;
  keyword?: string;
  company?: string;
  // 支持多个关键词、企业和城市
  keywords?: string[];
  companies?: string[];
  cities?: string[];
  maxPages?: number;
  delay?: [number, number];
  concurrency?: number;
}

// 任务实体
export interface Task {
  id: string;
  name: string;
  source: 'zhilian' | '51job' | 'all';
  config: string;
  status: TaskStatus;
  progress: number;
  total: number;
  current: number;
  recordCount: number;
  errorCount: number;
  errorMessage?: string;
  csvPath?: string;
  startTime?: string;
  endTime?: string;
  createdAt: string;
  updatedAt: string;
}

// 职位数据
export interface JobData {
  jobId: string;
  jobName: string;
  jobTags: string;
  jobDescription: string;
  salaryRange: string;
  workCity: string;
  workExperience: string;
  workAddress: string;
  education: string;
  companyCode: string;
  companyNature: string;
  businessScope: string;
  companyScale: string;
  recruitmentCount: string;
  updateDate: string;
  workType: string;
  dataSource: string;
}

// CSV文件记录
export interface CsvFile {
  id: string;
  taskId: string;
  filename: string;
  filepath: string;
  fileSize: number;
  recordCount: number;
  source: string;
  createdAt: string;
}

// 进度数据
export interface ProgressData {
  taskId: string;
  status: TaskStatus;
  progress: number;
  current: number;
  total: number;
  recordCount: number;
  speed: number;
  message: string;
}

// API响应
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// 省市数据
export interface Region {
  code: string;
  name: string;
  cities: City[];
}

export interface City {
  code: string;
  name: string;
}
