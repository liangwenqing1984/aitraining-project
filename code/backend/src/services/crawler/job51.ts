// @ts-nocheck - page.evaluate 代码在浏览器环境中运行
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { JobData, TaskConfig } from '../../types';
import { JOB51_CITY_CODES } from '../../config/constants';
import { classifyPage, suggestSelectors, recommendAction } from '../llm/antiCrawl';
import type { PageClassification } from '../llm/antiCrawl';
import { io } from '../../app';
import * as fs from 'fs';
import * as path from 'path';

puppeteer.use(StealthPlugin());

export class Job51Crawler {
  private logger: any = null;
  private signal: AbortSignal | null = null;
  private antiCrawlState = {
    consecutiveAntiCrawlPages: 0,
    lastClassification: null as PageClassification | null,
  };

  setLogger(logger: any) {
    this.logger = logger;
  }

  private log(level: string, ...args: any[]) {
    if (this.logger) {
      (this.logger as any)[level](...args);
    } else {
      console[level](...args);
    }
  }

  async *crawl(config: TaskConfig, signal: AbortSignal): AsyncGenerator<JobData> {
    this.signal = signal;

    const keywords = config.keywords?.length
      ? config.keywords
      : config.keyword ? [config.keyword] : [''];
    const cities = config.cities?.length
      ? config.cities
      : config.city ? [config.city] : [''];
    const companies = config.companies || (config.company ? [config.company] : []);

    const totalCombinationCount = keywords.length * cities.length;
    let currentCombination = 0;
    const taskId = this.getTaskId(config);

    this.log('info', `[Job51Crawler] ========== 开始爬取 ==========`);
    this.log('info', `[Job51Crawler] 关键词: [${keywords.join(', ')}] (${keywords.length}个)`);
    this.log('info', `[Job51Crawler] 城市: [${cities.join(', ')}] (${cities.length}个)`);
    this.log('info', `[Job51Crawler] 总组合数: ${totalCombinationCount}`);

    // 启动浏览器（使用 stealth 插件）
    const chromePath = 'C:\\Users\\Administrator\\.cache\\puppeteer\\chrome\\win64-131.0.6778.204\\chrome-win64\\chrome.exe';
    const userDataDir = `C:\\Users\\Administrator\\.cache\\puppeteer\\tmp\\job51_${Date.now()}`;

    const browser = await puppeteer.launch({
      executablePath: chromePath,
      userDataDir,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920x1080',
        '--disable-blink-features=AutomationControlled',
      ],
      timeout: 30000,
    });

    try {
      // === 浏览器会话预热：先访问主页建立 cookies/session ===
      const MIN_WARMUP_HTML = 50000; // 正常51job搜索页HTML应远大于50KB
      let warmupSuccess = false;
      for (let warmupAttempt = 0; warmupAttempt < 2 && !warmupSuccess; warmupAttempt++) {
        this.log('info', `[Job51Crawler] 🔥 正在预热浏览器会话（第${warmupAttempt + 1}次尝试）...`);
        let warmupPage: any = null;
        try {
          warmupPage = await browser.newPage();
          await warmupPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
          await warmupPage.goto('https://we.51job.com/', { waitUntil: 'networkidle2', timeout: 60000 });
          await new Promise(r => setTimeout(r, 3000));
          await warmupPage.goto('https://we.51job.com/pc/search?keyword=java&city=010000', { waitUntil: 'networkidle2', timeout: 60000 });
          const warmupHtml = await warmupPage.content();
          if (warmupHtml.length >= MIN_WARMUP_HTML) {
            this.log('info', `[Job51Crawler] ✅ 主页预热完成，获取 ${warmupHtml.length} 字节 (cookies/session已建立)`);
            warmupSuccess = true;
          } else {
            this.log('warn', `[Job51Crawler] ⚠️ 预热页面过小(${warmupHtml.length}字节 < ${MIN_WARMUP_HTML})，疑似被WAF拦截，将重试...`);
          }
        } catch (e: any) {
          this.log('warn', `[Job51Crawler] ⚠️ 主页预热失败: ${e.message}`);
        } finally {
          if (warmupPage) {
            try { await warmupPage.close(); } catch { /* ignore */ }
          }
        }
        if (!warmupSuccess && warmupAttempt < 1) {
          this.log('info', `[Job51Crawler] ⏳ 等待5秒后重试预热...`);
          await this.randomDelay(5000, 8000);
        }
      }
      if (!warmupSuccess) {
        this.log('error', `[Job51Crawler] ❌ 浏览器预热2次均失败，可能IP已被限制，继续尝试但可能无法获取数据`);
      }

      for (const keyword of keywords) {
        for (const city of cities) {
          currentCombination++;

          this.log('info', `[Job51Crawler] ╔══ 组合 ${currentCombination}/${totalCombinationCount}: "${keyword}" × "${city || '全国'}" ══╗`);

          if (this.checkAborted()) {
            this.log('info', `[Job51Crawler] 任务已中止`);
            return;
          }

          const cityCode = city ? (JOB51_CITY_CODES[city] || '010000') : '000000';

          let currentPage = 1;
          let hasNextPage = true;

          while (hasNextPage && !this.checkAborted()) {
            // 新 51job URL 格式：we.51job.com/pc/search?keyword=...&city=...&page=...
            const url = `https://we.51job.com/pc/search?keyword=${encodeURIComponent(keyword)}&city=${cityCode}&page=${currentPage}&pageSize=20`;
            const pageStartTime = Date.now();

            this.log('info', `[Job51Crawler] 📄 第 ${currentPage} 页: ${url}`);

            if (io) {
              io.to(`task:${taskId}`).emit('task:log', {
                taskId, level: 'info',
                message: `📄 正在请求第 ${currentPage} 页 (${keyword} × ${city || '全国'})`
              });
            }

            const page = await browser.newPage();
            try {
              await this.setupPageFingerprint(page);

              // 资源拦截：允许 document/script/xhr/fetch/stylesheet
              await page.setRequestInterception(true);
              page.on('request', (request) => {
                if (['image', 'font', 'media'].includes(request.resourceType())) {
                  request.abort();
                } else {
                  request.continue();
                }
              });

              // === XHR 拦截：捕获 API 响应（支持新旧多种 API 端点）===
              const xhrResponses: any[] = [];
              page.on('response', async (response) => {
                const respUrl = response.url();
                const contentType = response.headers()['content-type'] || '';
                const isApiUrl = respUrl.includes('51job.com') && (
                  respUrl.includes('/api/') || respUrl.includes('/open/') || respUrl.includes('search-pc')
                );
                if (isApiUrl) {
                  try {
                    const json = await response.json();
                    if (json && typeof json === 'object') {
                      xhrResponses.push({ url: respUrl, data: json });
                    }
                  } catch { /* 非 JSON 或已消费 */ }
                }
              });

              // === SPA 感知加载（核心修复）===
              await page.goto(url, {
                waitUntil: 'networkidle2',
                timeout: 90000,
              });

              // 等待 SPA 渲染职位列表（新版 Vue.js 站点）
              try {
                await page.waitForSelector(
                  '[class*="jobItem"], [class*="job-item"], [class*="jobList"] [class*="item"], #app [class*="result"] [class*="item"], .el-card, [class*="card"][class*="job"], .van-list__item, #app .list-item',
                  { timeout: 15000, visible: true }
                );
                this.log('info', `[Job51Crawler] ✅ SPA 内容渲染成功`);
              } catch {
                this.log('warn', `[Job51Crawler] ⚠️ SPA 职位列表未在预期时间内出现，尝试从已加载的 DOM/XHR 提取`);
              }

              // 额外滚动触发懒加载
              await page.evaluate(async () => {
                for (let i = 0; i < 3; i++) {
                  window.scrollTo(0, document.body.scrollHeight);
                  await new Promise(r => setTimeout(r, 800));
                }
              });
              await this.randomDelay(2000, 3000);

              // 获取渲染后的完整 HTML
              let html = await page.content();
              let htmlLength = html.length;
              this.log('info', `[Job51Crawler] 页面 HTML 长度: ${htmlLength} 字符`);

              // 保存调试快照
              const debugDir = path.join(__dirname, '../../../debug');
              if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });
              fs.writeFileSync(path.join(debugDir, `job51_page_${currentPage}_${Date.now()}.html`), html);

              // === HTML大小检测：正常51job搜索页 > 500KB，小页面为WAF/拦截 ===
              const MIN_PAGE_HTML = 50000;
              if (htmlLength < MIN_PAGE_HTML) {
                this.log('warn', `[Job51Crawler] 🛡️ 页面HTML过小(${htmlLength}字节 < ${MIN_PAGE_HTML})，疑似WAF拦截`);
                this.antiCrawlState.consecutiveAntiCrawlPages++;

                await new Promise(r => setTimeout(r, 10000));
                try {
                  await page.reload({ waitUntil: 'networkidle2', timeout: 60000 });
                  html = await page.content();
                  htmlLength = html.length;
                  this.log('info', `[Job51Crawler] 🔄 重载后HTML: ${htmlLength}字符`);

                  if (htmlLength < MIN_PAGE_HTML) {
                    this.log('warn', `[Job51Crawler] 🔄 重载后仍过小，尝试不带pageSize的备用URL...`);
                    const altUrl = url.replace(/&pageSize=\d+/, '');
                    await page.goto(altUrl, { waitUntil: 'networkidle2', timeout: 60000 });
                    html = await page.content();
                    htmlLength = html.length;
                    this.log('info', `[Job51Crawler] 🔄 备用URL HTML: ${htmlLength}字符`);
                  }
                } catch (reloadErr: any) {
                  this.log('error', `[Job51Crawler] ❌ 页面重载失败: ${reloadErr.message}`);
                }
              }

              // === AI 反爬接入点 1：页面分类 + 智能重试（仅大页面调用AI） ===
              const wasHtmlSmall = htmlLength < MIN_PAGE_HTML;
              const classification = !wasHtmlSmall
                ? await classifyPage(html, url)
                : { pageType: 'waf' as const, confidence: 1.0, indicators: ['html_too_small'], reason: 'HTML过小，判定为WAF拦截页面' };
              this.log('info', `[Job51Crawler] 🤖 AI分类: type=${classification.pageType}, confidence=${classification.confidence.toFixed(2)}`);

              // 如果已经在HTML大小检测中处理过WAF，跳过此处的重复重载
              if (wasHtmlSmall) {
                this.log('warn', `[Job51Crawler] 🔄 已在HTML大小检测中处理过WAF，跳过AI重载流程`);
                this.antiCrawlState.consecutiveAntiCrawlPages++;
              } else if (classification.confidence >= 0.5 && classification.pageType !== 'normal') {
                const action = await recommendAction(classification);
                this.log('warn', `[Job51Crawler] 🛡️ AI推荐动作: ${action.action}, 等待 ${action.waitMs}ms (${action.reason})`);

                if (action.action === 'abort') {
                  this.log('error', `[Job51Crawler] 🚨 AI判定需终止: ${classification.reason}`);
                  break;
                }

                // empty/waf/error 页面：实际重载页面，而非仅等待
                if (classification.pageType === 'empty' || classification.pageType === 'waf' || classification.pageType === 'error') {
                  this.antiCrawlState.consecutiveAntiCrawlPages++;
                  const reloadWait = action.waitMs || 10000;
                  this.log('warn', `[Job51Crawler] 🔄 页面异常(${classification.pageType})，等待 ${reloadWait/1000}s 后重载页面...`);

                  await new Promise(r => setTimeout(r, reloadWait));

                  // 重新加载页面
                  try {
                    await page.reload({ waitUntil: 'networkidle2', timeout: 60000 });
                    const reloadedHtml = await page.content();
                    this.log('info', `[Job51Crawler] 🔄 重载后 HTML: ${reloadedHtml.length} 字符`);

                    // 重载后再次分类
                    const reClassification = await classifyPage(reloadedHtml, url);
                    this.log('info', `[Job51Crawler] 🤖 重载后AI分类: type=${reClassification.pageType}, confidence=${reClassification.confidence.toFixed(2)}`);

                    if (reClassification.pageType !== 'normal' && reClassification.confidence >= 0.5) {
                      // 重载后仍异常：尝试移除 pageSize 参数或调整 page 参数重试
                      this.log('warn', `[Job51Crawler] 🔄 重载后仍为 ${reClassification.pageType}，尝试备用参数格式...`);
                      const altUrl = url.replace(/&pageSize=\d+/, '&pageSize=10');
                      try {
                        await page.goto(altUrl, { waitUntil: 'networkidle2', timeout: 60000 });
                        const altHtml = await page.content();
                        this.log('info', `[Job51Crawler] 🔄 备用URL HTML: ${altHtml.length} 字符`);
                      } catch { /* 备用 URL 也失败就放弃这页 */ }
                    } else {
                      this.log('info', `[Job51Crawler] ✅ 页面重载后恢复正常`);
                    }
                  } catch (reloadErr: any) {
                    this.log('error', `[Job51Crawler] ❌ 页面重载失败: ${reloadErr.message}`);
                  }
                } else if (action.waitMs > 0) {
                  // captcha/login 等其他类型：等待即可
                  await new Promise(r => setTimeout(r, action.waitMs));
                }
              } else {
                this.antiCrawlState.consecutiveAntiCrawlPages = 0;
              }
              this.antiCrawlState.lastClassification = classification;

              // 连续反爬退避
              if (this.antiCrawlState.consecutiveAntiCrawlPages >= 3) {
                const wait = Math.min(30000 * Math.pow(2, this.antiCrawlState.consecutiveAntiCrawlPages - 3), 300000);
                this.log('warn', `[Job51Crawler] ⏳ 连续 ${this.antiCrawlState.consecutiveAntiCrawlPages} 页触发反爬，退避 ${wait / 1000} 秒`);
                await new Promise(r => setTimeout(r, wait));
              }

              // === 数据提取 ===
              // 策略1：优先使用 XHR 拦截的 JSON 数据（支持多种 API 响应格式）
              let jobs: any[] = [];
              if (xhrResponses.length > 0) {
                // 查找搜索结果 API 响应（支持新旧多种响应结构）
                const searchApi = xhrResponses.find(r => {
                  const d = r.data;
                  return d?.resultbody?.job?.items
                    || d?.resultbody?.joblist?.items
                    || d?.resultbody?.data
                    || d?.data?.results
                    || d?.body?.jobList
                    || d?.result
                    || d?.items;
                });
                if (searchApi) {
                  const d = searchApi.data;
                  const items = d?.resultbody?.job?.items
                    || d?.resultbody?.joblist?.items
                    || d?.resultbody?.data
                    || d?.data?.results
                    || d?.body?.jobList
                    || d?.result
                    || d?.items
                    || [];
                  this.log('info', `[Job51Crawler] 📡 XHR拦截获取到 ${items.length} 条结构化数据 (来源: ${searchApi.url.substring(0, 80)})`);
                  // 从 API JSON 映射到内部格式（适配多种字段命名）
                  jobs = items.map((item: any) => ({
                    title: item.jobName || item.job_name || item.title || item.name || item.positionName || '',
                    company: item.companyName || item.company_name || item.coName || item.company || item.corpName || '',
                    salary: item.salary || item.provideSalary || item.salaryDesc || item.salaryRange || item.pay || '',
                    city: item.workCity || item.workArea || item.cityName || item.city || item.region || '',
                    link: item.jobHref || item.detailUrl || item.url
                      || (item.jobId ? `https://jobs.51job.com/${city || 'all'}/${item.jobId}.html` : '')
                      || (item.encryptJobId ? `https://we.51job.com/pc/detail?jobId=${item.encryptJobId}` : ''),
                    jobId: item.jobId || item.encryptJobId || item.id || '',
                    // 51job 新增字段
                    titleCategory: item.jobType || item.jobCategory || item.typeName || item.categoryName || '',
                    isUrgent: item.isUrgent || item.urgentJob || item.urgent || item.isEmergent || '',
                    companyDetailUrl: item.companyHref || item.coUrl || item.companyUrl
                      || (item.coId ? `https://jobs.51job.com/company/${item.coId}.html` : '')
                      || (item.companyId ? `https://we.51job.com/pc/company?companyId=${item.companyId}` : ''),
                    registeredAddress: item.companyAddress || item.regAddress || item.registeredAddress || '',
                    businessScope: item.businessScope || item.bizScope || item.companyBusiness || '',
                    companyScale: item.companyScale || item.coSize || item.scale || '',
                    companyNature: item.companyNature || item.coType || item.companyType || item.nature || '',
                  }));
                }
              }

              // 策略2：DOM 选择器提取
              if (jobs.length === 0) {
                jobs = await this.extractJobsFromDOM(page);
              }

              // === AI 反爬接入点 2：选择器失效时请求 AI 建议 ===
              if (jobs.length === 0) {
                this.log('warn', `[Job51Crawler] 🤖 所有已知选择器失效，请求 AI 建议...`);
                try {
                  const suggestions = await suggestSelectors(html, '职位列表');
                  if (suggestions.length > 0) {
                    this.log('info', `[Job51Crawler] AI 返回 ${suggestions.length} 个选择器建议`);
                    for (const s of suggestions) {
                      this.log('info', `[Job51Crawler]   尝试: "${s.selector}" (${s.type}, confidence: ${s.confidence})`);
                      // 跳过空选择器（AI 可能返回无效结果）
                      if (!s.selector || s.selector.trim() === '') {
                        this.log('warn', `[Job51Crawler] ⚠️ AI返回空选择器，跳过`);
                        continue;
                      }
                      try {
                        // @ts-ignore
                        const aiJobs = await page.evaluate(function(selector) {
                          var els = document.querySelectorAll(selector);
                          return Array.from(els).slice(0, 50).map(function(el) {
                            var a = el.querySelector('a') || el.closest('a');
                            var titleEl = el.querySelector('[class*="title"], [class*="name"], [class*="job"], h3, h2');
                            var title = (titleEl && titleEl.textContent && titleEl.textContent.trim()) || '';
                            if (!title && a && a.textContent) title = a.textContent.trim();
                            if (!title && el.textContent) title = el.textContent.trim().substring(0, 60);
                            var companyEl = el.querySelector('[class*="company"], [class*="cname"], [class*="corp"], [class*="enterprise"]');
                            var salaryEl = el.querySelector('[class*="salary"], [class*="pay"], [class*="sal"], [class*="wage"]');
                            var cityEl = el.querySelector('[class*="city"], [class*="area"], [class*="location"], [class*="region"]');
                            var categoryEl = el.querySelector('[class*="jobType"], [class*="category"], [class*="type"]');
                            var textContent = el.textContent || '';
                            var companyDetailUrl = '';
                            var companyLinkEl = (companyEl && companyEl.closest && companyEl.closest('a')) || el.querySelector('a[href*="/company/"], a[href*="coId"]');
                            if (companyLinkEl && companyLinkEl.href) companyDetailUrl = companyLinkEl.href;
                            return {
                              title: title,
                              company: (companyEl && companyEl.textContent && companyEl.textContent.trim()) || '',
                              salary: (salaryEl && salaryEl.textContent && salaryEl.textContent.trim()) || '',
                              city: (cityEl && cityEl.textContent && cityEl.textContent.trim()) || '',
                              link: (a && a.href) || el.getAttribute('href') || '',
                              titleCategory: (categoryEl && categoryEl.textContent && categoryEl.textContent.trim()) || '',
                              isUrgent: textContent.indexOf('急聘') !== -1 || textContent.indexOf('急') !== -1 ? '是' : '',
                              companyDetailUrl: companyDetailUrl,
                            };
                          });
                        }, s.selector);
                        if (aiJobs.length > 0) {
                          jobs = aiJobs;
                          this.log('info', `[Job51Crawler] ✅ AI选择器 "${s.selector}" 找到 ${jobs.length} 条`);
                          break;
                        }
                      } catch (e: any) {
                        this.log('warn', `[Job51Crawler] AI选择器 "${s.selector}" 失败: ${e.message}`);
                      }
                    }
                  }
                } catch (e: any) {
                  this.log('warn', `[Job51Crawler] AI选择器推荐失败: ${e.message}`);
                }
              }

              this.log('info', `[Job51Crawler] 本页提取 ${jobs.length} 条职位`);

              if (jobs.length === 0) {
                this.log('warn', `[Job51Crawler] ⚠️ 未找到任何职位，结束此组合的分页`);
                break;
              }

              // 企业过滤
              const filteredJobs = companies.length > 0
                ? jobs.filter(j => companies.some(c => j.company.includes(c)))
                : jobs;

              // 每页限制条数
              const pageJobs = config.maxRecordsPerPage && filteredJobs.length > config.maxRecordsPerPage
                ? filteredJobs.slice(0, config.maxRecordsPerPage)
                : filteredJobs;

              // === 处理职位：列表数据 + 详情页抓取（支持并发） ===
              const concurrency = config.concurrency || 1;
              const maxConcurrency = Math.min(concurrency, 3);
              this.log('info', `[Job51Crawler] 🚀 处理职位: 并发数=${maxConcurrency} (配置=${concurrency}), 总职位数=${pageJobs.length}`);

              if (maxConcurrency <= 1) {
                // 串行模式
                this.log('info', `[Job51Crawler] ⚡ 使用串行模式处理`);
                for (let i = 0; i < pageJobs.length && !this.checkAborted(); i++) {
                  const job = pageJobs[i];
                  this.log('info', `[Job51Crawler] [${i + 1}/${pageJobs.length}] ${job.title}`);

                  let jobData: JobData;
                  if (job.link) {
                    try {
                      const fullUrl = job.link.startsWith('http') ? job.link : `https:${job.link}`;
                      jobData = await this.fetchJobDetail(browser, fullUrl, job, config);
                    } catch (e: any) {
                      if (e.message?.includes('WAF_DETECTED')) {
                        if (this.antiCrawlState.lastClassification) {
                          const action = await recommendAction(this.antiCrawlState.lastClassification);
                          if (action.action === 'abort') throw e;
                          await new Promise(r => setTimeout(r, action.waitMs));
                        }
                      }
                      this.log('warn', `[Job51Crawler] 详情页失败，使用列表数据: ${e.message}`);
                      jobData = this.generateBasicJob(job, config);
                    }
                  } else {
                    jobData = this.generateBasicJob(job, config);
                  }

                  yield jobData;

                  if ((i + 1) % 5 === 0 && io) {
                    io.to(`task:${taskId}`).emit('task:log', {
                      taskId, level: 'success',
                      message: `✅ 已采集 ${i + 1}/${pageJobs.length} 条 | ${keyword} × ${city || '全国'}`
                    });
                  }

                  await this.randomDelay(1500, 3500);
                }
              } else {
                // 并发模式：批次内并行处理
                this.log('info', `[Job51Crawler] ⚡ 使用并发模式处理（批次大小=${maxConcurrency}）`);
                for (let batchStart = 0; batchStart < pageJobs.length && !this.checkAborted(); batchStart += maxConcurrency) {
                  const batchEnd = Math.min(batchStart + maxConcurrency, pageJobs.length);
                  const batch = pageJobs.slice(batchStart, batchEnd);

                  const batchPromises = batch.map(async (job, indexInBatch) => {
                    const globalIndex = batchStart + indexInBatch + 1;

                    if (this.checkAborted()) {
                      return { success: false, data: this.generateBasicJob(job, config), index: globalIndex };
                    }

                    this.log('info', `[Job51Crawler] [${globalIndex}/${pageJobs.length}] 🚀 并发抓取: ${job.title}`);

                    try {
                      let jobData: JobData;
                      if (job.link) {
                        const fullUrl = job.link.startsWith('http') ? job.link : `https:${job.link}`;
                        jobData = await this.fetchJobDetail(browser, fullUrl, job, config);
                      } else {
                        jobData = this.generateBasicJob(job, config);
                      }
                      return { success: true, data: jobData, index: globalIndex };
                    } catch (e: any) {
                      this.log('warn', `[Job51Crawler] [${globalIndex}/${pageJobs.length}] 详情页失败: ${e.message}`);
                      return { success: false, data: this.generateBasicJob(job, config), index: globalIndex };
                    }
                  });

                  const batchResults = await Promise.allSettled(batchPromises);

                  let collectedInBatch = 0;
                  for (const result of batchResults) {
                    if (result.status === 'fulfilled' && result.value.success) {
                      yield result.value.data;
                      collectedInBatch++;
                      if (result.value.index % 5 === 0 && io) {
                        io.to(`task:${taskId}`).emit('task:log', {
                          taskId, level: 'success',
                          message: `✅ 已采集 ${result.value.index}/${pageJobs.length} 条 | ${keyword} × ${city || '全国'}`
                        });
                      }
                    } else if (result.status === 'fulfilled') {
                      yield result.value.data;
                      collectedInBatch++;
                    } else {
                      this.log('error', `[Job51Crawler] 批次任务异常: ${result.reason}`);
                    }
                  }

                  this.log('info', `[Job51Crawler] 批次完成: ${batchStart + 1}-${batchEnd}/${pageJobs.length} (${collectedInBatch}条)`);

                  // 批次间延迟
                  if (batchEnd < pageJobs.length) {
                    await this.randomDelay(2000, 4000);
                  }
                }
              }

              // 检查下一页（多种方式）
              hasNextPage = await page.evaluate(() => {
                // 新版 Element UI / Ant Design 分页器
                const nextBtn = document.querySelector(
                  '.el-pager .btn-next:not(.disabled), .el-pagination .btn-next:not([disabled]), .ant-pagination .ant-pagination-next:not([disabled]), [class*="pagination"] [class*="next"]:not([class*="disabled"]), .page-next:not(.disabled), [class*="pager"] .next:not(.disabled), a[class*="next"]:not([class*="disabled"]), button[class*="next"]:not([disabled])'
                );
                return !!nextBtn;
              });
              // 兜底：如果本页提取到 0 条职位，视为无下一页
              if (hasNextPage && jobs.length === 0) {
                hasNextPage = false;
              }

              const pageDuration = ((Date.now() - pageStartTime) / 1000).toFixed(1);
              this.log('info', `[Job51Crawler] 第 ${currentPage} 页完成 (${pageDuration}s) | next=${hasNextPage}`);

              currentPage++;
              if (config.maxPages && currentPage > config.maxPages) {
                this.log('info', `[Job51Crawler] 达到最大页数限制: ${config.maxPages}`);
                break;
              }

              await this.randomDelay(3000, 5000);

            } catch (error: any) {
              this.log('error', `[Job51Crawler] ❌ 第 ${currentPage} 页出错: ${error.message}`);
              break;
            } finally {
              try { await page.close(); } catch { /* ignore */ }
            }
          }

          this.log('info', `[Job51Crawler] ✅ 组合 ${currentCombination}/${totalCombinationCount} 完成`);
        }
      }
      this.log('info', `[Job51Crawler] ========== 全部完成 ==========`);
    } finally {
      try { await browser.close(); } catch { /* ignore */ }
    }
  }

  // ==================== 页面指纹设置 ====================

  private async setupPageFingerprint(page: any): Promise<void> {
    const vw = 1366 + Math.floor(Math.random() * 554);
    const vh = 768 + Math.floor(Math.random() * 312);
    await page.setViewport({ width: vw, height: vh });

    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    ];
    await page.setUserAgent(userAgents[Math.floor(Math.random() * userAgents.length)]);

    await page.evaluateOnNewDocument(function() {
      Object.defineProperty(navigator, 'webdriver', { get: function() { return undefined; } });
      Object.defineProperty(navigator, 'plugins', {
        get: function() { return [
          { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
          { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
          { name: 'Native Client', filename: 'internal-nacl-plugin' },
        ]; },
      });
      Object.defineProperty(navigator, 'languages', { get: function() { return ['zh-CN', 'zh', 'en-US', 'en']; } });
      window.chrome = { runtime: {}, loadTimes: function() {}, csi: function() {}, app: {} };
      var navPerms = window.navigator.permissions;
      if (navPerms && navPerms.query) {
        var origQuery = navPerms.query.bind(navPerms);
        navPerms.query = function(params) {
          return params.name === 'notifications'
            ? Promise.resolve({ state: Notification.permission })
            : origQuery(params);
        };
      }
    });
  }

  // ==================== DOM 数据提取 ====================

  private async extractJobsFromDOM(page: any): Promise<any[]> {
    // @ts-ignore
    return await page.evaluate(() => {
      var jobs = [];
      var seen = new Set();

      // 策略 A：51job 新版 SPA 职位卡片（Vue.js / Element UI 站点）
      var selectors = [
        '[class*="jobItem"]', '[class*="job-item"]', '[class*="job_item"]',
        '[class*="jobList"] [class*="item"]', '[class*="job_list"] [class*="item"]',
        '#app [class*="result"] [class*="item"]', '#app [class*="list"] [class*="item"]',
        '.el-card', '[class*="card"]', '.van-list__item',
        'div[data-jid]', 'li[data-jid]', 'div[data-jobid]',
        'a[href*="/job/"]', 'a[href*="jobs.51job.com"]', 'a[href*="/pc/detail"]',
      ];

      for (var si = 0; si < selectors.length; si++) {
        var sel = selectors[si];
        var els = document.querySelectorAll(sel);
        var elsArr = Array.from(els);
        for (var ei = 0; ei < elsArr.length; ei++) {
          var el = elsArr[ei];
          // 对于 a 标签选择器，直接提取链接文本
          var isLink = sel.indexOf('a[') === 0;
          var container = isLink ? el : el;

          var titleEl = container.querySelector('[class*="title"], [class*="name"], [class*="job"], a[href*="/job/"], a[href*="/pc/detail"], h3, h2, .jname a');
          var companyEl = container.querySelector('[class*="company"], [class*="cname"], [class*="corp"], [class*="enterprise"], a[class*="com"]');
          var salaryEl = container.querySelector('[class*="salary"], [class*="pay"], [class*="sal"], [class*="wage"]');
          var cityEl = container.querySelector('[class*="city"], [class*="area"], [class*="location"], [class*="region"], .ltype');
          var linkEl = isLink ? el : container.querySelector('a[href*="/job/"], a[href*="jobs.51job.com"], a[href*="/pc/detail"]');

          var title = (titleEl && titleEl.textContent && titleEl.textContent.trim()) || (isLink ? (el.textContent && el.textContent.trim()) : '');
          var link = (linkEl && linkEl.href) || (isLink ? (el.href) : '');

          if (title && title.length > 3 && title.length < 100 && !seen.has(title)) {
            seen.add(title);
            var companyName = (companyEl && companyEl.textContent && companyEl.textContent.trim()) || '';
            var companyLink = (companyEl && companyEl.closest && companyEl.closest('a')) || container.querySelector('a[href*="/company/"], a[href*="coId"], a[href*="comDetail"]');
            var catEl = container.querySelector('[class*="jobType"], [class*="category"], [class*="type"]');
            var containerText = container.textContent || '';
            jobs.push({
              title: title,
              company: companyName,
              salary: (salaryEl && salaryEl.textContent && salaryEl.textContent.trim()) || '',
              city: (cityEl && cityEl.textContent && cityEl.textContent.trim()) || '',
              link: link.indexOf('http') === 0 ? link : 'https:' + link,
              titleCategory: (catEl && catEl.textContent && catEl.textContent.trim()) || '',
              isUrgent: (containerText.indexOf('急聘') !== -1 || containerText.match(/急(?!救|诊|性)/)) ? '是' : '',
              companyDetailUrl: (companyLink && companyLink.href) || '',
            });
          }
        }
        if (jobs.length > 0) break;
      }

      // 策略 B：文本行分析兜底
      if (jobs.length === 0) {
        var bodyText = document.body && document.body.innerText ? document.body.innerText : '';
        var lines = bodyText.split('\n').filter(function(l) { return l.trim().length > 0; });
        var jobKW = ['工程师', '经理', '专员', '助理', '总监', '主管', '顾问', '分析师', '开发', '设计', '运营'];

        for (var i = 0; i < lines.length; i++) {
          var line = lines[i].trim();
          var hasKW = false;
          for (var k = 0; k < jobKW.length; k++) {
            if (line.indexOf(jobKW[k]) !== -1) { hasKW = true; break; }
          }
          if (hasKW && line.length > 5 && line.length < 100) {
            var company = '', salary = '', city = '';
            for (var j = Math.max(0, i - 5); j <= Math.min(lines.length - 1, i + 5); j++) {
              var near = lines[j].trim();
              if (!company && (near.indexOf('公司') !== -1 || near.indexOf('科技') !== -1 || near.indexOf('集团') !== -1) && near.length > 4) company = near;
              if (!salary && /(万|千|K|元|薪)/.test(near) && /\d/.test(near)) salary = near;
              if (!city) {
                var cityMatch = near.match(/(北京|上海|广州|深圳|杭州|南京|成都|武汉|西安|重庆|苏州|郑州|长沙|青岛|大连|厦门|宁波|无锡|佛山|东莞|合肥|福州|济南|昆明|哈尔滨|长春|沈阳|南昌|贵阳|南宁|海口)/);
                if (cityMatch) city = cityMatch[0] || '';
              }
            }
            if (company || salary) {
              jobs.push({ title: line, company: company || '未知', salary: salary || '面议', city: city, link: '' });
            }
          }
        }
      }

      return jobs;
    });
  }

  // ==================== 详情页抓取 ====================

  private async fetchJobDetail(
    browser: any,
    jobUrl: string,
    basicInfo: any,
    config: TaskConfig
  ): Promise<JobData> {
    let page: any = null;
    const maxRetries = 2;

    for (let retry = 0; retry <= maxRetries; retry++) {
      try {
        if (retry > 0) {
          await this.randomDelay(3000, 5000);
          if (!browser.isConnected()) throw new Error('浏览器连接已断开');
        }

        page = await browser.newPage();
        await this.setupPageFingerprint(page);

        await page.setRequestInterception(true);
        page.on('request', (request: any) => {
          if (['image', 'font', 'media'].includes(request.resourceType())) {
            request.abort();
          } else {
            request.continue();
          }
        });

        await page.goto(jobUrl, { waitUntil: 'networkidle2', timeout: 30000 });

        const html = await page.content();
        const classification = await classifyPage(html, jobUrl);

        if (classification.confidence >= 0.5 && (classification.pageType === 'waf' || classification.pageType === 'captcha')) {
          throw new Error('WAF_DETECTED: 详情页被拦截');
        }

        // @ts-ignore
        const detail = await page.evaluate(() => {
          function get(sels) {
            var selectors = sels.split(', ');
            for (var i = 0; i < selectors.length; i++) {
              var el = document.querySelector(selectors[i]);
              if (el && el.textContent && el.textContent.trim()) return el.textContent.trim();
            }
            return '';
          }

          var result = {};

          // 标题
          result.title = get('h1[class*="title"], h1, .job-name h1, .cn h1, [class*="jobName"], [class*="job-name"], [class*="position"] h2, .tHeader h1, .detail-title');

          // 公司名
          result.company = get('.cname a, .company-name, [class*="company"] a, [class*="company"] h2, .com_name, .tCompany_sidebar a, [class*="corp"] a, [class*="enterprise"] a');

          // 薪资
          result.salary = get('[class*="salary"], .sal, .cn strong, [class*="pay"], .tHeader strong, [class*="wage"], [class*="remuneration"]');

          // 城市
          result.city = get('.ltype, [class*="area"], [class*="location"], [class*="workCity"], [class*="address"], [class*="region"]');

          // 经验/学历/工作类型
          var infoEls = document.querySelectorAll(
            '.msg.ltype span, .jtag span, .bmsg, [class*="info"] span, [class*="require"] span, .t1 span, [class*="detail"] span, [class*="condition"] span, [class*="tag"] span'
          );
          infoEls.forEach(function(el) {
            var t = (el.textContent || '').trim();
            if (/\d+-?\d*年/.test(t) || t.indexOf('经验') !== -1) result.experience = t;
            else if (/(本科|硕士|博士|大专|中专|高中|初中|不限)/.test(t)) result.education = t;
            else if (/(全职|兼职|实习|合同)/.test(t)) result.workType = t;
            else if (/招\d+人/.test(t)) result.recruitmentCount = t;
          });

          // 职位描述
          result.jobDescription = get(
            '.job_msg, .bmsg, .tBorderL_msg, [class*="job-detail"], [class*="jobDesc"], [class*="description"], .tCompany_main, [class*="job_content"], [class*="detail_content"], [class*="responsibility"]'
          );

          // 职位标签
          result.jobTags = Array.from(document.querySelectorAll(
            '.jtag .t1 span, [class*="tag"], [class*="skill"], .bmsg .t2 span, [class*="label"], [class*="welfare"] span'
          )).map(function(t) { return t.textContent ? t.textContent.trim() : ''; }).filter(function(v) { return !!v; }).join(',');

          // 公司性质/规模
          result.companyNature = get('[class*="type"], [class*="nature"], .com_tag span, .tCompany_sidebar .com_tag, [class*="company_type"]');
          result.companyScale = get('[class*="scale"], [class*="size"], .tCompany_sidebar .com_scale, [class*="company_size"]');
          result.address = get('[class*="address"], .bmsg address, [class*="location"], .tBorderL_msg .fp, [class*="workplace"]');

          // 经营范围
          result.businessScope = get('[class*="business"], [class*="bizScope"], [class*="scope"], [class*="businessScope"]');

          // 注册地址
          result.registeredAddress = get('[class*="regAddress"], [class*="registered"], [class*="reg_address"], [class*="companyAddress"]');

          // 职称分类
          result.titleCategory = get('[class*="jobType"], [class*="jobCategory"], [class*="category"], [class*="positionType"], [class*="title"]');

          // 职能类别
          result.jobCategory = get('[class*="function"], [class*="funcCategory"], [class*="jobCat"], [class*="job_category"]');

          // 是否紧急招聘
          var isUrgent = '';
          var urgentEls = document.querySelectorAll('[class*="urgent"], [class*="emergency"], .urgent-tag, .hot-tag');
          urgentEls.forEach(function(el) {
            var txt = (el.textContent || '').trim();
            if (txt === '急' || txt.indexOf('急聘') !== -1) {
              isUrgent = '是';
            }
          });
          if (!isUrgent && document.body && document.body.innerText && document.body.innerText.indexOf('急聘') !== -1) {
            isUrgent = '是';
          }
          result.isUrgent = isUrgent;

          // 公司详情链接
          var companyLinkEl = document.querySelector('a[href*="/company/"], a[href*="/pc/company"], a[href*="coId"], [class*="company"] a[href*="51job"]');
          result.companyDetailUrl = (companyLinkEl && companyLinkEl.href) || '';

          // 更新时间
          var updateEl = document.querySelector('[class*="update"], [class*="refresh"], [class*="time"], [class*="publish"], [class*="date"]');
          result.updateDateText = updateEl && updateEl.textContent ? updateEl.textContent.trim() : '';

          return result;
        });

        return this.buildJobData(detail, basicInfo, config);

      } catch (error: any) {
        if (retry >= maxRetries) {
          this.log('warn', `[Job51Crawler] 详情页重试${maxRetries}次后失败: ${error.message}`);
          return this.generateBasicJob(basicInfo, config);
        }
      } finally {
        if (page) {
          try { await page.close(); } catch { /* ignore */ }
        }
      }
    }

    return this.generateBasicJob(basicInfo, config);
  }

  // ==================== JobData 构建 ====================

  private buildJobData(detail: any, basicInfo: any, config: TaskConfig): JobData {
    let updateDate = new Date().toISOString().split('T')[0];
    if (detail.updateDateText) {
      const today = new Date();
      if (detail.updateDateText.includes('今天')) {
        updateDate = today.toISOString().split('T')[0];
      } else if (detail.updateDateText.includes('昨天')) {
        today.setDate(today.getDate() - 1);
        updateDate = today.toISOString().split('T')[0];
      } else {
        const m = detail.updateDateText.match(/(\d+)天前/);
        if (m) {
          today.setDate(today.getDate() - parseInt(m[1]));
          updateDate = today.toISOString().split('T')[0];
        }
      }
    }

    return {
      jobId: basicInfo.jobId || `51${Date.now()}${Math.random().toString(36).substring(2, 9)}`,
      jobName: detail.title || basicInfo.title || '',
      companyName: detail.company || basicInfo.company || '未知企业',
      salaryRange: detail.salary || basicInfo.salary || '面议',
      workCity: detail.city || basicInfo.city || config.city || '',
      workExperience: detail.experience || '',
      education: detail.education || '',
      workAddress: detail.address || '',
      jobDescription: detail.jobDescription || '',
      jobTags: detail.jobTags || '',
      jobCategory: detail.jobCategory || basicInfo.titleCategory || '',
      companyNature: detail.companyNature || basicInfo.companyNature || '',
      companyScale: detail.companyScale || basicInfo.companyScale || '',
      businessScope: detail.businessScope || basicInfo.businessScope || '',
      recruitmentCount: detail.recruitmentCount || '',
      workType: detail.workType || '全职',
      companyCode: '',
      updateDate,
      dataSource: '前程无忧',
      // 51job 新增字段
      registeredAddress: detail.registeredAddress || basicInfo.registeredAddress || '',
      titleCategory: detail.titleCategory || basicInfo.titleCategory || '',
      isUrgent: detail.isUrgent || basicInfo.isUrgent || '',
      jobDetailUrl: basicInfo.link || '',
      companyDetailUrl: detail.companyDetailUrl || basicInfo.companyDetailUrl || '',
    };
  }

  private generateBasicJob(basicInfo: any, config?: TaskConfig): JobData {
    return {
      jobId: basicInfo.jobId || `51fb${Date.now()}${Math.random().toString(36).substring(2, 7)}`,
      jobName: basicInfo.title || '',
      companyName: basicInfo.company || '未知企业',
      salaryRange: basicInfo.salary || '面议',
      workCity: basicInfo.city || config?.city || '',
      workExperience: '',
      education: '',
      workAddress: '',
      jobDescription: '',
      jobTags: '',
      jobCategory: basicInfo.titleCategory || '',
      companyNature: basicInfo.companyNature || '',
      companyScale: basicInfo.companyScale || '',
      businessScope: basicInfo.businessScope || '',
      recruitmentCount: '',
      workType: '全职',
      companyCode: '',
      updateDate: new Date().toISOString().split('T')[0],
      dataSource: '前程无忧',
      // 51job 新增字段
      registeredAddress: basicInfo.registeredAddress || '',
      titleCategory: basicInfo.titleCategory || '',
      isUrgent: basicInfo.isUrgent || '',
      jobDetailUrl: basicInfo.link || '',
      companyDetailUrl: basicInfo.companyDetailUrl || '',
    };
  }

  // ==================== 工具方法 ====================

  private getTaskId(config: TaskConfig): string {
    return (config as any).taskId || 'unknown-task-id';
  }

  private async randomDelay(min: number = 2000, max: number = 5000): Promise<void> {
    if (this.signal?.aborted) return;
    const delay = Math.random() * (max - min) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  private checkAborted(): boolean {
    return this.signal?.aborted || false;
  }
}
