const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function testSalaryExtraction() {
  console.log('=== 测试改进后的薪资提取逻辑 ===\n');
  
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
    
    await page.goto(url, { 
      waitUntil: 'networkidle0',
      timeout: 60000 
    });
    
    console.log('✓ 页面加载完成');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 使用改进的薪资提取逻辑
    const jobs = await page.evaluate(() => {
      const jobList = [];
      const allTexts = document.body.textContent || '';
      const lines = allTexts.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      
      // 查找职位标题行
      const jobTitleLines = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if ((line.includes('开发') || line.includes('工程师') || line.includes('Java') || 
             line.includes('Python') || line.includes('前端') || line.includes('后端')) &&
            line.length > 4 && line.length < 100 &&
            !line.includes('不限') && !line.includes('薪资要求') && !line.includes('学历要求') &&
            !line.includes('公司行业') && !line.includes('行政区') && !line.includes('地铁沿线')) {
          jobTitleLines.push({ text: line, index: i });
        }
      }
      
      console.log(`找到 ${jobTitleLines.length} 个候选职位标题\n`);
      
      // 对每个职位提取信息
      jobTitleLines.forEach((job, idx) => {
        const titleIndex = allTexts.indexOf(job.text);
        if (titleIndex === -1) return;
        
        const contextStart = Math.max(0, titleIndex - 300);
        const contextEnd = Math.min(allTexts.length, titleIndex + job.text.length + 500);
        const context = allTexts.substring(contextStart, contextEnd);
        
        // 提取企业名称
        const companyMatch = context.match(/([\u4e00-\u9fa5]{2,30}(?:公司|科技|信息|网络|软件|技术|开发|有限))[\s\n]/);
        const company = companyMatch ? companyMatch[1] : '未知企业';
        
        // 提取薪资 - 使用改进的逻辑
        let salary = '面议';
        
        const salaryPattern1 = /(\d+(?:\.\d+)?[-~]\d+(?:\.\d+)?[Kk万])/;
        const salaryPattern2 = /(\d+(?:\.\d+)?[Kk万](?:以上|以下)?)/;
        const salaryPattern3 = /(\d+(?:\.\d+)?千[-~]\d+(?:\.\d+)?千|\d+(?:\.\d+)?千以上)/;
        const salaryPattern4 = /(\d+(?:\.\d+)?元[-~]\d+(?:\.\d+)?元|\d+(?:\.\d+)?元\/月)/;
        
        let salaryMatch = salaryPattern1.exec(context);
        if (!salaryMatch) salaryMatch = salaryPattern2.exec(context);
        if (!salaryMatch) salaryMatch = salaryPattern3.exec(context);
        if (!salaryMatch) salaryMatch = salaryPattern4.exec(context);
        
        if (salaryMatch) {
          const matched = salaryMatch[1];
          const numPart = matched.replace(/[^0-9.]/g, '');
          const nums = numPart.split(/[.~\-]/).filter(n => n.length > 0);
          
          const isValid = nums.every(n => {
            const num = parseFloat(n);
            if (matched.includes('万')) {
              return num >= 0.5 && num <= 100;
            }
            if (matched.toLowerCase().includes('k')) {
              return num >= 1 && num <= 100;
            }
            if (matched.includes('千')) {
              return num >= 1 && num <= 100;
            }
            return num >= 3000 && num <= 100000;
          });
          
          if (isValid) {
            salary = matched;
          }
        }
        
        // 提取城市
        const cityMatch = context.match(/(?:北京|上海|广州|深圳|杭州|成都|武汉|南京|西安|重庆|天津|苏州|郑州|长沙|青岛|大连|厦门|宁波)[\u4e00-\u9fa5·]*/);
        const city = cityMatch ? cityMatch[0].replace(/[·\s]/g, '') : '';
        
        jobList.push({
          title: job.text.trim(),
          company: company.trim(),
          salary: salary.trim(),
          city: city.trim()
        });
      });
      
      return jobList;
    });
    
    console.log('\n=== 提取结果汇总 ===');
    console.log(`总共提取到 ${jobs.length} 个职位\n`);
    
    if (jobs.length > 0) {
      console.log('所有职位的薪资信息：');
      jobs.forEach((job, i) => {
        console.log(`${i + 1}. 【${job.title.substring(0, 40)}】`);
        console.log(`   企业: ${job.company.substring(0, 40)}`);
        console.log(`   薪资: ${job.salary}  ${isValidSalary(job.salary) ? '✅' : '❌'}`);
        console.log(`   城市: ${job.city}`);
        console.log('');
      });
      
      // 统计薪资识别准确率
      const validSalaries = jobs.filter(j => isValidSalary(j.salary));
      console.log(`\n=== 薪资识别统计 ===`);
      console.log(`总职位数: ${jobs.length}`);
      console.log(`有效薪资: ${validSalaries.length}`);
      console.log(`识别准确率: ${((validSalaries.length / jobs.length) * 100).toFixed(1)}%`);
    }
    
  } catch (error) {
    console.error('测试过程中出错:', error);
  } finally {
    await browser.close();
  }
}

// 验证薪资格式是否正确
function isValidSalary(salary) {
  if (salary === '面议') return true;
  
  // 应该包含薪资单位（万、K、千、元）
  const hasUnit = /万|K|k|千|元/.test(salary);
  
  // 不应该包含日期特征
  const hasDate = /月|日|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/.test(salary);
  
  // 不应该是纯数字范围（可能是公司规模）
  const isPureNumber = /^\d+[-~]\d+$/.test(salary);
  
  return hasUnit && !hasDate && !isPureNumber;
}

testSalaryExtraction().catch(console.error);
