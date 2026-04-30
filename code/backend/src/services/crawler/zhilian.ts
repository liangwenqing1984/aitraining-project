// @ts-nocheck - 禁用整个文件的类型检查，因为 page.evaluate 中的代码在浏览器环境中运行
import puppeteer from 'puppeteer';
import { JobData, TaskConfig } from '../../types';
import { ZHILIAN_CITY_CODES } from '../../config/constants';
import { io } from '../../app';
import { db } from '../../config/database';
import * as fs from 'fs';
import * as path from 'path';

export class ZhilianCrawler {
  private logger: any = null;  // 🔧 新增：日志记录器
  
  // 🔧 新增：设置日志记录器
  setLogger(logger: any) {
    this.logger = logger;
  }
  
  // 🔧 辅助方法：根据是否有logger选择输出方式
  private log(level: string, ...args: any[]) {
    if (this.logger) {
      (this.logger as any)[level](...args);
    } else {
      console[level](...args);
    }
  }


  private signal: AbortSignal | null = null;

  // 🔧 串行化 browser.newPage() 调用，防止并发创建时超时导致孤儿标签页泄漏
  private pageCreateMutex: Promise<void> = Promise.resolve();

  async *crawl(config: TaskConfig, signal: AbortSignal): AsyncGenerator<JobData> {
    this.signal = signal;

    // 🔧 断点续传：获取恢复状态
    const resumeState = config._resumeState;
    const startCombinationIndex = resumeState?.combinationIndex || 0;
    const startPage = resumeState?.currentPage || 1;
    const globalStartJobIndex = resumeState?.jobIndex || 0;

    if (resumeState) {
      this.log('info', `[ZhilianCrawler] 🔄 断点续传模式激活`);
      this.log('info', `[ZhilianCrawler] 📍 从组合索引 ${startCombinationIndex}, 第 ${startPage} 页, 第 ${globalStartJobIndex + 1} 个职位开始`);
    }

    // 获取关键词列表（支持多个）
    const keywords = config.keywords && config.keywords.length > 0 
      ? config.keywords 
      : (config.keyword ? [config.keyword] : ['']);
    
    this.log('info', `[ZhilianCrawler] ========== 原始配置检查 ==========`);
    this.log('info', `[ZhilianCrawler] config.keywords:`, JSON.stringify(config.keywords));
    this.log('info', `[ZhilianCrawler] config.keyword:`, JSON.stringify(config.keyword));
    this.log('info', `[ZhilianCrawler] 最终使用的keywords数组:`, JSON.stringify(keywords));
    this.log('info', `[ZhilianCrawler] ====================================`);
    
    // 获取城市列表（支持多个）
    const cities = config.cities && config.cities.length > 0
      ? config.cities
      : (config.city ? [config.city] : ['']);
    
    // 获取企业列表（支持多个）
    const companies = config.companies || (config.company ? [config.company] : []);

    // 🔧 优化：构建高效的企业匹配数据结构
    let companyMatchSet: Set<string> | null = null;
    let companyMatchMap: Map<string, string[]> | null = null;  // 小写->原始名称映射
    
    if (companies.length > 0) {
      this.log('info', `[ZhilianCrawler] 🏢 启用企业筛选模式，共 ${companies.length} 家目标企业`);
      
      // 构建小写映射表，支持大小写不敏感匹配
      companyMatchMap = new Map();
      companyMatchSet = new Set();
      
      for (const comp of companies) {
        const lowerComp = comp.toLowerCase();
        companyMatchMap.set(lowerComp, comp);
        companyMatchSet.add(lowerComp);
        
        // 同时添加去除"有限公司"等后缀的版本，提高匹配率
        const simplifiedComp = comp.replace(/(有限|股份|集团|科技|技术|发展|实业|控股|投资|管理|咨询|服务|网络|软件|信息|系统|工程|制造|贸易|进出口|中国|国际|北京|上海|广州|深圳|杭州|南京|成都|武汉|西安|天津|重庆|苏州|青岛|大连|厦门|宁波|长沙|郑州|济南|合肥|南昌|福州|昆明|贵阳|南宁|海口|哈尔滨|长春|沈阳|石家庄|太原|呼和浩特|兰州|西宁|银川|乌鲁木齐|拉萨|香港|澳门|台湾)/g, '');
        if (simplifiedComp !== comp) {
          const lowerSimplified = simplifiedComp.toLowerCase();
          companyMatchMap.set(lowerSimplified, comp);
          companyMatchSet.add(lowerSimplified);
        }
      }
      
      this.log('info', `[ZhilianCrawler] ✅ 企业匹配索引构建完成: ${companyMatchSet.size} 个索引项`);
    }

    let totalCombinationCount = keywords.length * cities.length;
    let currentCombination = 0;

    this.log('info', `[ZhilianCrawler] 开始爬取`);
    this.log('info', `[ZhilianCrawler] ========== 关键词和城市配置 ==========`);
    this.log('info', `[ZhilianCrawler] 关键词列表: [${keywords.join(', ')}] (共${keywords.length}个)`);
    this.log('info', `[ZhilianCrawler] 城市列表: [${cities.join(', ')}] (共${cities.length}个)`);
    this.log('info', `[ZhilianCrawler] 企业列表: ${companies.length > 0 ? '[' + companies.slice(0, 10).join(', ') + (companies.length > 10 ? `...等${companies.length}家` : '') + ']' : '不限'} (共${companies.length}个)`);
    this.log('info', `[ZhilianCrawler] 总组合数: ${totalCombinationCount} (${keywords.length} × ${cities.length})`);
    this.log('info', `[ZhilianCrawler] =============================================`);

    // 启动浏览器 - 使用自定义临时目录避免冲突
    const chromePath = 'C:\\Users\\Administrator\\.cache\\puppeteer\\chrome\\win64-131.0.6778.204\\chrome-win64\\chrome.exe';
    const userDataDir = `C:\\Users\\Administrator\\.cache\\puppeteer\\tmp\\zhilian_${Date.now()}`;
    
    this.log('info', `[ZhilianCrawler] 使用临时目录: ${userDataDir}`);
    
    // 🔧 优化：增加更多稳定性参数
    const browser = await puppeteer.launch({
      executablePath: chromePath,
      userDataDir,  // 使用自定义临时目录
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920x1080',
        // 🔧 稳定性参数
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-site-isolation-trials',
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-default-apps',
        '--no-first-run',
        '--disable-sync',
        '--disable-translate',
        '--metrics-recording-only',
        '--safebrowsing-disable-auto-update',
        // 🔧 内存与稳定性优化：防止OOM崩溃
        '--js-flags="--max-old-space-size=512"',  // 限制JS堆内存512MB
        '--disable-hang-monitor',                   // 禁用挂起监控，防止误杀
        '--disable-background-timer-throttling',    // 禁用后台定时器节流
        '--disable-renderer-backgrounding',         // 禁止渲染器降级
      ],
      // 🔧 添加超时控制
      timeout: 30000  // 30秒启动超时
    });
    
    this.log('info', `[ZhilianCrawler] ✅ 浏览器启动成功`);

    // 🔧 关键修复：监听 abort 信号，用户停止任务时主动关闭浏览器
    // 这会使所有正在进行的 page.goto/waitForSelector/newPage 立即失败，
    // 配合 abortableSleep 实现秒级响应停止请求
    const abortHandler = () => {
      this.log('info', `[ZhilianCrawler] ⏹️ 收到中止信号，正在强制关闭浏览器...`);
      browser.close().catch(() => {});
    };
    signal.addEventListener('abort', abortHandler, { once: true });

    try {
      // 遍历所有关键词和城市的组合
      this.log('info', `[ZhilianCrawler] >>>>>> 开始遍历 ${totalCombinationCount} 个组合 <<<<<<`);
      
      let skippedCombinations = 0;
      
      for (const keyword of keywords) {
        for (const city of cities) {
          currentCombination++;
          
          // 🔧 断点续传：跳过已完成的组合
          if (currentCombination < startCombinationIndex) {
            skippedCombinations++;
            if (skippedCombinations % 10 === 0 || skippedCombinations <= 3) {
              this.log('info', `[ZhilianCrawler] ⏭️ 跳过已完成组合 ${currentCombination}/${totalCombinationCount}`);
            }
            continue;
          }
          
          // 🔧 断点续传：如果是起始组合，从指定页码开始
          let currentPage = (currentCombination === startCombinationIndex) ? startPage : 1;
          
          this.log('info', `[ZhilianCrawler]`);
          this.log('info', `[ZhilianCrawler] ╔════════════════════════════════════════╗`);
          this.log('info', `[ZhilianCrawler] ║ 开始处理组合 ${currentCombination}/${totalCombinationCount}`);
          this.log('info', `[ZhilianCrawler] ║   关键词: "${keyword}"`);
          this.log('info', `[ZhilianCrawler] ║   城市:   "${city || '不限'}"`);
          this.log('info', `[ZhilianCrawler] ║   起始页: ${currentPage}`);
          this.log('info', `[ZhilianCrawler] ╚════════════════════════════════════════╝`);
          
          if (this.checkAborted()) {
            this.log('info', `[ZhilianCrawler] ⚠️ 任务已中止，停止后续组合处理`);
            return;
          }

          // 🔧 修复: 安全获取城市代码,避免undefined
          const cityCode = city ? (ZHILIAN_CITY_CODES[city] || '') : '';
          
          // 如果城市代码为空,记录警告但不中断任务
          if (city && !cityCode) {
            this.log('warn', `[ZhilianCrawler] ⚠️ 城市"${city}"未在映射表中找到,将使用全国搜索`);
            
            // 发送警告日志到前端
            const taskId = this.getTaskId();
            if (io && taskId) {
              io.to(`task:${taskId}`).emit('task:log', {
                taskId,
                level: 'warning',
                message: `城市"${city}"未找到对应代码,将搜索全国范围`
              });
            }
          }
          
          this.log('info', `[ZhilianCrawler] 开始爬取组合 ${currentCombination}/${totalCombinationCount}: 关键词="${keyword}", 城市="${city || '不限'}", 城市代码="${cityCode || '无(全国)'}"`);

          // 发送日志到前端
          const taskId = this.getTaskId();
          if (io && taskId) {
            io.to(`task:${taskId}`).emit('task:log', {
              taskId,
              level: 'info',
              message: `开始爬取: 关键词="${keyword}" | 城市="${city}" (${currentCombination}/${totalCombinationCount})`
            });
          }

          // 🔧 修复：清理关键词，去除首尾空格和不可见字符
          const cleanKeyword = keyword.trim().replace(/\s+/g, ' ');
          
          this.log('info', `[ZhilianCrawler] 原始关键词: "${keyword}"`);
          this.log('info', `[ZhilianCrawler] 清理后关键词: "${cleanKeyword}"`);
          
          // 🔧 关键修复：使用查询参数方式构建URL，避免智联的路径编码问题
          // ❌ 错误方式（路径编码）：https://www.zhaopin.com/sou/jl622/kwUI/p1
          // ✅ 正确方式（查询参数）：https://www.zhaopin.com/sou?jl=622&kw=UI&p=1
          
          // 🔧 断点续传：currentPage已在循环开始时设置，这里只声明hasNextPage
          let hasNextPage = true;
          
          // 🔧 智能提前终止：跟踪连续无匹配的页数
          let consecutiveEmptyPages = 0;
          const MAX_CONSECUTIVE_EMPTY_PAGES = companies.length > 0 ? 5 : 999;  // 有企业筛选时，连续5页无匹配则停止

          while (hasNextPage && !this.checkAborted()) {
            // 在循环内部构建URL，以便动态更新页码
            const searchParams = new URLSearchParams({
              jl: cityCode || '',  // 城市代码
              kw: cleanKeyword,     // 关键词（URLSearchParams会自动处理编码）
              p: currentPage.toString()                // 页码
            });
            
            const url = `https://www.zhaopin.com/sou?${searchParams.toString()}`;
            const pageStartTime = Date.now();
            
            this.log('info', `[ZhilianCrawler] 正在爬取第 ${currentPage} 页: ${url}`);
            this.log('info', `[ZhilianCrawler] 使用查询参数方式，避免路径编码问题`);
            
            // 发送详细日志到前端
            if (io && taskId) {
              io.to(`task:${taskId}`).emit('task:log', {
                taskId,
                level: 'info',
                message: `📄 正在请求第 ${currentPage} 页: ${url}`
              });
            }

            // 🔧 detached Frame 恢复：支持页面重载复用，避免重复创建
            let page: any = null;
            let isNewPage = true;
            if (typeof (this as any)._recoveredPage !== 'undefined' && !(this as any)._recoveredPage.isClosed()) {
              page = (this as any)._recoveredPage;
              (this as any)._recoveredPage = undefined;
              isNewPage = false;
              this.log('info', `[ZhilianCrawler] 🔄 复用恢复的页面，跳过新页面创建`);
            } else {
              page = null;
            }
            let currentJobIndex = 0;  // 🔧 断点续传：追踪当前页内处理的职位索引
            try {

              if (!page) {
                page = await browser.newPage();

                // 设置用户代理和视口 - 添加错误处理
                try {
                  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
                  await page.setViewport({ width: 1920, height: 1080 });
                } catch (setupError: any) {
                  this.log('error', `[ZhilianCrawler] ❌ 页面初始化失败:`, setupError.message);
                  // 如果页面初始化就失败，直接关闭并抛出
                  try { await page.close(); } catch (e) {}
                  throw new Error(`页面初始化失败: ${setupError.message}`);
                }
              }

              // 🚀 优化：拦截不必要的资源以加速页面加载（仅新页面需要设置）
              if (isNewPage) {
                await page.setRequestInterception(true);
                page.on('request', (request) => {
                // 🔧 优化：允许样式表和字体，确保页面正常渲染和JS执行
                const allowedTypes = ['document', 'script', 'xhr', 'fetch', 'websocket', 'stylesheet', 'font'];
                const resourceType = request.resourceType();
                
                if (allowedTypes.includes(resourceType)) {
                  request.continue();
                } else {
                  // 阻止图片、媒体、manifest等非关键资源
                  request.abort();
                }
              });
              }  // end if (isNewPage)

              // 🔄 重试机制：最多重试2次
              let loadSuccess = false;
              let retryCount = 0;
              const maxRetries = 2;

              while (!loadSuccess && retryCount <= maxRetries) {
                try {
                  if (retryCount > 0) {
                    this.log('info', `[ZhilianCrawler] 第 ${retryCount} 次重试加载...`);
                    if (io && taskId) {
                      io.to(`task:${taskId}`).emit('task:log', {
                        taskId,
                        level: 'warning',
                        message: `⚠️ 第 ${currentPage} 页加载超时，正在第 ${retryCount} 次重试...`
                      });
                    }
                  }

                  // 导航到页面 - 使用 domcontentloaded 加快加载速度
                  await page.goto(url, { 
                    waitUntil: 'domcontentloaded',  // 等待DOM加载完成即可，不等待所有资源
                    timeout: 90000  // 增加超时时间到90秒
                  });

                  loadSuccess = true;
                  this.log('info', `[ZhilianCrawler] 页面加载完成，URL: ${page.url()}`);
                  
                } catch (loadError: any) {
                  retryCount++;
                  this.log('warn', `[ZhilianCrawler] ⚠️ 第 ${retryCount} 次加载失败:`, loadError.message);
                  
                  if (retryCount > maxRetries) {
                    throw new Error(`页面加载失败，已重试 ${maxRetries} 次: ${loadError.message}`);
                  }
                  
                  // 等待2-4秒后重试
                  // 🔧 优化：缩短页间延迟，提高爬取速度
                  await this.randomDelay(1000, 2000);  // 🔧 从2-4秒优化为1-2秒
                }
              }

              this.log('info', `[ZhilianCrawler] 页面加载完成，URL: ${page.url()}`);
              
              // 发送页面加载成功日志
              if (io && taskId) {
                io.to(`task:${taskId}`).emit('task:log', {
                  taskId,
                  level: 'success',
                  message: `✅ 第 ${currentPage} 页加载成功`
                });
              }
              
              // 检查是否被重定向或显示错误页面
              const pageTitle = await page.title();
              this.log('info', `[ZhilianCrawler] 页面标题: ${pageTitle}`);
              
              // 检查是否有登录提示或验证码 - 🔧 增加空值检查
              const pageContent = await page.evaluate(() => {
                const bodyText = document.body?.textContent || '';
                return {
                  hasLogin: bodyText.includes('登录') || false,
                  hasVerify: bodyText.includes('验证') || false,
                  bodyLength: bodyText.length || 0
                };
              });
              this.log('info', `[ZhilianCrawler] 页面内容检查:`, pageContent);
              
              // 发送反爬检测日志
              if (pageContent.hasLogin || pageContent.hasVerify) {
                if (io && taskId) {
                  io.to(`task:${taskId}`).emit('task:log', {
                    taskId,
                    level: 'warning',
                    message: `⚠️ 第 ${currentPage} 页检测到登录提示或验证码，可能被反爬`
                  });
                }
              }
              
              // ⚠️ 优化：智能等待策略 - 根据页面复杂度动态调整
              this.log('info', `[ZhilianCrawler] 等待动态内容加载...`);
              await this.randomDelay(3000, 4000);  // 🔧 优化：从2-3秒增加到3-4秒，确保懒加载完成

              
              // 再次检查页面内容 - 🔧 增加空值检查
              const pageContentAfterWait = await page.evaluate(() => {
                const bodyText = document.body?.textContent || '';
                return {
                  bodyLength: bodyText.length || 0,
                  hasJobKeywords: bodyText.includes('开发') || 
                                  bodyText.includes('工程师') ||
                                  bodyText.includes('Java') || false
                };
              });
              this.log('info', `[ZhilianCrawler] 等待后页面内容:`, pageContentAfterWait);

              // 如果仍然没有职位关键词，尝试滚动页面触发懒加载
              if (!pageContentAfterWait.hasJobKeywords) {
                this.log('info', `[ZhilianCrawler] 未检测到职位关键词，尝试滚动页面...`);
                await page.evaluate(async () => {
                  // 滚动页面触发懒加载
                  for (let i = 0; i < 8; i++) {
                    window.scrollBy(0, window.innerHeight);
                    await new Promise(resolve => setTimeout(resolve, 800));
                  }
                });
                
                // 滚动后等待DOM渲染
                await this.randomDelay(1000, 2000);
                
                // 最终检查 - 🔧 增加空值检查
                const finalCheck = await page.evaluate(() => {
                  const bodyText = document.body?.textContent || '';
                  return {
                    bodyLength: bodyText.length || 0,
                    hasJobKeywords: bodyText.includes('开发') || 
                                    bodyText.includes('工程师') || false
                  };
                });
                this.log('info', `[ZhilianCrawler] 滚动后最终检查:`, finalCheck);
              }

              // 🔧 优化3：显式等待职位容器出现，确保DOM完全渲染
              try {
                this.log('info', `[ZhilianCrawler] ⏳ 显式等待职位容器...`);
                await page.waitForSelector('.joblist-box__item, jobinfo', { 
                  timeout: 10000,  // 最多等待10秒
                  visible: true     // 要求元素可见
                });
                this.log('info', `[ZhilianCrawler] ✅ 职位容器已加载`);
              } catch (e) {
                this.log('warn', `[ZhilianCrawler] ⚠️ 职位容器未在10秒内出现，继续尝试解析`);

                // 🔧 关键修复：检测反爬拦截（body为空 = GeeTest/反爬系统拦截）
                // 与普通"加载慢"区分：bodyLength=0 意味着页面完全被替换为反爬壳
                if (pageContentAfterWait.bodyLength === 0) {
                  this.log('error', `[ZhilianCrawler] 🚨 检测到反爬拦截！页面body为空（bodyLength=0），触发浏览器重启重试...`);

                  if (io && taskId) {
                    io.to(`task:${taskId}`).emit('task:log', {
                      taskId,
                      level: 'error',
                      message: `🚨 检测到反爬拦截，正在保存断点并重启浏览器重试...`
                    });
                  }

                  // 保存断点（当前组合+页码），确保重启后从此处继续
                  try {
                    const resumeTask = await db.prepare('SELECT config FROM tasks WHERE id = $1').get(taskId!) as any;
                    if (resumeTask) {
                      const resumeConfig = typeof resumeTask.config === 'string' ? JSON.parse(resumeTask.config) : resumeTask.config;
                      resumeConfig._resumeState = { combinationIndex: currentCombination, currentPage: currentPage, jobIndex: 0 };
                      await db.prepare('UPDATE tasks SET config = $1 WHERE id = $2').run(JSON.stringify(resumeConfig), taskId!);
                      this.log('info', `[ZhilianCrawler] 💾 反爬拦截断点已保存: 组合${currentCombination}, 第${currentPage}页`);
                    }
                  } catch (saveErr: any) {
                    this.log('error', `[ZhilianCrawler] ❌ 保存反爬断点失败:`, saveErr.message);
                  }

                  // 抛出可恢复错误，触发 taskService 的浏览器重启+重试机制
                  const antiCrawlError = new Error('BROWSER_CRASH_RECOVERABLE: 检测到反爬拦截(body为空)');
                  (antiCrawlError as any).canRecover = true;
                  (antiCrawlError as any).combinationIndex = currentCombination;
                  (antiCrawlError as any).currentPage = currentPage;
                  (antiCrawlError as any).jobIndex = 0;
                  throw antiCrawlError;
                }

                if (io && taskId) {
                  io.to(`task:${taskId}`).emit('task:log', {
                    taskId,
                    level: 'warning',
                    message: `⚠️ 职位容器加载超时，可能影响解析数量`
                  });
                }
              }

              // 🔧 关键改进：多策略DOM解析职位数据
              this.log('info', '[ZhilianCrawler] 开始使用多策略DOM解析职位数据...');
              
              // @ts-ignore - 此代码在浏览器环境中运行
              const jobs = await page.evaluate(() => {
                const jobList: any[] = [];
                
                // 🔧 关键修复：在函数级别创建全局去重集合，所有策略共享
                const globalSeenTitles = new Set<string>();
                const globalSeenHrefs = new Set<string>();
                
                // 🔧 检查document.body是否存在
                if (!document.body) {
                  return [];
                }
                
                // ========== 策略1: 从 .jobinfo 容器中提取（智联招聘实际结构）==========
                const jobInfoElements = Array.from(document.querySelectorAll('div.jobinfo'));
                
                // 🔧 诊断日志：记录策略1的匹配情况
                const strategy1Stats = {
                  extractedJobs: 0,
                  failedExtractions: 0,
                  duplicateCount: 0,
                  // 🔧 新增：详细失败原因统计
                  failReasons: {
                    titleLengthInvalid: 0,      // 标题长度异常
                    invalidKeyword: 0,          // 包含无效关键词
                    titleDuplicate: 0,          // 标题重复
                    domExtractionError: 0       // DOM提取异常
                  }
                };
                
                if (jobInfoElements.length > 0) {
                  console.log('info', `[ZhilianCrawler] 策略1: 找到 ${jobInfoElements.length} 个 div.jobinfo 容器`);
                  jobInfoElements.forEach((jobInfo: any) => {
                    try {
                      // 🔧 关键修复：使用正确的选择器 .jobinfo__name (实际存在的类名)
                      const titleEl = jobInfo.querySelector('.jobinfo__name, .job-name, [class*="jobname"] a, a[href*="/job/"]');
                      const title = titleEl ? (titleEl.textContent || '').trim() : '';
                      
                      // 🔧 优化：放宽标题长度限制，从 < 4 改为 < 2，避免过滤短职位名称
                      if (!title || title.length < 2 || title.length > 150) {
                        console.log('info', `[ZhilianCrawler] ⚠️ 策略1跳过: [标题长度异常] 长度=${title?.length || 0}, 内容="${(title || '').substring(0, 30)}"`);
                        strategy1Stats.failReasons.titleLengthInvalid++;
strategy1Stats.failedExtractions++;
                        return;
                      }
                      if (title.includes('立即沟通') || title.includes('立即投递')) {
                        console.log('info', `[ZhilianCrawler] ⚠️ 策略1跳过: [包含无效关键词] "${title}"`);
                        strategy1Stats.failReasons.invalidKeyword++;
strategy1Stats.failedExtractions++;
                        return;
                      }
                      // 🔧 使用全局去重集合
                      if (globalSeenTitles.has(title)) {
                        console.log('info', `[ZhilianCrawler] ⚠️ 策略1跳过: [标题重复] "${title}"`);
                        strategy1Stats.duplicateCount++;
                        strategy1Stats.failReasons.titleDuplicate++;
strategy1Stats.failedExtractions++;
                        return;
                      }
                      globalSeenTitles.add(title);
                      
                      // ✅ 提取企业信息 - 修复:使用正确的选择器
                      let company = '未知企业';
                      
                      // 🔧 关键修复:企业名称不在 .jobinfo 容器内,而是在 .joblist-box__item 中
                      // 需要从 .jobinfo 向上找到父容器 .joblist-box__item
                      const joblistItem = jobInfo.closest('.joblist-box__item');
                      if (joblistItem) {
                        // 从 .joblist-box__item 中提取企业名称
                        const companyEl = joblistItem.querySelector('.companyinfo__name');
                        if (companyEl) {
                          // .companyinfo__name 本身就是 <a> 标签,直接提取文本
                          company = (companyEl.textContent || '').trim();
                        } else {
                          // 备用方案:尝试其他选择器
                          const fallbackEl = joblistItem.querySelector('[class*="company"] a, .company-name a');
                          if (fallbackEl) {
                            company = (fallbackEl.textContent || '').trim();
                          }
                        }
                      }
                      
                      // 🔧 企业名称清洗:去除多余空白字符、换行符和无关信息
                      company = company.replace(/[\n\r\t]+/g, ' ')  // 替换换行符为空格
                                      .replace(/\s+/g, ' ')          // 合并多个空格
                                      .trim();
                      
                      // 🔧 关键修复:过滤掉企业名称中混入的企业性质、规模等信息
                      // 移除企业性质关键词
                      company = company.replace(/\s*(民营|国企|外企|合资|股份制|上市公司|事业单位|未融资|A轮|B轮|C轮|D轮|已上市|不需要融资)\s*/g, '').trim();
                      // 移除公司规模信息
                      company = company.replace(/\s*(\d+-?\d*人|少于\d+人|\d+人以上)\s*/g, '').trim();
                      // 移除行业信息(常见行业关键词)
                      company = company.replace(/\s*(计算机硬件|计算机软件|互联网\/电子商务|IT服务|电子技术|通信\/电信\/网络设备|其他行业)\s*/g, '').trim();
                      // 移除HR信息和活跃状态
                      company = company.replace(/\s*[·•]\s*人事/g, '').replace(/\s*(刚刚活跃|今日活跃|3日内活跃|本周活跃)/g, '').trim();
                      // 移除APP推广文案
                      company = company.replace(/\s*(立即沟通|对职位感兴趣吗|下载智联APP|和我聊聊吧)/g, '').trim();
                      
                      // 验证企业名称合理性
                      if (!company || company.length < 2 || company.length > 100) {
                        company = '未知企业';
                      }
                      
                      const salaryEl = jobInfo.querySelector('.salary, [class*="salary"], .zp-salary');

                      const salary = salaryEl ? (salaryEl.textContent || '').trim() : '面议';
                      
                      const cityEl = jobInfo.querySelector('.city a, .work-city, [class*="city"]');
                      const cityText = cityEl ? (cityEl.textContent || '').trim() : '';
                      const cityMatch = cityText.match(/(北京|上海|广州|深圳|杭州|成都|武汉|南京|西安|重庆|天津|苏州|郑州|长沙|青岛|大连|厦门|宁波|哈尔滨)/);
                      const city = cityMatch ? cityMatch[1] : '';
                      
                      // 🔧 关键修复：链接在 .jobinfo__top 容器中，不在 .jobinfo 直接子元素
                      // 链接的 href 是 "http://www.zhaopin.com/jobdetail/..." 而不是 "/job/..."
                      const linkEl = jobInfo.querySelector('.jobinfo__top a, a[href*="zhaopin.com"]');
                      const link = linkEl ? (linkEl as HTMLAnchorElement).href : '';
                      
                      // ✅ 新增：从标签中提取企业性质、公司规模、行业范围
                      let companyNature = '';
                      let companyScale = '';
                      let businessScope = '';
                      
                      const tagElements = Array.from(jobInfo.querySelectorAll('.joblist-box__item-tag'));
                      if (tagElements.length > 0) {
                        const tags = tagElements.map((el: any) => (el.textContent || '').trim());
                        
                        const natureKeywords = ['民营', '国企', '外企', '合资', '股份制', '上市公司', '事业单位'];
                        const scalePattern = /\d+-?\d*人/;
                        
                        tags.forEach(tag => {
                          if (natureKeywords.some(kw => tag.includes(kw))) {
                            companyNature = tag;
                          } else if (scalePattern.test(tag)) {
                            companyScale = tag;
                          } else if (!tag.match(/[A-Z]/) && !tag.includes('/') && tag.length > 2) {
                            businessScope = tag;
                          }
                        });
                      }
                      
                      jobList.push({ 
                        title, 
                        company, 
                        salary, 
                        city, 
                        link,
                        companyNature,
                        companyScale,
                        businessScope
                      });
                      
                      strategy1Stats.extractedJobs++;
                    } catch (e) {
                      const errorMsg = e instanceof Error ? e.message : String(e);
                      console.log('info', `[ZhilianCrawler] ⚠️ 策略1跳过: [DOM提取异常] 错误="${errorMsg.substring(0, 100)}"`);
                      strategy1Stats.failReasons.domExtractionError++;
strategy1Stats.failedExtractions++;
                      // Ignore error
                    }
                  });
                  
                  // 🔧 关键修复：移除硬编码的15个职位限制，提取页面上所有有效职位
                  // 智联招聘每页显示20个职位，不应提前终止
                  console.log('info', `[ZhilianCrawler] 策略1提取完成，共找到 ${strategy1Stats.extractedJobs} 个职位 (失败${strategy1Stats.failedExtractions}次, 其中重复${strategy1Stats.duplicateCount || 0}次)`);
                } else {
                  console.log('info', `[ZhilianCrawler] ⚠️ 策略1: 未找到任何 div.jobinfo 容器`);
                }
                
                // ========== 策略2: 查找职位卡片容器（常见选择器）==========
                const cardSelectors = [
                  '.positionlist__list .joblist-box__item',  // ✅ 优先使用实际的选择器
                  '.job-list-box .job-card-wrapper',
                  '.joblist-box__item',
                  '[class*="job-item"]',
                  '[class*="position-item"]',
                  '.search-result-list > div',
                  'article[class*="job"]',
                  'section[class*="job"]'
                ];
                
                // 🔧 诊断日志：记录策略2的匹配情况
                const strategy2Stats = {
                  matchedSelector: '',
                  foundCards: 0,
                  extractedJobs: 0,
                  failedExtractions: 0
                };
                
                let foundCards = false;
                for (const selector of cardSelectors) {
                  try {
                    const cards = document.querySelectorAll(selector);
                    
                    if (cards.length > 0 && cards.length <= 50) {
                      foundCards = true;
                      strategy2Stats.matchedSelector = selector;
                      strategy2Stats.foundCards = cards.length;
                      
                      console.log('info', `[ZhilianCrawler] 策略2: 使用选择器 "${selector}" 找到 ${cards.length} 个卡片`);
                      
                      cards.forEach((card: any) => {
                        try {
                          // ✅ 优先使用智联招聘实际的CSS类名
                          const titleEl = card.querySelector('.jobinfo__name, .job-name, .job-title, [class*="jobname"] a, a[href*="/job/"]');
                          if (!titleEl) {
                            strategy2Stats.failedExtractions++;
                            return;
                          }
                          
                          const title = (titleEl.textContent || '').trim();
                          // 🔧 优化：放宽标题长度限制，从 < 4 改为 < 2，避免过滤短职位名称
                          if (!title || title.length < 2 || title.length > 150) {
                            strategy2Stats.failedExtractions++;
                            return;
                          }
                          if (title.includes('立即沟通') || title.includes('收藏')) {
                            strategy2Stats.failedExtractions++;
                            return;
                          }

                          // 🔧 使用全局去重集合
                          if (globalSeenTitles.has(title)) {
                            strategy2Stats.duplicateCount++;  // ✅ 修复：使用正确的统计对象，移除重复计数
                            strategy2Stats.failedExtractions++;
                            return;
                          }
                          globalSeenTitles.add(title);
                          
                          // ✅ 提取企业信息 - 优化选择器，精确提取企业名称
                          let company = '未知企业';
                          const companyEl = card.querySelector('.companyinfo__name, .company-name, .cname');
                          
                          if (companyEl) {
                            // 优先提取a标签中的企业名称（最常见的结构）
                            const companyLinkEl = companyEl.querySelector('a');
                            if (companyLinkEl) {
                              company = (companyLinkEl.textContent || '').trim();
                            } else {
                              // 如果没有a标签，提取文本但只取第一行（去除换行符后的多余内容）
                              const fullText = (companyEl.textContent || '').trim();
                              // 按换行符分割，只取第一部分（企业名称）
                              company = fullText.split(/[\n\r]+/)[0].trim();
                            }
                          } else {
                            // 备用方案：尝试从其他常见选择器提取
                            const fallbackEl = card.querySelector('[class*="company"] a, .job-company a');
                            if (fallbackEl) {
                              company = (fallbackEl.textContent || '').trim();
                            }
                          }
                          
                          // 🔧 企业名称清洗：去除多余空白字符和换行符
                          company = company.replace(/[\n\r\t]+/g, ' ').replace(/\s+/g, ' ').trim();
                          
                          // 验证企业名称合理性
                          if (!company || company.length < 2 || company.length > 100 || company.includes('立即沟通')) {
                            company = '未知企业';
                          }
                          
                          // ✅ 提取薪资 - 使用正确的选择器
                          const salaryEl = card.querySelector('.jobinfo__salary, .salary, .sal, [class*="salary"]');
                          const salary = salaryEl ? (salaryEl.textContent || '').trim() : '面议';
                          
                          // ✅ 提取城市 - 从 jobinfo__other-info-item 中提取（智联招聘实际结构）
                          let city = '';
                          const cityInfoEls = card.querySelectorAll('.jobinfo__other-info-item span');
                          if (cityInfoEls.length > 0) {
                            const cityText = (cityInfoEls[0].textContent || '').trim();
                            const cityMatch = cityText.match(/(北京|上海|广州|深圳|杭州|成都|武汉|南京|西安|重庆|天津|苏州|郑州|长沙|青岛|大连|厦门|宁波|哈尔滨)/);
                            if (cityMatch) {
                              city = cityMatch[1];
                            }
                          }
                          
                          // 如果上面的方法失败，尝试备用选择器
                          if (!city) {
                            const cityEl = card.querySelector('.job-area, .address, [class*="city"], [class*="area"]');
                            const cityText = cityEl ? (cityEl.textContent || '').trim() : '';
                            const cityMatch = cityText.match(/(北京|上海|广州|深圳|杭州|成都|武汉|南京|西安|重庆|天津|苏州|郑州|长沙|青岛|大连|厦门|宁波|哈尔滨)/);
                            if (cityMatch) {
                              city = cityMatch[1];
                            }
                          }
                          
                          // 提取链接 - 优先使用 jobinfo__name（智联招聘实际结构）
                          const linkEl = card.querySelector('.jobinfo__name');
                          let link = '';
                          if (linkEl && linkEl instanceof HTMLAnchorElement) {
                            link = linkEl.href || '';
                          }
                          
                          // 如果 jobinfo__name 没有链接，尝试备用选择器
                          if (!link) {
                            const fallbackLinkEl = card.querySelector('a[href*="/jobdetail/"], a[href*="/job/"]');
                            if (fallbackLinkEl) {
                              link = (fallbackLinkEl as HTMLAnchorElement).href || '';
                            }
                          }
                          
                          // ✅ 新增：从标签中提取企业性质、公司规模、行业范围
                          let companyNature = '';
                          let companyScale = '';
                          let businessScope = '';
                          
                          const tagElements = Array.from(card.querySelectorAll('.joblist-box__item-tag'));
                          if (tagElements.length > 0) {
                            const tags = tagElements.map((el: any) => (el.textContent || '').trim());
                            
                            // 定义关键词匹配规则
                            const natureKeywords = ['民营', '国企', '外企', '合资', '股份制', '上市公司', '事业单位'];
                            const scalePattern = /\d+-?\d*人/;  // 匹配 "100-299人"、"10000人以上" 等
                            
                            // 遍历所有标签，识别不同类型
                            tags.forEach(tag => {
                              // 检查是否为企业性质
                              if (natureKeywords.some(kw => tag.includes(kw))) {
                                companyNature = tag;
                              }
                              // 检查是否为公司规模
                              else if (scalePattern.test(tag)) {
                                companyScale = tag;
                              }
                              // 其他标签可能是行业范围（取最后一个非技能标签）
                              else if (!tag.match(/[A-Z]/) && !tag.includes('/') && tag.length > 2) {
                                // 排除明显的技能标签（包含英文或斜杠）
                                businessScope = tag;
                              }
                            });
                          }
                          
                          jobList.push({ 
                            title, 
                            company, 
                            salary, 
                            city, 
                            link,
                            companyNature,    // ✅ 新增：企业性质
                            companyScale,     // ✅ 新增：公司规模
                            businessScope     // ✅ 新增：行业范围
                          });
                          
                          strategy2Stats.extractedJobs++;  // 🔧 统计成功提取的职位数
                        } catch (e) {
                          const errorMsg = e instanceof Error ? e.message : String(e);
                          console.log('info', `[ZhilianCrawler] ⚠️ 策略2跳过: [DOM提取异常] 错误="${errorMsg.substring(0, 100)}"`);
                          strategy2Stats.failedExtractions++;  // 🔧 统计失败的提取
                          // 忽略单个卡片错误
                        }
                      });
                      
                      // 🔧 关键修复：移除硬编码的15个职位限制
                      console.log('info', `[ZhilianCrawler] 策略2提取完成，共找到 ${strategy2Stats.extractedJobs} 个职位 (失败${strategy2Stats.failedExtractions}次)`);
                      break;  // 🔧 策略2成功后跳出选择器循环
                    }
                  } catch (e) {
                    // Ignore error
                  }
                }
                
                if (!foundCards) {  // 🔧 如果所有选择器都未匹配到容器
                  console.log('info', `[ZhilianCrawler] ⚠️ 策略2: 未找到任何匹配的职位卡片容器`);
                }
                
                // 🔧 关键修复：移除硬编码的15个职位限制，继续尝试策略3以补充更多职位
                console.log('info', `[ZhilianCrawler] 当前已提取 ${jobList.length} 个职位，继续尝试其他策略...`);
                
                // ========== 策略3: 基于职位链接提取（最可靠）==========
                const jobLinks = Array.from(document.querySelectorAll('a[href*="/jobdetail/"], a[href*="/job/"]'));
                
                // 🔧 诊断日志：记录策略3的匹配情况
                const strategy3Stats = {
                  foundLinks: jobLinks.length,
                  extractedJobs: 0,
                  duplicateCount: 0,
                  failedExtractions: 0
                };
                
                // 🔧 移除局部seenHrefs和seenTitles，使用全局去重集合
                let duplicateCount = 0;
                
                jobLinks.forEach((link: any) => {
                  try {
                    const href = link.href || '';
                    if (!href) {
                      strategy3Stats.failedExtractions++;
                      return;
                    }
                    // 🔧 使用全局去重集合检查href
                    if (globalSeenHrefs.has(href)) {
                      strategy3Stats.duplicateCount++;
                      return;
                    }
                    
                    const title = (link.textContent || '').trim();
                    
                    // 🔧 优化：放宽标题长度限制，从 < 4 改为 < 2，避免过滤短职位名称
                    if (!title || title.length < 2 || title.length > 150) {
                      strategy3Stats.failedExtractions++;
                      return;
                    }
                    if (title.includes('立即沟通') || title.includes('立即投递') || 
                        title.includes('收藏') || title.includes('分享')) return;
                    
                    // 🔧 使用全局去重集合检查重复
                    if (globalSeenTitles.has(title)) {
                      console.log('info', `[ZhilianCrawler] ⚠️ 策略3跳过: [标题重复] "${title}"`);
                      strategy3Stats.duplicateCount++;  // ✅ 修复：移除重复计数，只累加一次
                      duplicateCount++;
                      return;
                    }
                    
                    globalSeenHrefs.add(href);
                    globalSeenTitles.add(title);
                    
                    // 向上查找父容器以获取更多信息
                    let container = link.parentElement;
                    let salary = '面议';
                    let company = '';
                    let city = '';
                    let depth = 0;
                    
                    while (container && depth < 5) {
                      const containerText = container.textContent || '';
                      
                      if (!salary || salary === '面议') {
                        const salaryMatch = containerText.match(/(\d+(?:\.\d+)?[-~]\d+(?:\.\d+)?[Kk万])|(\d+(?:\.\d+)?[Kk万](?:以上)?)/);
                        if (salaryMatch) {
                          salary = salaryMatch[0];
                        }
                      }
                      
                      if (!company) {
                        const companyMatch = containerText.match(/([\u4e00-\u9fa5]{2,30}(?:公司|科技|信息|网络|软件|技术|开发|设计|有限))/);
                        if (companyMatch) {
                          company = companyMatch[1];
                        }
                      }
                      
                      if (!city) {
                        const cityMatch = containerText.match(/(北京|上海|广州|深圳|杭州|成都|武汉|南京|西安|重庆|天津|苏州|郑州|长沙|青岛|大连|厦门|宁波|哈尔滨)/);
                        if (cityMatch) {
                          city = cityMatch[1];
                        }
                      }
                      
                      if (salary !== '面议' && company && city) {
                        break;
                      }
                      
                      container = container.parentElement;
                      depth++;
                    }
                    
                    // ✅ 新增：尝试从父容器中查找标签元素
                    let companyNature = '';
                    let companyScale = '';
                    let businessScope = '';
                    
                    const parentContainer = link.closest('.joblist-box__item, .position-item, [class*="job"]');
                    if (parentContainer) {
                      const tagElements = Array.from(parentContainer.querySelectorAll('.joblist-box__item-tag'));
                      if (tagElements.length > 0) {
                        const tags = tagElements.map((el: any) => (el.textContent || '').trim());
                        
                        const natureKeywords = ['民营', '国企', '外企', '合资', '股份制', '上市公司', '事业单位'];
                        const scalePattern = /\d+-?\d*人/;
                        
                        tags.forEach(tag => {
                          if (natureKeywords.some(kw => tag.includes(kw))) {
                            companyNature = tag;
                          } else if (scalePattern.test(tag)) {
                            companyScale = tag;
                          } else if (!tag.match(/[A-Z]/) && !tag.includes('/') && tag.length > 2) {
                            businessScope = tag;
                          }
                        });
                      }
                    }
                    
                    jobList.push({
                      title: title.trim(),
                      company: company.trim() || '未知企业',
                      salary: salary.trim(),
                      city: city.trim(),
                      link: href,
                      companyNature,
                      companyScale,
                      businessScope
                    });
                    
                    strategy3Stats.extractedJobs++;  // 🔧 统计成功提取
                    
                  } catch (e) {
                    strategy3Stats.failedExtractions++;  // 🔧 统计失败
                    // Ignore error
                  }
                });
                
                console.log('info', `[ZhilianCrawler] 策略3提取完成，共找到 ${strategy3Stats.extractedJobs} 个职位 (链接总数${strategy3Stats.foundLinks}, 重复${strategy3Stats.duplicateCount}, 失败${strategy3Stats.failedExtractions})`);
                
                // 🔧 返回职位列表和统计信息
              return {
                jobs: jobList,
                stats: {
                  strategy1: strategy1Stats || { foundContainers: 0, extractedJobs: 0, failedExtractions: 0 },
                  strategy2: strategy2Stats || { extractedJobs: 0, failedExtractions: 0 },
                  strategy3: strategy3Stats || { foundLinks: 0, extractedJobs: 0, duplicateCount: 0, failedExtractions: 0 }
                }
              };
              });

              // 🔧 解构返回结果（result是包含jobs和stats的对象）
              const resultData = jobs;  // jobs是从page.evaluate返回的对象
              const jobList = resultData.jobs || [];
              const stats = resultData.stats || {};
              
              this.log('info', `[ZhilianCrawler] 📊 多策略解析汇总:`);
              this.log('info', `[ZhilianCrawler]    策略1 (div.jobinfo): 提取 ${stats.strategy1?.extractedJobs || 0} 个职位 (失败${stats.strategy1?.failedExtractions || 0}次, 其中重复${stats.strategy1?.duplicateCount || 0}次)`);
              this.log('info', `[ZhilianCrawler]    策略2 (卡片容器): 提取 ${stats.strategy2?.extractedJobs || 0} 个职位 (失败${stats.strategy2?.failedExtractions || 0}次, 其中重复${stats.strategy2?.duplicateCount || 0}次)`);
              this.log('info', `[ZhilianCrawler]    策略3 (职位链接): 提取 ${stats.strategy3?.extractedJobs || 0} 个职位 (重复${stats.strategy3?.duplicateCount || 0}, 失败${stats.strategy3?.failedExtractions || 0})`);
              this.log('info', `[ZhilianCrawler]    最终结果: ${jobList.length} 个职位（已去重）`);
              this.log('info', `[ZhilianCrawler] 使用 Puppeteer 找到 ${jobList.length} 个职位`);
              
              // 🔧 关键优化：当解析数量异常时，自动保存HTML快照用于离线分析
              if (jobList.length < 18 && io && taskId) {
                this.log('warn', `[ZhilianCrawler] ⚠️ 警告：本页仅解析到 ${jobList.length} 个职位，预期20个，保存HTML快照...`);
                
                try {
                  const html = await page.content();
                  const debugDir = path.join(__dirname, '../../../../debug');
                  
                  // 确保目录存在
                  if (!fs.existsSync(debugDir)) {
                    fs.mkdirSync(debugDir, { recursive: true });
                  }
                  
                  // 保存HTML快照
                  const timestamp = Date.now();
                  const snapshotFile = path.join(debugDir, `zhilian_failed_task${taskId.substring(0, 8)}_page${currentPage}_${timestamp}.html`);
                  fs.writeFileSync(snapshotFile, html, 'utf-8');
                  
                  this.log('info', `[ZhilianCrawler] 📸 HTML快照已保存: ${snapshotFile}`);
                  this.log('info', `[ZhilianCrawler]    文件大小: ${(html.length / 1024).toFixed(2)} KB`);
                  
                  // 通过WebSocket通知前端
                  io.to(`task:${taskId}`).emit('task:log', {
                    taskId,
                    level: 'warning',
                    message: `⚠️ 第${currentPage}页仅解析到${jobList.length}个职位(预期20个)，HTML快照已保存至debug目录`
                  });
                } catch (saveError) {
                  this.log('error', `[ZhilianCrawler] 保存HTML快照失败:`, saveError.message);
                }
              } else if (jobList.length >= 18 && jobList.length < 20) {
                this.log('info', `[ZhilianCrawler] ℹ️  提示：本页解析到 ${jobList.length}/20 个职位，略低于预期`);
              } else {
                this.log('info', `[ZhilianCrawler] ✅ 本页解析正常：${jobList.length}/20 个职位`);
              }
              
              // 🔧 关键修复：给每个job对象添加当前的keyword，以便后续填充到jobCategory
              jobList.forEach(job => {
                job.keyword = cleanKeyword;  // 添加当前搜索的关键词
              });
              
              this.log('info', `[ZhilianCrawler] ✅ 已为 ${jobList.length} 个职位添加keyword字段: "${cleanKeyword}"`);

              // 🔧 优化：使用高效的企业过滤算法
              let filteredJobs = jobList;
              let matchedCompanyCount = 0;
              
              if (companies.length > 0 && companyMatchSet && companyMatchMap) {
                const beforeFilter = Date.now();
                
                // 使用Set进行O(1)查找，大幅提升性能
                filteredJobs = jobList.filter(job => {
                  const companyName = job.company.toLowerCase();
                  
                  // 策略1：直接匹配
                  if (companyMatchSet.has(companyName)) {
                    matchedCompanyCount++;
                    return true;
                  }
                  
                  // 策略2：包含匹配（目标企业名是否包含在公司名中）
                  for (const [key, originalName] of companyMatchMap) {
                    if (companyName.includes(key) || key.includes(companyName)) {
                      matchedCompanyCount++;
                      return true;
                    }
                  }
                  
                  return false;
                });
                
                const filterDuration = Date.now() - beforeFilter;
                this.log('info', `[ZhilianCrawler] 🏢 企业过滤完成: ${jobList.length} → ${filteredJobs.length} (耗时${filterDuration}ms, 匹配${matchedCompanyCount}次)`);
                
                // 🔧 智能提前终止：更新连续无匹配计数器
                if (companies.length > 0) {
                  if (filteredJobs.length === 0) {
                    consecutiveEmptyPages++;
                    this.log('warn', `[ZhilianCrawler] ⚠️ 连续 ${consecutiveEmptyPages}/${MAX_CONSECUTIVE_EMPTY_PAGES} 页未匹配到目标企业`);
                    
                    if (consecutiveEmptyPages >= MAX_CONSECUTIVE_EMPTY_PAGES) {
                      this.log('info', `[ZhilianCrawler] 🛑 连续${MAX_CONSECUTIVE_EMPTY_PAGES}页未匹配到目标企业，提前终止爬取`);
                      if (io && taskId) {
                        io.to(`task:${taskId}`).emit('task:log', {
                          taskId,
                          level: 'warning',
                          message: `🛑 连续${MAX_CONSECUTIVE_EMPTY_PAGES}页未匹配到目标企业，已自动停止爬取（节省资源）`
                        });
                      }
                      hasNextPage = false;
                      break;
                    }
                  } else {
                    // 有匹配则重置计数器
                    consecutiveEmptyPages = 0;
                    this.log('info', `[ZhilianCrawler] ✅ 当前页匹配到 ${filteredJobs.length} 条目标企业职位`);
                  }
                }
              }

              this.log('info', `[ZhilianCrawler] 过滤后剩余 ${filteredJobs.length} 个职位`);

              // 发送详细日志到前端
              if (io && taskId) {
                io.to(`task:${taskId}`).emit('task:log', {
                  taskId,
                  level: 'info',
                  message: `📊 第 ${currentPage} 页解析完成 | 找到 ${jobList.length} 条职位 | 过滤后 ${filteredJobs.length} 条`
                });
              }

              // 如果没有找到职位
              if (jobList.length === 0) {
                this.log('warn', `[ZhilianCrawler] ⚠️ 第${currentPage}页未找到职位，可能原因：`);
                this.log('warn', `[ZhilianCrawler]    1. 网站结构已变化`);
                this.log('warn', `[ZhilianCrawler]    2. 被反爬虫机制拦截`);
                this.log('warn', `[ZhilianCrawler]    3. 该关键词/城市组合确实没有职位`);
                
                if (io && taskId) {
                  io.to(`task:${taskId}`).emit('task:log', {
                    taskId,
                    level: 'warning',
                    message: `⚠️ 第${currentPage}页未解析到职位数据，尝试继续爬取下一页`
                  });
                }
                
                // ✅ 优化：不再直接break，而是尝试继续爬取下一页
                // 连续3页为空才真正停止
                if (currentPage >= 3) {
                  this.log('info', `[ZhilianCrawler] 已连续${currentPage}页未找到数据，停止爬取`);
                  if (io && taskId) {
                    io.to(`task:${taskId}`).emit('task:log', {
                      taskId,
                      level: 'warning',
                      message: `已连续${currentPage}页无数据，停止爬取`
                    });
                  }
                  hasNextPage = false; // 标记为无下一页，让finally块处理退出
                } else {
                  // 否则继续尝试下一页
                  this.log('info', `[ZhilianCrawler] 尝试继续爬取第${currentPage + 1}页...`);
                }
              } else {
                // ✅ 使用并发控制加速详情页抓取（支持WAF检测自动降级）
                const concurrency = config.concurrency != null ? config.concurrency : 2;
                let wafDetected = false;  // 🔧 跟踪WAF拦截状态
                // 🔧 断点续传：确定当前页的起始职位索引（仅恢复组合的恢复页面生效，其他为0）
                let pageStartJobIndex = (resumeState && currentCombination === startCombinationIndex && currentPage === startPage)
                  ? globalStartJobIndex : 0;
                // 🔧 安全钳：重新解析的职位数可能少于原始列表，防止索引越界导致职位丢失
                if (pageStartJobIndex >= filteredJobs.length) {
                  this.log('warn', `[ZhilianCrawler] ⚠️ 断点续传位置(${pageStartJobIndex + 1})超出重新解析的职位数(${filteredJobs.length})，页面列表可能已更新`);
                  this.log('info', `[ZhilianCrawler] 📋 重置为0，依赖去重机制跳过已采集的职位`);
                  pageStartJobIndex = 0;
                }
                this.log('info', `[ZhilianCrawler] 🚀启用${concurrency <= 1 ? '串行' : '并发'}模式: 并发数=${concurrency}, 总职位数=${filteredJobs.length}, 起始职位索引=${pageStartJobIndex}`);

                if (concurrency <= 1) {
                  // 🔧 串行模式：逐个处理，最安全但速度最慢（适合已被WAF标记的IP）
                  this.log('info', `[ZhilianCrawler] ⚡ 使用串行模式处理（最安全，避免WAF拦截）`);

                  for (let i = pageStartJobIndex; i < filteredJobs.length && !this.checkAborted(); i++) {
                    const job = filteredJobs[i];
                    currentJobIndex = i;  // 🔧 断点续传：记录当前处理的职位索引
                    this.log('info', `[ZhilianCrawler] [${i + 1}/${filteredJobs.length}] 🔄 串行抓取: ${job.title}`);

                    let jobData;
                    if (job.link) {
                      try {
                        jobData = await this.fetchJobDetail(browser, job.link, job);
                        this.log('info', `[ZhilianCrawler] [${i + 1}/${filteredJobs.length}] ✅ 成功: ${jobData.companyName}`);
                      } catch (error: any) {
                        this.log('error', `[ZhilianCrawler] [${i + 1}/${filteredJobs.length}] ❌ 失败: ${error.message}`);
                        if (error.message?.includes('WAF_DETECTED')) {
                          wafDetected = true;
                          this.log('warn', `[ZhilianCrawler] 🛡️ WAF拦截已确认，后续延迟加倍`);
                        }
                        // 🔧 浏览器崩溃类错误 → 重新抛出，让外层 catch 触发浏览器重启恢复
                        const isBrowserCrash = error.message.includes('Connection closed') ||
                                               error.message.includes('Session closed') ||
                                               error.message.includes('Target closed') ||
                                               error.message.includes('Protocol error') ||
                                               error.message.includes('浏览器连接已断开') ||
                                               error.message.includes('浏览器实例已断开连接');
                        if (isBrowserCrash) {
                          throw error;  // 不保存降级数据，直接触发浏览器重启后重试本job
                        }
                        jobData = this.generateBasicJob(job, config);
                      }
                    } else {
                      this.log('warn', `[ZhilianCrawler] [${i + 1}/${filteredJobs.length}] ⚠️ 无链接`);
                      jobData = this.generateBasicJob(job, config);
                    }

                    yield jobData;

                    // 🔧 串行延迟：WAF命中后增加到4-8秒，否则2-4秒
                    if (i < filteredJobs.length - 1) {
                      const delay = wafDetected
                        ? 4000 + Math.random() * 4000   // 4-8秒（WAF模式）
                        : 2000 + Math.random() * 2000;  // 2-4秒（正常模式）
                      this.log('info', `[ZhilianCrawler] ⏳ 等待 ${(delay/1000).toFixed(1)} 秒后处理下一个...`);
                      await this.abortableSleep(delay);
                    }
                  }
                } else {
                  // ✅ 并发模式：批次内并行处理，但加强资源管理
                  const maxConcurrency = 5;
                  const actualConcurrency = Math.min(concurrency, maxConcurrency);
                  const batchSize = actualConcurrency;
                  
                  this.log('info', `[ZhilianCrawler] 🚀启用并发模式: 并发数=${actualConcurrency} (配置值=${concurrency}, 上限=${maxConcurrency}), 总职位数=${filteredJobs.length}`);
                  
                  for (let batchStart = pageStartJobIndex; batchStart < filteredJobs.length && !this.checkAborted(); batchStart += batchSize) {
                    const batchEnd = Math.min(batchStart + batchSize, filteredJobs.length);
                    const batch = filteredJobs.slice(batchStart, batchEnd);
                    
                    this.log('info', `[ZhilianCrawler] 🔄 处理批次 ${Math.floor(batchStart / batchSize) + 1}: 职位 ${batchStart + 1}-${batchEnd}/${filteredJobs.length}`);
                    
                    // 🔧 关键修复：在处理批次前检查浏览器连接状态和标签页数量
                    try {
                      if (!browser.isConnected()) {
                        throw new Error('浏览器连接已断开，无法继续抓取');
                      }
                      
                      const pages = await browser.pages();
                      this.log('info', `[ZhilianCrawler] 🔍 浏览器健康检查: 连接正常，当前标签页数: ${pages.length}`);
                      
                      // 🔧 如果标签页过多，在批次开始前清理（更激进的清理策略）
                      if (pages.length > 3) {
                        this.log('warn', `[ZhilianCrawler] ⚠️ 标签页数量较多(${pages.length})，批次开始前清理...`);
                        // 只保留搜索列表页，关闭所有详情页和空白页
                        for (let i = pages.length - 1; i >= 0; i--) {  // 从后往前遍历，避免索引问题
                          try {
                            const url = pages[i].url();
                            // 保留搜索列表页（zhaopin.com/sou），不包含 jobdetail
                            if (url.includes('zhaopin.com/sou') && !url.includes('jobdetail')) {
                              this.log('info', `[ZhilianCrawler] 📋 保留搜索页: ${url.substring(0, 60)}`);
                              continue;
                            }
                            // 关闭详情页和空白页
                            if (!pages[i].isClosed()) {
                              await pages[i].close();
                              this.log('info', `[ZhilianCrawler] 🗑️ 已关闭标签页 #${i + 1}`);
                            }
                          } catch (e: any) {
                            this.log('warn', `[ZhilianCrawler] 关闭标签页失败: ${e.message}`);
                          }
                        }
                      }
                    } catch (browserError: any) {
                      this.log('error', `[ZhilianCrawler] ❌ 浏览器连接失败: ${browserError.message}`);
                      this.log('error', `[ZhilianCrawler] 💡 建议：降低并发数或检查Chrome进程是否正常`);
                      // 直接跳出循环，不再继续
                      break;
                    }
                    
                    // ✅ 关键优化：批次内并行处理，但增强错误隔离和资源管理
                    this.log('info', `[ZhilianCrawler] ⚡ 使用并行模式处理当前批次（并发数=${batch.length}）`);
                    
                    // 🔧 使用Promise.allSettled替代Promise.all，确保单个失败不影响其他任务
                    const batchPromises = batch.map(async (job, indexInBatch) => {
                      const globalIndex = batchStart + indexInBatch + 1;
                      currentJobIndex = batchStart + indexInBatch;  // 🔧 断点续传：记录当前处理的职位索引
                      let userPage: any = null;  // 🔧 追踪创建的页面，确保始终被关闭

                      if (this.checkAborted()) {
                        return { success: false, data: null, index: globalIndex };
                      }

                      // 🔧 每次创建标签页前都检查浏览器状态
                      try {
                        if (!browser.isConnected()) {
                          this.log('error', `[ZhilianCrawler] [${globalIndex}/${filteredJobs.length}] ❌ 浏览器连接已断开`);
                          return { success: false, data: this.generateBasicJob(job, config), index: globalIndex, error: 'BROWSER_DISCONNECTED' };
                        }
                        
                        // 🔧 额外检查：如果标签页太多，等待一下
                        const currentPages = await browser.pages();
                        if (currentPages.length > 8) {
                          this.log('warn', `[ZhilianCrawler] [${globalIndex}/${filteredJobs.length}] ⚠️ 标签页过多(${currentPages.length})，等待2秒...`);
                          await this.randomDelay(2000, 2000);
                        }
                      } catch (e: any) {
                        this.log('error', `[ZhilianCrawler] [${globalIndex}/${filteredJobs.length}] ❌ 浏览器状态检查失败: ${e.message}`);
                        return { success: false, data: this.generateBasicJob(job, config), index: globalIndex, error: 'BROWSER_DISCONNECTED' };
                      }
                      
                      this.log('info', `[ZhilianCrawler] [${globalIndex}/${filteredJobs.length}] 🚀 并发抓取: ${job.title}`);
                      
                      let jobData;
                      if (job.link) {
                        try {
                          // 🔧 关键修复：实现串行化标签页创建，但保持抓取并行
                          // 使用一个简单的锁机制来串行化标签页创建
                          const createPageWithLock = async () => {
                            // 🔧 关键修复：使用互斥锁串行化 browser.newPage() 调用
                            // Promise.race 超时不会取消落后的 newPage() promise，
                            // 导致孤儿 about:blank 标签页泄漏，最终耗尽内存导致 Chrome 崩溃。
                            // 修复方案：
                            // 1. 互斥锁确保同一时刻只有一个 newPage() 在执行
                            // 2. 超时后捕获泄漏的页面并立即关闭
                            const currentMutex = this.pageCreateMutex;
                            let releaseMutex: () => void;
                            this.pageCreateMutex = new Promise<void>(resolve => { releaseMutex = resolve; });
                            await currentMutex;

                            let attempts = 0;
                            const maxAttempts = 3;

                            while (attempts < maxAttempts) {
                              try {
                                if (!browser.isConnected()) {
                                  releaseMutex!();
                                  throw new Error('BROWSER_DISCONNECTED');
                                }

                                this.log('info', `[ZhilianCrawler] [${globalIndex}/${filteredJobs.length}] 🆕 创建新标签页 (尝试 ${attempts + 1}/${maxAttempts})`);

                                const newPagePromise = browser.newPage();
                                const createPageTimeout = new Promise<any>((_, reject) => {
                                  setTimeout(() => reject(new Error('创建标签页超时（10秒）')), 10000);
                                });

                                const page = await Promise.race([
                                  newPagePromise,
                                  createPageTimeout
                                ]).catch(async (raceError) => {
                                  // 🔧 超时或错误时：newPagePromise 可能仍在后台运行，
                                  // 必须捕获泄漏的页面并关闭，防止孤儿标签页堆积
                                  newPagePromise.then((leakedPage: any) => {
                                    if (leakedPage && !leakedPage.isClosed()) {
                                      this.log('warn', `[ZhilianCrawler] [${globalIndex}/${filteredJobs.length}] 🧹 关闭超时泄漏的孤儿标签页`);
                                      leakedPage.close().catch(() => {});
                                    }
                                  }).catch(() => {});
                                  throw raceError;
                                });

                                const vw = 1366 + Math.floor(Math.random() * 554);
                                const vh = 768 + Math.floor(Math.random() * 312);
                                await page.setViewport({ width: vw, height: vh });
                                const uas = [
                                  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                                  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
                                  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
                                  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
                                ];
                                await page.setUserAgent(uas[Math.floor(Math.random() * uas.length)]);

                                this.log('info', `[ZhilianCrawler] [${globalIndex}/${filteredJobs.length}] ✅ 标签页创建成功`);
                                releaseMutex!();
                                return page;
                              } catch (createError: any) {
                                attempts++;

                                if (createError.message.includes('Target closed') ||
                                    createError.message.includes('Protocol error') ||
                                    createError.message.includes('Session closed')) {
                                  this.log('error', `[ZhilianCrawler] [${globalIndex}/${filteredJobs.length}] 💥 浏览器已崩溃，无法创建标签页`);
                                  releaseMutex!();
                                  throw new Error('BROWSER_CRASHED');
                                }

                                if (attempts >= maxAttempts) {
                                  this.log('error', `[ZhilianCrawler] [${globalIndex}/${filteredJobs.length}] ❌ 创建标签页失败，已重试 ${maxAttempts} 次`);
                                  releaseMutex!();
                                  throw createError;
                                }

                                this.log('warn', `[ZhilianCrawler] [${globalIndex}/${filteredJobs.length}] ⚠️ 创建标签页失败，${1000 * attempts}ms后重试...`);
                                await this.randomDelay(1000 * attempts, 1000 * attempts + 500);
                              }
                            }
                            releaseMutex!();
                          };
                          
                          userPage = await createPageWithLock();

                          // 现在使用创建好的页面进行详情抓取
                          jobData = await this.fetchJobDetailWithPage(userPage, job.link, job);

                          this.log('info', `[ZhilianCrawler] [${globalIndex}/${filteredJobs.length}] ✅ 成功 - ${jobData.companyName}`);
                          return { success: true, data: jobData, index: globalIndex };
                        } catch (error: any) {
                          this.log('error', `[ZhilianCrawler] [${globalIndex}/${filteredJobs.length}] ❌ 失败: ${error.message}`);

                          // 🔧 如果是浏览器断开错误，立即返回并标记
                          if (error.message.includes('Session closed') ||
                              error.message.includes('浏览器连接已断开') ||
                              error.message === 'BROWSER_CRASHED') {
                            this.log('error', `[ZhilianCrawler] [${globalIndex}/${filteredJobs.length}] 💥 浏览器会话已关闭，停止当前批次`);
                            return { success: false, data: this.generateBasicJob(job, config), index: globalIndex, error: 'BROWSER_CRASHED' };
                          }

                          // 🔧 详情页失败时使用降级数据，但不影响其他并发任务
                          jobData = this.generateBasicJob(job, config);
                          return { success: false, data: jobData, index: globalIndex, error: error.message };
                        } finally {
                          // 🔧 关键修复：始终关闭页面，防止标签页泄漏
                          if (userPage && !userPage.isClosed()) {
                            try {
                              await userPage.close();
                            } catch (e) {
                              // 忽略关闭错误
                            }
                          }
                        }
                      } else {
                        this.log('warn', `[ZhilianCrawler] [${globalIndex}/${filteredJobs.length}] ⚠️ 无链接`);
                        jobData = this.generateBasicJob(job, config);
                        return { success: true, data: jobData, index: globalIndex };
                      }
                    });
                    
                    // ✅ 等待当前批次所有任务并行完成（使用allSettled确保单个失败不中断）
                    const batchResults = await Promise.allSettled(batchPromises);
                    
                    // 🔧 按顺序提取结果并yield
                    const successCount = batchResults.filter(r => r.status === 'fulfilled' && r.value.success).length;
                    const failCount = batchResults.filter(r => r.status === 'fulfilled' && !r.value.success).length;
                    const browserDisconnected = batchResults.some(r =>
                      r.status === 'fulfilled' && (
                        r.value.error === 'BROWSER_DISCONNECTED' ||
                        r.value.error === 'BROWSER_CRASHED'
                      )
                    );

                    this.log('info', `[ZhilianCrawler] 📊 批次完成: 成功${successCount}条, 失败${failCount}条`);

                    // 🔧 如果批次中所有任务都失败了，且浏览器已断开，立即中断
                    const allFailed = successCount === 0 && failCount === batch.length;
                    if (allFailed && !browser.isConnected()) {
                      this.log('error', `[ZhilianCrawler] 💥 批次全失败且浏览器已断开，立即停止`);
                      break;
                    }

                    // 🔧 检测WAF拦截：任意详情页被WAF拦截，立即停止并发
                    const wafInBatch = batchResults.some(r =>
                      r.status === 'fulfilled' && r.value.error?.includes('WAF_DETECTED')
                    );
                    if (wafInBatch) {
                      wafDetected = true;
                      this.log('warn', `[ZhilianCrawler] 🛡️ 检测到智联WAF安全验证！自动降级为串行模式处理剩余职位`);
                      if (io && taskId) {
                        io.to(`task:${taskId}`).emit('task:log', {
                          taskId,
                          level: 'warning',
                          message: '🛡️ 检测到WAF安全验证，已自动切换为串行模式（速度降低但更安全）'
                        });
                      }
                      for (const result of batchResults) {
                        if (result.status === 'fulfilled' && result.value.data) {
                          yield result.value.data;
                        }
                      }
                      // 🔧 剩余职位用串行+长延迟处理
                      for (let i = batchEnd; i < filteredJobs.length && !this.checkAborted(); i++) {
                        const job = filteredJobs[i];
                        this.log('info', `[ZhilianCrawler] [${i + 1}/${filteredJobs.length}] 🔄 WAF串行: ${job.title}`);
                        const wafDelay = 5000 + Math.random() * 5000;
                        this.log('info', `[ZhilianCrawler] ⏳ WAF模式等待 ${(wafDelay/1000).toFixed(1)} 秒...`);
                        await this.abortableSleep(wafDelay);
                        let jobData;
                        if (job.link) {
                          try {
                            jobData = await this.fetchJobDetail(browser, job.link, job);
                            this.log('info', `[ZhilianCrawler] [${i + 1}/${filteredJobs.length}] ✅ 成功: ${jobData.companyName}`);
                          } catch (error: any) {
                            this.log('error', `[ZhilianCrawler] [${i + 1}/${filteredJobs.length}] ❌ 失败: ${error.message}`);
                            jobData = this.generateBasicJob(job, config);
                          }
                        } else {
                          jobData = this.generateBasicJob(job, config);
                        }
                        yield jobData;
                      }
                      break;
                    }

                    // 🔧 如果检测到浏览器断开，立即停止
                    if (browserDisconnected) {
                      this.log('error', `[ZhilianCrawler] 💥 检测到浏览器断开，停止爬取`);
                      for (const result of batchResults) {
                        if (result.status === 'fulfilled' && result.value.data) {
                          yield result.value.data;
                        }
                      }
                      break;
                    }

                    for (const result of batchResults) {
                      if (result.status === 'fulfilled' && result.value.data) {
                        yield result.value.data;
                      }
                    }
                    
                    // 🔧 批次间延迟，给浏览器充分的GC和内存恢复时间
                    if (batchEnd < filteredJobs.length && !browserDisconnected) {
                      this.log('info', `[ZhilianCrawler] ⏱️ 批次间延迟 8-10秒（浏览器内存恢复）...`);
                      await this.randomDelay(8000, 10000);
                    }
                    
                    // 发送进度日志
                    if (io && taskId) {
                      const progressMsg = companies.length > 0 
                        ? `✅ 已采集 ${batchEnd}/${filteredJobs.length} 条目标企业职位 | 关键词: ${keyword} | 城市: ${city || '不限'} | 本批次成功${successCount}/${batch.length}`
                        : `✅ 已采集 ${batchEnd}/${filteredJobs.length} 条 | 关键词: ${keyword} | 城市: ${city || '不限'} | 本批次成功${successCount}/${batch.length}`;
                      
                      io.to(`task:${taskId}`).emit('task:log', {
                        taskId,
                        level: 'success',
                        message: progressMsg
                      });
                    }
                  }
                }

                // 🔧 关键修复：中止时不进行 hasNextPage 检查（浏览器可能已被关闭，eval 会抛错导致断点无法保存）
                if (this.checkAborted()) {
                  hasNextPage = false;
                } else {
                  // 检查下一页 - 使用多套选择器策略
                  // @ts-ignore - 此代码在浏览器环境中运行
                  hasNextPage = await page.evaluate(() => {
                  // 🔧 防御性检查: 确保document存在
                  if (!document || !document.querySelector) {
                    return false;
                  }
                  
                  // 策略1: 标准选择器
                  let nextButton = document.querySelector('.pagination .next:not(.disabled)');
                  if (nextButton) return true;
                  
                  // 策略2: 备用选择器
                  nextButton = document.querySelector('.next:not(.disabled)');
                  if (nextButton) return true;
                  
                  // 策略3: 查找包含"下一页"文本的按钮
                  const allButtons = document.querySelectorAll('button, a');
                  for (const btn of Array.from(allButtons)) {
                    if (btn.textContent?.includes('下一页') && !btn.classList.contains('disabled')) {
                      return true;
                    }
                  }
                  
                  // 策略4: 查找pagination容器中的最后一个非禁用链接
                  const pagination = document.querySelector('.pagination');
                  if (pagination) {
                    const links = pagination.querySelectorAll('a');
                    if (links.length > 0) {
                      const lastLink = links[links.length - 1];
                      if (lastLink.textContent?.includes('下一页') || lastLink.textContent?.includes('>')) {
                        return !lastLink.classList.contains('disabled');
                      }
                    }
                  }
                  
                  return false;
                });
                }  // 🔧 关闭 else 块（abort 检查的 if-else）

                this.log('info', `[ZhilianCrawler] 是否有下一页: ${hasNextPage}`);
              }

              // 计算本页耗时
              const pageEndTime = Date.now();
              const pageDuration = ((pageEndTime - pageStartTime) / 1000).toFixed(2);
              
              // 发送页面处理完成的详细日志
              if (io && taskId) {
                io.to(`task:${taskId}`).emit('task:log', {
                  taskId,
                  level: 'success',
                  message: `✅ 第 ${currentPage} 页处理完成 | 耗时 ${pageDuration}秒 | 解析 ${jobList.length} 条 | 过滤后 ${filteredJobs.length} 条${hasNextPage ? ' | 继续下一页' : ' | 已是最后一页'}`
                });
              }

              // 🔧 断点续传：每页处理完成后保存进度到DB config（仅非中止时保存）
              if (!this.checkAborted()) {
                try {
                  const resumeTask = await db.prepare('SELECT config FROM tasks WHERE id = $1').get(taskId!) as any;
                  if (resumeTask) {
                    const resumeConfig = typeof resumeTask.config === 'string' ? JSON.parse(resumeTask.config) : resumeTask.config;
                    resumeConfig._resumeState = { combinationIndex: currentCombination, currentPage: currentPage + 1, jobIndex: 0 };
                    await db.prepare('UPDATE tasks SET config = $1 WHERE id = $2').run(JSON.stringify(resumeConfig), taskId!);
                  }
                } catch (e: any) {
                  // 保存失败不影响继续爬取
                }
              }

            } catch (error: any) {
              const pageEndTime = Date.now();
              const pageDuration = ((pageEndTime - pageStartTime) / 1000).toFixed(2);

              // 🔧 关键修复：检测浏览器崩溃错误
              const isBrowserCrash = error.message.includes('Connection closed') ||
                                     error.message.includes('Session closed') ||
                                     error.message.includes('Target closed') ||
                                     error.message.includes('Protocol error') ||
                                     error.message.includes('浏览器连接已断开') ||
                                     error.message.includes('BROWSER_RESTART_SCHEDULED') ||
                                     error.message.includes('BROWSER_CRASH_RECOVERABLE');

              // 🔧 detached Frame 单独处理：先尝试恢复页面而非直接重启浏览器
              const isDetachedFrame = error.message.includes('detached');

              // 🔧 关键修复：用户中止时优雅退出，不抛错
              // 之前 throw error → generator 异常退出 → taskService catch → 任务标为 failed
              // 正确做法：保存断点 + 设 hasNextPage=false → 循环正常退出 → stop handler 执行 → 任务标为 stopped
              if (this.checkAborted()) {
                this.log('info', `[ZhilianCrawler] ⏹️ 检测到中止信号，正在优雅退出...`);
                try {
                  const abortResumeTask = await db.prepare('SELECT config FROM tasks WHERE id = $1').get(taskId!) as any;
                  if (abortResumeTask) {
                    const abortConfig = typeof abortResumeTask.config === 'string' ? JSON.parse(abortResumeTask.config) : abortResumeTask.config;
                    abortConfig._resumeState = { combinationIndex: currentCombination, currentPage: currentPage, jobIndex: currentJobIndex };
                    await db.prepare('UPDATE tasks SET config = $1 WHERE id = $2').run(JSON.stringify(abortConfig), taskId!);
                    this.log('info', `[ZhilianCrawler] 💾 中止断点已保存（异常路径）: 组合${currentCombination}, 第${currentPage}页, 职位${currentJobIndex + 1}`);
                  }
                } catch (e: any) {
                  this.log('error', `[ZhilianCrawler] ❌ 保存中止断点失败:`, e.message);
                }
                hasNextPage = false;  // 让 while 循环条件失效，自然退出
                // 不抛错，落到 catch 块末尾 → finally 清理 → while 条件检查 → 优雅退出
              } else if (isBrowserCrash || isDetachedFrame) {
                const errorType = isDetachedFrame ? '页面Frame分离' : '浏览器崩溃';
                this.log('error', `[ZhilianCrawler] 🚨 检测到${errorType}！错误: ${error.message}`);
                this.log('error', `[ZhilianCrawler] 📊 浏览器进程PID: ${browser.process()?.pid || '未知'}`);

                if (io && taskId) {
                  io.to(`task:${taskId}`).emit('task:log', {
                    taskId,
                    level: 'error',
                    message: `🚨 ${errorType}，正在尝试恢复...`
                  });
                }

                // 🔧 detached Frame 恢复策略：先尝试重新加载当前页面而非重启浏览器
                if (isDetachedFrame && browser.isConnected()) {
                  this.log('info', `[ZhilianCrawler] 🔄 尝试恢复列表页（页面重载，不重启浏览器）...`);
                  try {
                    if (page && !page.isClosed()) {
                      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
                      this.log('info', `[ZhilianCrawler] ✅ 列表页重载成功，继续当前页处理`);
                      // 等待DOM渲染
                      await this.randomDelay(3000, 4000);
                      // 🔧 将恢复的页面暂存，供while循环顶部复用
                      (this as any)._recoveredPage = page;
                      continue;  // 🔧 回到while顶部，复用恢复的页面
                    }
                  } catch (reloadError: any) {
                    this.log('warn', `[ZhilianCrawler] ⚠️ 列表页重载失败: ${reloadError.message}，升级为浏览器重启`);
                  }
                }

                // 🔧 真正的浏览器崩溃处理
                if (page) {
                  try {
                    await page.close().catch(() => {});
                    this.log('info', `[ZhilianCrawler] ✅ 页面已强制关闭`);
                  } catch (e) {
                    this.log('warn', `[ZhilianCrawler] ⚠️ 关闭页面失败:`, e);
                  }
                }

                try {
                  if (browser.isConnected()) {
                    await browser.close().catch(() => {});
                    this.log('info', `[ZhilianCrawler] ✅ 浏览器实例已关闭`);
                  }
                } catch (closeErr) {
                  this.log('warn', `[ZhilianCrawler] ⚠️ 关闭浏览器失败:`, closeErr);
                }

                const crashError = new Error(`BROWSER_CRASH_RECOVERABLE: ${error.message}`);
                (crashError as any).canRecover = true;
                // 🔧 关键修复：附加当前爬取状态，用于断点续传
                (crashError as any).combinationIndex = currentCombination;
                (crashError as any).currentPage = currentPage;
                (crashError as any).jobIndex = currentJobIndex;
                throw crashError;
              } else {
              // 🔧 非崩溃、非中止错误：记录日志后跳过当前页
              // 🔧 优化：根据错误类型记录不同的日志级别
              const isPageLoadError = error.message.includes('未能提取到职位标题') ||
                                      error.message.includes('页面可能加载不完整') ||
                                      error.message.includes('TimeoutError');

              if (isPageLoadError) {
                this.log('warn', `[ZhilianCrawler] ⚠️ 第 ${currentPage} 页加载不完整或超时: ${error.message}`);

                if (io && taskId) {
                  io.to(`task:${taskId}`).emit('task:log', {
                    taskId,
                    level: 'warning',
                    message: `⚠️ 第 ${currentPage} 页加载不稳定，可能影响数据完整性`
                  });
                }
              } else {
                this.log('error', `[ZhilianCrawler] ❌ 爬取第 ${currentPage} 页时出错:`, error.message);
                if (error.stack) {
                  this.log('error', `[ZhilianCrawler] 错误堆栈:`, error.stack);
                }

                if (io && taskId) {
                  io.to(`task:${taskId}`).emit('task:log', {
                    taskId,
                    level: 'error',
                    message: `❌ 第 ${currentPage} 页请求失败 | 耗时 ${pageDuration}秒 | 错误: ${error.message}`
                  });
                }
              }

              // 🔧 关键修复：确保页面被关闭，避免资源泄漏
              if (page) {
                try {
                  await page.close();
                  this.log('info', `[ZhilianCrawler] ✅ 异常页面已关闭`);
                } catch (e) {
                  // 忽略关闭错误
                }
              }

              this.log('warn', `[ZhilianCrawler] ⚠️ 由于请求失败，跳过当前页面的数据爬取`);
              break;
              }
            } finally {
  if (page) {
    try {
      const closeTimeout = new Promise<void>((_, reject) => {
        setTimeout(() => reject(new Error('关闭页面超时（5秒）')), 5000);
      });
      
      await Promise.race([
        page.close(),
        closeTimeout
      ]);
      
      this.log('info', `[ZhilianCrawler] ✅ 页面已关闭`);
    } catch (closeError: any) {
      this.log('warn', `[ZhilianCrawler] ⚠️ 关闭页面时出错（可能已自动关闭）:`, closeError.message);
    }
  }
}
            
            // 如果任务中止或没有下一页，退出循环
            if (this.checkAborted() || !hasNextPage) {
              // 🔧 断点续传：中止时保存当前位置（不递增页码），确保恢复时从此页开始
              if (this.checkAborted()) {
                try {
                  const abortResumeTask = await db.prepare('SELECT config FROM tasks WHERE id = $1').get(taskId!) as any;
                  if (abortResumeTask) {
                    const abortConfig = typeof abortResumeTask.config === 'string' ? JSON.parse(abortResumeTask.config) : abortResumeTask.config;
                    abortConfig._resumeState = { combinationIndex: currentCombination, currentPage: currentPage, jobIndex: currentJobIndex };
                    await db.prepare('UPDATE tasks SET config = $1 WHERE id = $2').run(JSON.stringify(abortConfig), taskId!);
                    this.log('info', `[ZhilianCrawler] 💾 中止断点已保存: 组合${currentCombination}, 第${currentPage}页, 职位${currentJobIndex + 1}`);
                  }
                } catch (e: any) {
                  // 保存失败不影响继续
                }
              }
              break;
            }
            currentPage++;

            if (config.maxPages && currentPage > config.maxPages) {
              this.log('info', `[ZhilianCrawler] 达到最大页数限制: ${config.maxPages}`);
              break;
            }

            await this.randomDelay(2000, 4000);

          }
          
          // 🔧 修复：如果是用户中止，跳过"完成组合"逻辑，保留当前 _resumeState
          if (this.checkAborted()) {
            this.log('info', `[ZhilianCrawler] ⚠️ 组合 ${currentCombination}/${totalCombinationCount} 被中止，保留断点续传状态`);

            // 🔧 关键修复：保存 _resumeState 到 DB config
            // 处理在 while 循环外部（如 randomDelay 期间）被中止的场景
            // 此时 line 1711 的保存点已错过，必须在此处补存
            try {
              const abortResumeTask = await db.prepare('SELECT config FROM tasks WHERE id = $1').get(taskId!) as any;
              if (abortResumeTask) {
                const abortConfig = typeof abortResumeTask.config === 'string' ? JSON.parse(abortResumeTask.config) : abortResumeTask.config;
                if (!abortConfig._resumeState) {
                  abortConfig._resumeState = { combinationIndex: currentCombination, currentPage: currentPage, jobIndex: currentJobIndex };
                  await db.prepare('UPDATE tasks SET config = $1 WHERE id = $2').run(JSON.stringify(abortConfig), taskId!);
                  this.log('info', `[ZhilianCrawler] 💾 中止断点已保存（组合退出路径）: 组合${currentCombination}, 第${currentPage}页, 职位${currentJobIndex + 1}`);
                }
              }
            } catch (e: any) {
              this.log('error', `[ZhilianCrawler] ❌ 保存中止断点失败:`, e.message);
            }
            // 不执行组合完成进度更新，让外层的 abort 检测处理返回
          } else {

          this.log('info', `[ZhilianCrawler] ✅ 完成组合 ${currentCombination}/${totalCombinationCount}: 关键词="${keyword}", 城市="${city}"`);
          this.log('info', `[ZhilianCrawler]`);

          // 🔧 关键修复：发送组合完成进度到前端并更新数据库
          if (io && taskId) {
            // 发送组合进度事件
            io.to(`task:${taskId}`).emit('task:combinationProgress', {
              taskId,
              currentCombination,
              totalCombinationCount,
              keyword,
              city
            });

            // 🔧 直接更新数据库进度（多组合场景）
            const progressPercent = Math.round((currentCombination / totalCombinationCount) * 99);
            try {
              await db.prepare(`
                UPDATE tasks
                SET progress = $1, current = $2, updated_at = CURRENT_TIMESTAMP
                WHERE id = $3
              `).run(progressPercent, currentCombination, taskId);

              this.log('info', `[ZhilianCrawler] 📊 进度更新: ${currentCombination}/${totalCombinationCount} (${progressPercent}%)`);
            } catch (dbError) {
              this.log('warn', `[ZhilianCrawler] ⚠️ 更新进度失败:`, dbError.message);
            }

            // 🔧 断点续传：组合完成后保存下一个组合的起始状态
            try {
              const comboResumeTask = await db.prepare('SELECT config FROM tasks WHERE id = $1').get(taskId) as any;
              if (comboResumeTask) {
                const comboResumeConfig = typeof comboResumeTask.config === 'string' ? JSON.parse(comboResumeTask.config) : comboResumeTask.config;
                comboResumeConfig._resumeState = { combinationIndex: currentCombination + 1, currentPage: 1, jobIndex: 0 };
                await db.prepare('UPDATE tasks SET config = $1 WHERE id = $2').run(JSON.stringify(comboResumeConfig), taskId);
              }
            } catch (e: any) {
              // 保存失败不影响继续爬取
            }
          }
          
          // 🔧 主动重启机制：每处理20个组合后主动关闭并重启浏览器
const COMBINATIONS_PER_BROWSER = 5;
const combosSinceRestart = currentCombination - Math.max(0, startCombinationIndex);
if (combosSinceRestart > 0 && combosSinceRestart % COMBINATIONS_PER_BROWSER === 0 && currentCombination < totalCombinationCount) {
  this.log('info', `[ZhilianCrawler] 🔄 已处理 ${combosSinceRestart} 个组合（自上次重启），主动重启浏览器以防止资源泄漏...`);
  
  if (io && taskId) {
    io.to(`task:${taskId}`).emit('task:log', {
      taskId,
      level: 'info',
      message: `🔄 已处理${currentCombination}个组合，正在重启浏览器以优化性能...`
    });
  }
  
  // 🔧 关键修复：保存当前组合索引，确保断点续传从正确位置开始
  const restartError = new Error(`BROWSER_RESTART_SCHEDULED: 已处理${currentCombination}个组合`);
  (restartError as any).shouldRestart = true;
  (restartError as any).combinationIndex = currentCombination;  // ✅ 保存组合索引
  (restartError as any).currentPage = 1;  // ✅ 新组合从第1页开始
  (restartError as any).jobIndex = 0;     // ✅ 新页面从第1个职位开始
  throw restartError;
}
          }  // end else: 组合正常完成
        }
      }

      // 🔧 修复：如果被中止，不打印"所有组合完成"
      if (!this.checkAborted()) {
        this.log('info', `[ZhilianCrawler]`);
        this.log('info', `[ZhilianCrawler] =============================================`);
        this.log('info', `[ZhilianCrawler] ✅✅✅ 所有 ${totalCombinationCount} 个组合处理完成!`);
        this.log('info', `[ZhilianCrawler] =============================================`);
      }
    } finally {
      // 🔧 清理 abort 监听器，防止 retry 时重复注册导致日志刷屏
      signal.removeEventListener('abort', abortHandler);
      // 🔧 优化：安全关闭浏览器，添加超时和错误处理
      this.log('info', `[ZhilianCrawler] 🛑 正在关闭浏览器...`);
      
      try {
        // 添加超时控制，防止关闭时卡住
        const closeTimeout = new Promise<void>((_, reject) => {
          setTimeout(() => reject(new Error('关闭浏览器超时（10秒）')), 10000);
        });
        
        await Promise.race([
          browser.close(),
          closeTimeout
        ]);
        
        this.log('info', `[ZhilianCrawler] ✅ 浏览器已关闭`);
      } catch (closeError: any) {
        this.log('warn', `[ZhilianCrawler] ⚠️ 关闭浏览器时出错: ${closeError.message}`);
      }
      
      // 🔧 延迟清理临时目录（等待2秒确保Chrome进程完全退出）
      this.log('info', `[ZhilianCrawler] 🧹 等待2秒后清理临时目录...`);
      setTimeout(async () => {
        try {
          const fs = await import('fs/promises');
          await fs.rm(userDataDir, { recursive: true, force: true });
          this.log('info', `[ZhilianCrawler] ✅ 临时目录已清理: ${userDataDir}`);
        } catch (cleanupError: any) {
          this.log('warn', `[ZhilianCrawler] ⚠️ 清理临时目录失败: ${cleanupError.message}`);
        }
      }, 2000);
    }
  }

  // 获取taskId的辅助方法
  private getTaskId(): string {
    return (this as any).taskId || '';
  }

  // 🔧 可中断延迟：监听 AbortSignal 的 abort 事件，立即中断等待
  private abortableSleep(ms: number): Promise<void> {
    return new Promise(resolve => {
      if (this.signal?.aborted) {
        resolve();
        return;
      }
      const cleanup = () => {
        this.signal?.removeEventListener('abort', onAbort);
      };
      const onAbort = () => {
        clearTimeout(timer);
        cleanup();
        resolve();
      };
      const timer = setTimeout(() => {
        cleanup();
        resolve();
      }, ms);
      this.signal?.addEventListener('abort', onAbort);
    });
  }

  // 随机延迟（可被 abort 中断）
  private async randomDelay(min: number = 2000, max: number = 5000): Promise<void> {
    if (this.signal?.aborted) return;
    const delay = Math.random() * (max - min) + min;
    await this.abortableSleep(delay);
  }

  // 检查是否终止
  private checkAborted(): boolean {
    return this.signal?.aborted || false;
  }

  // ✅ 优化：访问职位详情页获取完整信息（复用浏览器实例，增加智能重试机制）
  private async fetchJobDetail(browser: any, jobUrl: string, basicInfo: any): Promise<JobData> {
    let page: any = null;
    let retryCount = 0;
    const maxRetries = 3;  // 🔧 优化：从2次增加到3次重试
    
    while (retryCount <= maxRetries) {
      try {
        if (retryCount > 0) {
          this.log('info', `[ZhilianCrawler] 🔄 第 ${retryCount} 次重试抓取详情页: ${jobUrl.substring(0, 60)}...`);
          
          // 🔧 优化：根据重试次数动态调整延迟时间
          const delayMin = 2000 + (retryCount - 1) * 1000;  // 第1次重试2-4秒，第2次3-5秒，第3次4-6秒
          const delayMax = 4000 + (retryCount - 1) * 2000;
          await this.randomDelay(delayMin, delayMax);
          
          // 🔧 重试前检查浏览器连接
          if (!browser.isConnected()) {
            throw new Error('浏览器连接已断开，无法重试');
          }
        } else {
          this.log('info', `[ZhilianCrawler] 📑 开始抓取详情页: ${jobUrl.substring(0, 60)}...`);
        }

        // ✅ 关键修复：检查浏览器是否仍然可用
        try {
          // 🔧 首先检查浏览器连接状态
          if (!browser.isConnected()) {
            throw new Error('浏览器实例已断开连接');
          }
          
          const pages = await browser.pages();
          this.log('info', `[ZhilianCrawler] 🔍 浏览器健康检查: 当前打开 ${pages.length} 个标签页`);
          
          // 🔧 关键优化：如果标签页过多，关闭一些旧页面释放资源（更激进的清理）
          if (pages.length > 5) {  // 🔧 降低阈值至5，防止并发5时资源耗尽
            this.log('warn', `[ZhilianCrawler] ⚠️ 标签页数量过多(${pages.length})，清理详情页和空白页...`);
            let closedCount = 0;
            for (let i = pages.length - 1; i >= 0; i--) {
              try {
                const url = pages[i].url();
                // 保留搜索列表页
                if (url.includes('zhaopin.com/sou') && !url.includes('jobdetail')) {
                  continue;
                }
                if (!pages[i].isClosed()) {
                  await pages[i].close();
                  closedCount++;
                }
              } catch (e) {
                // 忽略关闭错误
              }
            }
            if (closedCount > 0) {
              this.log('info', `[ZhilianCrawler] ✅ 已清理 ${closedCount} 个标签页`);
            }
          }
        } catch (browserCheckError: any) {
          this.log('error', `[ZhilianCrawler] ❌ 浏览器健康检查失败: ${browserCheckError.message}`);
          throw new Error(`浏览器实例已失效，无法继续抓取: ${browserCheckError.message}`);
        }

        // 创建新标签页（而不是新浏览器）
        this.log('info', `[ZhilianCrawler] 🆕 创建新标签页...`);
        
        // 🔧 增加超时控制，并处理孤儿标签页泄漏
        const newPagePromise = browser.newPage();
        const createPageTimeout = new Promise<any>((_, reject) => {
          setTimeout(() => reject(new Error('创建标签页超时（10秒）')), 10000);
        });

        page = await Promise.race([
          newPagePromise,
          createPageTimeout
        ]).catch(async (raceError) => {
          // 超时时 newPagePromise 仍在后台运行，捕获并关闭泄漏的孤儿页面
          newPagePromise.then((leakedPage: any) => {
            if (leakedPage && !leakedPage.isClosed()) {
              this.log('warn', `[ZhilianCrawler] 🧹 关闭超时泄漏的孤儿标签页`);
              leakedPage.close().catch(() => {});
            }
          }).catch(() => {});
          throw raceError;
        });
        
        this.log('info', `[ZhilianCrawler] ✅ 标签页创建成功`);
        
        // 🔧 设置资源拦截，减少内存占用
        await page.setRequestInterception(true);
        page.on('request', (request: any) => {
          // 🔧 只拦截非必要资源，保留CSS加载避免WAF识别
          if (['image', 'font', 'media'].includes(request.resourceType())) {
            request.abort();
          } else {
            request.continue();
          }
        });

        // 🔧 随机化浏览器指纹，降低WAF检测率
        const viewportWidth = 1366 + Math.floor(Math.random() * 554);   // 1366-1920
        const viewportHeight = 768 + Math.floor(Math.random() * 312);   // 768-1080
        await page.setViewport({ width: viewportWidth, height: viewportHeight });

        const userAgents = [
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
        ];
        await page.setUserAgent(userAgents[Math.floor(Math.random() * userAgents.length)]);
        
        // 导航到详情页
        this.log('info', `[ZhilianCrawler] 🌐 正在导航至详情页...`);
        await page.goto(jobUrl, { 
          waitUntil: 'domcontentloaded',  // 改为domcontentloaded，更快
          timeout: 15000 
        });
        
        // 等待关键元素加载（对齐新版 fetchJobDetailWithPage 的等待策略）
        this.log('info', `[ZhilianCrawler] ⏳ 等待关键元素加载...`);
        try {
          await page.waitForSelector('.summary-planes__title, .company-name, [class*="job-title"]', {
            timeout: 6000
          });
          this.log('info', `[ZhilianCrawler] ✅ 关键元素已加载`);
        } catch (waitError: any) {
          this.log('warn', `[ZhilianCrawler] ⚠️ 关键元素等待超时，尝试延长等待时间...`);
          await this.abortableSleep(2000);
        }

        this.log('info', `[ZhilianCrawler] ⏳ 等待动态内容渲染...`);
        await this.abortableSleep(2000);

        // 页面健康检查
        const pageHealth = await page.evaluate(() => {
          return {
            bodyLength: document.body ? document.body.textContent?.length || 0 : 0,
            isSecurityVerification: (document.title || '').includes('Security Verification'),
            pageTitle: document.title || '',
            htmlContent: document.documentElement.outerHTML.substring(0, 500)
          };
        });

        this.log('info', `[ZhilianCrawler] 📊 页面健康检查: body长度=${pageHealth.bodyLength}`);

        // WAF专项检测
        if (pageHealth.isSecurityVerification) {
          this.log('error', `[ZhilianCrawler] 🚨 检测到WAF安全验证！页面标题="${pageHealth.pageTitle}"`);
          throw new Error('WAF_DETECTED: 智联招聘安全验证拦截，此IP/会话已被标记');
        }

        // 内容过少检测
        if (pageHealth.bodyLength < 1000) {
          this.log('warn', `[ZhilianCrawler] ⚠️ 页面内容过少(${pageHealth.bodyLength}字节)，尝试刷新...`);
          await page.reload({ waitUntil: 'domcontentloaded', timeout: 10000 });
          await this.abortableSleep(3000);

          const retryHealth = await page.evaluate(() => ({
            bodyLength: document.body ? document.body.textContent?.length || 0 : 0,
            isSecurityVerification: (document.title || '').includes('Security Verification'),
            pageTitle: document.title || ''
          }));

          this.log('info', `[ZhilianCrawler] 📊 刷新后检查: body=${retryHealth.bodyLength}B, title="${retryHealth.pageTitle}"`);

          if (retryHealth.isSecurityVerification) {
            this.log('error', `[ZhilianCrawler] 🚨 刷新后触发WAF安全验证，放弃`);
            throw new Error('WAF_DETECTED: 刷新后触发智联招聘安全验证');
          }

          if (retryHealth.bodyLength < 1000) {
            this.log('error', `[ZhilianCrawler] ❌ 刷新后仍然无法加载，放弃此详情页`);
            throw new Error('PAGE_LOAD_FAILED: 页面内容过少，刷新后仍无效');
          }

          this.log('info', `[ZhilianCrawler] ✅ 刷新后页面加载成功`);
        }

        // 提取职位详情（多选择器策略，对齐新版 fetchJobDetailWithPage）
        this.log('info', `[ZhilianCrawler] 🔍 正在提取页面数据...`);
        const detail = await page.evaluate(() => {
        const result: any = {};

        // ✅ 职位名称 - 多策略提取
        const titleSelectors = [
          '.summary-planes__title',
          '.job-title',
          '[class*="job-title"]',
          '[class*="position-title"]',
          'h1[class*="title"]'
        ];
        for (const selector of titleSelectors) {
          const titleEl = document.querySelector(selector);
          if (titleEl && titleEl.textContent?.trim()) {
            result.title = titleEl.textContent.trim();
            break;
          }
        }

        // ✅ 公司名称 - 多策略提取
        const companySelectors = [
          '.company-name',
          '.company-info__name',
          '.cname',
          '[class*="company-name"]',
          '[class*="cname"]'
        ];
        for (const selector of companySelectors) {
          const companyEl = document.querySelector(selector);
          if (companyEl && companyEl.textContent?.trim()) {
            result.company = companyEl.textContent.trim();
            break;
          }
        }

        // ✅ 薪资
        const salaryEl = document.querySelector('.summary-planes__salary, [class*="salary"]');
        result.salary = salaryEl ? salaryEl.textContent.trim() : '';

        // ✅ 城市
        const cityEl = document.querySelector('.workCity-link, [class*="city"] a');
        if (cityEl) {
          result.city = cityEl.textContent.trim();
        }

        // ✅ 区域
        const areaEl = document.querySelector('.summary-planes__info li span, [class*="area"]');
        result.area = areaEl ? areaEl.textContent.trim() : '';

        // ✅ 工作经验、学历、工作性质、招聘人数
        const infoItems = Array.from(document.querySelectorAll('.summary-planes__info li, [class*="job-info"] li'));
        infoItems.forEach((item: any) => {
          const text = (item.textContent || '').trim();
          if (item.querySelector('a')) return;
          if (text.match(/\d+-?\d*年/)) {
            result.experience = text;
          } else if (text.match(/(本科|硕士|博士|大专|中专|高中|初中)/)) {
            result.education = text;
          } else if (text.match(/(全职|兼职|实习)/)) {
            result.workType = text;
          } else if (text.match(/招\d+人/)) {
            result.recruitmentCount = text;
          }
        });

        // ✅ 工作地址
        const addressEl = document.querySelector('.address-info__bubble, [class*="address"]');
        if (addressEl) {
          result.address = (addressEl.textContent || '').trim();
        }

        // ✅ 公司信息
        const companyDescEl = document.querySelector('.company-info__desc, [class*="company-desc"]');
        if (companyDescEl) {
          const companyText = (companyDescEl.textContent || '').trim();
          const parts = companyText.split('·').map(p => p.trim());
          if (parts.length >= 2) {
            result.companyNature = parts[0];
            result.companyScale = parts[1];
            if (parts.length >= 3) {
              result.businessScope = parts.slice(2).join(', ');
            }
          }
        }

        // ✅ 岗位更新日期
        const updateEl = document.querySelector('.summary-planes__time, [class*="update-time"]');
        if (updateEl) {
          const updateTimeText = updateEl.textContent.trim();
          const timeMatch = updateTimeText.match(/更新于\s*(.+)/);
          if (timeMatch) {
            result.updateDateText = timeMatch[1].trim();
          }
        }

        // ✅ 职位标签/技能要求
        const skillItems = Array.from(document.querySelectorAll('.describtion-card__skills-item, [class*="skill"]'));
        if (skillItems.length > 0) {
          result.jobTags = skillItems.map((item: any) => item.textContent.trim()).join(',');
        }

        return result;
      });

      // 诊断输出
      this.log('info', `[ZhilianCrawler] 📊 提取结果: 标题="${detail.title?.substring(0, 20) || '空'}", 公司="${detail.company?.substring(0, 20) || '空'}"`);

      // 检查是否提取到了关键数据
      if (!detail.title && !detail.company) {
        this.log('error', `[ZhilianCrawler] ❌ 详情页提取失败: 标题和公司名均为空`);
        throw new Error('未能提取到职位标题或公司名称，页面可能加载不完整');
      }

      this.log('info', `[ZhilianCrawler] ✅ 详情页数据提取成功: ${detail.title || '未知职位'}`);
      
      // 🔧 关键优化：立即关闭标签页，释放资源
      if (page) {
        try {
          await page.close();
          this.log('info', `[ZhilianCrawler] ✅ 标签页已关闭`);
          page = null;
        } catch (closeError: any) {
          this.log('warn', `[ZhilianCrawler] ⚠️ 关闭标签页失败（可忽略）: ${closeError.message}`);
          page = null;  // 即使关闭失败也清空引用
        }
      }
      
      // ✅ 将相对日期转换为实际日期
      let updateDate = new Date().toISOString().split('T')[0];
      if (detail.updateDateText) {
        const today = new Date();
        if (detail.updateDateText === '今天') {
          updateDate = today.toISOString().split('T')[0];
        } else if (detail.updateDateText === '昨天') {
          today.setDate(today.getDate() - 1);
          updateDate = today.toISOString().split('T')[0];
        } else {
          const daysMatch = detail.updateDateText.match(/(\d+)天前/);
          if (daysMatch) {
            const days = parseInt(daysMatch[1]);
            today.setDate(today.getDate() - days);
            updateDate = today.toISOString().split('T')[0];
          }
        }
      }
      
      // ✅ 合并基本信息和详情信息（优先使用详情页的真实数据）
      const jobData = {
        companyName: detail.company || basicInfo.company || '',  // 优先使用详情页的公司名称
        jobId: `ZL${Date.now()}${Math.random().toString(36).substr(2, 9)}`,
        jobName: detail.title || basicInfo.title,
        jobCategory: basicInfo.keyword || config.keyword || '',  // 🔧 填充为职位关键词
        jobTags: detail.jobTags || '',  // ✅ 使用真实的职位标签
        jobDescription: '',  // 🔧 职位描述不再解析爬取，置空
        salaryRange: detail.salary || basicInfo.salary || '',
        workCity: detail.city || basicInfo.city || '',
        workExperience: detail.experience || '',  // ✅ 使用真实的工作经验
        workAddress: detail.address || `${detail.city || ''}${detail.area || ''}` || '',  // ✅ 使用真实的工作地址
        education: detail.education || '',  // ✅ 使用真实的学历要求
        companyCode: '',  // 智联招聘不提供公司代码
        // ✅ 优先使用列表页提取的企业性质（来自.joblist-box__item-tag），其次详情页
        companyNature: (basicInfo as any).companyNature || detail.companyNature || '',
        // ✅ 优先使用列表页提取的经营范围，其次详情页
        businessScope: (basicInfo as any).businessScope || detail.businessScope || '',
        // ✅ 优先使用列表页提取的公司规模，其次详情页
        companyScale: (basicInfo as any).companyScale || detail.companyScale || '',
        recruitmentCount: detail.recruitmentCount || '',  // ✅ 使用真实招聘人数
        updateDate: updateDate,  // ✅ 使用转换后的真实日期
        workType: detail.workType || '',  // ✅ 使用真实工作性质
        dataSource: '智联招聘'
      };

      this.log('info', `[ZhilianCrawler] 🏁 详情页处理完成`);
      return jobData;
      
    } catch (error: any) {
      // 🔧 浏览器已断开时不再浪费时间去重试，直接抛出
      const isBrowserGone = error.message.includes('浏览器连接已断开') ||
                            error.message.includes('浏览器实例已断开连接') ||
                            error.message.includes('Session closed') ||
                            error.message.includes('Connection closed') ||
                            error.message.includes('Target closed') ||
                            error.message.includes('Protocol error');
      if (isBrowserGone) {
        this.log('error', `[ZhilianCrawler] 💥 浏览器会话已断开（已重试${retryCount}次），停止重试并抛出`);
        if (page) {
          try { await page.close(); page = null; } catch (e) { /* ignore */ }
        }
        throw error;  // 直接抛出，让外层处理浏览器恢复
      }

      retryCount++;
      this.log('warn', `[ZhilianCrawler] ⚠️ 抓取详情页失败 (尝试 ${retryCount}/${maxRetries + 1}): ${error.message}`);
      
      // 🔧 关键修复：确保页面被关闭，避免资源泄漏
      if (page) {
        try {
          await page.close();
          page = null;
        } catch (e) {
          // 忽略关闭错误
        }
      }

      // 如果达到最大重试次数，抛出错误或返回降级数据
      if (retryCount > maxRetries) {
        this.log('error', `[ZhilianCrawler] ❌ 详情页抓取最终失败，使用基本信息降级`);
        return this.generateBasicJob(basicInfo, {} as TaskConfig);
      }
      
      // 继续下一次循环重试
    }
    }
    
    // 理论上不会到达这里，但为了类型安全返回降级数据
    return this.generateBasicJob(basicInfo, {} as TaskConfig);
  }

  // ✅ 新增：使用已创建的page对象抓取详情页（避免并发创建标签页导致的浏览器崩溃）
  // ✅ 新增：使用已创建的page对象抓取详情页（避免并发创建标签页导致的浏览器崩溃）
  private async fetchJobDetailWithPage(page: any, jobUrl: string, basicInfo: any): Promise<JobData> {
    try {
      this.log('info', `[ZhilianCrawler] 📑 开始抓取详情页: ${jobUrl.substring(0, 60)}...`);

      // 🔧 页面已在并发控制中初始化完成（setRequestInterception、setViewport、setUserAgent）
      // 这里直接导航到详情页
      
      // 导航到详情页
      this.log('info', `[ZhilianCrawler] 🌐 正在导航至详情页...`);
      let navigationTimedOut = false;
      try {
        await page.goto(jobUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 12000  // 缩短超时，快速失败以减少资源占用
        });
      } catch (navError: any) {
        if (navError.message?.includes('timeout') || navError.message?.includes('Navigation')) {
          navigationTimedOut = true;
          this.log('warn', `[ZhilianCrawler] ⏰ 导航超时，尝试从已加载的部分内容提取数据...`);
        } else {
          throw navError;  // 非超时错误，直接抛出
        }
      }
      
      // 🔧 关键优化：显式等待关键元素出现，确保页面完全加载
      // 但如果导航已超时，跳过等待，直接尝试快速提取
      if (!navigationTimedOut) {
        this.log('info', `[ZhilianCrawler] ⏳ 等待关键元素加载...`);
        try {
          await page.waitForSelector('.summary-planes__title, .company-name, [class*="job-title"]', {
            timeout: 6000
          });
          this.log('info', `[ZhilianCrawler] ✅ 关键元素已加载`);
        } catch (waitError: any) {
          this.log('warn', `[ZhilianCrawler] ⚠️ 关键元素等待超时，尝试延长等待时间...`);
          await this.abortableSleep(2000);
        }

        this.log('info', `[ZhilianCrawler] ⏳ 等待动态内容渲染...`);
        await this.abortableSleep(2000);
      } else {
        this.log('info', `[ZhilianCrawler] ⚡ 跳过等待，直接尝试快速提取...`);
        await this.abortableSleep(1000);
      }
      
      // 🔧 健康检查：验证页面是否真的加载成功
      const pageHealth = await page.evaluate(() => {
        return {
          bodyLength: document.body ? document.body.textContent?.length || 0 : 0,
          hasTitle: !!document.querySelector('.summary-planes__title, .job-title, [class*="title"]'),
          hasCompany: !!document.querySelector('.company-name, .company-info, [class*="company"]'),
          title: document.querySelector('.summary-planes__title')?.textContent?.trim() || '',
          company: document.querySelector('.company-name')?.textContent?.trim() || '',
          
          // 🔧 反爬检测指标
          isSecurityVerification: (document.title || '').includes('Security Verification'),
          hasErrorPage: !!document.querySelector('.error-page, #verifyCode, .robot-check, [class*="robot"]'),
          hasLoginPrompt: !!document.querySelector('.need-login, .login-prompt, [data-require="login"]'),
          pageTitle: document.title || '',
          htmlContent: document.documentElement.outerHTML.substring(0, 500)
        };
      });

      this.log('info', `[ZhilianCrawler] 📊 页面健康检查: body长度=${pageHealth.bodyLength}, 有标题=${pageHealth.hasTitle}, 有公司=${pageHealth.hasCompany}`);

      // 🔧 WAF专项检测：Security Verification页面直接放弃（刷新无效）
      if (pageHealth.isSecurityVerification) {
        this.log('error', `[ZhilianCrawler] 🚨 检测到WAF安全验证！页面标题="${pageHealth.pageTitle}"`);
        this.log('error', `[ZhilianCrawler] 📄 HTML片段: ${pageHealth.htmlContent.substring(0, 300)}...`);
        throw new Error('WAF_DETECTED: 智联招聘安全验证拦截，此IP/会话已被标记');
      }

      // 🔧 反爬检测：验证码或登录页面
      if (pageHealth.hasErrorPage || pageHealth.hasLoginPrompt) {
        this.log('error', `[ZhilianCrawler] 🚨 检测到反爬拦截！页面标题="${pageHealth.pageTitle}"`);
        this.log('error', `[ZhilianCrawler] 📄 HTML片段: ${pageHealth.htmlContent.substring(0, 300)}...`);
        throw new Error('ANTI_BOT_DETECTED: 检测到反爬拦截（验证码/错误页面）');
      }

      // 🔧 内容过少检测
      if (pageHealth.bodyLength < 1000) {
        this.log('warn', `[ZhilianCrawler] ⚠️ 页面内容过少(${pageHealth.bodyLength}字节)`);

        // 🔧 导航已超时 → 不浪费时间刷新，直接失败用降级数据
        if (navigationTimedOut) {
          this.log('warn', `[ZhilianCrawler] ⚡ 导航已超时，跳过刷新直接使用降级数据`);
          throw new Error('PAGE_LOAD_FAILED: 导航超时且内容过少');
        }

        this.log('info', `[ZhilianCrawler] 🔄 尝试刷新页面...`);
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 10000 });
        await this.abortableSleep(3000);

        const retryHealth = await page.evaluate(() => ({
          bodyLength: document.body ? document.body.textContent?.length || 0 : 0,
          hasTitle: !!document.querySelector('.summary-planes__title, .job-title'),
          hasCompany: !!document.querySelector('.company-name, .company-info'),
          isSecurityVerification: (document.title || '').includes('Security Verification'),
          pageTitle: document.title || ''
        }));

        this.log('info', `[ZhilianCrawler] 📊 刷新后检查: body=${retryHealth.bodyLength}B, title="${retryHealth.pageTitle}"`);

        if (retryHealth.isSecurityVerification) {
          this.log('error', `[ZhilianCrawler] 🚨 刷新后触发WAF安全验证，放弃`);
          throw new Error('WAF_DETECTED: 刷新后触发智联招聘安全验证');
        }

        if (retryHealth.bodyLength < 1000 || (!retryHealth.hasTitle && !retryHealth.hasCompany)) {
          this.log('error', `[ZhilianCrawler] ❌ 刷新后仍然无法加载，放弃此详情页`);
          throw new Error('PAGE_LOAD_FAILED: 页面内容过少，刷新后仍无效');
        }

        this.log('info', `[ZhilianCrawler] ✅ 刷新后页面加载成功`);
      }
      
      // 提取职位详情
      this.log('info', `[ZhilianCrawler] 🔍 正在提取页面数据...`);
      const detail = await page.evaluate(() => {
        const result: any = {};
        
        // ✅ 职位名称 - 多策略提取（兼容不同版本的DOM结构）
        const titleSelectors = [
          '.summary-planes__title',
          '.job-title',
          '[class*="job-title"]',
          '[class*="position-title"]',
          'h1[class*="title"]'
        ];
        
        for (const selector of titleSelectors) {
          const titleEl = document.querySelector(selector);
          if (titleEl && titleEl.textContent?.trim()) {
            result.title = titleEl.textContent.trim();
            break;
          }
        }
        
        // ✅ 公司名称 - 多策略提取
        const companySelectors = [
          '.company-name',
          '.company-info__name',
          '.cname',
          '[class*="company-name"]',
          '[class*="cname"]'
        ];
        
        for (const selector of companySelectors) {
          const companyEl = document.querySelector(selector);
          if (companyEl && companyEl.textContent?.trim()) {
            result.company = companyEl.textContent.trim();
            break;
          }
        }
        
        // ✅ 薪资 - 从 summary-planes__salary 中提取
        const salaryEl = document.querySelector('.summary-planes__salary, [class*="salary"]');
        result.salary = salaryEl ? salaryEl.textContent.trim() : '';
        
        // ✅ 城市 - 从 workCity-link 中提取
        const cityEl = document.querySelector('.workCity-link, [class*="city"] a');
        if (cityEl) {
          result.city = cityEl.textContent.trim();
        }
        
        // ✅ 区域 - 从 summary-planes__info 第一个li的span中提取
        const areaEl = document.querySelector('.summary-planes__info li span, [class*="area"]');
        result.area = areaEl ? areaEl.textContent.trim() : '';
        
        // ✅ 工作经验、学历、工作性质、招聘人数 - 从 summary-planes__info 中提取
        const infoItems = Array.from(document.querySelectorAll('.summary-planes__info li, [class*="job-info"] li'));
        infoItems.forEach((item: any) => {
          const text = (item.textContent || '').trim();
          
          // 跳过已提取的城市链接
          if (item.querySelector('a')) return;
          
          // 判断是否为工作经验（包含"年"字）
          if (text.match(/\d+-?\d*年/)) {
            result.experience = text;
          }
          // 判断是否为学历
          else if (text.match(/(本科|硕士|博士|大专|中专|高中|初中)/)) {
            result.education = text;
          }
          // 判断是否为工作性质
          else if (text.match(/(全职|兼职|实习)/)) {
            result.workType = text;
          }
          // 判断是否为招聘人数
          else if (text.match(/招\d+人/)) {
            result.recruitmentCount = text;
          }
        });
        
        // ✅ 工作地址 - 从 address-info__bubble 中提取
        const addressEl = document.querySelector('.address-info__bubble, [class*="address"]');
        if (addressEl) {
          result.address = (addressEl.textContent || '').trim();
        }
        
        // ✅ 公司信息 - 从 company-info__desc 中提取
        const companyDescEl = document.querySelector('.company-info__desc, [class*="company-desc"]');
        if (companyDescEl) {
          const companyText = (companyDescEl.textContent || '').trim();
          // 解析公司性质和规模：未融资 · 500-999人 · 计算机软件
          const parts = companyText.split('·').map(p => p.trim());
          if (parts.length >= 2) {
            result.companyNature = parts[0]; // 融资状态/公司性质
            result.companyScale = parts[1];  // 公司规模
            if (parts.length >= 3) {
              result.businessScope = parts.slice(2).join(', '); // 经营范围
            }
          }
        }
        
        // ✅ 岗位更新日期 - 从 summary-planes__time 中提取
        const updateEl = document.querySelector('.summary-planes__time, [class*="update-time"]');
        if (updateEl) {
          const updateTimeText = updateEl.textContent.trim();
          // 提取"更新于 今天"、"更新于 3天前"等
          const timeMatch = updateTimeText.match(/更新于\s*(.+)/);
          if (timeMatch) {
            result.updateDateText = timeMatch[1].trim();
          }
        }
        
        // ✅ 职位标签/技能要求 - 从 describtion-card__skills-item 中提取
        const skillItems = Array.from(document.querySelectorAll('.describtion-card__skills-item, [class*="skill"]'));
        if (skillItems.length > 0) {
          result.jobTags = skillItems.map((item: any) => item.textContent.trim()).join(',');
        }
        
        return result;
      });
      
      // 🔧 增强诊断：输出提取结果
      this.log('info', `[ZhilianCrawler] 📊 提取结果: 标题="${detail.title?.substring(0, 20) || '空'}", 公司="${detail.company?.substring(0, 20) || '空'}"`);
      
      // 检查是否提取到了关键数据，如果没有可能页面加载有问题
      if (!detail.title && !detail.company) {
        this.log('error', `[ZhilianCrawler] ❌ 详情页提取失败: 标题和公司名均为空`);
        throw new Error('未能提取到职位标题或公司名称，页面可能加载不完整');
      }

      this.log('info', `[ZhilianCrawler] ✅ 详情页数据提取成功: ${detail.title || '未知职位'}`);
      
      // 🔧 关键修复：此处不关闭 page，因为它是通过参数传入的共享页面对象，由调用者管理生命周期
      // 如果在内部关闭，会导致后续复用该 page 的任务失败
      
      // ✅ 将相对日期转换为实际日期
      let updateDate = new Date().toISOString().split('T')[0];
      if (detail.updateDateText) {
        const today = new Date();
        if (detail.updateDateText === '今天') {
          updateDate = today.toISOString().split('T')[0];
        } else if (detail.updateDateText === '昨天') {
          today.setDate(today.getDate() - 1);
          updateDate = today.toISOString().split('T')[0];
        } else {
          const daysMatch = detail.updateDateText.match(/(\d+)天前/);
          if (daysMatch) {
            const days = parseInt(daysMatch[1]);
            today.setDate(today.getDate() - days);
            updateDate = today.toISOString().split('T')[0];
          }
        }
      }
      
      // ✅ 合并基本信息和详情信息（优先使用详情页的真实数据）
      const jobData = {
        companyName: detail.company || basicInfo.company || '',  // 优先使用详情页的公司名称
        jobId: `ZL${Date.now()}${Math.random().toString(36).substr(2, 9)}`,
        jobName: detail.title || basicInfo.title,
        jobCategory: basicInfo.keyword || (basicInfo as any).keyword || '',  // 🔧 填充为职位关键词
        jobTags: detail.jobTags || '',  // ✅ 使用真实的职位标签
        jobDescription: '',  // 🔧 职位描述不再解析爬取，置空
        salaryRange: detail.salary || basicInfo.salary || '',
        workCity: detail.city || basicInfo.city || '',
        workExperience: detail.experience || '',  // ✅ 使用真实的工作经验
        workAddress: detail.address || `${detail.city || ''}${detail.area || ''}` || '',  // ✅ 使用真实的工作地址
        education: detail.education || '',  // ✅ 使用真实的学历要求
        companyCode: '',  // 智联招聘不提供公司代码
        // ✅ 优先使用列表页提取的企业性质（来自.joblist-box__item-tag），其次详情页
        companyNature: (basicInfo as any).companyNature || detail.companyNature || '',
        // ✅ 优先使用列表页提取的经营范围，其次详情页
        businessScope: (basicInfo as any).businessScope || detail.businessScope || '',
        // ✅ 优先使用列表页提取的公司规模，其次详情页
        companyScale: (basicInfo as any).companyScale || detail.companyScale || '',
        recruitmentCount: detail.recruitmentCount || '',  // ✅ 使用真实招聘人数
        updateDate: updateDate,  // ✅ 使用转换后的真实日期
        workType: detail.workType || '',  // ✅ 使用真实工作性质
        dataSource: '智联招聘'
      };

      this.log('info', `[ZhilianCrawler] 🏁 详情页处理完成`);
      return jobData;
      
    } catch (error: any) {
      this.log('error', `[ZhilianCrawler] ❌ 抓取详情页失败: ${error.message}`);
      
      // 🔧 关键修复：确保页面被关闭，避免资源泄漏
      if (page) {
        try {
          await page.close();
        } catch (e) {
          // 忽略关闭错误
        }
      }
      
      throw error;  // 重新抛出错误，让上层处理
    }
  }

  // ✅ 新增：仅使用列表页基本信息生成职位数据（降级方案 - 不编造任何数据）
  private generateBasicJob(job: any, config: TaskConfig): JobData {
    return {
      companyName: job.company || '',  // ✅ 留空，不编造
      jobId: `ZL${Date.now()}${Math.random().toString(36).substr(2, 9)}`,
      jobName: job.title,
      jobCategory: job.keyword || config.keyword || '',  // 🔧 填充为职位关键词
      jobTags: '',
      jobDescription: '',  // 🔧 职位描述不再解析爬取，置空
      salaryRange: job.salary || '',
      workCity: job.city || config.city || '',
      workExperience: '',  // ✅ 留空，不编造
      workAddress: job.city || config.city || '',
      education: '',  // ✅ 留空，不编造
      companyCode: '',
      companyNature: '',  // ✅ 留空，不编造
      businessScope: '',  // ✅ 留空，不编造
      companyScale: '',  // ✅ 留空，不编造
      recruitmentCount: '',  // ✅ 留空，不编造
      updateDate: new Date().toISOString().split('T')[0],
      workType: '',  // ✅ 留空，不编造
      dataSource: '智联招聘'
    };
  }

}
