const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function testTextBasedExtraction() {
  console.log('=== 测试基于文本分析的职位提取策略 ===\n');
  
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
    
    const url = 'https://www.zhaopin.com/sou/jl530/kw%E5%BC%80%E5%8F%91/p1';
    console.log('访问URL:', url);
    
    // 等待页面完全加载
    await page.goto(url, { 
      waitUntil: 'networkidle0',
      timeout: 60000 
    });
    
    console.log('✓ 页面加载完成');
    
    // 额外等待让JavaScript执行
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 使用新的文本分析策略提取职位
    const jobs = await page.evaluate(() => {
      const jobList = [];
      
      console.log('开始文本分析...');
      
      // 获取整个页面的文本内容
      const allTexts = document.body.textContent || '';
      const lines = allTexts.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      
      console.log(`总行数: ${lines.length}`);
      
      // 查找职位标题行
      const jobTitleLines = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // 检查是否是职位标题
        if ((line.includes('开发') || line.includes('工程师') || line.includes('Java') || 
             line.includes('Python') || line.includes('前端') || line.includes('后端')) &&
            line.length > 4 && line.length < 100 &&
            !line.includes('不限') && !line.includes('薪资要求') && !line.includes('学历要求') &&
            !line.includes('公司行业') && !line.includes('行政区') && !line.includes('地铁沿线')) {
          
          jobTitleLines.push({
            text: line,
            index: i
          });
        }
      }
      
      console.log(`找到 ${jobTitleLines.length} 个候选职位标题\n`);
      
      // 对每个职位标题，从上下文中提取更多信息
      jobTitleLines.forEach((job, idx) => {
        const titleIndex = allTexts.indexOf(job.text);
        if (titleIndex === -1) return;
        
        // 获取上下文（前后500字符）
        const contextStart = Math.max(0, titleIndex - 300);
        const contextEnd = Math.min(allTexts.length, titleIndex + job.text.length + 500);
        const context = allTexts.substring(contextStart, contextEnd);
        
        // 提取企业名称
        const companyMatch = context.match(/([\u4e00-\u9fa5]{2,30}(?:公司|科技|信息|网络|软件|技术|开发|有限))[\s\n]/);
        const company = companyMatch ? companyMatch[1] : '未知企业';
        
        // 提取薪资
        const salaryMatch = context.match(/(\d+(?:\.\d+)?[-~]\d+(?:\.\d+)?[Kk万]?|\d+[Kk万]以上|面议)/);
        const salary = salaryMatch ? salaryMatch[1] : '面议';
        
        // 提取城市
        const cityMatch = context.match(/(?:北京|上海|广州|深圳|杭州|成都|武汉|南京|西安|重庆|天津|苏州|郑州|长沙|青岛|大连|厦门|宁波)[\u4e00-\u9fa5·]*/);
        const city = cityMatch ? cityMatch[0].replace(/[·\s]/g, '') : '';
        
        jobList.push({
          title: job.text.trim(),
          company: company.trim(),
          salary: salary.trim(),
          city: city.trim()
        });
        
        console.log(`${idx + 1}. ${job.text.substring(0, 60)}`);
        console.log(`   企业: ${company.substring(0, 40)}`);
        console.log(`   薪资: ${salary}`);
        console.log(`   城市: ${city}\n`);
      });
      
      return jobList;
    });
    
    console.log('\n=== 提取结果汇总 ===');
    console.log(`总共提取到 ${jobs.length} 个职位\n`);
    
    if (jobs.length > 0) {
      console.log('前10个职位详情：');
      jobs.slice(0, 10).forEach((job, i) => {
        console.log(`${i + 1}. 【${job.title}】`);
        console.log(`   企业: ${job.company}`);
        console.log(`   薪资: ${job.salary}`);
        console.log(`   城市: ${job.city}`);
        console.log('');
      });
      
      console.log('✅ 测试成功！新的文本分析策略能有效提取职位数据');
    } else {
      console.log('❌ 测试失败！未能提取到职位数据');
    }
    
  } catch (error) {
    console.error('测试过程中出错:', error);
  } finally {
    await browser.close();
  }
}

testTextBasedExtraction().catch(console.error);
