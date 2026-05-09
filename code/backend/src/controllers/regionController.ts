import { Request, Response } from 'express';
import { db } from '../config/database';

export async function getStats(req: Request, res: Response) {
  const dimension = (req.query.dimension as string) || 'city';

  try {
    const summary = await getSummary(dimension);
    const mapData = await getMapData(dimension);
    const breakdown = await getBreakdown(dimension);

    res.json({
      success: true,
      data: {
        dimension,
        mapData,
        summary,
        breakdown,
        dimensions: [
          { key: 'city', label: '城市分布' },
          { key: 'education', label: '学历分布' },
          { key: 'salary', label: '薪资分布' },
          { key: 'industry', label: '行业分布' },
          { key: 'category', label: '职位分类' },
        ],
      },
    });
  } catch (e: any) {
    console.error('[Region] getStats error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
}

// ==================== 汇总指标 ====================
async function getSummary(dimension: string) {
  const num = (v: any) => Number(v) || 0;

  const total = await db.prepare('SELECT COUNT(*) as cnt FROM sp_jobs').get() as any;
  const enriched = await db.prepare('SELECT COUNT(*) as cnt FROM sp_job_enrichments WHERE salary_monthly_min IS NOT NULL').get() as any;
  const avgSalary = await db.prepare(
    'SELECT ROUND(AVG((salary_monthly_min + salary_monthly_max) / 2.0)) as avg_salary FROM sp_job_enrichments WHERE salary_monthly_min IS NOT NULL'
  ).get() as any;

  return {
    totalJobs: num(total?.cnt),
    enrichedJobs: num(enriched?.cnt),
    avgSalary: num(avgSalary?.avgSalary),
    dimension: dimension,
  };
}

// ==================== 地图数据 ====================
async function getMapData(dimension: string): Promise<{ name: string; value: number }[]> {
  const num = (v: any) => Number(v) || 0;

  switch (dimension) {
    case 'city': {
      const rows = await db.prepare(`
        SELECT work_city, COUNT(*) as cnt
        FROM sp_jobs WHERE work_city IS NOT NULL
        GROUP BY work_city ORDER BY cnt DESC
      `).all() as any[];
      // 映射并合并同名城市（如 北京/北京-朝阳区 → 北京市）
      return mergeByName(rows.map(r => ({ name: mapCityName(r.workCity), value: num(r.cnt) })));
    }
    case 'education': {
      // 每个城市按学历分组，返回该城市最高学历的值
      const rows = await db.prepare(`
        SELECT j.work_city,
          COUNT(*) FILTER (WHERE e.education_normalized = '本科') as undergrad,
          COUNT(*) FILTER (WHERE e.education_normalized = '大专') as college,
          COUNT(*) FILTER (WHERE e.education_normalized = '硕士') as master,
          COUNT(*) FILTER (WHERE e.education_normalized = '博士') as doctor,
          COUNT(*) as total
        FROM sp_jobs j
        JOIN sp_job_enrichments e ON j.task_id = e.task_id AND j.job_id = e.job_id
        WHERE j.work_city IS NOT NULL
        GROUP BY j.work_city
      `).all() as any[];
      return mergeByName(rows.map(r => ({
        name: mapCityName(r.workCity),
        value: num(r.total),
        undergrad: num(r.undergrad),
        college: num(r.college),
        master: num(r.master),
        doctor: num(r.doctor),
      })));
    }
    case 'salary': {
      const rows = await db.prepare(`
        SELECT j.work_city,
          COUNT(*) as total,
          ROUND(AVG((e.salary_monthly_min + e.salary_monthly_max) / 2.0)) as avg_salary,
          MAX(e.salary_monthly_max) as max_salary,
          MIN(e.salary_monthly_min) as min_salary
        FROM sp_jobs j
        JOIN sp_job_enrichments e ON j.task_id = e.task_id AND j.job_id = e.job_id
        WHERE j.work_city IS NOT NULL AND e.salary_monthly_min IS NOT NULL
        GROUP BY j.work_city
      `).all() as any[];
      return mergeByName(rows.map(r => ({
        name: mapCityName(r.workCity),
        value: num(r.avgSalary),
        total: num(r.total),
        maxSalary: num(r.maxSalary),
        minSalary: num(r.minSalary),
      })));
    }
    case 'industry': {
      const rows = await db.prepare(`
        SELECT j.work_city,
          COUNT(*) as total,
          e.company_industry
        FROM sp_jobs j
        JOIN sp_job_enrichments e ON j.task_id = e.task_id AND j.job_id = e.job_id
        WHERE j.work_city IS NOT NULL AND e.company_industry IS NOT NULL
        GROUP BY j.work_city, e.company_industry
        ORDER BY j.work_city, COUNT(*) DESC
      `).all() as any[];
      // 取每个城市最多的行业
      const cityMap = new Map<string, any>();
      for (const r of rows) {
        if (!cityMap.has(r.workCity)) {
          cityMap.set(r.workCity, {
            name: mapCityName(r.workCity),
            value: num(r.total),
            topIndustry: r.companyIndustry,
          });
        }
      }
      return Array.from(cityMap.values());
    }
    case 'category': {
      const rows = await db.prepare(`
        SELECT j.work_city,
          COUNT(*) as total,
          e.job_category_l1
        FROM sp_jobs j
        JOIN sp_job_enrichments e ON j.task_id = e.task_id AND j.job_id = e.job_id
        WHERE j.work_city IS NOT NULL AND e.job_category_l1 IS NOT NULL
        GROUP BY j.work_city, e.job_category_l1
        ORDER BY j.work_city, COUNT(*) DESC
      `).all() as any[];
      const cityMap = new Map<string, any>();
      for (const r of rows) {
        if (!cityMap.has(r.workCity)) {
          cityMap.set(r.workCity, {
            name: mapCityName(r.workCity),
            value: num(r.total),
            topCategory: r.jobCategoryL1,
          });
        }
      }
      return Array.from(cityMap.values());
    }
    default:
      return [];
  }
}

// ==================== 维度明细 ====================
async function getBreakdown(dimension: string) {
  const num = (v: any) => Number(v) || 0;

  switch (dimension) {
    case 'education': {
      const rows = await db.prepare(`
        SELECT education_normalized as label, COUNT(*) as cnt
        FROM sp_job_enrichments
        GROUP BY education_normalized ORDER BY cnt DESC
      `).all() as any[];
      return rows.map(r => ({ label: r.label || '未标注', value: num(r.cnt) }));
    }
    case 'salary': {
      const rows = await db.prepare(`
        SELECT
          CASE
            WHEN salary_monthly_min < 5000 THEN '5K以下'
            WHEN salary_monthly_min < 10000 THEN '5K-10K'
            WHEN salary_monthly_min < 15000 THEN '10K-15K'
            WHEN salary_monthly_min < 20000 THEN '15K-20K'
            WHEN salary_monthly_min >= 20000 THEN '20K以上'
            ELSE '未知'
          END as label,
          COUNT(*) as cnt
        FROM sp_job_enrichments
        WHERE salary_monthly_min IS NOT NULL
        GROUP BY label ORDER BY MIN(salary_monthly_min)
      `).all() as any[];
      return rows.map(r => ({ label: r.label, value: num(r.cnt) }));
    }
    case 'industry': {
      const rows = await db.prepare(`
        SELECT company_industry as label, COUNT(*) as cnt
        FROM sp_job_enrichments WHERE company_industry IS NOT NULL
        GROUP BY label ORDER BY cnt DESC LIMIT 12
      `).all() as any[];
      return rows.map(r => ({ label: r.label, value: num(r.cnt) }));
    }
    case 'category': {
      const rows = await db.prepare(`
        SELECT job_category_l1 as label, COUNT(*) as cnt
        FROM sp_job_enrichments WHERE job_category_l1 IS NOT NULL
        GROUP BY label ORDER BY cnt DESC
      `).all() as any[];
      return rows.map(r => ({ label: r.label, value: num(r.cnt) }));
    }
    case 'city': {
      const rows = await db.prepare(`
        SELECT work_city as label, COUNT(*) as cnt
        FROM sp_jobs WHERE work_city IS NOT NULL
        GROUP BY label ORDER BY cnt DESC LIMIT 15
      `).all() as any[];
      return rows.map(r => ({ label: r.label, value: num(r.cnt) }));
    }
    default:
      return [];
  }
}

// 合并同名城市数据（处理"北京"/"北京-朝阳区"→"北京市"的重复）
function mergeByName(items: { name: string; value: number; [k: string]: any }[]): { name: string; value: number; [k: string]: any }[] {
  const map = new Map<string, any>();
  for (const item of items) {
    const existing = map.get(item.name);
    if (existing) {
      existing.value += item.value || 0;
      for (const k of Object.keys(item)) {
        if (k !== 'name' && k !== 'value' && typeof item[k] === 'number') {
          existing[k] = (existing[k] || 0) + item[k];
        }
      }
    } else {
      map.set(item.name, { ...item });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.value - a.value);
}

// 数据库城市名 → GeoJSON 城市名映射（加"市"/"地区"后缀）
function mapCityName(name: string): string {
  if (!name) return '';
  const clean = name.split('-')[0].trim();
  const map: Record<string, string> = {
    '哈尔滨': '哈尔滨市',
    '齐齐哈尔': '齐齐哈尔市',
    '鸡西': '鸡西市',
    '鹤岗': '鹤岗市',
    '双鸭山': '双鸭山市',
    '大庆': '大庆市',
    '伊春': '伊春市',
    '佳木斯': '佳木斯市',
    '七台河': '七台河市',
    '牡丹江': '牡丹江市',
    '黑河': '黑河市',
    '绥化': '绥化市',
    '大兴安岭': '大兴安岭地区',
    '北京': '北京市',
    '上海': '上海市',
  };
  return map[clean] || clean;
}
