import api from './index';

export interface RegionStats {
  dimension: string;
  mapData: { name: string; value: number; [k: string]: any }[];
  summary: {
    totalJobs: number;
    enrichedJobs: number;
    avgSalary: number;
    dimension: string;
  };
  breakdown: { label: string; value: number }[];
  dimensions: { key: string; label: string }[];
}

export async function fetchRegionStats(dimension: string): Promise<RegionStats> {
  const res = await api.get('/region/stats', { params: { dimension } });
  if (!res.success) throw new Error(res.error || '获取区域数据失败');
  return res.data;
}
