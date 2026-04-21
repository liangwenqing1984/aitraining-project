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

              // 🔧 关键改进：多策略DOM解析职位数据
              console.log('[ZhilianCrawler] 开始使用多策略DOM解析职位数据...');
              
              // @ts-ignore - 此代码在浏览器环境中运行
              const jobs = await page.evaluate(() => {
                const jobList: any[] = [];
                
                console.log('开始DOM结构解析...');
                
                // 🔧 检查document.body是否存在
                if (!document.body) {
                  console.error('[ZhilianCrawler] document.body为null,页面可能加载失败');
                  return [];
                }
                
                // ========== 策略1: 从 jobinfo 标签中提取（如果存在）==========
                console.log('策略1: 查找 jobinfo 标签...');
                const jobInfoElements = Array.from(document.querySelectorAll('jobinfo'));
                console.log(`找到 ${jobInfoElements.length} 个 jobinfo 标签`);
                
                if (jobInfoElements.length > 0) {
                  const seenTitles = new Set<string>();
                  
                  jobInfoElements.forEach((jobInfo: any) => {
                    try {
                      const titleEl = jobInfo.querySelector('.jobname a, .job-name, [class*="jobname"] a, a[href*="/job/"]');
                      const title = titleEl ? (titleEl.textContent || '').trim() : '';
                      
                      if (!title || title.length < 4 || title.length > 100) return;
                      if (title.includes('立即沟通') || title.includes('立即投递')) return;
                      if (seenTitles.has(title)) return;
                      seenTitles.add(title);
                      
                      const companyEl = jobInfo.querySelector('.company a, .company-name, [class*="company"] a');
                      const company = companyEl ? (companyEl.textContent || '').trim() : '未知企业';
                      
                      const salaryEl = jobInfo.querySelector('.salary, [class*="salary"], .zp-salary');
                      const salary = salaryEl ? (salaryEl.textContent || '').trim() : '面议';
                      
                      const cityEl = jobInfo.querySelector('.city a, .work-city, [class*="city"]');
                      const cityText = cityEl ? (cityEl.textContent || '').trim() : '';
                      const cityMatch = cityText.match(/(北京|上海|广州|深圳|杭州|成都|武汉|南京|西安|重庆|天津|苏州|郑州|长沙|青岛|大连|厦门|宁波|哈尔滨)/);
                      const city = cityMatch ? cityMatch[1] : '';
                      
                      const linkEl = jobInfo.querySelector('a[href*="/job/"]');
                      const link = linkEl ? (linkEl as HTMLAnchorElement).href : '';
                      
                      jobList.push({ title, company, salary, city, link });
                    } catch (e) {
                      console.error('处理 jobinfo 元素时出错:', e);
                    }
                  });
                  
                  console.log(`✓ 通过 jobinfo 标签提取到 ${jobList.length} 个职位`);
                  if (jobList.length >= 15) {
                    return jobList;
                  }
                }
                
                // ========== 策略2: 查找职位卡片容器（常见选择器）==========
                console.log('策略2: 查找职位卡片容器...');
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
                
                let foundCards = false;
                for (const selector of cardSelectors) {
                  try {
                    const cards = document.querySelectorAll(selector);
                    console.log(`  尝试选择器 "${selector}": 找到 ${cards.length} 个元素`);
                    
                    if (cards.length > 0 && cards.length <= 50) {
                      foundCards = true;
                      const seenTitles = new Set<string>();
                      
                      cards.forEach((card: any) => {
                        try {
                          // ✅ 优先使用智联招聘实际的CSS类名
                          const titleEl = card.querySelector('.jobinfo__name, .job-name, .job-title, [class*="jobname"] a, a[href*="/job/"]');
                          if (!titleEl) return;
                          
                          const title = (titleEl.textContent || '').trim();
                          if (!title || title.length < 4 || title.length > 100) return;
                          if (title.includes('立即沟通') || title.includes('收藏')) return;
                          if (seenTitles.has(title)) return;
                          seenTitles.add(title);
                          
                          // ✅ 提取企业信息 - 使用正确的选择器
                          const companyEl = card.querySelector('.companyinfo__name, .company-name, .cname, [class*="company"]');
                          const company = companyEl ? (companyEl.textContent || '').trim() : '未知企业';
                          
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
                          
                          jobList.push({ title, company, salary, city, link });
                        } catch (e) {
                          // 忽略单个卡片错误
                        }
                      });
                      
                      console.log(`  ✓ 通过选择器 "${selector}" 提取到 ${jobList.length} 个职位`);
                      if (jobList.length >= 15) {
                        break;
                      }
                    }
                  } catch (e) {
                    console.log(`  ✗ 选择器 "${selector}" 失败`);
                  }
                }
                
                if (jobList.length >= 15) {
                  console.log(`✓ DOM结构解析成功，找到 ${jobList.length} 个职位`);
                  return jobList;
                }
                
                // ========== 策略3: 基于职位链接提取（最可靠）==========
                console.log('策略3: 基于职位链接提取...');
                const jobLinks = Array.from(document.querySelectorAll('a[href*="/jobdetail/"], a[href*="/job/"]'));
                console.log(`找到 ${jobLinks.length} 个职位链接`);
                
                const seenHrefs = new Set<string>();
                const seenTitles = new Set<string>();
                let duplicateCount = 0;
                
                jobLinks.forEach((link: any) => {
                  try {
                    const href = link.href || '';
                    if (!href || seenHrefs.has(href)) return;
                    
                    const title = (link.textContent || '').trim();
                    
                    // 过滤无效标题
                    if (!title || title.length < 4 || title.length > 100) return;
                    if (title.includes('立即沟通') || title.includes('立即投递') || 
                        title.includes('收藏') || title.includes('分享')) return;
                    
                    // 去重检查
                    if (seenHrefs.has(href) || seenTitles.has(title)) {
                      duplicateCount++;
                      return;
                    }
                    
                    seenHrefs.add(href);
                    seenTitles.add(title);
                    
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
                
                console.log(`通过链接提取找到 ${jobList.length} 个职位（去重${duplicateCount}个重复项）`);
                
                // 🔧 调试日志：输出前5个职位的详细信息
                if (jobList.length > 0) {
                  console.log('前5个职位详情:');
                  jobList.slice(0, 5).forEach((job, idx) => {
                    console.log(`  ${idx + 1}. ${job.title.substring(0, 40)} | ${job.company.substring(0, 20)} | ${job.salary}`);
                  });
                } else {
                  console.warn('⚠️ 所有策略均未找到职位，请检查页面结构或反爬机制');
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
                // ✅ 优化：使用并发控制加速详情页抓取
                const concurrency = config.concurrency || 1; // 默认串行（兼容旧配置）
                console.log(`[ZhilianCrawler] 🚀启用并发模式: 并发数=${concurrency}, 总职位数=${filteredJobs.length}`);
                
                if (concurrency <= 1) {
                  // 串行模式（原有逻辑）
                  for (let i = 0; i < filteredJobs.length && !this.checkAborted(); i++) {
                    const job = filteredJobs[i];
                    console.log(`[ZhilianCrawler] 处理第 ${i + 1}/${filteredJobs.length} 个职位: ${job.title}`);
                    
                    // ✅ 关键修复：访问职位详情页获取完整信息
                    let jobData;
                    if (job.link) {
                      try {
                        console.log(`[ZhilianCrawler] 📄 正在访问详情页: ${job.link.substring(0, 80)}...`);
                        jobData = await this.fetchJobDetail(browser, job.link, job);
                        console.log(`[ZhilianCrawler] ✅ 成功获取详情页数据 - 公司: ${jobData.companyName}, 经验: ${jobData.workExperience}, 学历: ${jobData.education}`);
                      } catch (error: any) {
                        console.error(`[ZhilianCrawler] ❌ 获取职位详情失败: ${error.message}，使用基本信息（字段将为空）`);
                        // 如果详情页抓取失败，降级使用基本信息（但字段为空，不编造）
                        jobData = this.generateBasicJob(job, config);
                      }
                    } else {
                      console.warn(`[ZhilianCrawler] ⚠️ 职位没有链接，使用基本信息`);
                      // 没有链接时使用基本信息
                      jobData = this.generateBasicJob(job, config);
                    }
                    
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
                } else {
                  // ✅ 并发模式：分批处理
                  const batchSize = concurrency;
                  for (let batchStart = 0; batchStart < filteredJobs.length && !this.checkAborted(); batchStart += batchSize) {
                    const batchEnd = Math.min(batchStart + batchSize, filteredJobs.length);
                    const batch = filteredJobs.slice(batchStart, batchEnd);
                    
                    console.log(`[ZhilianCrawler] 🔄 处理批次 ${Math.floor(batchStart / batchSize) + 1}: 职位 ${batchStart + 1}-${batchEnd}/${filteredJobs.length}`);
                    
                    // 并发处理当前批次
                    const batchPromises = batch.map(async (job, indexInBatch) => {
                      const globalIndex = batchStart + indexInBatch + 1;
                      
                      if (this.checkAborted()) {
                        return null;
                      }
                      
                      console.log(`[ZhilianCrawler] [${globalIndex}/${filteredJobs.length}] 开始抓取: ${job.title}`);
                      
                      let jobData;
                      if (job.link) {
                        try {
                          jobData = await this.fetchJobDetail(browser, job.link, job);
                          console.log(`[ZhilianCrawler] [${globalIndex}/${filteredJobs.length}] ✅ 成功 - ${jobData.companyName}`);
                        } catch (error: any) {
                          console.error(`[ZhilianCrawler] [${globalIndex}/${filteredJobs.length}] ❌ 失败: ${error.message}`);
                          jobData = this.generateBasicJob(job, config);
                        }
                      } else {
                        console.warn(`[ZhilianCrawler] [${globalIndex}/${filteredJobs.length}] ⚠️ 无链接`);
                        jobData = this.generateBasicJob(job, config);
                      }
                      
                      return jobData;
                    });
                    
                    // 等待当前批次完成
                    const batchResults = await Promise.all(batchPromises);
                    
                    // 按顺序yield结果（过滤掉null）
                    for (const result of batchResults) {
                      if (result) {
                        yield result;
                      }
                    }
                    
                    // 批次间延迟，避免被封
                    if (batchEnd < filteredJobs.length) {
                      console.log(`[ZhilianCrawler] ⏱️ 批次间延迟 2-3秒...`);
                      await this.randomDelay(2000, 3000);
                    }
                    
                    // 发送进度日志
                    if (io && taskId) {
                      io.to(`task:${taskId}`).emit('task:log', {
                        taskId,
                        level: 'success',
                        message: `✅ 已采集 ${batchEnd}/${filteredJobs.length} 条 | 关键词: ${keyword} | 城市: ${city || '不限'}`
                      });
                    }
                  }
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

  // ✅ 优化：访问职位详情页获取完整信息（复用浏览器实例）
  private async fetchJobDetail(browser: any, jobUrl: string, basicInfo: any): Promise<JobData> {
    let page;
    try {
      // 创建新标签页（而不是新浏览器）
      page = await browser.newPage();
      await page.setViewport({ width: 1920, height: 1080 });
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
      
      // 导航到详情页
      await page.goto(jobUrl, { 
        waitUntil: 'networkidle2',
        timeout: 15000 
      });
      
      // 等待动态内容加载
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 提取职位详情
      const detail = await page.evaluate(() => {
        const result: any = {};
        
        // ✅ 职位名称 - 从 summary-planes__title 中提取
        const titleEl = document.querySelector('.summary-planes__title');
        result.title = titleEl ? titleEl.textContent.trim() : '';
        
        // ✅ 薪资 - 从 summary-planes__salary 中提取
        const salaryEl = document.querySelector('.summary-planes__salary');
        result.salary = salaryEl ? salaryEl.textContent.trim() : '';
        
        // ✅ 城市 - 从 workCity-link 中提取
        const cityEl = document.querySelector('.workCity-link');
        if (cityEl) {
          result.city = cityEl.textContent.trim();
        }
        
        // ✅ 区域 - 从 summary-planes__info 第一个li的span中提取
        const areaEl = document.querySelector('.summary-planes__info li span');
        result.area = areaEl ? areaEl.textContent.trim() : '';
        
        // ✅ 工作经验、学历、工作性质、招聘人数 - 从 summary-planes__info 中提取
        const infoItems = Array.from(document.querySelectorAll('.summary-planes__info li'));
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
            const match = text.match(/招(\d+)人/);
            if (match) {
              result.recruitmentCount = match[1] + '人';
            }
          }
        });
        
        // ✅ 职位描述 - 从 describtion-card__detail-content 中提取
        const descEl = document.querySelector('.describtion-card__detail-content');
        if (descEl) {
          // 将<br>替换为换行符，然后清理HTML标签
          let description = descEl.innerHTML.replace(/<br\s*\/?>/gi, '\n');
          // 移除所有HTML标签
          description = description.replace(/<[^>]+>/g, '');
          // 清理多余空白
          description = description.replace(/\s+/g, ' ').trim();
          result.description = description;
        }
        
        // ✅ 工作地址 - 从 address-info__bubble 中提取
        const addressEl = document.querySelector('.address-info__bubble');
        if (addressEl) {
          result.address = (addressEl.textContent || '').trim();
        }
        
        // ✅ 公司名称 - 从 company-info__name 中提取（关键修复）
        const companyEl = document.querySelector('.company-info__name');
        if (companyEl) {
          result.company = (companyEl.textContent || '').trim();
        }
        
        // ✅ 公司信息 - 从 company-info__desc 中提取（融资状态 · 规模 · 行业）
        const companyDescEl = document.querySelector('.company-info__desc');
        if (companyDescEl) {
          const companyText = (companyDescEl.textContent || '').trim();
          // 解析：未融资 · 500-999人 · 计算机软件、IT服务
          const parts = companyText.split('·').map(p => p.trim());
          if (parts.length >= 1) {
            result.companyNature = parts[0]; // 融资状态/公司性质
          }
          if (parts.length >= 2) {
            result.companyScale = parts[1];  // 公司规模
          }
          if (parts.length >= 3) {
            result.businessScope = parts.slice(2).join(', '); // 经营范围
          }
        }
        
        // ✅ 岗位更新日期 - 从 summary-planes__time 中提取
        const updateEl = document.querySelector('.summary-planes__time');
        if (updateEl) {
          const updateTimeText = updateEl.textContent.trim();
          // 提取"更新于 今天"、"更新于 3天前"等
          const timeMatch = updateTimeText.match(/更新于\s*(.+)/);
          if (timeMatch) {
            result.updateDateText = timeMatch[1].trim();
          }
        }
        
        // ✅ 职位标签/技能要求 - 从 describtion-card__skills-item 中提取
        const skillItems = Array.from(document.querySelectorAll('.describtion-card__skills-item'));
        if (skillItems.length > 0) {
          result.jobTags = skillItems.map((item: any) => item.textContent.trim()).join(',');
        }
        
        return result;
      });
      
      // 关闭当前标签页（不是浏览器）
      await page.close();
      
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
      return {
        companyName: detail.company || basicInfo.company || '',  // 优先使用详情页的公司名称
        jobId: `ZL${Date.now()}${Math.random().toString(36).substr(2, 9)}`,
        jobName: detail.title || basicInfo.title,
        jobCategory: '',  // ✅ 不再使用硬编码，留空或从其他来源获取
        jobTags: detail.jobTags || '',  // ✅ 使用真实的职位标签
        jobDescription: detail.description || '',  // ✅ 使用真实的职位描述
        salaryRange: detail.salary || basicInfo.salary || '',
        workCity: detail.city || basicInfo.city || '',
        workExperience: detail.experience || '',  // ✅ 使用真实的工作经验
        workAddress: detail.address || `${detail.city || ''}${detail.area || ''}` || '',  // ✅ 使用真实的工作地址
        education: detail.education || '',  // ✅ 使用真实的学历要求
        companyCode: '',  // 智联招聘不提供公司代码
        companyNature: detail.companyNature || '',  // ✅ 使用真实性质（如"未融资"）
        businessScope: detail.businessScope || '',  // ✅ 使用真实经营范围
        companyScale: detail.companyScale || '',  // ✅ 使用真实规模
        recruitmentCount: detail.recruitmentCount || '',  // ✅ 使用真实招聘人数
        updateDate: updateDate,  // ✅ 使用转换后的真实日期
        workType: detail.workType || '',  // ✅ 使用真实工作性质
        dataSource: '智联招聘'
      };
      
    } catch (error: any) {
      console.error(`[ZhilianCrawler] 抓取职位详情时出错: ${error.message}`);
      // 确保页面被关闭
      if (page) {
        try {
          await page.close();
        } catch (e) {
          // 忽略关闭错误
        }
      }
      throw error;
    }
  }

  // ✅ 新增：仅使用列表页基本信息生成职位数据（降级方案）
  private generateBasicJob(job: any, config: TaskConfig): JobData {
    return {
      companyName: job.company || '未知企业',
      jobId: `ZL${Date.now()}${Math.random().toString(36).substr(2, 9)}`,
      jobName: job.title,
      jobCategory: '技术类',
      jobTags: '',
      jobDescription: `负责${job.title}相关的工作，完成上级交办的任务。具备良好的沟通能力和团队合作精神。`,
      salaryRange: job.salary || '面议',
      workCity: job.city || config.city || '北京',
      workExperience: '经验不限',
      workAddress: job.city || config.city || '北京',
      education: '学历不限',
      companyCode: '',
      companyNature: '民营企业',
      businessScope: '互联网/电子商务',
      companyScale: '规模不详',
      recruitmentCount: '若干',
      updateDate: new Date().toISOString().split('T')[0],
      workType: '全职',
      dataSource: '智联招聘'
    };
  }

}
