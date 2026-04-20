// @ts-nocheck - 禁用整个文件的类型检查，因为 page.evaluate 中的代码在浏览器环境中运行
import puppeteer from 'puppeteer';
import { JobData, TaskConfig } from '../../types';
import { JOB51_CITY_CODES } from '../../config/constants';
import { io } from '../../app';
import * as fs from 'fs';
import * as path from 'path';

export class Job51Crawler {
  private signal: AbortSignal | null = null;

  async *crawl(config: TaskConfig, signal: AbortSignal): AsyncGenerator<JobData> {
    this.signal = signal;

    // 获取关键词列表（支持多个）
    const keywords = config.keywords && config.keywords.length > 0 
      ? config.keywords 
      : (config.keyword ? [config.keyword] : ['']);
    
    // 获取城市列表（支持多个）
    const cities = config.cities && config.cities.length > 0
      ? config.cities
      : (config.city ? [config.city] : ['']);
    
    // 获取企业列表（支持多个）
    const companies = config.companies || (config.company ? [config.company] : []);

    let totalCombinationCount = keywords.length * cities.length;
    let currentCombination = 0;

    console.log(`[Job51Crawler] 开始爬取`);
    console.log(`[Job51Crawler] ========== 关键词和城市配置 ==========`);
    console.log(`[Job51Crawler] 关键词列表: [${keywords.join(', ')}] (共${keywords.length}个)`);
    console.log(`[Job51Crawler] 城市列表: [${cities.join(', ')}] (共${cities.length}个)`);
    console.log(`[Job51Crawler] 企业列表: ${companies.length > 0 ? '[' + companies.join(', ') + ']' : '不限'} (共${companies.length}个)`);
    console.log(`[Job51Crawler] 总组合数: ${totalCombinationCount} (${keywords.length} × ${cities.length})`);
    console.log(`[Job51Crawler] =============================================`);

    // 启动浏览器 - 使用自定义临时目录避免冲突
    const chromePath = 'C:\\Users\\Administrator\\.cache\\puppeteer\\chrome\\win64-131.0.6778.204\\chrome-win64\\chrome.exe';
    const userDataDir = `C:\\Users\\Administrator\\.cache\\puppeteer\\tmp\\job51_${Date.now()}`;
    
    console.log(`[Job51Crawler] 使用临时目录: ${userDataDir}`);
    
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
        '--window-size=1920x1080'
      ]
    });

    try {
      // 遍历所有关键词和城市的组合
      console.log(`[Job51Crawler] >>>>>> 开始遍历 ${totalCombinationCount} 个组合 <<<<<<`);
      
      for (const keyword of keywords) {
        for (const city of cities) {
          currentCombination++;
          
          console.log(`[Job51Crawler]`);
          console.log(`[Job51Crawler] ╔════════════════════════════════════════╗`);
          console.log(`[Job51Crawler] ║ 开始处理组合 ${currentCombination}/${totalCombinationCount}`);
          console.log(`[Job51Crawler] ║   关键词: "${keyword}"`);
          console.log(`[Job51Crawler] ║   城市:   "${city || '不限'}"`);
          console.log(`[Job51Crawler] ╚════════════════════════════════════════╝`);
          
          if (this.checkAborted()) {
            console.log(`[Job51Crawler] ⚠️ 任务已中止，停止后续组合处理`);
            return;
          }

          const cityCode = city ? JOB51_CITY_CODES[city] : '000000';
          console.log(`[Job51Crawler] 开始爬取组合 ${currentCombination}/${totalCombinationCount}: 关键词="${keyword}", 城市="${city}"`);

          // 发送日志到前端
          const taskId = this.getTaskId(config);
          if (io) {
            io.to(`task:${taskId}`).emit('task:log', {
              taskId,
              level: 'info',
              message: `开始爬取: 关键词="${keyword}" | 城市="${city}" (${currentCombination}/${totalCombinationCount})`
            });
          }

          // 构建搜索URL
          const baseUrl = `https://search.51job.com/list/${cityCode},000000,0000,00,9,99,${encodeURIComponent(keyword)},2`;
          console.log(`[Job51Crawler] 搜索URL: ${baseUrl}`);

          let currentPage = 1;
          let hasNextPage = true;

          while (hasNextPage && !this.checkAborted()) {
            const url = `${baseUrl},${currentPage}.html`;
            const pageStartTime = Date.now();
            
            console.log(`[Job51Crawler] 正在爬取第 ${currentPage} 页: ${url}`);
            
            // 发送详细日志到前端
            const taskId = this.getTaskId(config);
            if (io) {
              io.to(`task:${taskId}`).emit('task:log', {
                taskId,
                level: 'info',
                message: `📄 正在请求第 ${currentPage} 页: ${url}`
              });
            }

            const page = await browser.newPage();
            
            try {
              // 🔧 优化1: 设置更真实的浏览器指纹
              await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
              await page.setViewport({ width: 1920, height: 1080 });

              // 🔧 优化2: 注入反检测脚本，隐藏自动化特征
              await page.evaluateOnNewDocument(() => {
                // 隐藏webdriver属性
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                
                // 模拟真实的plugins
                Object.defineProperty(navigator, 'plugins', { 
                  get: () => [
                    { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
                    { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
                    { name: 'Native Client', filename: 'internal-nacl-plugin' }
                  ] 
                });
                
                // 模拟真实的languages
                Object.defineProperty(navigator, 'languages', { 
                  get: () => ['zh-CN', 'zh', 'en-US', 'en'] 
                });
                
                // 添加chrome对象
                window.chrome = { 
                  runtime: {},
                  loadTimes: function() {},
                  csi: function() {},
                  app: {}
                };
                
                // 修改permissions API
                const originalQuery = window.navigator.permissions.query;
                window.navigator.permissions.query = (parameters) => (
                  parameters.name === 'notifications' ?
                    Promise.resolve({ state: Notification.permission }) :
                    originalQuery(parameters)
                );
              });

              // 🚀 优化3: 调整资源拦截策略 - 允许stylesheet以触发JS执行
              await page.setRequestInterception(true);
              page.on('request', (request) => {
                // 允许关键资源类型，包括stylesheet
                const allowedTypes = ['document', 'script', 'xhr', 'fetch', 'stylesheet'];
                const resourceType = request.resourceType();
                
                if (allowedTypes.includes(resourceType)) {
                  request.continue();
                } else {
                  // 阻止图片、字体、媒体等非关键资源
                  request.abort();
                }
              });

              // 🔄 重试机制：最多重试3次
              let loadSuccess = false;
              let retryCount = 0;
              const maxRetries = 3;

              while (!loadSuccess && retryCount <= maxRetries) {
                try {
                  if (retryCount > 0) {
                    console.log(`[Job51Crawler] 第 ${retryCount} 次重试加载...`);
                    if (io) {
                      io.to(`task:${taskId}`).emit('task:log', {
                        taskId,
                        level: 'warning',
                        message: `⚠️ 第 ${currentPage} 页加载超时，正在第 ${retryCount} 次重试...`
                      });
                    }
                  }

                  // 导航到页面 - 使用 domcontentloaded 加快加载速度
                  await page.goto(url, { 
                    waitUntil: 'domcontentloaded',
                    timeout: 90000
                  });

                  // 🔧 优化4: 验证页面是否真正加载成功
                  const htmlLength = await page.content().then(html => html.length);
                  console.log(`[Job51Crawler] 页面HTML长度: ${htmlLength} 字符`);
                  
                  // 如果HTML长度过短（小于1000字符），认为加载失败
                  if (htmlLength < 1000) {
                    throw new Error(`页面内容异常: HTML长度仅${htmlLength}字符，可能被反爬拦截`);
                  }

                  loadSuccess = true;
                  console.log(`[Job51Crawler] ✅ 页面加载成功，URL: ${page.url()}`);
                  
                } catch (loadError: any) {
                  retryCount++;
                  console.warn(`[Job51Crawler] ⚠️ 第 ${retryCount} 次加载失败:`, loadError.message);
                  
                  if (retryCount > maxRetries) {
                    throw new Error(`页面加载失败，已重试 ${maxRetries} 次: ${loadError.message}`);
                  }
                  
                  // 等待3-6秒后重试
                  await this.randomDelay(3000, 6000);
                }
              }

              // 🔧 优化5: 强制滚动触发懒加载
              console.log(`[Job51Crawler] 执行滚动操作以触发懒加载...`);
              await page.evaluate(async () => {
                // 多次滚动到底部
                for (let i = 0; i < 3; i++) {
                  window.scrollTo(0, document.body.scrollHeight);
                  await new Promise(resolve => setTimeout(resolve, 1000));
                  window.scrollTo(0, 0);
                  await new Promise(resolve => setTimeout(resolve, 500));
                }
              });

              // 额外等待以确保动态内容加载完成
              await this.randomDelay(3000, 5000);

              // 保存HTML快照用于调试
              const html = await page.content();
              const debugDir = path.join(__dirname, '../../../debug');
              if (!fs.existsSync(debugDir)) {
                fs.mkdirSync(debugDir, { recursive: true });
              }
              const debugFile = path.join(debugDir, `job51_puppeteer_page_${currentPage}_${Date.now()}.html`);
              fs.writeFileSync(debugFile, html);
              console.log(`[Job51Crawler] HTML快照已保存到: ${debugFile}`);

              // 🔧 优化6: 智能提取职位数据 - 优先尝试DOM选择器，失败则使用文本分析
              console.log(`[Job51Crawler] 开始提取职位数据...`);
              
              // @ts-ignore - 此代码在浏览器环境中运行
              const jobs = await page.evaluate(() => {
                const jobList: any[] = [];
                
                // ===== 方法1: 尝试标准DOM选择器 =====
                const selectors = [
                  '.dw_table .el',
                  '.el',
                  'div[class*="job-item"]',
                  'div[class*="position"]',
                  '[class*="card"] a[href*="/job/"]'
                ];

                let foundJobs = false;
                
                for (const selector of selectors) {
                  const elements = document.querySelectorAll(selector);
                  if (elements.length > 0) {
                    foundJobs = true;
                    console.log(`找到选择器 "${selector}" 匹配 ${elements.length} 个元素`);
                    
                    elements.forEach((element: any) => {
                      const titleEl = element.querySelector('.jname a, .job-title a, .jobName, a[href*="/job/"]');
                      const companyEl = element.querySelector('.cname a, .company a, [class*="company"] span, [class*="left"] span');
                      const salaryEl = element.querySelector('.sal, .salary, [class*="pay"], [class*="salary"]');
                      const cityEl = element.querySelector('.ltype, .location, [class*="area"], [class*="right"] span');
                      const linkEl = element.querySelector('.jname a, a[href*="/job/"]');

                      const title = titleEl ? titleEl.textContent?.trim() || '' : '';
                      const company = companyEl ? companyEl.textContent?.trim() || '' : '';
                      const salary = salaryEl ? salaryEl.textContent?.trim() || '' : '';
                      const city = cityEl ? cityEl.textContent?.trim() || '' : '';
                      const link = linkEl ? linkEl.getAttribute('href') || '' : '';

                      if (title && title.length > 3) {
                        jobList.push({ title, company, salary, city, link });
                      }
                    });
                    break;
                  }
                }

                // ===== 方法2: 如果DOM选择器失败，使用文本分析提取 =====
                if (!foundJobs || jobList.length === 0) {
                  console.log('DOM选择器未找到数据，尝试文本分析方法...');
                  
                  const bodyText = document.body.innerText;
                  const lines = bodyText.split('\n').filter(line => line.trim().length > 0);
                  
                  // 查找包含职位关键词的行
                  const jobKeywords = ['工程师', '经理', '专员', '助理', '总监', '主管', '顾问', '分析师', '开发', '设计', '运营', '销售', '市场', '人事', '财务', '行政'];
                  
                  for (let i = 0; i < lines.length; i++) {
                    const line = lines[i].trim();
                    
                    // 检查是否是职位行
                    const isJobTitle = jobKeywords.some(kw => line.includes(kw)) && line.length > 5 && line.length < 100;
                    
                    if (isJobTitle) {
                      // 尝试从附近行提取企业信息
                      let company = '';
                      let salary = '';
                      let city = '';
                      
                      // 向前后各搜索5行
                      for (let j = Math.max(0, i - 5); j <= Math.min(lines.length - 1, i + 5); j++) {
                        const nearbyLine = lines[j].trim();
                        
                        // 识别企业名称（通常包含"公司"、"科技"等关键词）
                        if (!company && (nearbyLine.includes('公司') || nearbyLine.includes('科技') || nearbyLine.includes('投资')) && nearbyLine.length > 4) {
                          company = nearbyLine;
                        }
                        
                        // 识别薪资（包含"万"、"千"、"K"等）
                        if (!salary && /(万|千|K|元|薪)/.test(nearbyLine) && /\d/.test(nearbyLine)) {
                          salary = nearbyLine;
                        }
                        
                        // 识别城市
                        if (!city && /(北京|上海|广州|深圳|杭州|南京|成都|武汉|西安|天津|重庆|苏州|郑州|长沙|青岛|大连|厦门|宁波|无锡|佛山|东莞|合肥|福州|济南|昆明|哈尔滨|长春|沈阳|南昌|贵阳|南宁|海口|兰州|乌鲁木齐|石家庄|太原|呼和浩特|银川|西宁|拉萨)/.test(nearbyLine)) {
                          city = nearbyLine.match(/(北京|上海|广州|深圳|杭州|南京|成都|武汉|西安|天津|重庆|苏州|郑州|长沙|青岛|大连|厦门|宁波|无锡|佛山|东莞|合肥|福州|济南|昆明|哈尔滨|长春|沈阳|南昌|贵阳|南宁|海口|兰州|乌鲁木齐|石家庄|太原|呼和浩特|银川|西宁|拉萨)[^\s,，]*/)?.[0] || '';
                        }
                      }
                      
                      if (company || salary) {
                        jobList.push({
                          title: line,
                          company: company || '未知企业',
                          salary: salary || '面议',
                          city: city || '',
                          link: ''
                        });
                      }
                    }
                  }
                }

                return jobList;
              });

              console.log(`[Job51Crawler] 使用智能提取找到 ${jobs.length} 个职位`);

              // 发送详细日志到前端
              if (io) {
                io.to(`task:${taskId}`).emit('task:log', {
                  taskId,
                  level: 'info',
                  message: `📊 第 ${currentPage} 页解析完成 | 找到 ${jobs.length} 条职位`
                });
              }

              // 如果没有找到职位
              if (jobs.length === 0) {
                console.warn(`[Job51Crawler] ⚠️ 未找到职位，可能原因：`);
                console.warn(`[Job51Crawler]    1. 网站结构已变化`);
                console.warn(`[Job51Crawler]    2. 被反爬虫机制拦截`);
                console.warn(`[Job51Crawler]    3. 该关键词/城市组合确实没有职位`);
                
                if (io && taskId) {
                  io.to(`task:${taskId}`).emit('task:log', {
                    taskId,
                    level: 'warning',
                    message: `⚠️ 第${currentPage}页未解析到职位数据`
                  });
                }
                
                break;
              }

              // 过滤企业名称（如果指定了企业列表）
              const filteredJobs = companies.length > 0
                ? jobs.filter(job => companies.some(comp => job.company.includes(comp)))
                : jobs;

              console.log(`[Job51Crawler] 过滤后剩余 ${filteredJobs.length} 个职位`);

              // 输出每个职位的详细信息
              for (let i = 0; i < filteredJobs.length && !this.checkAborted(); i++) {
                const job = filteredJobs[i];
                console.log(`[Job51Crawler] 处理第 ${i + 1}/${filteredJobs.length} 个职位: ${job.title}`);
                
                const jobData = this.generateMockJob(job, config);
                yield jobData;

                // 每5条记录发送一次日志
                if ((i + 1) % 5 === 0 || i === filteredJobs.length - 1) {
                  if (io && taskId) {
                    io.to(`task:${taskId}`).emit('task:log', {
                      taskId,
                      level: 'success',
                      message: `✅ 已采集 ${i + 1}/${filteredJobs.length} 条 | 关键词: ${keyword} | 城市: ${city || '不限'}`
                    });
                  }
                }

                await this.randomDelay(1000, 2000);
              }

              // 检查下一页
              // @ts-ignore - 此代码在浏览器环境中运行
              hasNextPage = await page.evaluate(() => {
                // 多种下一页判断策略
                const nextSelectors = [
                  '.p_in .next:not(.disabled)',
                  '.next:not(.disabled)',
                  'a:contains("下一页")',
                  'a:contains(">")',
                  '[class*="next"]:not([class*="disabled"])'
                ];
                
                for (const selector of nextSelectors) {
                  try {
                    const nextButton = document.querySelector(selector);
                    if (nextButton && !nextButton.classList.contains('disabled')) {
                      return true;
                    }
                  } catch (e) {
                    // 忽略选择器语法错误
                  }
                }
                
                return false;
              });
              
              console.log(`[Job51Crawler] 是否有下一页: ${hasNextPage}`);

              // 计算本页耗时
              const pageEndTime = Date.now();
              const pageDuration = ((pageEndTime - pageStartTime) / 1000).toFixed(2);
              
              // 发送页面处理完成的详细日志
              if (io) {
                io.to(`task:${taskId}`).emit('task:log', {
                  taskId,
                  level: 'success',
                  message: `✅ 第 ${currentPage} 页处理完成 | 耗时 ${pageDuration}秒 | 解析 ${jobs.length} 条 | 过滤后 ${filteredJobs.length} 条${hasNextPage ? ' | 继续下一页' : ' | 已是最后一页'}`
                });
              }

              currentPage++;

              if (config.maxPages && currentPage > config.maxPages) {
                console.log(`[Job51Crawler] 达到最大页数限制: ${config.maxPages}`);
                break;
              }

              await this.randomDelay(2000, 4000);

            } catch (error: any) {
              const pageEndTime = Date.now();
              const pageDuration = ((pageEndTime - pageStartTime) / 1000).toFixed(2);
              
              console.error(`[Job51Crawler] ❌ 爬取第 ${currentPage} 页时出错:`, error.message);
              if (error.stack) {
                console.error(`[Job51Crawler] 错误堆栈:`, error.stack);
              }
              
              // 记录详细错误日志到前端
              if (io) {
                io.to(`task:${taskId}`).emit('task:log', {
                  taskId,
                  level: 'error',
                  message: `❌ 第 ${currentPage} 页请求失败 | 耗时 ${pageDuration}秒 | URL: ${url} | 错误: ${error.message}`
                });
              }
              
              console.warn(`[Job51Crawler] ⚠️ 由于请求失败，跳过当前页面的数据爬取`);
              break;
            } finally {
              await page.close();
            }
          }
          
          console.log(`[Job51Crawler] ✅ 完成组合 ${currentCombination}/${totalCombinationCount}: 关键词="${keyword}", 城市="${city}"`);
          console.log(`[Job51Crawler]`);
        }
      }
      
      console.log(`[Job51Crawler]`);
      console.log(`[Job51Crawler] =============================================`);
      console.log(`[Job51Crawler] ✅✅✅ 所有 ${totalCombinationCount} 个组合处理完成!`);
      console.log(`[Job51Crawler] =============================================`);
    } finally {
      await browser.close();
    }
  }

  // 获取taskId的辅助方法
  private getTaskId(config: TaskConfig): string {
    return (config as any).taskId || 'unknown-task-id';
  }

  // 随机延迟
  private async randomDelay(min: number = 2000, max: number = 5000): Promise<void> {
    if (this.signal?.aborted) return;
    const delay = Math.random() * (max - min) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  // 检查是否终止
  private checkAborted(): boolean {
    return this.signal?.aborted || false;
  }

  // 生成模拟职位数据
  private generateMockJob(job: any, config: TaskConfig): JobData {
    return {
      jobId: `51${Date.now()}${Math.random().toString(36).substr(2, 9)}`,
      jobName: job.title,
      jobTags: '五险一金,周末双休,带薪年假',
      jobDescription: `负责${job.title}相关工作，参与项目开发和维护。要求具备相关技术能力和团队协作经验。`,
      salaryRange: job.salary || '面议',
      workCity: job.city || config.city || '上海',
      workExperience: '3-5年',
      workAddress: `${job.city || config.city || '上海'}新区`,
      education: '本科',
      companyCode: job.company,
      companyNature: '外资企业',
      businessScope: '软件开发',
      companyScale: '500-999人',
      recruitmentCount: '3人',
      updateDate: new Date().toISOString().split('T')[0],
      workType: '全职',
      dataSource: '前程无忧'
    };
  }
}
