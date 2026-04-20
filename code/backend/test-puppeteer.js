const puppeteer = require('puppeteer');
const path = require('path');

async function testPuppeteer() {
  console.log('开始测试 Puppeteer...');
  
  // 指定使用已安装的 Chrome 131
  const chromePath = 'C:\\Users\\Administrator\\.cache\\puppeteer\\chrome\\win64-131.0.6778.204\\chrome-win64\\chrome.exe';
  console.log('Chrome 路径:', chromePath);
  
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage'
    ]
  });

  try {
    console.log('浏览器启动成功');
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1920, height: 1080 });
    
    console.log('正在访问智联招聘...');
    await page.goto('https://www.zhaopin.com/sou/jl530/kwJava', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    console.log('页面加载完成');
    
    // 等待职位列表加载
    await page.waitForSelector('.job-list-box, .job-card-wrapper, div[class*="job"]', { timeout: 10000 })
      .then(() => console.log('找到职位列表元素'))
      .catch(() => console.log('未找到职位列表元素'));
    
    // 保存HTML快照
    const html = await page.content();
    const fs = require('fs');
    const path = require('path');
    const debugDir = path.join(__dirname, 'debug');
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true });
    }
    const debugFile = path.join(debugDir, 'test_zhilian.html');
    fs.writeFileSync(debugFile, html);
    console.log(`HTML快照已保存到: ${debugFile}`);
    
    // 尝试提取职位数据
    const jobs = await page.evaluate(() => {
      const jobList = [];
      const selectors = [
        '.job-list-box .job-card-wrapper',
        '.job-card-wrapper',
        'div[class*="job-card"]'
      ];

      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        console.log(`选择器 "${selector}" 找到 ${elements.length} 个元素`);
        
        if (elements.length > 0) {
          elements.forEach((element) => {
            const titleEl = element.querySelector('.job-name, .job-title');
            const companyEl = element.querySelector('.company-name, .company');
            
            const title = titleEl ? titleEl.textContent.trim() : '';
            const company = companyEl ? companyEl.textContent.trim() : '';
            
            if (title) {
              jobList.push({ title, company });
            }
          });
          break;
        }
      }
      
      return jobList;
    });
    
    console.log(`\n找到 ${jobs.length} 个职位:`);
    jobs.slice(0, 5).forEach((job, index) => {
      console.log(`${index + 1}. ${job.title} - ${job.company}`);
    });
    
    await page.close();
    console.log('\n✅ Puppeteer 测试成功！');
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  } finally {
    await browser.close();
    console.log('浏览器已关闭');
  }
}

testPuppeteer();
