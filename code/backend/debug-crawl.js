const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function debugCrawl() {
  console.log('开始详细调试爬取...\n');
  
  const chromePath = 'C:\\Users\\Administrator\\.cache\\puppeteer\\chrome\\win64-131.0.6778.204\\chrome-win64\\chrome.exe';
  
  // 使用非无头模式，可以看到浏览器窗口
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: false,  // 设置为 false 可以看到浏览器
    slowMo: 500,      // 减慢操作速度，便于观察
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--window-size=1920,1080'
    ]
  });

  try {
    const page = await browser.newPage();
    
    // 设置用户代理
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1920, height: 1080 });
    
    // 监听控制台消息
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    
    // 监听请求
    page.on('request', request => {
      if (request.resourceType() === 'xhr' || request.resourceType() === 'fetch') {
        console.log('API请求:', request.url());
      }
    });
    
    // 监听响应
    page.on('response', async response => {
      if (response.url().includes('/api/') || response.url().includes('/job')) {
        console.log('API响应:', response.url(), '状态:', response.status());
      }
    });
    
    const url = 'https://www.zhaopin.com/sou/jl530/kwJava';
    console.log('正在访问:', url);
    
    await page.goto(url, { 
      waitUntil: 'networkidle0',  // 等待所有网络连接空闲
      timeout: 60000 
    });
    
    console.log('页面加载完成，等待5秒让动态内容加载...');
    await page.waitForTimeout(5000);
    
    // 保存HTML
    const html = await page.content();
    const debugDir = path.join(__dirname, 'debug');
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true });
    }
    const debugFile = path.join(debugDir, 'zhilian_debug_detailed.html');
    fs.writeFileSync(debugFile, html);
    console.log('HTML快照已保存到:', debugFile);
    
    // 检查页面内容
    const pageInfo = await page.evaluate(() => {
      return {
        title: document.title,
        bodyLength: document.body.textContent?.length || 0,
        hasLoginPrompt: document.body.textContent?.includes('登录') || false,
        hasVerifyCode: document.body.textContent?.includes('验证') || false,
        jobCards: document.querySelectorAll('[class*="job"]').length,
        links: Array.from(document.querySelectorAll('a')).map(a => ({
          text: a.textContent?.trim().substring(0, 50),
          href: a.href
        })).filter(a => a.text.length > 0).slice(0, 20)
      };
    });
    
    console.log('\n=== 页面信息 ===');
    console.log('标题:', pageInfo.title);
    console.log('正文长度:', pageInfo.bodyLength);
    console.log('包含登录提示:', pageInfo.hasLoginPrompt);
    console.log('包含验证码:', pageInfo.hasVerifyCode);
    console.log('职位相关元素数量:', pageInfo.jobCards);
    
    console.log('\n=== 前20个链接 ===');
    pageInfo.links.forEach((link, i) => {
      console.log(`${i + 1}. ${link.text} -> ${link.href}`);
    });
    
    console.log('\n请在浏览器中观察页面状态，按回车键继续...');
    
    // 等待用户观察
    await new Promise(resolve => {
      process.stdin.once('data', () => {
        resolve();
      });
    });
    
  } catch (error) {
    console.error('调试过程中出错:', error);
  } finally {
    await browser.close();
    console.log('\n✅ 调试完成！');
  }
}

debugCrawl().catch(console.error);
