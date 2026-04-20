// @ts-nocheck - 诊断脚本，用于测试前程无忧网站的可访问性和页面结构
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function diagnoseJob51() {
  console.log('=== 前程无忧(51job)爬取诊断工具 ===\n');
  
  const chromePath = 'C:\\Users\\Administrator\\.cache\\puppeteer\\chrome\\win64-131.0.6778.204\\chrome-win64\\chrome.exe';
  const userDataDir = `C:\\Users\\Administrator\\.cache\\puppeteer\\tmp\\diagnose_${Date.now()}`;
  
  console.log(`[诊断] 使用Chrome路径: ${chromePath}`);
  console.log(`[诊断] 临时目录: ${userDataDir}\n`);
  
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    userDataDir,
    headless: false, // 使用有头模式便于观察
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--window-size=1920x1080'
    ]
  });

  try {
    const page = await browser.newPage();
    
    // 设置更真实的浏览器指纹
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1920, height: 1080 });
    
    // 注入反检测脚本
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['zh-CN', 'zh', 'en-US', 'en'] });
      window.chrome = { runtime: {} };
    });
    
    // 监听所有网络请求
    const requestLog = [];
    page.on('request', request => {
      const url = request.url();
      if (url.includes('51job.com')) {
        requestLog.push({
          type: 'request',
          method: request.method(),
          url: url,
          resourceType: request.resourceType(),
          timestamp: Date.now()
        });
        console.log(`[请求] ${request.method()} ${request.resourceType()} - ${url.substring(0, 120)}...`);
      }
    });
    
    page.on('response', async response => {
      const url = response.url();
      if (url.includes('51job.com')) {
        const status = response.status();
        const statusText = response.statusText();
        const contentType = response.headers()['content-type'] || 'unknown';
        
        requestLog.push({
          type: 'response',
          status: status,
          url: url,
          contentType: contentType,
          timestamp: Date.now()
        });
        
        console.log(`[响应] ${status} ${statusText} | ${contentType} | ${url.substring(0, 100)}...`);
        
        if (status >= 400) {
          console.error(`[错误响应] 状态码: ${status}, URL: ${url}`);
        }
      }
    });
    
    page.on('console', msg => {
      console.log(`[页面Console] ${msg.type()}: ${msg.text().substring(0, 200)}`);
    });
    
    page.on('pageerror', error => {
      console.error(`[页面错误] ${error.message}`);
    });
    
    // 测试URL列表
    const testUrls = [
      {
        name: '北京-开发职位搜索',
        url: 'https://search.51job.com/list/010000,000000,0000,00,9,99,%E5%BC%80%E5%8F%91,2,1.html'
      },
      {
        name: '上海-Java职位搜索',
        url: 'https://search.51job.com/list/020000,000000,0000,00,9,99,java,2,1.html'
      },
      {
        name: '前程无忧首页',
        url: 'https://www.51job.com/'
      }
    ];
    
    for (let i = 0; i < testUrls.length; i++) {
      const test = testUrls[i];
      console.log(`\n${'='.repeat(80)}`);
      console.log(`测试 ${i + 1}/${testUrls.length}: ${test.name}`);
      console.log(`URL: ${test.url}`);
      console.log('='.repeat(80));
      
      try {
        const startTime = Date.now();
        
        // 清空之前的请求日志
        requestLog.length = 0;
        
        // 导航到页面
        console.log('\n[步骤1] 开始加载页面...');
        await page.goto(test.url, { 
          waitUntil: 'networkidle2',
          timeout: 60000 
        });
        
        const loadTime = Date.now() - startTime;
        console.log(`[步骤1完成] 页面加载耗时: ${loadTime}ms`);
        
        // 获取最终URL（可能有重定向）
        const finalUrl = page.url();
        console.log(`[步骤2] 最终URL: ${finalUrl}`);
        
        // 获取页面标题
        const title = await page.title();
        console.log(`[步骤3] 页面标题: ${title}`);
        
        // 获取页面HTML长度
        const html = await page.content();
        console.log(`[步骤4] HTML长度: ${html.length} 字符`);
        
        // 保存HTML快照
        const debugDir = path.join(__dirname, 'debug');
        if (!fs.existsSync(debugDir)) {
          fs.mkdirSync(debugDir, { recursive: true });
        }
        const debugFile = path.join(debugDir, `job51_diagnose_${i + 1}_${Date.now()}.html`);
        fs.writeFileSync(debugFile, html);
        console.log(`[步骤5] HTML快照已保存: ${debugFile}`);
        
        // 检查是否有职位相关元素
        console.log('\n[步骤6] 检查职位列表元素...');
        const jobElements = await page.evaluate(() => {
          const selectors = [
            '.dw_table .el',
            '.el',
            'div[class*="job"]',
            'div[class*="position"]',
            '[class*="job-list"]',
            'a[href*="/job/"]'
          ];
          
          const results = {};
          selectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            results[selector] = elements.length;
          });
          
          return results;
        });
        
        console.log('[元素统计]');
        Object.entries(jobElements).forEach(([selector, count]) => {
          console.log(`  ${selector}: ${count} 个元素`);
        });
        
        // 提取部分文本内容
        console.log('\n[步骤7] 提取页面文本内容（前500字符）...');
        const textContent = await page.evaluate(() => {
          return document.body.innerText.substring(0, 500);
        });
        console.log(textContent);
        
        // 检查是否有反爬提示
        console.log('\n[步骤8] 检查反爬提示...');
        const antiBotIndicators = await page.evaluate(() => {
          const indicators = {
            hasCaptcha: document.querySelector('[class*="captcha"], [class*="verify"], #nc_1_nocaptcha') !== null,
            hasLoginPrompt: document.querySelector('[class*="login"], [class*="登录"]') !== null,
            hasBlockMessage: /blocked|拦截|验证|异常|限制/i.test(document.body.innerText),
            bodyTextLength: document.body.innerText.length
          };
          return indicators;
        });
        
        console.log('[反爬检测]');
        console.log(`  验证码元素: ${antiBotIndicators.hasCaptcha ? '检测到' : '未检测到'}`);
        console.log(`  登录提示: ${antiBotIndicators.hasLoginPrompt ? '检测到' : '未检测到'}`);
        console.log(`  拦截信息: ${antiBotIndicators.hasBlockMessage ? '检测到' : '未检测到'}`);
        console.log(`  页面文本总长度: ${antiBotIndicators.bodyTextLength} 字符`);
        
        // 分析网络请求
        console.log('\n[步骤9] 网络请求分析...');
        const apiRequests = requestLog.filter(req => 
          req.type === 'request' && 
          (req.resourceType === 'xhr' || req.resourceType === 'fetch')
        );
        
        console.log(`API请求数量: ${apiRequests.length}`);
        if (apiRequests.length > 0) {
          console.log('API请求列表:');
          apiRequests.slice(0, 10).forEach((req, idx) => {
            console.log(`  ${idx + 1}. ${req.method} ${req.url.substring(0, 150)}...`);
          });
        }
        
        console.log(`\n✅ 测试 ${i + 1} 完成！`);
        
        // 等待用户观察（仅第一个测试）
        if (i === 0) {
          console.log('\n⏸️  暂停10秒供您观察浏览器行为...');
          await new Promise(resolve => setTimeout(resolve, 10000));
        }
        
      } catch (error) {
        console.error(`\n❌ 测试 ${i + 1} 失败:`, error.message);
        if (error.stack) {
          console.error('错误堆栈:', error.stack.substring(0, 500));
        }
      }
      
      // 每个测试之间等待
      if (i < testUrls.length - 1) {
        console.log('\n等待3秒后继续下一个测试...\n');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('所有测试完成！');
    console.log('请检查 debug 目录中的HTML文件以进一步分析页面结构。');
    console.log('='.repeat(80));
    
  } catch (error) {
    console.error('诊断过程出错:', error);
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

// 执行诊断
diagnoseJob51().catch(console.error);
