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
      for (const keyword of keywords) {
        for (const city of cities) {
          currentCombination++;

          this.log('info', `[Job51Crawler] ╔══ 组合 ${currentCombination}/${totalCombinationCount}: "${keyword}" × "${city || '全国'}" ══╗`);

          if (this.checkAborted()) {
            this.log('info', `[Job51Crawler] 任务已中止`);
            return;
          }

          const cityCode = city ? (JOB51_CITY_CODES[city] || '000000') : '000000';
          const baseUrl = `https://search.51job.com/list/${cityCode},000000,0000,00,9,99,${encodeURIComponent(keyword)},2`;

          let currentPage = 1;
          let hasNextPage = true;

          while (hasNextPage && !this.checkAborted()) {
            const url = `${baseUrl},${currentPage}.html`;
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

              // === XHR 拦截：捕获 API 响应 ===
              const xhrResponses: any[] = [];
              page.on('response', async (response) => {
                const respUrl = response.url();
                const contentType = response.headers()['content-type'] || '';
                if (respUrl.includes('51job.com') && contentType.includes('json')) {
                  try {
                    const json = await response.json();
                    xhrResponses.push({ url: respUrl, data: json });
                  } catch { /* 非 JSON 或已消费 */ }
                }
              });

              // === SPA 感知加载（核心修复）===
              await page.goto(url, {
                waitUntil: 'networkidle2',
                timeout: 90000,
              });

              // 等待 SPA 渲染职位列表
              try {
                await page.waitForSelector(
                  '.joblist-item, .j_joblist, .joblist, [class*="joblist"], .resultlist, .e, .el, .dw_table',
                  { timeout: 15000, visible: true }
                );
                this.log('info', `[Job51Crawler] ✅ SPA 内容渲染成功`);
              } catch {
                this.log('warn', `[Job51Crawler] ⚠️ SPA 职位列表未在预期时间内出现，尝试从已加载的 DOM 提取`);
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
              const html = await page.content();
              const htmlLength = html.length;
              this.log('info', `[Job51Crawler] 页面 HTML 长度: ${htmlLength} 字符`);

              // 保存调试快照
              const debugDir = path.join(__dirname, '../../../debug');
              if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });
              fs.writeFileSync(path.join(debugDir, `job51_page_${currentPage}_${Date.now()}.html`), html);

              // === AI 反爬接入点 1：页面分类 ===
              const classification = await classifyPage(html, url);
              this.log('info', `[Job51Crawler] 🤖 AI分类: type=${classification.pageType}, confidence=${classification.confidence.toFixed(2)}`);

              if (classification.confidence >= 0.5 && classification.pageType !== 'normal') {
                const action = await recommendAction(classification);
                this.log('warn', `[Job51Crawler] 🛡️ AI推荐动作: ${action.action}, 等待 ${action.waitMs}ms (${action.reason})`);

                if (action.action === 'abort') {
                  this.log('error', `[Job51Crawler] 🚨 AI判定需终止: ${classification.reason}`);
                  break;
                }
                if (action.waitMs > 0) {
                  this.antiCrawlState.consecutiveAntiCrawlPages++;
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
              // 策略1：优先使用 XHR 拦截的 JSON 数据
              let jobs: any[] = [];
              if (xhrResponses.length > 0) {
                const searchApi = xhrResponses.find(r =>
                  r.data?.resultbody?.job?.items || r.data?.data?.results || r.data?.body?.jobList
                );
                if (searchApi) {
                  const items = searchApi.data?.resultbody?.job?.items
                    || searchApi.data?.data?.results
                    || searchApi.data?.body?.jobList
                    || [];
                  this.log('info', `[Job51Crawler] 📡 XHR拦截获取到 ${items.length} 条结构化数据`);
                  // 从 API JSON 映射到内部格式
                  jobs = items.map((item: any) => ({
                    title: item.jobName || item.job_name || item.title || '',
                    company: item.companyName || item.company_name || item.coName || '',
                    salary: item.salary || item.provideSalary || item.salaryDesc || '',
                    city: item.workCity || item.workArea || item.cityName || '',
                    link: item.jobHref || item.detailUrl || `https://jobs.51job.com/${city || 'all'}/${item.jobId || ''}.html`,
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
                      try {
                        // @ts-ignore
                        const aiJobs = await page.evaluate((selector: string) => {
                          const els = document.querySelectorAll(selector);
                          return Array.from(els).slice(0, 50).map((el: Element) => {
                            const a = el.querySelector('a') || el.closest('a');
                            const title = el.querySelector('[class*="title"], [class*="name"], [class*="job"]')?.textContent?.trim()
                              || a?.textContent?.trim() || el.textContent?.trim().substring(0, 60) || '';
                            return {
                              title,
                              company: el.querySelector('[class*="company"], [class*="cname"]')?.textContent?.trim() || '',
                              salary: el.querySelector('[class*="salary"], [class*="pay"], [class*="sal"]')?.textContent?.trim() || '',
                              city: el.querySelector('[class*="city"], [class*="area"], [class*="location"]')?.textContent?.trim() || '',
                              link: a?.href || '',
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

              // === 处理职位：列表数据 + 详情页抓取 ===
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
                      // AI 反爬接入点 3：详情页触发反爬
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

                // 每 5 条发送进度
                if ((i + 1) % 5 === 0 && io) {
                  io.to(`task:${taskId}`).emit('task:log', {
                    taskId, level: 'success',
                    message: `✅ 已采集 ${i + 1}/${pageJobs.length} 条 | ${keyword} × ${city || '全国'}`
                  });
                }

                await this.randomDelay(1500, 3500);
              }

              // 检查下一页
              hasNextPage = await page.evaluate(() => {
                const nextBtn = document.querySelector(
                  '.p_in .next:not(.disabled), .next:not(.disabled), [class*="pager"] .next:not(.disabled), a[class*="next"]:not([class*="disabled"])'
                );
                return !!nextBtn;
              });

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

    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'plugins', {
        get: () => [
          { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
          { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
          { name: 'Native Client', filename: 'internal-nacl-plugin' },
        ],
      });
      Object.defineProperty(navigator, 'languages', { get: () => ['zh-CN', 'zh', 'en-US', 'en'] });
      (window as any).chrome = { runtime: {}, loadTimes: () => {}, csi: () => {}, app: {} };
      const origQuery = (window.navigator as any).permissions?.query;
      if (origQuery) {
        (window.navigator as any).permissions.query = (params: any) =>
          params.name === 'notifications'
            ? Promise.resolve({ state: Notification.permission })
            : origQuery(params);
      }
    });
  }

  // ==================== DOM 数据提取 ====================

  private async extractJobsFromDOM(page: any): Promise<any[]> {
    // @ts-ignore
    return await page.evaluate(() => {
      const jobs: any[] = [];
      const seen = new Set<string>();

      // 策略 A：51job 新版 SPA 职位卡片
      const selectors = [
        '.joblist-item', '.j_joblist .e', '.e_result .e',
        '[class*="joblist"] [class*="item"]', '.dw_table .el',
        'div[data-jid]', 'li[data-jid]',
        'a[href*="/job/"]', 'a[href*="jobs.51job.com"]',
      ];

      for (const sel of selectors) {
        const els = document.querySelectorAll(sel);
        for (const el of Array.from(els)) {
          // 对于 a 标签选择器，直接提取链接文本
          const isLink = sel.startsWith('a[');
          const container = isLink ? el : el;

          const titleEl = container.querySelector('.jname a, [class*="title"], [class*="name"], [class*="job"], a[href*="/job/"]');
          const companyEl = container.querySelector('.cname a, [class*="company"], [class*="cname"]');
          const salaryEl = container.querySelector('.sal, [class*="salary"], [class*="pay"]');
          const cityEl = container.querySelector('.ltype, [class*="city"], [class*="area"], [class*="location"]');
          const linkEl = isLink ? el : container.querySelector('a[href*="/job/"], a[href*="jobs.51job.com"]');

          const title = titleEl?.textContent?.trim() || (isLink ? el.textContent?.trim() : '');
          const link = (linkEl as HTMLAnchorElement)?.href || (isLink ? (el as HTMLAnchorElement).href : '');

          if (title && title.length > 3 && title.length < 100 && !seen.has(title)) {
            seen.add(title);
            jobs.push({
              title,
              company: companyEl?.textContent?.trim() || '',
              salary: salaryEl?.textContent?.trim() || '',
              city: cityEl?.textContent?.trim() || '',
              link: link.startsWith('http') ? link : `https:${link}`,
            });
          }
        }
        if (jobs.length > 0) break;
      }

      // 策略 B：文本行分析兜底
      if (jobs.length === 0) {
        const text = document.body.innerText || '';
        const lines = text.split('\n').filter(l => l.trim().length > 0);
        const jobKW = ['工程师', '经理', '专员', '助理', '总监', '主管', '顾问', '分析师', '开发', '设计', '运营'];

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (jobKW.some(k => line.includes(k)) && line.length > 5 && line.length < 100) {
            let company = '', salary = '', city = '';
            for (let j = Math.max(0, i - 5); j <= Math.min(lines.length - 1, i + 5); j++) {
              const near = lines[j].trim();
              if (!company && (near.includes('公司') || near.includes('科技') || near.includes('集团')) && near.length > 4) company = near;
              if (!salary && /(万|千|K|元|薪)/.test(near) && /\d/.test(near)) salary = near;
              if (!city && /(北京|上海|广州|深圳|杭州|南京|成都|武汉|西安|重庆|苏州|郑州|长沙|青岛|大连|厦门|宁波|无锡|佛山|东莞|合肥|福州|济南|昆明|哈尔滨|长春|沈阳|南昌|贵阳|南宁|海口)/.test(near))
                city = near.match(/(北京|上海|广州|深圳|杭州|南京|成都|武汉|西安|重庆|苏州|郑州|长沙|青岛|大连|厦门|宁波|无锡|佛山|东莞|合肥|福州|济南|昆明|哈尔滨|长春|沈阳|南昌|贵阳|南宁|海口)/)?.[0] || '';
            }
            if (company || salary) {
              jobs.push({ title: line, company: company || '未知', salary: salary || '面议', city, link: '' });
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
          const get = (sels: string) => {
            for (const s of sels.split(', ')) {
              const el = document.querySelector(s);
              if (el?.textContent?.trim()) return el.textContent.trim();
            }
            return '';
          };

          const result: any = {};

          result.title = get('h1[class*="title"], .job-name h1, .cn h1, [class*="jobName"], .tHeader h1');
          result.company = get('.cname a, .company-name, [class*="company"] a, .com_name, .tCompany_sidebar a');
          result.salary = get('[class*="salary"], .sal, .cn strong, [class*="pay"], .tHeader strong');
          result.city = get('.ltype, [class*="area"], [class*="location"], [class*="workCity"]');

          // 经验/学历/工作类型
          const infoEls = document.querySelectorAll('.msg.ltype span, .jtag span, .bmsg, [class*="info"] span, [class*="require"] span, .t1 span');
          infoEls.forEach((el: Element) => {
            const t = (el.textContent || '').trim();
            if (/\d+-?\d*年/.test(t) || t.includes('经验')) result.experience = t;
            else if (/(本科|硕士|博士|大专|中专|高中|初中|不限)/.test(t)) result.education = t;
            else if (/(全职|兼职|实习|合同)/.test(t)) result.workType = t;
            else if (/招\d+人/.test(t)) result.recruitmentCount = t;
          });

          result.jobDescription = get('.job_msg, .bmsg, .tBorderL_msg, [class*="job-detail"], [class*="jobDesc"], [class*="description"], .tCompany_main');
          result.jobTags = Array.from(document.querySelectorAll('.jtag .t1 span, [class*="tag"], [class*="skill"], .bmsg .t2 span'))
            .map(t => t.textContent?.trim()).filter(Boolean).join(',');

          result.companyNature = get('[class*="type"], [class*="nature"], .com_tag span, .tCompany_sidebar .com_tag');
          result.companyScale = get('[class*="scale"], [class*="size"], .tCompany_sidebar .com_scale');
          result.address = get('[class*="address"], .bmsg address, [class*="location"], .tBorderL_msg .fp');

          const updateEl = document.querySelector('[class*="update"], [class*="refresh"], [class*="time"]');
          result.updateDateText = updateEl?.textContent?.trim() || '';

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
      jobId: `51${Date.now()}${Math.random().toString(36).substring(2, 9)}`,
      jobName: detail.title || basicInfo.title || '',
      companyName: detail.company || basicInfo.company || '未知企业',
      salaryRange: detail.salary || basicInfo.salary || '面议',
      workCity: detail.city || basicInfo.city || config.city || '',
      workExperience: detail.experience || '',
      education: detail.education || '',
      workAddress: detail.address || '',
      jobDescription: detail.jobDescription || '',
      jobTags: detail.jobTags || '',
      jobCategory: '',
      companyNature: detail.companyNature || '',
      companyScale: detail.companyScale || '',
      businessScope: '',
      recruitmentCount: detail.recruitmentCount || '',
      workType: detail.workType || '全职',
      companyCode: '',
      updateDate,
      dataSource: '前程无忧',
    };
  }

  private generateBasicJob(basicInfo: any, config?: TaskConfig): JobData {
    return {
      jobId: `51fb${Date.now()}${Math.random().toString(36).substring(2, 7)}`,
      jobName: basicInfo.title || '',
      companyName: basicInfo.company || '未知企业',
      salaryRange: basicInfo.salary || '面议',
      workCity: basicInfo.city || config?.city || '',
      workExperience: '',
      education: '',
      workAddress: '',
      jobDescription: '',
      jobTags: '',
      jobCategory: '',
      companyNature: '',
      companyScale: '',
      businessScope: '',
      recruitmentCount: '',
      workType: '全职',
      companyCode: '',
      updateDate: new Date().toISOString().split('T')[0],
      dataSource: '前程无忧',
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
