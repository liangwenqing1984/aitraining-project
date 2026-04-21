const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
  console.log('启动浏览器...');
  
  // 使用项目中已安装的Chrome版本
  const chromePath = 'C:\\Users\\Administrator\\.cache\\puppeteer\\chrome\\win64-131.0.6778.204\\chrome-win64\\chrome.exe';
  
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: chromePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    
    // 设置User-Agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
    
    const url = 'https://www.zhaopin.com/sou/jl622/kw%E8%AE%BE%E8%AE%A1/p1';
    console.log(`访问URL: ${url}`);
    
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    console.log('页面加载完成，等待动态内容...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 保存HTML快照
    const html = await page.content();
    const debugDir = path.join(__dirname, 'debug');
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true });
    }
    const timestamp = Date.now();
    const debugFile = path.join(debugDir, `zhilian-jobinfo-test-${timestamp}.html`);
    fs.writeFileSync(debugFile, html);
    console.log(`✓ HTML快照已保存: ${debugFile}`);
    
    // 深度分析 jobinfo 标签结构
    console.log('\n=== 深度分析 jobinfo 标签结构 ===\n');
    
    const analysis = await page.evaluate(() => {
      const result = {
        jobinfoCount: 0,
        jobinfoStructure: [],
        allTags: {},
        sampleData: []
      };
      
      // 1. 查找所有 jobinfo 标签
      const jobinfoElements = document.querySelectorAll('jobinfo');
      result.jobinfoCount = jobinfoElements.length;
      console.log(`找到 ${result.jobinfoCount} 个 <jobinfo> 标签`);
      
      if (result.jobinfoCount === 0) {
        console.log('⚠️ 未找到 jobinfo 标签，尝试其他选择器...');
        
        // 尝试常见选择器
        const selectors = [
          '[class*="job"]',
          '[class*="position"]',
          'article',
          'section'
        ];
        
        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0 && elements.length <= 30) {
            console.log(`  ✓ ${selector}: ${elements.length} 个元素`);
          }
        }
        
        return result;
      }
      
      // 2. 分析前3个 jobinfo 的完整结构
      for (let i = 0; i < Math.min(3, result.jobinfoCount); i++) {
        const jobinfo = jobinfoElements[i];
        const structure = {
          index: i,
          className: jobinfo.className,
          id: jobinfo.id,
          childTags: [],
          allText: jobinfo.innerText?.substring(0, 500),
          links: []
        };
        
        // 遍历所有子元素
        const allElements = jobinfo.querySelectorAll('*');
        const tagCount = {};
        
        allElements.forEach(el => {
          const tag = el.tagName.toLowerCase();
          tagCount[tag] = (tagCount[tag] || 0) + 1;
          
          // 记录关键信息
          if (['a', 'span', 'div', 'p'].includes(tag)) {
            const text = (el.textContent || '').trim();
            if (text.length > 0 && text.length < 200) {
              structure.links.push({
                tag: tag,
                className: el.className,
                text: text.substring(0, 100),
                href: el.href || null
              });
            }
          }
        });
        
        structure.childTags = tagCount;
        result.jobinfoStructure.push(structure);
        
        console.log(`\n--- jobinfo #${i + 1} ---`);
        console.log(`类名: ${jobinfo.className}`);
        console.log(`子元素统计:`, tagCount);
        console.log(`文本预览: ${structure.allText.substring(0, 200)}...`);
      }
      
      // 3. 提取职位数据示例
      for (let i = 0; i < Math.min(5, result.jobinfoCount); i++) {
        const jobinfo = jobinfoElements[i];
        
        // 尝试多种选择器提取信息
        const titleEl = jobinfo.querySelector('.job-name, .jobname, [class*="job"] a, a[href*="/job/"]');
        const companyEl = jobinfo.querySelector('.company, .company-name, [class*="company"]');
        const salaryEl = jobinfo.querySelector('.salary, .sal, [class*="salary"]');
        const cityEl = jobinfo.querySelector('.city, .area, .address, [class*="city"], [class*="area"]');
        
        const sample = {
          title: titleEl ? (titleEl.textContent || '').trim() : null,
          company: companyEl ? (companyEl.textContent || '').trim() : null,
          salary: salaryEl ? (salaryEl.textContent || '').trim() : null,
          city: cityEl ? (cityEl.textContent || '').trim() : null,
          link: titleEl && titleEl.href ? titleEl.href : null
        };
        
        result.sampleData.push(sample);
        
        console.log(`\n职位 #${i + 1}:`);
        console.log(`  标题: ${sample.title}`);
        console.log(`  公司: ${sample.company}`);
        console.log(`  薪资: ${sample.salary}`);
        console.log(`  城市: ${sample.city}`);
        console.log(`  链接: ${sample.link}`);
      }
      
      return result;
    });
    
    console.log('\n=== 分析结果汇总 ===\n');
    console.log(JSON.stringify(analysis, null, 2));
    
    // 保存分析结果
    const analysisFile = path.join(debugDir, `zhilian-jobinfo-analysis-${timestamp}.json`);
    fs.writeFileSync(analysisFile, JSON.stringify(analysis, null, 2));
    console.log(`\n✓ 分析结果已保存: ${analysisFile}`);
    console.log(`✓ HTML文件: ${debugFile}`);
    
  } catch (error) {
    console.error('❌ 错误:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
    console.log('\n✓ 浏览器已关闭');
  }
})();
