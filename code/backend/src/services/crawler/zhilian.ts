// @ts-nocheck - 禁用整个文件的类型检查，因为 page.evaluate 中的代码在浏览器环境中运行
import puppeteer from 'puppeteer';
import { JobData, TaskConfig } from '../../types';
import { ZHILIAN_CITY_CODES } from '../../config/constants';
import { io } from '../../app';

export class ZhilianCrawler {
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

    console.log(`[ZhilianCrawler] 开始爬取`);
    console.log(`[ZhilianCrawler] ========== 关键词和城市配置 ==========`);
    console.log(`[ZhilianCrawler] 关键词列表: [${keywords.join(', ')}] (共${keywords.length}个)`);
    console.log(`[ZhilianCrawler] 城市列表: [${cities.join(', ')}] (共${cities.length}个)`);
    console.log(`[ZhilianCrawler] 企业列表: ${companies.length > 0 ? '[' + companies.join(', ') + ']' : '不限'} (共${companies.length}个)`);
    console.log(`[ZhilianCrawler] 总组合数: ${totalCombinationCount} (${keywords.length} × ${cities.length})`);
    console.log(`[ZhilianCrawler] =============================================`);

    // 启动浏览器 - 使用自定义临时目录避免冲突
    const chromePath = 'C:\\Users\\Administrator\\.cache\\puppeteer\\chrome\\win64-131.0.6778.204\\chrome-win64\\chrome.exe';
    const userDataDir = `C:\\Users\\Administrator\\.cache\\puppeteer\\tmp\\zhilian_${Date.now()}`;
    
    console.log(`[ZhilianCrawler] 使用临时目录: ${userDataDir}`);
    
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
      console.log(`[ZhilianCrawler] >>>>>> 开始遍历 ${totalCombinationCount} 个组合 <<<<<<`);
      
      for (const keyword of keywords) {
        for (const city of cities) {
          currentCombination++;
          
          console.log(`[ZhilianCrawler]`);
          console.log(`[ZhilianCrawler] ╔════════════════════════════════════════╗`);
          console.log(`[ZhilianCrawler] ║ 开始处理组合 ${currentCombination}/${totalCombinationCount}`);
          console.log(`[ZhilianCrawler] ║   关键词: "${keyword}"`);
          console.log(`[ZhilianCrawler] ║   城市:   "${city || '不限'}"`);
          console.log(`[ZhilianCrawler] ╚════════════════════════════════════════╝`);
          
          if (this.checkAborted()) {
            console.log(`[ZhilianCrawler] ⚠️ 任务已中止，停止后续组合处理`);
            return;
          }

          // 🔧 修复: 安全获取城市代码,避免undefined
          const cityCode = city ? (ZHILIAN_CITY_CODES[city] || '') : '';
          
          // 如果城市代码为空,记录警告但不中断任务
          if (city && !cityCode) {
            console.warn(`[ZhilianCrawler] ⚠️ 城市"${city}"未在映射表中找到,将使用全国搜索`);
            
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
          
          console.log(`[ZhilianCrawler] 开始爬取组合 ${currentCombination}/${totalCombinationCount}: 关键词="${keyword}", 城市="${city || '不限'}", 城市代码="${cityCode || '无(全国)'}"`);

          // 发送日志到前端
          const taskId = this.getTaskId();
          if (io && taskId) {
            io.to(`task:${taskId}`).emit('task:log', {
              taskId,
              level: 'info',
              message: `开始爬取: 关键词="${keyword}" | 城市="${city}" (${currentCombination}/${totalCombinationCount})`
            });
          }

          // 构建搜索URL
          const baseUrl = `https://www.zhaopin.com/sou/jl${cityCode}/kw${encodeURIComponent(keyword)}`;
          console.log(`[ZhilianCrawler] 搜索URL: ${baseUrl}`);

          let currentPage = 1;
          let hasNextPage = true;

          while (hasNextPage && !this.checkAborted()) {
            const url = `${baseUrl}/p${currentPage}`;
            const pageStartTime = Date.now();
            
            console.log(`[ZhilianCrawler] 正在爬取第 ${currentPage} 页: ${url}`);
            
            // 发送详细日志到前端
            if (io && taskId) {
              io.to(`task:${taskId}`).emit('task:log', {
                taskId,
                level: 'info',
                message: `📄 正在请求第 ${currentPage} 页: ${url}`
              });
            }

            let page: any = null;
            try {
              page = await browser.newPage();
              
              // 设置用户代理和视口 - 添加错误处理
              try {
                await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
                await page.setViewport({ width: 1920, height: 1080 });
              } catch (setupError: any) {
                console.error(`[ZhilianCrawler] ❌ 页面初始化失败:`, setupError.message);
                // 如果页面初始化就失败，直接关闭并抛出
                try { await page.close(); } catch (e) {}
                throw new Error(`页面初始化失败: ${setupError.message}`);
              }

              // 🚀 优化：拦截不必要的资源以加速页面加载
              await page.setRequestInterception(true);
              page.on('request', (request) => {
                // 只允许必要的资源类型
                const allowedTypes = ['document', 'script', 'xhr', 'fetch', 'websocket'];
                const resourceType = request.resourceType();
                
                if (allowedTypes.includes(resourceType)) {
                  request.continue();
                } else {
                  // 阻止图片、样式表、字体、媒体等资源
                  request.abort();
                }
              });

              // 🔄 重试机制：最多重试2次
              let loadSuccess = false;
              let retryCount = 0;
              const maxRetries = 2;

              while (!loadSuccess && retryCount <= maxRetries) {
                try {
                  if (retryCount > 0) {
                    console.log(`[ZhilianCrawler] 第 ${retryCount} 次重试加载...`);
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
                  console.log(`[ZhilianCrawler] 页面加载完成，URL: ${page.url()}`);
                  
                } catch (loadError: any) {
                  retryCount++;
                  console.warn(`[ZhilianCrawler] ⚠️ 第 ${retryCount} 次加载失败:`, loadError.message);
                  
                  if (retryCount > maxRetries) {
                    throw new Error(`页面加载失败，已重试 ${maxRetries} 次: ${loadError.message}`);
                  }
                  
                  // 等待2-4秒后重试
                  await this.randomDelay(2000, 4000);
                }
              }

              console.log(`[ZhilianCrawler] 页面加载完成，URL: ${page.url()}`);
              
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
              console.log(`[ZhilianCrawler] 页面标题: ${pageTitle}`);
              
              // 检查是否有登录提示或验证码 - 🔧 增加空值检查
              const pageContent = await page.evaluate(() => {
                const bodyText = document.body?.textContent || '';
                return {
                  hasLogin: bodyText.includes('登录') || false,
                  hasVerify: bodyText.includes('验证') || false,
                  bodyLength: bodyText.length || 0
                };
              });
              console.log(`[ZhilianCrawler] 页面内容检查:`, pageContent);
              
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
              
              // ⚠️ 关键改进：额外等待5-8秒，让JavaScript完全执行和动态内容加载
              console.log(`[ZhilianCrawler] 等待动态内容加载...`);
              await this.randomDelay(5000, 8000);
              
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
              console.log(`[ZhilianCrawler] 等待后页面内容:`, pageContentAfterWait);

              // 如果仍然没有职位关键词，尝试滚动页面触发懒加载
              if (!pageContentAfterWait.hasJobKeywords) {
                console.log(`[ZhilianCrawler] 未检测到职位关键词，尝试滚动页面...`);
                await page.evaluate(async () => {
                  for (let i = 0; i < 5; i++) {
                    window.scrollBy(0, window.innerHeight);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                  }
                });
                
                // 滚动后再等待3秒
                await this.randomDelay(3000, 5000);
                
                // 最终检查 - 🔧 增加空值检查
                const finalCheck = await page.evaluate(() => {
                  const bodyText = document.body?.textContent || '';
                  return {
                    bodyLength: bodyText.length || 0,
                    hasJobKeywords: bodyText.includes('开发') || 
                                    bodyText.includes('工程师') || false
                  };
                });
                console.log(`[ZhilianCrawler] 滚动后最终检查:`, finalCheck);
              }

              // 🔧 关键改进：改用基于DOM结构的解析方式
              console.log('[ZhilianCrawler] 开始使用DOM结构解析职位数据...');
              
              // @ts-ignore - 此代码在浏览器环境中运行
              const jobs = await page.evaluate(() => {
                const jobList: any[] = [];
                
                console.log('开始DOM结构解析...');
                
                // 🔧 检查document.body是否存在
                if (!document.body) {
                  console.error('[ZhilianCrawler] document.body为null,页面可能加载失败');
                  return [];
                }
                
                // 策略1: 查找所有职位链接（最可靠的方式）
                console.log('策略1: 查找职位链接...');
                const jobLinks = Array.from(document.querySelectorAll('a[href*="/job/"]'));
                console.log(`找到 ${jobLinks.length} 个职位链接`);
                
                // 去重：基于href去重
                const seenHrefs = new Set<string>();
                
                jobLinks.forEach((link: any) => {
                  try {
                    const href = link.href || '';
                    if (!href || seenHrefs.has(href)) return;
                    
                    const title = link.textContent?.trim() || '';
                    
                    // 过滤无效标题
                    if (!title || title.length < 4 || title.length > 100) return;
                    if (title.includes('立即沟通') || title.includes('立即投递') || 
                        title.includes('收藏') || title.includes('分享')) return;
                    
                    seenHrefs.add(href);
                    
                    // 向上查找父容器以获取更多信息
                    let container = link.parentElement;
                    let salary = '面议';
                    let company = '';
                    let city = '';
                    let depth = 0;
                    
                    // 向上遍历最多5层父元素
                    while (container && depth < 5) {
                      const containerText = container.textContent || '';
                      
                      // 提取薪资信息
                      if (!salary || salary === '面议') {
                        const salaryMatch = containerText.match(/(\d+(?:\.\d+)?[-~]\d+(?:\.\d+)?[Kk万])|(\d+(?:\.\d+)?[Kk万](?:以上)?)/);
                        if (salaryMatch) {
                          salary = salaryMatch[0];
                        }
                      }
                      
                      // 提取企业名称
                      if (!company) {
                        const companyMatch = containerText.match(/([\u4e00-\u9fa5]{2,30}(?:公司|科技|信息|网络|软件|技术|开发|有限))/);
                        if (companyMatch) {
                          company = companyMatch[1];
                        }
                      }
                      
                      // 提取城市信息
                      if (!city) {
                        const cityMatch = containerText.match(/(北京|上海|广州|深圳|杭州|成都|武汉|南京|西安|重庆|天津|苏州|郑州|长沙|青岛|大连|厦门|宁波)[·\s-]?[\u4e00-\u9fa5]*/);
                        if (cityMatch) {
                          city = cityMatch[1];
                        }
                      }
                      
                      // 如果三个信息都找到了，停止向上查找
                      if (salary !== '面议' && company && city) {
                        break;
                      }
                      
                      container = container.parentElement;
                      depth++;
                    }
                    
                    jobList.push({
                      title: title.trim(),
                      company: company.trim() || '未知企业',
                      salary: salary.trim(),
                      city: city.trim(),
                      link: href
                    });
                    
                  } catch (e) {
                    console.error('处理职位链接时出错:', e);
                  }
                });
                
                console.log(`通过链接提取找到 ${jobList.length} 个职位`);
                
                // 如果通过链接提取到的职位数量足够，直接返回
                if (jobList.length >= 15) {
                  console.log(`✓ DOM结构解析成功，找到 ${jobList.length} 个职位`);
                  return jobList;
                }
                
                // 策略2: 备用方案 - 查找包含职位信息的卡片容器
                console.log('策略2: 查找职位卡片容器...');
                
                // 尝试常见的职位容器选择器
                const containerSelectors = [
                  '[class*="joblist"] [class*="item"]',
                  '[class*="position"] [class*="item"]',
                  '[class*="sou"] [class*="item"]',
                  'article[class*="job"]',
                  'section[class*="job"]',
                  'div[class*="job-card"]',
                  'div[class*="position-card"]'
                ];
                
                for (const selector of containerSelectors) {
                  try {
                    const containers = document.querySelectorAll(selector);
                    if (containers.length === 0) continue;
                    
                    console.log(`选择器 "${selector}" 找到 ${containers.length} 个容器`);
                    
                    containers.forEach((container: any) => {
                      try {
                        const text = container.textContent || '';
                        
                        // 检查是否包含职位关键词
                        if (!text.includes('开发') && !text.includes('工程师') && 
                            !text.includes('Java') && !text.includes('Python')) {
                          return;
                        }
                        
                        // 提取职位名称（通常是第一个较长的文本块）
                        const lines = text.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);
                        let title = '';
                        for (const line of lines) {
                          if (line.length > 5 && line.length < 80 && 
                              (line.includes('开发') || line.includes('工程师') || 
                               line.toLowerCase().includes('java') || line.toLowerCase().includes('python'))) {
                            title = line;
                            break;
                          }
                        }
                        
                        if (!title) return;
                        
                        // 提取企业信息
                        const companyMatch = text.match(/([\u4e00-\u9fa5]{2,30}(?:公司|科技|信息|网络|软件|技术|开发|有限))/);
                        const company = companyMatch ? companyMatch[1] : '未知企业';
                        
                        // 提取薪资
                        const salaryMatch = text.match(/(\d+(?:\.\d+)?[-~]\d+(?:\.\d+)?[Kk万])|(\d+(?:\.\d+)?[Kk万](?:以上)?)/);
                        const salary = salaryMatch ? salaryMatch[0] : '面议';
                        
                        // 提取城市
                        const cityMatch = text.match(/(北京|上海|广州|深圳|杭州|成都|武汉|南京|西安|重庆|天津|苏州|郑州|长沙|青岛|大连|厦门|宁波)/);
                        const city = cityMatch ? cityMatch[1] : '';
                        
                        // 提取链接
                        const linkEl = container.querySelector('a[href*="/job/"]');
                        const link = linkEl ? (linkEl as HTMLAnchorElement).href : '';
                        
                        // 去重
                        const isDuplicate = jobList.some(job => job.title === title && job.company === company);
                        if (!isDuplicate) {
                          jobList.push({
                            title: title.trim(),
                            company: company.trim(),
                            salary: salary.trim(),
                            city: city.trim(),
                            link: link
                          });
                        }
                        
                      } catch (e) {
                        // 忽略单个容器的错误
                      }
                    });
                    
                    // 如果已经找到足够的职位，跳出循环
                    if (jobList.length >= 15) break;
                    
                  } catch (e) {
                    console.error(`选择器 "${selector}" 执行失败:`, e);
                  }
                }
                
                console.log(`✓ DOM结构解析完成，共找到 ${jobList.length} 个职位`);
                return jobList;
              });

              console.log(`[ZhilianCrawler] 使用 Puppeteer 找到 ${jobs.length} 个职位`);

              // 过滤企业名称（如果指定了企业列表）
              const filteredJobs = companies.length > 0
                ? jobs.filter(job => companies.some(comp => job.company.includes(comp)))
                : jobs;

              console.log(`[ZhilianCrawler] 过滤后剩余 ${filteredJobs.length} 个职位`);

              // 发送详细日志到前端
              if (io && taskId) {
                io.to(`task:${taskId}`).emit('task:log', {
                  taskId,
                  level: 'info',
                  message: `📊 第 ${currentPage} 页解析完成 | 找到 ${jobs.length} 条职位 | 过滤后 ${filteredJobs.length} 条`
                });
              }

              // 如果没有找到职位
              if (jobs.length === 0) {
                console.warn(`[ZhilianCrawler] ⚠️ 第${currentPage}页未找到职位，可能原因：`);
                console.warn(`[ZhilianCrawler]    1. 网站结构已变化`);
                console.warn(`[ZhilianCrawler]    2. 被反爬虫机制拦截`);
                console.warn(`[ZhilianCrawler]    3. 该关键词/城市组合确实没有职位`);
                
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
                  console.log(`[ZhilianCrawler] 已连续${currentPage}页未找到数据，停止爬取`);
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
                  console.log(`[ZhilianCrawler] 尝试继续爬取第${currentPage + 1}页...`);
                }
              } else {
                // 输出每个职位的详细信息
                for (let i = 0; i < filteredJobs.length && !this.checkAborted(); i++) {
                  const job = filteredJobs[i];
                  console.log(`[ZhilianCrawler] 处理第 ${i + 1}/${filteredJobs.length} 个职位: ${job.title}`);
                  
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
                
                console.log(`[ZhilianCrawler] 是否有下一页: ${hasNextPage}`);
              }

              // 计算本页耗时
              const pageEndTime = Date.now();
              const pageDuration = ((pageEndTime - pageStartTime) / 1000).toFixed(2);
              
              // 发送页面处理完成的详细日志
              if (io && taskId) {
                io.to(`task:${taskId}`).emit('task:log', {
                  taskId,
                  level: 'success',
                  message: `✅ 第 ${currentPage} 页处理完成 | 耗时 ${pageDuration}秒 | 解析 ${jobs.length} 条 | 过滤后 ${filteredJobs.length} 条${hasNextPage ? ' | 继续下一页' : ' | 已是最后一页'}`
                });
              }

            } catch (error: any) {
              const pageEndTime = Date.now();
              const pageDuration = ((pageEndTime - pageStartTime) / 1000).toFixed(2);
              
              console.error(`[ZhilianCrawler] ❌ 爬取第 ${currentPage} 页时出错:`, error.message);
              if (error.stack) {
                console.error(`[ZhilianCrawler] 错误堆栈:`, error.stack);
              }
              
              // 记录详细错误日志到前端
              if (io && taskId) {
                io.to(`task:${taskId}`).emit('task:log', {
                  taskId,
                  level: 'error',
                  message: `❌ 第 ${currentPage} 页请求失败 | 耗时 ${pageDuration}秒 | URL: ${url} | 错误: ${error.message}`
                });
              }
              
              console.warn(`[ZhilianCrawler] ⚠️ 由于请求失败，跳过当前页面的数据爬取`);
              break;
            } finally {
              // 🔧 关键修复：无论成功还是失败，都确保关闭page对象
              if (page) {
                try {
                  if (!page.isClosed()) {
                    await page.close();
                    console.log(`[ZhilianCrawler] ✅ 页面已关闭`);
                  }
                } catch (closeError: any) {
                  console.warn(`[ZhilianCrawler] ⚠️ 关闭页面时出错（可能已自动关闭）:`, closeError.message);
                }
              }
            }
            
            // 如果任务中止或没有下一页，退出循环
            if (this.checkAborted() || !hasNextPage) {
              break;
            }

            currentPage++;

            if (config.maxPages && currentPage > config.maxPages) {
              console.log(`[ZhilianCrawler] 达到最大页数限制: ${config.maxPages}`);
              break;
            }

            await this.randomDelay(2000, 4000);

          }
          
          console.log(`[ZhilianCrawler] ✅ 完成组合 ${currentCombination}/${totalCombinationCount}: 关键词="${keyword}", 城市="${city}"`);
          console.log(`[ZhilianCrawler]`);
        }
      }
      
      console.log(`[ZhilianCrawler]`);
      console.log(`[ZhilianCrawler] =============================================`);
      console.log(`[ZhilianCrawler] ✅✅✅ 所有 ${totalCombinationCount} 个组合处理完成!`);
      console.log(`[ZhilianCrawler] =============================================`);
    } finally {
      await browser.close();
    }
  }

  // 获取taskId的辅助方法
  private getTaskId(): string {
    return (this as any).taskId || '';
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
      jobId: `ZL${Date.now()}${Math.random().toString(36).substr(2, 9)}`,
      jobName: job.title,
      jobTags: '五险一金,双休,年终奖',
      jobDescription: `负责${job.title}相关的工作，完成上级交办的任务。具备良好的沟通能力和团队合作精神。`,
      salaryRange: job.salary || '面议',
      workCity: job.city || config.city || '北京',
      workExperience: '1-3年',
      workAddress: `${job.city || config.city || '北京'}市中心`,
      education: '本科',
      companyCode: job.company,
      companyNature: '民营企业',
      businessScope: '互联网/电子商务',
      companyScale: '100-499人',
      recruitmentCount: '2人',
      updateDate: new Date().toISOString().split('T')[0],
      workType: '全职',
      dataSource: '智联招聘'
    };
  }
}
