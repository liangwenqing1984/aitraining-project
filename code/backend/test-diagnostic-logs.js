// 测试智联招聘爬虫的诊断日志功能
const puppeteer = require('puppeteer');

async function testDiagnosticLogs() {
  console.log('🧪 开始测试诊断日志功能...\n');
  
  let browser;
  try {
    // 启动浏览器
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
    
    // 访问智联招聘搜索页面（销售 + 哈尔滨）
    const keyword = '销售';
    const cityCode = '622'; // 哈尔滨
    const url = `https://www.zhaopin.com/sou?jl=${cityCode}&kw=${encodeURIComponent(keyword)}&p=1`;
    
    console.log(`🌐 访问URL: ${url}\n`);
    
    await page.goto(url, { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });
    
    // 等待动态内容加载
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 执行与zhilian.ts相同的解析逻辑
    console.log('[ZhilianCrawler] 开始使用多策略DOM解析职位数据...\n');
    
    const result = await page.evaluate(() => {
      const jobList = [];
      const globalSeenTitles = new Set();
      const globalSeenHrefs = new Set();
      
      // 策略1统计
      const strategy1Stats = {
        foundContainers: 0,
        extractedJobs: 0,
        failedExtractions: 0
      };
      
      // ========== 策略1: div.jobinfo ==========
      const jobInfos = document.querySelectorAll('div.jobinfo');
      strategy1Stats.foundContainers = jobInfos.length;
      
      if (jobInfos.length > 0) {
        console.log(`[ZhilianCrawler] 策略1: 找到 ${jobInfos.length} 个 div.jobinfo 容器`);
        
        jobInfos.forEach((jobInfo) => {
          try {
            const titleEl = jobInfo.querySelector('.jobinfo__name, .job-name, .job-title');
            if (!titleEl) {
              strategy1Stats.failedExtractions++;
              return;
            }
            
            const title = (titleEl.textContent || '').trim();
            if (!title || title.length < 2 || title.length > 150) {
              strategy1Stats.failedExtractions++;
              return;
            }
            
            if (globalSeenTitles.has(title)) {
              strategy1Stats.failedExtractions++;
              return;
            }
            
            globalSeenTitles.add(title);
            
            // 简化提取，只获取标题和链接
            const linkEl = jobInfo.querySelector('a[href*="zhaopin.com"]');
            const link = linkEl ? linkEl.href : '';
            
            if (link) {
              jobList.push({ title, link });
              strategy1Stats.extractedJobs++;
            } else {
              strategy1Stats.failedExtractions++;
            }
          } catch (e) {
            strategy1Stats.failedExtractions++;
          }
        });
        
        console.log(`[ZhilianCrawler] 策略1提取完成，共找到 ${strategy1Stats.extractedJobs} 个职位 (失败${strategy1Stats.failedExtractions}次)`);
      } else {
        console.log(`[ZhilianCrawler] ⚠️ 策略1: 未找到任何 div.jobinfo 容器`);
      }
      
      return {
        jobs: jobList,
        stats: {
          strategy1: strategy1Stats
        }
      };
    });
    
    // Node.js端输出汇总日志
    const jobList = result.jobs || [];
    const stats = result.stats || {};
    
    console.log('\n[ZhilianCrawler] 📊 多策略解析汇总:');
    console.log(`[ZhilianCrawler]    策略1 (div.jobinfo): 提取 ${stats.strategy1?.extractedJobs || 0} 个职位 (失败${stats.strategy1?.failedExtractions || 0}次)`);
    console.log(`[ZhilianCrawler]    最终结果: ${jobList.length} 个职位（已去重）\n`);
    
    // 显示提取到的职位
    console.log('📋 提取到的职位列表:');
    jobList.forEach((job, index) => {
      console.log(`  ${index + 1}. ${job.title}`);
    });
    
    console.log('\n✅ 测试完成！');
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

testDiagnosticLogs();
