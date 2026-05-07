/**
 * 将已有任务的 Excel 数据迁入 sp_jobs 表
 * 用法: npx ts-node scripts/migrate_jobs_to_db.ts
 */
import { Pool } from 'pg';
import ExcelJS from 'exceljs';
import { v4 as uuidv4 } from 'uuid';

const pool = new Pool({
  host: '10.1.1.113',
  port: 7300,
  database: 'training_exercises',
  user: 'liangwenqing',
  password: 'liangwenqing',
});

// 51job Excel 列名 → JobData 字段映射
const JOB51_COLUMN_MAP: Record<string, string> = {
  '公司名称': 'companyName',
  '经营范围': 'businessScope',
  '公司规模': 'companyScale',
  '注册地址': 'registeredAddress',
  '工作地址': 'workAddress',
  '岗位名称': 'jobName',
  '职能类别': 'jobCategory',
  '工作经验': 'workExperience',
  '学历': 'education',
  '发布时间': 'updateDate',
  '薪资': 'salaryRange',
  '工作类型': 'workType',
  '是否紧急招聘': 'isUrgent',
  '职位描述': 'jobDescription',
  '城市': 'workCity',
  '企业类型': 'companyNature',
  '职位详情链接': 'jobDetailUrl',
  '公司详情链接': 'companyDetailUrl',
  '数据来源': 'dataSource',
  '职位ID': 'jobId',
};

// 智联 Excel 列名 → JobData 字段映射
const ZHILIAN_COLUMN_MAP: Record<string, string> = {
  '企业名称': 'companyName',
  '职位ID': 'jobId',
  '职位名称': 'jobName',
  '职位分类': 'jobCategory',
  '职位标签': 'jobTags',
  '职位描述': 'jobDescription',
  '薪资范围': 'salaryRange',
  '工作城市': 'workCity',
  '工作经验': 'workExperience',
  '工作地址': 'workAddress',
  '学历': 'education',
  '公司代码': 'companyCode',
  '公司性质': 'companyNature',
  '经营范围': 'businessScope',
  '公司规模': 'companyScale',
  '岗位招聘人数': 'recruitmentCount',
  '岗位更新日期': 'updateDate',
  '工作性质': 'workType',
  '数据来源': 'dataSource',
};

async function main() {
  const client = await pool.connect();
  await client.query('SET search_path TO liangwenqing, public');

  // 查询有 Excel 文件的任务
  const tasks = await client.query(
    "SELECT id, name, csv_path, record_count, source FROM sp_tasks WHERE record_count > 0 AND csv_path IS NOT NULL"
  );

  console.log(`找到 ${tasks.rows.length} 个任务\n`);

  for (const task of tasks.rows) {
    const filepath = task.csv_path;
    console.log(`处理: ${task.name} (${task.id.substring(0, 8)}...) — ${task.record_count} 条 — ${filepath}`);

    const fs = require('fs');
    if (!fs.existsSync(filepath)) {
      console.log(`  ⚠️ 文件不存在，跳过: ${filepath}`);
      continue;
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filepath);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      console.log('  ⚠️ 工作表为空');
      continue;
    }

    // 读取表头
    const headers: string[] = [];
    worksheet.getRow(1).eachCell((cell) => headers.push(String(cell.value || '').trim()));
    console.log(`  表头: ${headers.slice(0, 5).join(', ')}...`);

    const columnMap = task.source === '51job' ? JOB51_COLUMN_MAP : ZHILIAN_COLUMN_MAP;

    let inserted = 0;
    let skipped = 0;
    let errors = 0;

    // 逐行读取并插入
    for (let rowIdx = 2; rowIdx <= worksheet.rowCount; rowIdx++) {
      const row = worksheet.getRow(rowIdx);
      const rawData: Record<string, string> = {};

      row.eachCell((cell, colNum) => {
        const header = headers[colNum - 1];
        if (header) {
          rawData[header] = String(cell.value ?? '');
        }
      });

      const jobId = rawData['职位ID'];
      if (!jobId) {
        skipped++;
        continue;
      }

      // 通过列映射提取 JobData 字段
      const jobData: Record<string, string> = {};
      for (const [excelCol, jobField] of Object.entries(columnMap)) {
        jobData[jobField] = rawData[excelCol] || '';
      }

      const dataSource = jobData['dataSource'] || (task.source === '51job' ? '前程无忧' : '智联招聘');

      try {
        await client.query(
          `INSERT INTO sp_jobs (id, task_id, job_id, data_source, company_name, job_name,
            work_city, salary_range, education, work_experience, job_category, raw_data)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
           ON CONFLICT (task_id, job_id) DO NOTHING`,
          [
            uuidv4(),
            task.id,
            jobId,
            dataSource,
            jobData['companyName'] || '',
            jobData['jobName'] || '',
            jobData['workCity'] || '',
            jobData['salaryRange'] || '',
            jobData['education'] || '',
            jobData['workExperience'] || '',
            jobData['jobCategory'] || '',
            JSON.stringify(jobData),
          ]
        );
        inserted++;
      } catch (e: any) {
        errors++;
        if (errors <= 3) {
          console.error(`  行${rowIdx} 插入失败: ${e.message}`);
        }
      }
    }

    console.log(`  完成: 插入 ${inserted}，跳过 ${skipped}，错误 ${errors}`);
  }

  // 验证结果
  const countRes = await client.query('SELECT COUNT(*) as cnt FROM sp_jobs');
  console.log(`\nsp_jobs 表总记录数: ${countRes.rows[0].cnt}`);

  client.release();
  await pool.end();
}

main().catch((e) => {
  console.error('迁移失败:', e);
  process.exit(1);
});
