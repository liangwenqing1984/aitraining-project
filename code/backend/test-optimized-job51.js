// @ts-nocheck - 测试脚本，用于验证优化后的前程无忧爬虫
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function testOptimizedCrawler() {
  console.log('=== 测试优化后的前程无忧爬虫 ===\n');
  
  const chromePath = 'C:\\Users\\Administrator\\.cache\\puppeteer\\chrome\\win64-131.0.6778.204\\chrome-win64\\chrome.exe';
  const userDataDir = `C:\\Users\\Administrator\\.cache\\puppeteer\\tmp\\test_optimized_${Date.now()}`;
  
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    userDataDir,
    headless: true, // 使用无头模式测试
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--window-size=1920x1080'
    ]
  });

  try {
    const page = await browser.newPage();
    
    // 🔧 设置真实的浏览器指纹
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1920, height: 1080 });

    // 🔧 注入反检测脚本
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'plugins', { 
        get: () => [
          { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
          { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
          { name: 'Native Client', filename: 'internal-nacl-plugin' }
        ] 
      });
      Object.defineProperty(navigator, 'languages', { 
        get: () => ['zh-CN', 'zh', 'en-US', 'en'] 
      });
      window.chrome = { runtime: {}, loadTimes: function() {}, csi: function() {}, app: {} };
    });

    // 🚀 调整资源拦截策略
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const allowedTypes = ['document', 'script', 'xhr', 'fetch', 'stylesheet'];
      if (allowedTypes.includes(request.resourceType())) {
        request.continue();
      } else {
        request.abort();
      }
    });

    // 测试URL
    const testUrl = 'https://search.51job.com/list/010000,000000,0000,00,9,99,%E5%BC%80%E5%8F%91,2,1.html';
    console.log(`[测试] 访问URL: ${testUrl}\n`);

    // 加载页面
    console.log('[步骤1] 加载页面...');
    await page.goto(testUrl, { 
      waitUntil: 'domcontentloaded',
      timeout: 90000
    });

    // 验证页面内容
    const htmlLength = await page.content().then(html => html.length);
    console.log(`[步骤2] HTML长度: ${htmlLength} 字符`);
    
    if (htmlLength < 1000) {
      console.error(`❌ 页面加载失败: HTML长度仅${htmlLength}字符`);
      return;
    }
    console.log(`✅ 页面加载成功\n`);

    // 强制滚动触发懒加载
    console.log('[步骤3] 执行滚动操作...');
    await page.evaluate(async () => {
      for (let i = 0; i < 3; i++) {
        window.scrollTo(0, document.body.scrollHeight);
        await new Promise(resolve => setTimeout(resolve, 1000));
        window.scrollTo(0, 0);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    });
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 保存HTML快照
    const debugDir = path.join(__dirname, 'debug');
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true });
    }
    const debugFile = path.join(debugDir, `test_optimized_${Date.now()}.html`);
    const html = await page.content();
    fs.writeFileSync(debugFile, html);
    console.log(`[步骤4] HTML快照已保存: ${debugFile}\n`);

    // 智能提取职位数据
    console.log('[步骤5] 开始提取职位数据...\n');
    const jobs = await page.evaluate(() => {
      const jobList = [];
      
      // 方法1: DOM选择器
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
          
          elements.forEach((element) => {
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

      // 方法2: 文本分析
      if (!foundJobs || jobList.length === 0) {
        console.log('DOM选择器未找到数据，尝试文本分析方法...');
        
        const bodyText = document.body.innerText;
        const lines = bodyText.split('\n').filter(line => line.trim().length > 0);
        
        const jobKeywords = ['工程师', '经理', '专员', '助理', '总监', '主管', '顾问', '分析师', '开发', '设计', '运营', '销售', '市场', '人事', '财务', '行政'];
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          const isJobTitle = jobKeywords.some(kw => line.includes(kw)) && line.length > 5 && line.length < 100;
          
          if (isJobTitle) {
            let company = '';
            let salary = '';
            let city = '';
            
            for (let j = Math.max(0, i - 5); j <= Math.min(lines.length - 1, i + 5); j++) {
              const nearbyLine = lines[j].trim();
              
              if (!company && (nearbyLine.includes('公司') || nearbyLine.includes('科技') || nearbyLine.includes('投资')) && nearbyLine.length > 4) {
                company = nearbyLine;
              }
              
              if (!salary && /(万|千|K|元|薪)/.test(nearbyLine) && /\d/.test(nearbyLine)) {
                salary = nearbyLine;
              }
              
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

    console.log(`\n[结果] 共提取到 ${jobs.length} 条职位数据\n`);
    
    if (jobs.length > 0) {
      console.log('前5条职位数据:');
      jobs.slice(0, 5).forEach((job, index) => {
        console.log(`\n${index + 1}. 职位名称: ${job.title}`);
        console.log(`   企业名称: ${job.company}`);
        console.log(`   薪资范围: ${job.salary}`);
        console.log(`   工作地点: ${job.city}`);
        console.log(`   职位链接: ${job.link || 'N/A'}`);
      });
      console.log(`\n✅ 测试成功！共提取 ${jobs.length} 条职位数据`);
    } else {
      console.log('❌ 未能提取到任何职位数据');
    }

  } catch (error) {
    console.error('测试过程中出错:', error);
  } finally {
    try {
      console.log('\n关闭浏览器...');
      await browser.close();
      console.log('浏览器已关闭');
      
      // 清理临时目录
      setTimeout(() => {
        try {
          if (fs.existsSync(userDataDir)) {
            fs.rmSync(userDataDir, { recursive: true, force: true });
            console.log(`已清理临时目录: ${userDataDir}`);
          }
        } catch (e) {
          console.warn('清理临时目录失败:', e.message);
        }
      }, 2000);
    } catch (e) {
      console.error('关闭浏览器时出错:', e);
    }
  }
}

// 执行测试
testOptimizedCrawler().catch(console.error);
