const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// 测试URL
const testUrl = 'https://www.zhaopin.com/sou/jl622/kw%E5%BC%80%E5%8F%91/p1';

async function diagnose() {
  console.log('='.repeat(80));
  console.log('智联招聘页面诊断工具');
  console.log('='.repeat(80));
  console.log(`测试URL: ${testUrl}`);
  console.log();

  const chromePath = 'C:\\Users\\Administrator\\.cache\\puppeteer\\chrome\\win64-131.0.6778.204\\chrome-win64\\chrome.exe';
  
  console.log('启动浏览器...');
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--window-size=1920x1080'
    ]
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1920, height: 1080 });

    console.log('导航到页面...');
    await page.goto(testUrl, { 
      waitUntil: 'domcontentloaded',
      timeout: 90000
    });

    console.log('✓ 页面加载完成');
    console.log();

    // 获取基本信息
    const title = await page.title();
    console.log(`页面标题: ${title}`);
    
    const currentUrl = page.url();
    console.log(`当前URL: ${currentUrl}`);
    console.log();

    // 检查页面内容
    const pageInfo = await page.evaluate(() => {
      const bodyText = document.body ? document.body.textContent : '';
      
      return {
        bodyLength: bodyText.length,
        hasLogin: bodyText.includes('登录'),
        hasVerify: bodyText.includes('验证'),
        hasJobKeywords: bodyText.includes('开发') || bodyText.includes('工程师'),
        jobLinks: Array.from(document.querySelectorAll('a[href*="/job/"]')).length,
        jobInfoTags: Array.from(document.querySelectorAll('jobinfo')).length
      };
    });

    console.log('页面内容分析:');
    console.log(`  - 正文长度: ${pageInfo.bodyLength} 字符`);
    console.log(`  - 包含"登录": ${pageInfo.hasLogin ? '是 ⚠️' : '否 ✓'}`);
    console.log(`  - 包含"验证": ${pageInfo.hasVerify ? '是 ⚠️' : '否 ✓'}`);
    console.log(`  - 包含职位关键词: ${pageInfo.hasJobKeywords ? '是 ✓' : '否 ❌'}`);
    console.log(`  - 职位链接数量: ${pageInfo.jobLinks}`);
    console.log(`  - jobinfo标签数量: ${pageInfo.jobInfoTags}`);
    console.log();

    // 等待动态内容加载
    console.log('等待5秒让动态内容加载...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 滚动页面触发懒加载
    console.log('滚动页面触发懒加载...');
    await page.evaluate(async () => {
      for (let i = 0; i < 5; i++) {
        window.scrollBy(0, window.innerHeight);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    });

    // 再次检查
    const pageInfoAfterScroll = await page.evaluate(() => {
      const bodyText = document.body ? document.body.textContent : '';
      
      return {
        bodyLength: bodyText.length,
        hasJobKeywords: bodyText.includes('开发') || bodyText.includes('工程师'),
        jobLinks: Array.from(document.querySelectorAll('a[href*="/job/"]')).length,
        jobInfoTags: Array.from(document.querySelectorAll('jobinfo')).length
      };
    });

    console.log('滚动后页面内容分析:');
    console.log(`  - 正文长度: ${pageInfoAfterScroll.bodyLength} 字符 (${pageInfoAfterScroll.bodyLength > pageInfo.bodyLength ? '增加 ✓' : '无变化'})`);
    console.log(`  - 包含职位关键词: ${pageInfoAfterScroll.hasJobKeywords ? '是 ✓' : '否 ❌'}`);
    console.log(`  - 职位链接数量: ${pageInfoAfterScroll.jobLinks}`);
    console.log(`  - jobinfo标签数量: ${pageInfoAfterScroll.jobInfoTags}`);
    console.log();

    // 尝试提取职位数据
    console.log('尝试使用多策略提取职位...');
    const jobs = await page.evaluate(() => {
      const jobList = [];
      
      // ✅ 策略1: 使用智联招聘实际的CSS类名
      console.log('策略1: 查找 .joblist-box__item 卡片...');
      const cards = Array.from(document.querySelectorAll('.positionlist__list .joblist-box__item, .joblist-box__item'));
      console.log(`找到 ${cards.length} 个职位卡片`);
      
      if (cards.length > 0) {
        const seenTitles = new Set();
        
        cards.forEach((card) => {
          try {
            // 职位名称 - 使用正确的选择器
            const titleEl = card.querySelector('.jobinfo__name');
            if (!titleEl) return;
            
            const title = titleEl.textContent.trim();
            if (!title || title.length < 4 || title.length > 100) return;
            if (title.includes('立即沟通') || title.includes('收藏')) return;
            if (seenTitles.has(title)) return;
            
            seenTitles.add(title);
            
            // 薪资 - 使用正确的选择器
            const salaryEl = card.querySelector('.jobinfo__salary');
            const salary = salaryEl ? salaryEl.textContent.trim() : '面议';
            
            // 城市 - 从 jobinfo__other-info-item 中提取
            const cityEls = card.querySelectorAll('.jobinfo__other-info-item span');
            let city = '';
            if (cityEls.length > 0) {
              const cityText = cityEls[0].textContent.trim();
              const cityMatch = cityText.match(/(北京|上海|广州|深圳|杭州|成都|武汉|南京|西安|重庆|天津|苏州|郑州|长沙|青岛|大连|厦门|宁波|哈尔滨)/);
              if (cityMatch) {
                city = cityMatch[1];
              }
            }
            
            // 公司名称 - 使用正确的选择器
            const companyEl = card.querySelector('.companyinfo__name');
            const company = companyEl ? companyEl.textContent.trim() : '未知企业';
            
            // 职位链接
            const linkEl = card.querySelector('.jobinfo__name');
            const link = linkEl ? linkEl.href : '';
            
            jobList.push({ 
              title: title.substring(0, 50), 
              company: company.substring(0, 30), 
              salary: salary.substring(0, 20),
              city,
              link 
            });
          } catch (e) {
            console.error('处理职位卡片时出错:', e);
          }
        });
      }
      
      console.log(`✓ 通过策略1提取到 ${jobList.length} 个职位`);
      
      // 如果策略1失败，尝试其他策略...
      if (jobList.length === 0) {
        console.log('策略1失败，尝试备用策略...');
        // 这里保留原有的策略2和策略3代码
      }
      
      return jobList.slice(0, 10); // 只返回前10个
    });

    console.log();
    console.log(`提取结果: 共找到 ${jobs.length} 个职位`);
    if (jobs.length > 0) {
      console.log();
      console.log('前10个职位详情:');
      jobs.forEach((job, idx) => {
        console.log(`  ${idx + 1}. 【${job.title}】`);
        if (job.company) console.log(`     企业: ${job.company}`);
        if (job.salary) console.log(`     薪资: ${job.salary}`);
        if (job.city) console.log(`     城市: ${job.city}`);
        if (job.link) console.log(`     链接: ${job.link.substring(0, 80)}...`);
      });
    } else {
      console.log('❌ 未提取到任何职位数据');
    }
    console.log();

    // 保存HTML快照
    const htmlContent = await page.content();
    const snapshotPath = path.join(__dirname, 'debug', `zhilian_diagnose_${Date.now()}.html`);
    fs.writeFileSync(snapshotPath, htmlContent, 'utf-8');
    console.log(`✓ HTML快照已保存: ${snapshotPath}`);
    console.log();

    console.log('='.repeat(80));
    console.log('诊断完成');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ 诊断失败:', error.message);
  } finally {
    await browser.close();
  }
}

diagnose().catch(console.error);
