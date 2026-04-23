// 任务状态类型
export type TaskStatus = 'pending' | 'running' | 'paused' | 'completed' | 'stopped' | 'failed';

// 爬虫任务配置
export interface TaskConfig {
  sites: ('zhilian' | '51job')[];
  name?: string;  // 🔧 支持前端传递自定义任务名称
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
  
  // 🔧 断点续传支持：恢复状态（内部使用，不暴露给前端）
  _resumeState?: {
    combinationIndex: number;  // 从第几个组合开始
    currentPage: number;       // 从第几页开始
  };
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
  companyName: string;      // 企业名称
  jobId: string;            // 职位ID
  jobName: string;          // 职位名称
  jobCategory: string;      // 职位分类
  jobTags: string;          // 职位标签
  jobDescription: string;   // 职位描述
  salaryRange: string;      // 薪资范围
  workCity: string;         // 工作城市
  workExperience: string;   // 工作经验
  workAddress: string;      // 工作地址
  education: string;        // 学历
  companyCode: string;      // 公司代码
  companyNature: string;    // 公司性质
  businessScope: string;    // 经营范围
  companyScale: string;     // 公司规模
  recruitmentCount: string; // 岗位招聘人数
  updateDate: string;       // 岗位更新日期
  workType: string;         // 工作性质
  dataSource: string;       // 数据来源
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
