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
const logDir = path.join(__dirname, '../../data/logs');

// 确保日志目录存在
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// 🔧 新增：任务专用日志记录器（替代全局console劫持）
class TaskLogger {
  private taskId: string;
  private writeStream: fs.WriteStream | null = null;
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
    
    // 创建日志文件写入流（追加模式）
    const logFilePath = path.join(logDir, `task_${taskId}.log`);
    this.writeStream = fs.createWriteStream(logFilePath, { 
      flags: 'a',
      encoding: 'utf-8'
    });
    
    // 写入日志头部
    const startTime = new Date().toISOString();
    this.writeStream.write(`\n${'='.repeat(80)}\n`);
    this.writeStream.write(`任务ID: ${this.taskId}\n`);
    this.writeStream.write(`开始时间: ${startTime}\n`);
    this.writeStream.write(`${'='.repeat(80)}\n\n`);
  }

  // 格式化消息
  private formatMessage(level: string, args: any[]): string {
    const timestamp = new Date().toISOString();
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  }

  // 写入日志文件和WebSocket
  private writeLog(level: string, args: any[]) {
    const formattedMessage = this.formatMessage(level, args);
    const logLine = formattedMessage + '\n';
    
    // 写入文件
    if (this.writeStream) {
      this.writeStream.write(logLine);
    }
    
    // 推送到WebSocket
    if (io && this.taskId) {
      io.to(`task:${this.taskId}`).emit('task:log', {
        taskId: this.taskId,
        level: level.toLowerCase(),
        message: args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' '),
        timestamp: new Date().toISOString()
      });
    }
  }

  // 日志方法
  info(...args: any[]) {
    this.writeLog('INFO', args);
    // 同时输出到原始console（用于调试）
    this.originalConsoleLog.apply(console, [`[${this.taskId}]`, ...args]);
  }

  warn(...args: any[]) {
    this.writeLog('WARN', args);
    this.originalConsoleWarn.apply(console, [`[${this.taskId}]`, ...args]);
  }

  error(...args: any[]) {
    this.writeLog('ERROR', args);
    this.originalConsoleError.apply(console, [`[${this.taskId}]`, ...args]);
  }

  // 关闭日志器
  close() {
    if (this.writeStream) {
      const endTime = new Date().toISOString();
      this.writeStream.write(`\n${'='.repeat(80)}\n`);
      this.writeStream.write(`结束时间: ${endTime}\n`);
      this.writeStream.write(`${'='.repeat(80)}\n`);
      
      this.writeStream.end(() => {
        this.originalConsoleLog(`[TaskLogger] 📝 日志文件已保存: task_${this.taskId}.log`);
      });
      this.writeStream = null;
    }
  }
}

class TaskService {
  private runningTasks: Map<string, AbortController> = new Map();
  private taskProgress: Map<string, any> = new Map();
  private writtenJobIds: Map<string, Set<string>> = new Map();  // taskId → Set<jobId>

  // 启动任务
  async startTask(taskId: string, config: TaskConfig) {
    const logger = new TaskLogger(taskId);
    
    logger.info(`[TaskService] 开始启动任务: ${taskId}`);
    logger.info(`[TaskService] 任务配置:`, JSON.stringify(config, null, 2));
    
    const controller = new AbortController();
    this.runningTasks.set(taskId, controller);

    // 更新任务状态为running
    await db.prepare(`
      UPDATE tasks SET status = 'running', start_time = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `).run(taskId);
    logger.info(`[TaskService] 任务状态已更新为 running`);

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
    logger.info(`[TaskService] Excel文件已创建: ${filepath}`);

    // 更新文件路径
    await db.prepare(`
      UPDATE tasks SET csv_path = $1 WHERE id = $2
    `).run(filepath, taskId);
    logger.info(`[TaskService] 文件路径已更新`);

    // 发送初始状态消息
    io.to(`task:${taskId}`).emit('task:status', {
      taskId,
      status: 'running',
      message: '任务已启动，准备开始爬取...'
    });
    logger.info(`[TaskService] 已发送初始状态消息`);

    // 启动爬取过程（传入logger）
    this.executeCrawling(taskId, config, controller, undefined, logger);
  }

  // 执行爬取
  private async executeCrawling(
    taskId: string, 
    config: TaskConfig, 
    controller: AbortController,
    resumeState?: { combinationIndex: number; currentPage: number; initialRecordCount: number },
    logger?: TaskLogger  // 🔧 修改参数类型：从ConsoleInterceptor改为TaskLogger
  ) {
    let taskLogger: TaskLogger | null = null; // 🔧 在try外部声明

    try {
      // 🔧 关键修复：如果已有logger则复用，否则创建新的
      if (logger) {
        taskLogger = logger;
        taskLogger.info(`[TaskService] 🔄 使用已有的日志记录器`);
      } else {
        taskLogger = new TaskLogger(taskId);
        taskLogger.info(`[TaskService] ✅ 创建新的日志记录器`);
      }
      
      // 执行爬取
      let totalRecords = resumeState?.initialRecordCount || 0;
      let lastUpdateTime = Date.now();
      let lastRecordCount = totalRecords;
      
      // 🔧 关键修复：如果是重启任务，从已有CSV文件读取初始记录数
      let initDedupPromise: Promise<void> | null = null;
      if (resumeState) {
        taskLogger.info(`[TaskService] 🔄 断点续传模式 - 起始记录数: ${totalRecords}`);
        taskLogger.info(`[TaskService] 📍 从组合索引 ${resumeState.combinationIndex}, 第 ${resumeState.currentPage} 页继续`);

        io.to(`task:${taskId}`).emit('task:log', {
          taskId,
          level: 'info',
          message: `🔄 断点续传：已采集${totalRecords}条数据，从失败点继续...`
        });
      }

      // 获取CSV路径和文件名
      const task = await db.prepare('SELECT csv_path FROM tasks WHERE id = $1').get(taskId) as Task;
      const filepath = task?.csvPath || path.join(csvDir, `job_data_${taskId}.csv`);
      const filename = path.basename(filepath);

      // 🔧 去重：从已有Excel文件读取已写入的jobId集合，防止断点续传产生重复数据
      if (resumeState) {
        initDedupPromise = this.initWrittenJobIds(filepath, taskId, taskLogger);
        await initDedupPromise;
      }

      for (const site of config.sites) {
        taskLogger.info(`[TaskService] 开始爬取站点: ${site}`);
        
        if (controller.signal.aborted) {
          taskLogger.info(`[TaskService] 任务已被中止`);
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

        // 🔧 关键修复：设置爬虫的taskId和logger，使其能够正确记录日志
        (crawler as any).taskId = taskId;
        if ((crawler as any).setLogger) {
          (crawler as any).setLogger(taskLogger);
        }
        
        taskLogger.info(`[TaskService] 🚀 爬虫实例已创建，开始遍历职位数据...`);

        // 🔧 诊断：记录迭代次数
        let iterationCount = 0;
        
        for await (const job of crawler.crawl(config, controller.signal)) {
          iterationCount++;
          
          if (iterationCount === 1) {
            taskLogger.info(`[TaskService] ✅ 首次接收到数据！job=${JSON.stringify({jobName: job.jobName, companyName: job.companyName})}`);
          }
          
          if (controller.signal.aborted) {
            taskLogger.info(`[TaskService] 爬取过程中被中止`);
            break;
          }

          // 写入Excel
          const writeSuccess = await this.appendExcelRow(filepath, job, taskId);
          
          if (writeSuccess) {
            totalRecords++;
            
            // 🔧 优化：减少日志输出频率，每10条输出一次
            if (totalRecords % 10 === 0 || totalRecords <= 5) {
              taskLogger.info(`[TaskService] 已采集第 ${totalRecords} 条数据`);
            }
          } else {
            taskLogger.warn(`[TaskService] ⚠️ 职位 ${job.jobId} 写入失败，跳过计数`);
          }

          // 🔧 关键优化：降低数据库更新频率，从每条更新改为每5条或每秒更新
          const now = Date.now();
          const elapsed = (now - lastUpdateTime) / 1000;
          const speed = elapsed > 0
            ? Math.round((totalRecords - lastRecordCount) / elapsed)
            : 0;

          // 🔧 关键修复：计算总组合数，判断是否为多组合场景
          const keywords = config.keywords && config.keywords.length > 0 
            ? config.keywords 
            : (config.keyword ? [config.keyword] : ['']);
          const cities = config.cities && config.cities.length > 0
            ? config.cities
            : (config.city ? [config.city] : ['']);
          const totalCombinations = keywords.length * cities.length;
          const isMultiCombination = totalCombinations > 1;

          // 🔧 更新条件：时间间隔>=2秒 或 每采集5条数据
          // ⚠️ 注意：即使totalRecords为0，也要定期更新以显示"正在运行"状态
          const shouldUpdate = elapsed >= 2 || totalRecords % 5 === 0 || (totalRecords === 0 && elapsed >= 5);
          
          if (shouldUpdate) {
            lastUpdateTime = now;
            lastRecordCount = totalRecords;
            
            // 🔧 诊断日志：记录更新触发原因
            const triggerReason = totalRecords === 0 ? '心跳(无数据)' : 
                                 (elapsed >= 2 ? `时间间隔(${elapsed.toFixed(1)}s)` : `数据量(${totalRecords}条)`);
            taskLogger.info(`[TaskService] 📊 准备更新进度 - 触发原因: ${triggerReason}, totalRecords=${totalRecords}, isMultiCombination=${isMultiCombination}`);

            // 🔧 关键修复：无论单/多组合，都更新record_count（已采集记录数）
            // 但progress（进度百分比）的计算方式不同
            let progressPercent: number;

            if (isMultiCombination) {
              // 多组合场景：主进度 = 已完成组合数/总组合数，干净直观
              // 爬虫每完成一个组合写入 current=已完成的组合编号
              try {
                const taskInfo = await db.prepare('SELECT current FROM tasks WHERE id = $1').get(taskId) as any;
                const completedCombo = taskInfo?.current || 0;

                // 主进度 = 已完成组合比例（最大99%，留给任务完成时才设为100%）
                progressPercent = Math.min(99, Math.round(completedCombo / totalCombinations * 100));
              } catch (e) {
                // DB读取失败时回退到记录估算
                if (totalRecords <= 10) {
                  progressPercent = (totalRecords / 10) * 50;
                } else if (totalRecords <= 50) {
                  progressPercent = 50 + ((totalRecords - 10) / 40) * 30;
                } else {
                  progressPercent = 80 + Math.min(19, (totalRecords - 50) / 10);
                }
              }
            } else {
              // 单组合场景：基于已采集数据量，使用渐进式估算
              // 前10条数据显示0-50%，10-50条显示50-80%，50条以上显示80-99%
              if (totalRecords <= 10) {
                progressPercent = (totalRecords / 10) * 50;
              } else if (totalRecords <= 50) {
                progressPercent = 50 + ((totalRecords - 10) / 40) * 30;
              } else {
                progressPercent = 80 + Math.min(19, (totalRecords - 50) / 10);
              }
            }

            // 确保进度不超过99%
            progressPercent = Math.min(99, Math.max(0, progressPercent));

            // 🔧 关键修复：PostgreSQL的INTEGER字段不接受小数，必须取整
            progressPercent = Math.round(progressPercent);

            // 🔧 组合内进度：记录数估算（0-99%），用于多组合任务显示当前组合内的爬取进展
            let comboProgress = 0;
            if (isMultiCombination) {
              if (totalRecords <= 10) {
                comboProgress = (totalRecords / 10) * 50;
              } else if (totalRecords <= 50) {
                comboProgress = 50 + ((totalRecords - 10) / 40) * 30;
              } else {
                comboProgress = 80 + Math.min(19, (totalRecords - 50) / 10);
              }
              comboProgress = Math.round(Math.min(99, comboProgress));
            }

            try {
              // 更新数据库进度和记录数
              // ⚠️ 多组合场景下 current 由爬虫写入（已完成组合编号），此处不覆盖
              if (isMultiCombination) {
                await db.prepare(`
                  UPDATE tasks
                  SET progress = $1, record_count = $2, updated_at = CURRENT_TIMESTAMP
                  WHERE id = $3
                `).run(progressPercent, totalRecords, taskId);
              } else {
                await db.prepare(`
                  UPDATE tasks
                  SET progress = $1, current = $2, record_count = $3, updated_at = CURRENT_TIMESTAMP
                  WHERE id = $4
                `).run(progressPercent, totalRecords, totalRecords, taskId);
              }
            } catch (dbError: any) {
              // 🔧 数据库更新失败不影响数据采集，仅记录日志
              taskLogger.warn(`[TaskService] 数据库进度更新失败（可忽略）: ${dbError.message}`);
            }

            // 🔧 调试：检查WebSocket房间内的客户端数量
            const room = io.sockets.adapter.rooms.get(`task:${taskId}`);
            const clientCount = room ? room.size : 0;
            taskLogger.info(`[TaskService] 📡 准备推送进度 - 房间内客户端数: ${clientCount}, progress: ${progressPercent}%, comboProgress: ${comboProgress}%, records: ${totalRecords}`);

            io.to(`task:${taskId}`).emit('task:progress', {
              taskId,
              status: 'running',
              progress: progressPercent,
              comboProgress: isMultiCombination ? comboProgress : 0,
              current: totalRecords,
              total: totalRecords > 0 ? totalRecords : 100,
              recordCount: totalRecords,
              speed,
              message: totalRecords > 0 ? `已采集 ${totalRecords} 条数据` : '正在爬取中...'
            });
            
            taskLogger.info(`[TaskService] ✅ 进度消息已发送`);
          }
        }

      }

      // 任务完成
      taskLogger.info(`[TaskService] 任务完成，共采集 ${totalRecords} 条数据`);
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
      
      taskLogger.info(`[TaskService] 任务已完成并发送完成消息`);

    } catch (error: any) {
      // 任务失败
      taskLogger?.error(`[TaskService] 任务失败:`, error);
      if (error.stack) {
        taskLogger?.error(`[TaskService] 错误堆栈:`, error.stack);
      }

      // 🔧 关键修复：检测是否为可恢复的浏览器崩溃错误
      const isBrowserCrash = error.canRecover === true || 
                             error.message?.includes('BROWSER_CRASH_RECOVERABLE');
      
      // 🔧 新增：检测是否为计划内的浏览器重启
      const isPlannedRestart = error.shouldRestart === true ||
                               error.message?.includes('BROWSER_RESTART_SCHEDULED');

      if (isBrowserCrash || isPlannedRestart) {
        const restartReason = isPlannedRestart ? '计划内重启' : '浏览器崩溃';
        taskLogger?.info(`[TaskService] 🔄 检测到${restartReason}，准备重启并重试...`);
        
        // 🔧 关键修复1：读取当前Excel/CSV文件的行数作为初始记录数
        let initialRecordCount = 0;
        try {
          const task = await db.prepare('SELECT csv_path FROM tasks WHERE id = $1').get(taskId) as Task;
          const filepath = task?.csvPath || path.join(csvDir, `job_data_${taskId}.csv`);

          if (fs.existsSync(filepath)) {
            const ext = path.extname(filepath).toLowerCase();
            if (ext === '.xlsx') {
              const workbook = new ExcelJS.Workbook();
              await workbook.xlsx.readFile(filepath);
              const worksheet = workbook.worksheets[0];
              if (worksheet) {
                // 减去表头行
                initialRecordCount = Math.max(0, worksheet.rowCount - 1);
                taskLogger?.info(`[TaskService] 📊 已爬取数据: ${initialRecordCount} 条（从Excel文件读取）`);
              }
            } else {
              const fileContent = fs.readFileSync(filepath, 'utf-8');
              const lines = fileContent.split('\n').filter(line => line.trim().length > 0);
              // 减去表头行
              initialRecordCount = Math.max(0, lines.length - 1);
              taskLogger?.info(`[TaskService] 📊 已爬取数据: ${initialRecordCount} 条（从CSV文件读取）`);
            }
          }
        } catch (readError: any) {
          taskLogger?.warn(`[TaskService] ⚠️ 读取文件失败，将从0开始计数:`, readError.message);
        }
        
        // 🔧 关键修复2：提取错误中的位置信息
        const combinationIndex = error.combinationIndex || 0;
        const currentPage = error.currentPage || 1;
        const jobIndex = error.jobIndex || 0;

        taskLogger?.info(`[TaskService] 📍 失败位置: 组合索引=${combinationIndex}, 页码=${currentPage}, 职位索引=${jobIndex}`);

        // 发送重启日志到前端
        io.to(`task:${taskId}`).emit('task:log', {
          taskId,
          level: 'warning',
          message: `🔄 浏览器崩溃，正在重启并从第${combinationIndex}个组合、第${currentPage}页继续...`
        });

        // 🔧 等待3秒后重启浏览器并重试
        await new Promise(resolve => setTimeout(resolve, 3000));

        try {
          // 重新执行爬取任务（从当前位置继续）
          taskLogger?.info(`[TaskService] 🚀 重新启动爬虫任务...`);
          
          // 🔧 关键修复3：传递恢复状态，包括起始记录数和失败位置
          const resumeState = {
            combinationIndex,
            currentPage,
            initialRecordCount
          };
          
          // 🔧 关键修复4：将恢复状态注入config，传递给爬虫
          const configWithResume = {
            ...config,
            _resumeState: {
              combinationIndex,
              currentPage,
              jobIndex
            }
          };
          
          // 🔧 关键修复5：传递当前拦截器，避免重复创建
          await this.executeCrawling(taskId, configWithResume, controller, resumeState, logger || undefined);
          return; // 重试成功后直接返回，不执行下方的失败逻辑
        } catch (retryError: any) {
          // 如果重试也失败，则标记为最终失败
          taskLogger?.error(`[TaskService] ❌ 重试后仍然失败:`, retryError.message);
          error = retryError; // 使用重试的错误信息
        }
      }

      // 标记任务为失败
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
      // 🔧 关键修复：只有当前创建的拦截器才需要停止（复用的拦截器由外层管理）
      if (logger) {
        logger.close();
        taskLogger?.info(`[TaskService] ✅ 日志记录器已停止`);
      }
      
      taskLogger?.info(`[TaskService] 清理任务资源`);
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

  // 🔧 去重：从现有Excel文件读取已写入的jobId集合
  private async initWrittenJobIds(filepath: string, taskId: string, taskLogger?: TaskLogger): Promise<void> {
    try {
      if (!fs.existsSync(filepath)) {
        this.writtenJobIds.set(taskId, new Set());
        return;
      }

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filepath);
      const worksheet = workbook.getWorksheet(1);
      if (!worksheet) {
        this.writtenJobIds.set(taskId, new Set());
        return;
      }

      const jobIds = new Set<string>();
      // jobId是第2列（索引1），跳过表头行
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // 跳过表头
        const jobIdCell = row.getCell(2); // B列 = 职位ID
        const jobId = jobIdCell?.value?.toString()?.trim();
        if (jobId) {
          jobIds.add(jobId);
        }
      });

      this.writtenJobIds.set(taskId, jobIds);
      taskLogger?.info(`[TaskService] 🔍 去重初始化完成: 已从Excel读取 ${jobIds.size} 个已有jobId`);
    } catch (error: any) {
      taskLogger?.warn(`[TaskService] ⚠️ 读取已有jobId失败，将使用空去重集合: ${error.message}`);
      this.writtenJobIds.set(taskId, new Set());
    }
  }

  // 追加Excel行
  private async appendExcelRow(filepath: string, job: JobData, taskId: string): Promise<boolean> {
    try {
      // 🔧 去重检查：防止断点续传产生的重复数据
      const existingIds = this.writtenJobIds.get(taskId);
      if (existingIds && existingIds.has(job.jobId)) {
        return false; // 重复jobId，静默跳过
      }

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

      // 🔧 去重：记录已写入的jobId
      if (!this.writtenJobIds.has(taskId)) {
        this.writtenJobIds.set(taskId, new Set());
      }
      this.writtenJobIds.get(taskId)!.add(job.jobId);

      return true; // 写入成功
      
    } catch (error: any) {
      // 🔧 关键修复：Excel写入失败时记录错误，但不中断爬取流程
      console.error(`[TaskService] ❌ Excel写入失败: ${error.message}`);
      console.error(`[TaskService] 失败的职位数据:`, {
        jobId: job.jobId,
        jobName: job.jobName,
        companyName: job.companyName
      });
      
      return false; // 写入失败
    }
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