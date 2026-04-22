import { io } from '../app';
import { db } from '../config/database';
import { TaskConfig, Task, JobData } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { ZhilianCrawler } from './crawler/zhilian';
import { Job51Crawler } from './crawler/job51';
import path from 'path';
import fs from 'fs';
import ExcelJS from 'exceljs';

const csvDir = path.join(__dirname, '../../data/csv');

// 控制台输出拦截器类
class ConsoleInterceptor {
  private taskId: string;
  private originalConsoleLog: any;
  private originalConsoleWarn: any;
  private originalConsoleError: any;
  private originalConsoleInfo: any;

  constructor(taskId: string) {
    this.taskId = taskId;
    this.originalConsoleLog = console.log;
    this.originalConsoleWarn = console.warn;
    this.originalConsoleError = console.error;
    this.originalConsoleInfo = console.info;
  }

  // 启动拦截
  start() {
    const self = this;
    
    // 拦截 console.log
    console.log = function(...args: any[]) {
      self.originalConsoleLog.apply(console, args);
      // 同时推送到前端
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ');
      
      if (io && self.taskId) {
        io.to(`task:${self.taskId}`).emit('task:log', {
          taskId: self.taskId,
          level: 'info',
          message: message
        });
      }
    };

    // 拦截 console.warn
    console.warn = function(...args: any[]) {
      self.originalConsoleWarn.apply(console, args);
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ');
      
      if (io && self.taskId) {
        io.to(`task:${self.taskId}`).emit('task:log', {
          taskId: self.taskId,
          level: 'warning',
          message: message
        });
      }
    };

    // 拦截 console.error
    console.error = function(...args: any[]) {
      self.originalConsoleError.apply(console, args);
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ');
      
      if (io && self.taskId) {
        io.to(`task:${self.taskId}`).emit('task:log', {
          taskId: self.taskId,
          level: 'error',
          message: message
        });
      }
    };

    // 拦截 console.info
    console.info = function(...args: any[]) {
      self.originalConsoleInfo.apply(console, args);
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ');
      
      if (io && self.taskId) {
        io.to(`task:${self.taskId}`).emit('task:log', {
          taskId: self.taskId,
          level: 'info',
          message: message
        });
      }
    };

    console.log(`[ConsoleInterceptor] 已启动日志拦截，任务ID: ${this.taskId}`);
  }

  // 停止拦截，恢复原始console
  stop() {
    console.log = this.originalConsoleLog;
    console.warn = this.originalConsoleWarn;
    console.error = this.originalConsoleError;
    console.info = this.originalConsoleInfo;
    console.log(`[ConsoleInterceptor] 已停止日志拦截，任务ID: ${this.taskId}`);
  }
}

class TaskService {
  private runningTasks: Map<string, AbortController> = new Map();
  private taskProgress: Map<string, any> = new Map();

  // 启动任务
  async startTask(taskId: string, config: TaskConfig) {
    console.log(`[TaskService] 开始启动任务: ${taskId}`);
    console.log(`[TaskService] 任务配置:`, JSON.stringify(config, null, 2));
    
    const controller = new AbortController();
    this.runningTasks.set(taskId, controller);

    // 更新任务状态为running
    await db.prepare(`
      UPDATE tasks SET status = 'running', start_time = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `).run(taskId);
    console.log(`[TaskService] 任务状态已更新为 running`);

    // 初始化进度
    this.taskProgress.set(taskId, {
      taskId,
      status: 'running',
      progress: 0,
      current: 0,
      total: 0,
      recordCount: 0,
      speed: 0,
      startTime: Date.now(),
      lastRecordCount: 0
    });

    // 创建Excel文件(替代CSV)
    const filename = `job_data_${taskId}.xlsx`;
    const filepath = path.join(csvDir, filename);
    await this.createExcelFile(filepath);
    console.log(`[TaskService] Excel文件已创建: ${filepath}`);

    // 更新文件路径
    await db.prepare(`
      UPDATE tasks SET csv_path = $1 WHERE id = $2
    `).run(filepath, taskId);
    console.log(`[TaskService] 文件路径已更新`);

    // 发送初始状态消息
    io.to(`task:${taskId}`).emit('task:status', {
      taskId,
      status: 'running',
      message: '任务已启动，准备开始爬取...'
    });
    console.log(`[TaskService] 已发送初始状态消息`);

    // 启动爬取过程
    this.executeCrawling(taskId, config, controller);
  }

  // 执行爬取
  private async executeCrawling(taskId: string, config: TaskConfig, controller: AbortController) {
    // 在try外部声明拦截器
    let consoleInterceptor: ConsoleInterceptor | null = null;
    
    try {
      // 启动控制台拦截器
      consoleInterceptor = new ConsoleInterceptor(taskId);
      consoleInterceptor.start();
      
      // 执行爬取
      let totalRecords = 0;
      let lastUpdateTime = Date.now();
      let lastRecordCount = 0;
      
      // 获取CSV路径和文件名
      const task = await db.prepare('SELECT csv_path FROM tasks WHERE id = $1').get(taskId) as Task;
      const filepath = task?.csvPath || path.join(csvDir, `job_data_${taskId}.csv`);
      const filename = path.basename(filepath);

      for (const site of config.sites) {
        console.log(`[TaskService] 开始爬取站点: ${site}`);
        
        if (controller.signal.aborted) {
          console.log(`[TaskService] 任务已被中止`);
          break;
        }

        io.to(`task:${taskId}`).emit('task:status', {
          taskId,
          status: 'running',
          message: `正在爬取 ${site === 'zhilian' ? '智联招聘' : '前程无忧'}...`
        });

        const crawler = site === 'zhilian'
          ? new ZhilianCrawler()
          : new Job51Crawler();

        console.log(`[TaskService] 开始遍历职位数据...`);
        for await (const job of crawler.crawl(config, controller.signal)) {
          if (controller.signal.aborted) {
            console.log(`[TaskService] 爬取过程中被中止`);
            break;
          }

          // 写入Excel
          await this.appendExcelRow(filepath, job);
          totalRecords++;
          
          // 🔧 优化：减少日志输出频率，每10条输出一次
          if (totalRecords % 10 === 0 || totalRecords <= 5) {
            console.log(`[TaskService] 已采集第 ${totalRecords} 条数据`);
          }

          // 🔧 关键优化：降低数据库更新频率，从每条更新改为每5条或每秒更新
          const now = Date.now();
          const elapsed = (now - lastUpdateTime) / 1000;
          const speed = elapsed > 0
            ? Math.round((totalRecords - lastRecordCount) / elapsed)
            : 0;

          // 🔧 更新条件：时间间隔>=2秒 或 每采集5条数据
          if (elapsed >= 2 || totalRecords % 5 === 0) {
            lastUpdateTime = now;
            lastRecordCount = totalRecords;

            // 改进的进度计算：基于已采集数据量，使用渐进式估算
            // 前10条数据显示0-50%，10-50条显示50-80%，50条以上显示80-99%
            let progressPercent: number;
            if (totalRecords <= 10) {
              progressPercent = (totalRecords / 10) * 50;
            } else if (totalRecords <= 50) {
              progressPercent = 50 + ((totalRecords - 10) / 40) * 30;
            } else {
              progressPercent = 80 + Math.min(19, (totalRecords - 50) / 10);
            }
            
            // 确保进度不超过99%
            progressPercent = Math.min(99, Math.max(0, progressPercent));
            
            // 🔧 关键修复：PostgreSQL的INTEGER字段不接受小数，必须取整
            progressPercent = Math.round(progressPercent);

            try {
              // 更新数据库进度
              await db.prepare(`
                UPDATE tasks
                SET progress = $1, current = $2, record_count = $3, updated_at = CURRENT_TIMESTAMP
                WHERE id = $4
              `).run(
                progressPercent,
                totalRecords,
                totalRecords,
                taskId
              );
            } catch (dbError: any) {
              // 🔧 数据库更新失败不影响数据采集，仅记录日志
              console.warn(`[TaskService] 数据库进度更新失败（可忽略）: ${dbError.message}`);
            }

            io.to(`task:${taskId}`).emit('task:progress', {
              taskId,
              status: 'running',
              progress: progressPercent,
              current: totalRecords,
              total: totalRecords > 0 ? totalRecords : 100,
              recordCount: totalRecords,
              speed,
              message: `已采集 ${totalRecords} 条数据`
            });
          }
        }

      }

      // 任务完成
      console.log(`[TaskService] 任务完成，共采集 ${totalRecords} 条数据`);
      const endTime = Date.now();
      
      // 安全地获取startTime
      const taskProgressInfo = this.taskProgress.get(taskId);
      const startTime = taskProgressInfo?.startTime || Date.now();
      const duration = Math.round((endTime - startTime) / 1000);

      db.prepare(`
        UPDATE tasks
        SET status = 'completed', progress = 100, current = $1, record_count = $2, end_time = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
      `).run(totalRecords, totalRecords, taskId);

      // 先发送进度100%的消息
      io.to(`task:${taskId}`).emit('task:progress', {
        taskId,
        status: 'completed',
        progress: 100,
        current: totalRecords,
        total: totalRecords,
        recordCount: totalRecords,
        speed: 0,
        message: `爬取完成！共采集 ${totalRecords} 条数据`
      });

      // 创建CSV文件记录
      const csvId = uuidv4();
      const fileSize = fs.statSync(filepath).size;
      await db.prepare(`
        INSERT INTO csv_files (id, task_id, filename, filepath, file_size, record_count, source, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
      `).run(csvId, taskId, filename, filepath, fileSize, totalRecords, config.sites[0]);

      // 再发送完成消息
      io.to(`task:${taskId}`).emit('task:completed', {
        taskId,
        totalRecords,
        duration,
        csvPath: filepath
      });
      
      console.log(`[TaskService] 任务已完成并发送完成消息`);

    } catch (error: any) {
      // 任务失败
      console.error(`[TaskService] 任务失败:`, error);
      console.error(`[TaskService] 错误堆栈:`, error.stack);
      
      await db.prepare(`
        UPDATE tasks SET status = 'failed', error_message = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `).run(error.message, taskId);

      const taskProgressInfo = this.taskProgress.get(taskId);
      const startTime = taskProgressInfo?.startTime || Date.now();
      const endTime = Date.now();
      const duration = Math.round((endTime - startTime) / 1000);

      io.to(`task:${taskId}`).emit('task:failed', {
        taskId,
        error: error.message,
        duration
      });
      
    } finally {
      // 停止控制台拦截器
      consoleInterceptor?.stop();
      
      console.log(`[TaskService] 清理任务资源`);
      this.runningTasks.delete(taskId);
      this.taskProgress.delete(taskId);
    }
  }

  // 停止任务
  stopTask(taskId: string) {
    const controller = this.runningTasks.get(taskId);
    if (controller) {
      controller.abort();
      return true;
    }
    return false;
  }

  // 暂停任务
  pauseTask(taskId: string) {
    this.stopTask(taskId);
    db.prepare(`
      UPDATE tasks SET status = 'paused', updated_at = CURRENT_TIMESTAMP WHERE id = $1
    `).run(taskId);
  }

  // 恢复任务
  async resumeTask(taskId: string, config: TaskConfig) {
    const task = await db.prepare('SELECT * FROM tasks WHERE id = $1').get(taskId) as Task;
    if (!task || task.status !== 'paused') {
      return;
    }

    await this.startTask(taskId, config);
  }

  // 创建Excel文件(替代CSV)
  private async createExcelFile(filepath: string) {
    const { CSV_FIELDS } = await import('../config/constants');
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('职位数据', {
      views: [
        { state: 'frozen', ySplit: 1 }  // 冻结首行
      ]
    });

    // 添加表头
    const headerRow = worksheet.addRow(CSV_FIELDS);
    
    // 设置表头样式: 粗体、背景色、居中、边框
    headerRow.font = { 
      bold: true, 
      size: 11, 
      name: 'Microsoft YaHei',
      color: { argb: 'FFFFFFFF' }  // 白色文字
    };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }  // 深蓝色背景
    };
    headerRow.alignment = { 
      horizontal: 'center', 
      vertical: 'middle', 
      wrapText: true 
    };
    headerRow.height = 25;  // 表头行高

    // 设置表头边框
    headerRow.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } }
      };
    });

    // 设置列宽(根据字段内容自适应)
    const columnWidths = [
      25,  // 企业名称
      20,  // 职位ID
      20,  // 职位名称
      15,  // 职位分类
      25,  // 职位标签
      30,  // 职位描述
      15,  // 薪资范围
      12,  // 工作城市
      12,  // 工作经验
      25,  // 工作地址
      10,  // 学历
      15,  // 公司代码
      12,  // 公司性质
      20,  // 经营范围
      15,  // 公司规模
      15,  // 岗位招聘人数
      15,  // 岗位更新日期
      12,  // 工作性质
      12   // 数据来源
    ];

    worksheet.columns.forEach((column, index) => {
      column.width = columnWidths[index] || 15;
    });

    // 保存工作簿
    await workbook.xlsx.writeFile(filepath);
    console.log(`[TaskService] Excel文件已创建: ${filepath}`);
  }

  // 追加Excel行
  private async appendExcelRow(filepath: string, job: JobData) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filepath);
    const worksheet = workbook.getWorksheet(1);

    if (!worksheet) {
      throw new Error('工作表不存在');
    }

    // 添加数据行
    const dataRow = worksheet.addRow([
      job.companyName,       // 企业名称
      job.jobId,             // 职位ID
      job.jobName,           // 职位名称
      job.jobCategory,       // 职位分类
      job.jobTags,           // 职位标签
      job.jobDescription,    // 职位描述
      job.salaryRange,       // 薪资范围
      job.workCity,          // 工作城市
      job.workExperience,    // 工作经验
      job.workAddress,       // 工作地址
      job.education,         // 学历
      job.companyCode,       // 公司代码
      job.companyNature,     // 公司性质
      job.businessScope,     // 经营范围
      job.companyScale,      // 公司规模
      job.recruitmentCount,  // 岗位招聘人数
      job.updateDate,        // 岗位更新日期
      job.workType,          // 工作性质
      job.dataSource         // 数据来源
    ]);

    // 设置数据行样式: 固定行高、边框、字体
    dataRow.height = 20;  // 固定行高
    dataRow.font = { size: 10, name: 'Microsoft YaHei' };
    dataRow.alignment = { 
      vertical: 'middle', 
      wrapText: true 
    };

    // 设置单元格边框
    dataRow.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD0D7E5' } },
        left: { style: 'thin', color: { argb: 'FFD0D7E5' } },
        bottom: { style: 'thin', color: { argb: 'FFD0D7E5' } },
        right: { style: 'thin', color: { argb: 'FFD0D7E5' } }
      };
    });

    // 隔行变色(可选,提升可读性)
    const rowIndex = dataRow.number;
    if (rowIndex % 2 === 0) {
      dataRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF2F2F2' }  // 浅灰色背景
      };
    }

    // 保存工作簿
    await workbook.xlsx.writeFile(filepath);
  }

  // 创建CSV文件(保留作为备选)
  private async createCsvFile(filepath: string) {
    const { CSV_FIELDS } = await import('../config/constants');
    const header = CSV_FIELDS.join(',') + '\n';
    // ✅ 添加UTF-8 BOM头，确保Excel正确显示中文
    const bom = '\uFEFF';
    fs.writeFileSync(filepath, bom + header, 'utf-8');
  }

  // 追加CSV行(保留作为备选)
  private async appendCsvRow(filepath: string, job: JobData) {
    const row = [
      this.escapeCsv(job.companyName),       // 企业名称
      this.escapeCsv(job.jobId),             // 职位ID
      this.escapeCsv(job.jobName),           // 职位名称
      this.escapeCsv(job.jobCategory),       // 职位分类
      this.escapeCsv(job.jobTags),           // 职位标签
      this.escapeCsv(job.jobDescription),    // 职位描述
      this.escapeCsv(job.salaryRange),       // 薪资范围
      this.escapeCsv(job.workCity),          // 工作城市
      this.escapeCsv(job.workExperience),    // 工作经验
      this.escapeCsv(job.workAddress),       // 工作地址
      this.escapeCsv(job.education),         // 学历
      this.escapeCsv(job.companyCode),       // 公司代码
      this.escapeCsv(job.companyNature),     // 公司性质
      this.escapeCsv(job.businessScope),     // 经营范围
      this.escapeCsv(job.companyScale),      // 公司规模
      this.escapeCsv(job.recruitmentCount),  // 岗位招聘人数
      this.escapeCsv(job.updateDate),        // 岗位更新日期
      this.escapeCsv(job.workType),          // 工作性质
      this.escapeCsv(job.dataSource)         // 数据来源
    ].join(',') + '\n';

    fs.appendFileSync(filepath, row, 'utf-8');
  }

  // CSV转义
  private escapeCsv(value: string): string {
    if (!value) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }
}

export { TaskService };