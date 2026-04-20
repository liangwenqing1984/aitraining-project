const puppeteer = require('puppeteer');

async function testJobTitleExtraction() {
  console.log('=== 测试优化后的职位名称提取逻辑 ===\n');
  
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
    
    // 使用优化后的职位名称提取逻辑
    const jobs = await page.evaluate(() => {
      const jobList = [];
      const allTexts = document.body.textContent || '';
      const lines = allTexts.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      
      console.log(`总行数: ${lines.length}`);
      
      // 查找职位标题行
      const jobTitleLines = [];
      for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        
        // 清理操作按钮文本
        line = line.replace(/立即投递\s*/g, '')
                   .replace(/收藏\s*/g, '')
                   .replace(/投递\s*/g, '')
                   .trim();
        
        // 检查是否是职位标题
        const hasJobKeyword = line.includes('开发') || line.includes('工程师') || line.includes('Java') || 
                              line.includes('Python') || line.includes('前端') || line.includes('后端') ||
                              line.includes('算法') || line.includes('架构') || line.includes('测试') ||
                              line.includes('经理') || line.includes('主管') || line.includes('总监');
        
        // 排除条件
        const shouldExclude = 
          line.length < 4 || line.length > 60 ||
          line.includes('不限') || line.includes('薪资要求') || line.includes('学历要求') ||
          line.includes('公司行业') || line.includes('行政区') || line.includes('地铁沿线') ||
          line.includes('公司规模') || line.includes('公司性质') ||
          line.includes('有限公司') || line.includes('责任公司') || line.includes('分公司') ||
          line.includes('交流中心') || line.includes('研究中心') || line.includes('研究院') ||
          line.includes('开发中心') || line.includes('服务中心') ||
          line.includes('"title"') || line.includes('meta') || line.includes('charset') ||
          line.includes('「') || line.includes('」') ||
          /^(北京|上海|广州|深圳|杭州|成都|武汉|南京|西安|重庆|天津)[·\s]/.test(line) ||
          (/^[A-Za-z0-9+]+$/.test(line.replace(/[\s·\-\/]/g, '')) && !line.includes('工程师') && !line.includes('开发') && !line.includes('经理')) ||
          (line.match(/[A-Z][a-z]+/g) && line.match(/[A-Z][a-z]+/g).length >= 4 && !line.includes('工程师')) ||
          /^(房地产|互联网|金融|教育|医疗|制造)[\u4e00-\u9fa5]{0,10}$/.test(line) ||
          /^北京[市区县]/.test(line) ||
          line.includes('月薪') ||
          line.includes('外包') ||
          /\(.{10,}\)/.test(line) ||
          (line.match(/(?:Spring|Cloud|Boot|Java|JavaScript|Python|C\+\+|MySQL|Oracle|Linux|Git)/gi) && 
           line.match(/(?:Spring|Cloud|Boot|Java|JavaScript|Python|C\+\+|MySQL|Oracle|Linux|Git)/gi).length >= 3);
        
        if (hasJobKeyword && !shouldExclude) {
          // 进一步清理：移除城市信息
          line = line.replace(/[\s]+(北京|上海|广州|深圳|杭州|成都|武汉|南京|西安|重庆|天津)[\u4e00-\u9fa5·\s]*/g, '')
                     .trim();
          
          // 清理多余空格和特殊字符
          line = line.replace(/\s+/g, ' ')
                     .replace(/[·•]/g, '')
                     .trim();
          
          // 清理末尾的技术标签
          line = line.replace(/[A-Z][a-zA-Z+]{5,}$/, '').trim();
          
          // 清理开头的技术标签
          line = line.replace(/^[A-Z][a-zA-Z+]{5,}\s*/, '').trim();
          
          // 再次检查长度和质量
          if (line.length >= 4 && line.length <= 50 && 
              (line.includes('工程师') || line.includes('开发') || line.includes('经理') || 
               line.includes('主管') || line.includes('专员') || line.includes('助理') ||
               line.includes('设计师') || line.includes('架构师'))) {
            jobTitleLines.push(line);
          }
        }
      }
      
      console.log(`找到 ${jobTitleLines.length} 个候选职位标题\n`);
      
      // 对每个职位提取信息
      jobTitleLines.forEach((title, idx) => {
        const titleIndex = allTexts.indexOf(title);
        if (titleIndex === -1) return;
        
        const contextStart = Math.max(0, titleIndex - 300);
        const contextEnd = Math.min(allTexts.length, titleIndex + title.length + 500);
        const context = allTexts.substring(contextStart, contextEnd);
        
        // 提取企业名称
        const companyMatch = context.match(/([\u4e00-\u9fa5]{2,30}(?:公司|科技|信息|网络|软件|技术|开发|有限))[\s\n]/);
        const company = companyMatch ? companyMatch[1] : '未知企业';
        
        // 提取薪资
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
            if (matched.includes('万')) return num >= 0.5 && num <= 100;
            if (matched.toLowerCase().includes('k')) return num >= 1 && num <= 100;
            if (matched.includes('千')) return num >= 1 && num <= 100;
            return num >= 3000 && num <= 100000;
          });
          
          if (isValid) salary = matched;
        }
        
        // 提取城市
        const cityMatch = context.match(/(?:北京|上海|广州|深圳|杭州|成都|武汉|南京|西安|重庆|天津|苏州|郑州|长沙|青岛|大连|厦门|宁波)[\u4e00-\u9fa5·]*/);
        const city = cityMatch ? cityMatch[0].replace(/[·\s]/g, '') : '';
        
        jobList.push({
          title: title,
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
      console.log('所有职位的标题信息（前20个）：');
      jobs.slice(0, 20).forEach((job, i) => {
        console.log(`${i + 1}. 【${job.title}】`);
        console.log(`   企业: ${job.company.substring(0, 40)}`);
        console.log(`   薪资: ${job.salary}`);
        console.log(`   城市: ${job.city}`);
        console.log('');
      });
      
      // 分析标题质量
      console.log('\n=== 标题质量分析 ===');
      const hasDirtyData = jobs.some(j => 
        j.title.includes('立即投递') || 
        j.title.includes('收藏') ||
        j.title.includes('有限公司') ||
        j.title.includes('北京·') ||
        j.title.length > 60
      );
      
      if (hasDirtyData) {
        console.log('❌ 仍存在脏数据，需要进一步优化');
      } else {
        console.log('✅ 标题质量良好，无明显脏数据');
      }
    }
    
  } catch (error) {
    console.error('测试过程中出错:', error);
  } finally {
    await browser.close();
  }
}

testJobTitleExtraction().catch(console.error);
