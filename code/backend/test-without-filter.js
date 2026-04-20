const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function testWithoutCompanyFilter() {
  console.log('=== 测试不带企业过滤的爬取 ===\n');
  
  const chromePath = 'C:\\Users\\Administrator\\.cache\\puppeteer\\chrome\\win64-131.0.6778.204\\chrome-win64\\chrome.exe';
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--window-size=1920,1080'
    ]
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // 访问智联招聘 - 开发职位，北京
    const url = 'https://www.zhaopin.com/sou/jl530/kw%E5%BC%80%E5%8F%91/p1';
    console.log('访问URL:', url);
    
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    console.log('页面加载完成，等待3秒...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 提取职位数据（不使用企业过滤）
    const jobs = await page.evaluate(() => {
      const jobList = [];
      
      // 尝试多种选择器
      const selectors = [
        '.job-list-box .job-card-wrapper',
        '.job-card-wrapper',
        'div[class*="job-card"]',
        'div[class*="job-item"]',
        'div[class*="position"]'
      ];

      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        console.log(`选择器 "${selector}": 找到 ${elements.length} 个元素`);
        
        if (elements.length > 0) {
          elements.forEach((element) => {
            const titleEl = element.querySelector('.job-name, .job-title, a[href*="/job/"], [class*="title"]');
            const companyEl = element.querySelector('.company-name, .company, [class*="company"]');
            const salaryEl = element.querySelector('.salary, .pay, [class*="salary"]');
            const cityEl = element.querySelector('.job-area, .location, [class*="area"], [class*="city"]');
            const linkEl = element.querySelector('a[href*="/job/"], a[href*="/jobs/"], a[href]');

            const title = titleEl ? titleEl.textContent?.trim() || '' : '';
            const company = companyEl ? companyEl.textContent?.trim() || '' : '';
            const salary = salaryEl ? salaryEl.textContent?.trim() || '' : '';
            const city = cityEl ? cityEl.textContent?.trim() || '' : '';
            const link = linkEl ? (linkEl.getAttribute('href') || '') : '';

            if (title && title.length > 3) {
              jobList.push({
                title,
                company: company || '未知企业',
                salary: salary || '面议',
                city: city || '',
                link: link.startsWith('http') ? link : `https://www.zhaopin.com${link}`
              });
            }
          });
          
          if (jobList.length > 0) {
            console.log(`✓ 使用选择器 "${selector}" 找到 ${jobList.length} 个职位`);
            return jobList;
          }
        }
      }

      // 备用方案：查找所有职位链接
      console.log('标准选择器未找到，尝试通用链接提取...');
      const allLinks = document.querySelectorAll('a[href]');
      allLinks.forEach((link) => {
        const href = link.href || '';
        const text = link.textContent?.trim() || '';
        
        if ((href.includes('/job/') || href.includes('/jobs/') || href.includes('/position/')) && 
            text.length > 5 && text.length < 100) {
          jobList.push({
            title: text,
            company: '未知企业',
            salary: '面议',
            city: '',
            link: href
          });
        }
      });
      
      console.log(`通过链接提取找到 ${jobList.length} 个职位`);
      return jobList;
    });
    
    console.log('\n=== 爬取结果 ===');
    console.log(`总共找到 ${jobs.length} 个职位\n`);
    
    if (jobs.length > 0) {
      console.log('前5个职位示例：');
      jobs.slice(0, 5).forEach((job, i) => {
        console.log(`${i + 1}. ${job.title}`);
        console.log(`   企业: ${job.company}`);
        console.log(`   薪资: ${job.salary}`);
        console.log(`   城市: ${job.city}`);
        console.log('');
      });
      
      console.log('✅ 测试成功！不带企业过滤可以获取到数据');
    } else {
      console.log('❌ 仍未找到任何职位数据');
      console.log('\n可能原因：');
      console.log('1. 网站反爬机制拦截');
      console.log('2. 需要登录才能查看');
      console.log('3. DOM结构与我们预期的不同');
    }
    
  } catch (error) {
    console.error('测试过程中出错:', error);
  } finally {
    await browser.close();
  }
}

testWithoutCompanyFilter().catch(console.error);
