const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function analyzeHtml() {
  console.log('开始分析HTML快照...\n');
  
  const htmlPath = path.join(__dirname, 'debug', 'test_zhilian.html');
  
  if (!fs.existsSync(htmlPath)) {
    console.error('HTML快照文件不存在:', htmlPath);
    return;
  }
  
  const html = fs.readFileSync(htmlPath, 'utf-8');
  console.log(`HTML文件大小: ${(html.length / 1024).toFixed(2)} KB\n`);
  
  // 启动浏览器进行分析
  const chromePath = 'C:\\Users\\Administrator\\.cache\\puppeteer\\chrome\\win64-131.0.6778.204\\chrome-win64\\chrome.exe';
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true
  });

  try {
    const page = await browser.newPage();
    
    // 加载HTML内容
    await page.setContent(html);
    
    console.log('=== 测试各种选择器 ===\n');
    
    // 测试多种可能的选择器
    const selectorsToTest = [
      '.job-list-box',
      '.job-card-wrapper',
      'div[class*="job"]',
      'div[class*="job-card"]',
      'div[class*="job-item"]',
      'a[href*="/job/"]',
      'a[href*="/jobs/"]',
      '[class*="job"]',
      'article',
      'section'
    ];
    
    for (const selector of selectorsToTest) {
      const count = await page.evaluate((sel) => {
        return document.querySelectorAll(sel).length;
      }, selector);
      
      console.log(`选择器 "${selector}": 找到 ${count} 个元素`);
    }
    
    console.log('\n=== 页面标题和基本信息 ===\n');
    const pageInfo = await page.evaluate(() => {
      return {
        title: document.title,
        bodyText: document.body.textContent?.substring(0, 500),
        hasJobContent: document.body.textContent?.includes('职位') || 
                       document.body.textContent?.includes('招聘') ||
                       document.body.textContent?.includes('Java')
      };
    });
    
    console.log('页面标题:', pageInfo.title);
    console.log('包含职位相关内容:', pageInfo.hasJobContent);
    console.log('\n页面文本前500字符:');
    console.log(pageInfo.bodyText);
    
    console.log('\n✅ 分析完成！');
    
  } catch (error) {
    console.error('分析过程中出错:', error);
  } finally {
    await browser.close();
  }
}

analyzeHtml().catch(console.error);
