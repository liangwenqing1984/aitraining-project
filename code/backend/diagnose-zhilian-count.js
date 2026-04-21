const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
  console.log('='.repeat(80));
  console.log('智联招聘列表页职位数量诊断');
  console.log('='.repeat(80));
  
  const testUrl = 'https://www.zhaopin.com/sou/jl622/kw%E5%BC%80%E5%8F%91/p1';
  
  console.log(`测试URL: ${testUrl}`);
  console.log();
  
  let browser;
  
  try {
    console.log('启动浏览器...');
    const chromePath = 'C:\\Users\\Administrator\\.cache\\puppeteer\\chrome\\win64-131.0.6778.204\\chrome-win64\\chrome.exe';
    
    browser = await puppeteer.launch({
      executablePath: chromePath,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
    
    console.log('导航到列表页...');
    await page.goto(testUrl, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    console.log('✓ 页面加载完成');
    console.log();
    
    // 等待动态内容加载
    console.log('等待8秒让动态内容加载...');
    await new Promise(resolve => setTimeout(resolve, 8000));
    
    // 滚动触发懒加载
    console.log('滚动页面触发懒加载...');
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => {
        window.scrollBy(0, window.innerHeight);
      });
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // 保存HTML快照
    const debugDir = path.join(__dirname, 'debug');
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true });
    }
    
    const htmlContent = await page.content();
    const snapshotPath = path.join(debugDir, `zhilian_list_diagnose_${Date.now()}.html`);
    fs.writeFileSync(snapshotPath, htmlContent, 'utf-8');
    console.log(`✓ HTML快照已保存: ${snapshotPath}`);
    console.log();
    
    // 统计各种选择器找到的元素数量
    console.log('统计页面上的职位相关元素...');
    const elementCounts = await page.evaluate(() => {
      return {
        jobinfo_name: document.querySelectorAll('.jobinfo__name').length,
        joblist_box_item: document.querySelectorAll('.joblist-box__item').length,
        job_links_old: document.querySelectorAll('a[href*="/job/"]').length,  // 旧选择器
        job_links_new: document.querySelectorAll('a[href*="/jobdetail/"], a[href*="/job/"]').length,  // 新选择器
        jobinfo_blocks: document.querySelectorAll('.jobinfo').length,
        positionlist_list: document.querySelectorAll('.positionlist__list').length
      };
    });
    
    console.log('─'.repeat(80));
    console.log('元素统计结果:');
    console.log(`  .jobinfo__name:                    ${elementCounts.jobinfo_name} 个`);
    console.log(`  .joblist-box__item:                ${elementCounts.joblist_box_item} 个`);
    console.log(`  a[href*="/job/"] (旧):             ${elementCounts.job_links_old} 个 ❌`);
    console.log(`  a[href*="/jobdetail/"] (新):       ${elementCounts.job_links_new} 个 ✅`);
    console.log(`  .jobinfo:                          ${elementCounts.jobinfo_blocks} 个`);
    console.log(`  .positionlist__list:               ${elementCounts.positionlist_list} 个`);
    console.log('─'.repeat(80));
    console.log();
    
    // 提取所有 .jobinfo__name 的详细信息
    console.log('提取所有 .jobinfo__name 元素的详细信息...');
    const allJobs = await page.evaluate(() => {
      const jobs = [];
      const nameElements = Array.from(document.querySelectorAll('.jobinfo__name'));
      
      nameElements.forEach((el, index) => {
        const title = el.textContent.trim();
        const href = el.href || '';
        
        // 查找父级卡片容器
        const card = el.closest('.joblist-box__item') || el.closest('.jobinfo');
        
        // 从卡片中提取其他信息
        let company = '';
        let salary = '';
        let city = '';
        
        if (card) {
          const companyEl = card.querySelector('.companyinfo__name');
          if (companyEl) {
            company = companyEl.textContent.trim();
          }
          
          const salaryEl = card.querySelector('.jobinfo__salary');
          if (salaryEl) {
            salary = salaryEl.textContent.trim();
          }
          
          const cityInfoEls = card.querySelectorAll('.jobinfo__other-info-item span');
          if (cityInfoEls.length > 0) {
            const cityText = cityInfoEls[0].textContent.trim();
            const cityMatch = cityText.match(/(北京|上海|广州|深圳|杭州|成都|武汉|南京|西安|重庆|天津|苏州|郑州|长沙|青岛|大连|厦门|宁波|哈尔滨)/);
            if (cityMatch) {
              city = cityMatch[1];
            }
          }
        }
        
        jobs.push({
          index: index + 1,
          title,
          href,
          company,
          salary,
          city,
          hasValidLink: href.includes('/jobdetail/') || href.includes('/job/')  // ✅ 支持两种格式
        });
      });
      
      return jobs;
    });
    
    console.log(`\n找到 ${allJobs.length} 个 .jobinfo__name 元素:`);
    console.log('─'.repeat(80));
    allJobs.forEach(job => {
      console.log(`${job.index.toString().padStart(2)}. ${job.title.substring(0, 30).padEnd(30)} | ${job.company.substring(0, 20).padEnd(20)} | ${job.salary.padEnd(12)} | ${job.city.padEnd(6)} | ${job.hasValidLink ? '✓' : '✗'}链接`);
    });
    console.log('─'.repeat(80));
    console.log();
    
    // 检查是否有重复标题
    const titles = allJobs.map(j => j.title);
    const uniqueTitles = new Set(titles);
    console.log(`标题总数: ${titles.length}, 唯一标题数: ${uniqueTitles.size}`);
    if (titles.length !== uniqueTitles.size) {
      console.log('⚠️ 发现重复标题!');
      const titleCount = {};
      titles.forEach(t => {
        titleCount[t] = (titleCount[t] || 0) + 1;
      });
      Object.entries(titleCount).forEach(([title, count]) => {
        if (count > 1) {
          console.log(`  - "${title}" 出现 ${count} 次`);
        }
      });
    }
    console.log();
    
    // 检查是否有无效链接
    const invalidLinks = allJobs.filter(j => !j.hasValidLink);
    if (invalidLinks.length > 0) {
      console.log(`⚠️ 发现 ${invalidLinks.length} 个没有有效链接的职位:`);
      invalidLinks.forEach(job => {
        console.log(`  - ${job.title} (公司: ${job.company})`);
      });
      console.log();
    }
    
  } catch (error) {
    console.error('❌ 错误:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  } finally {
    if (browser) {
      await browser.close();
      console.log('浏览器已关闭');
    }
  }
  
  console.log('='.repeat(80));
  console.log('诊断完成');
  console.log('='.repeat(80));
})();
