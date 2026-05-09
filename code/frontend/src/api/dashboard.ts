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
