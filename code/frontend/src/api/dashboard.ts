import axios from 'axios';

const api = axios.create({ baseURL: '/api/dashboard' });

export interface DashboardOverview {
  summary: {
    totalJobs: number;
    totalTasks: number;
    totalCompanies: number;
    avgSalary: number;
    maxSalary: number;
    minSalary: number;
  };
  salaryDistribution: { label: string; min: number; max: number; count: number }[];
  cityDistribution: { name: string; count: number }[];
  educationDistribution: { name: string; count: number }[];
  experienceDistribution: { name: string; count: number }[];
  industryDistribution: { name: string; count: number; avgSalary: number }[];
  categoryDistribution: { name: string; count: number }[];
  topSkills: { name: string; count: number }[];
  workModeDistribution: { name: string; count: number }[];
}

export async function fetchOverview(): Promise<DashboardOverview> {
  const { data } = await api.get('/overview');
  if (!data.success) throw new Error(data.error || '获取看板数据失败');
  return data.data;
}

// ==================== AI 全量洞察报告 ====================

export interface InsightReport {
  id: string;
  fileId: string;
  reportType: string;
  title: string;
  content: string;       // JSON string of sections array
  summary: string;
  chartsConfig: any;
  modelUsed: string;
  createdAt: string;
}

export interface InsightSection {
  heading: string;
  body: string;
  key_insight?: string;
}

// 生成全量洞察报告
export async function generateDashboardInsights(): Promise<InsightReport> {
  const { data } = await api.post('/insights');
  if (!data.success) throw new Error(data.error || '报告生成失败');
  return data.data;
}

// 获取全量洞察历史报告列表
export async function getDashboardInsightsHistory(): Promise<InsightReport[]> {
  const { data } = await api.get('/insights/history');
  if (!data.success) throw new Error(data.error || '获取报告历史失败');
  return data.data || [];
}

// 获取单个报告详情
export async function getDashboardInsightReport(reportId: string): Promise<InsightReport> {
  const { data } = await api.get(`/insights/report/${reportId}`);
  if (!data.success) throw new Error(data.error || '获取报告失败');
  return data.data;
}

// 下载报告 PDF
export function getDashboardInsightPdfUrl(reportId: string): string {
  return `/api/dashboard/insights/report/${reportId}/pdf`;
}
