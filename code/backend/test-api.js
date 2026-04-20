const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function testApiApproach() {
  console.log('测试API方式获取职位数据...\n');
  
  const chromePath = 'C:\\Users\\Administrator\\.cache\\puppeteer\\chrome\\win64-131.0.6778.204\\chrome-win64\\chrome.exe';
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: false,
    slowMo: 500,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--window-size=1920,1080'
    ]
  });

  try {
    const page = await browser.newPage();
    
    // 拦截并记录所有API请求
    const apiRequests = [];
    page.on('response', async response => {
      const url = response.url();
      if (url.includes('/api/') || url.includes('/search') || url.includes('/sou')) {
        try {
          const contentType = response.headers()['content-type'] || '';
          if (contentType.includes('application/json')) {
            const data = await response.json().catch(() => null);
            apiRequests.push({
              url,
              status: response.status(),
              data
            });
            console.log('\n捕获到JSON API响应:');
            console.log('URL:', url);
            console.log('状态:', response.status());
            console.log('数据预览:', JSON.stringify(data).substring(0, 500));
          }
        } catch (e) {
          // 忽略解析错误
        }
      }
    });
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    const url = 'https://www.zhaopin.com/sou/jl530/kwJava';
    console.log('访问页面:', url);
    
    await page.goto(url, { 
      waitUntil: 'networkidle0',
      timeout: 60000 
    });
    
    console.log('\n页面加载完成，等待10秒以捕获所有API请求...');
    await page.waitForTimeout(10000);
    
    console.log('\n=== 捕获到的API请求 ===');
    console.log(`共捕获 ${apiRequests.length} 个JSON API响应`);
    
    if (apiRequests.length > 0) {
      console.log('\n✅ 找到API接口！可以使用API方式获取数据');
      apiRequests.forEach((req, i) => {
        console.log(`\n${i + 1}. ${req.url}`);
        console.log(`   状态: ${req.status}`);
      });
    } else {
      console.log('\n❌ 未找到JSON API，可能需要其他方式');
    }
    
    console.log('\n请在浏览器中观察页面，按回车键继续...');
    await new Promise(resolve => {
      process.stdin.once('data', () => resolve());
    });
    
  } catch (error) {
    console.error('测试过程中出错:', error);
  } finally {
    await browser.close();
    console.log('\n✅ 测试完成！');
  }
}

testApiApproach().catch(console.error);
