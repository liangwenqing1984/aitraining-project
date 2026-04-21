const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
  console.log('启动浏览器...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    // 设置User-Agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    const url = 'https://www.zhaopin.com/sou/jl530/kwjava/p1';
    console.log(`访问页面: ${url}`);
    
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
    
    // 等待动态内容加载
    console.log('等待动态内容加载...');
    await page.waitForTimeout(5000);
    
    // 获取页面HTML结构
    const html = await page.content();
    const debugDir = path.join(__dirname, 'debug');
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true });
    }
    const htmlPath = path.join(debugDir, 'zhilian-dom-structure.html');
    fs.writeFileSync(htmlPath, html, 'utf-8');
    console.log(`HTML已保存到: ${htmlPath}`);
    
    // 分析DOM结构
    console.log('\n=== DOM结构分析 ===\n');
    
    const structure = await page.evaluate(() => {
      const result = {
        jobContainers: [],
        possibleSelectors: []
      };
      
      // 尝试常见的职位容器选择器
      const selectors = [
        '.joblist-box__item',
        '.positionlist__listitem',
        '[class*="job"]',
        '[class*="position"]',
        '[class*="sou"]',
        'article',
        'section'
      ];
      
      for (const selector of selectors) {
        try {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            result.possibleSelectors.push({
              selector,
              count: elements.length,
              sampleText: elements[0]?.textContent?.substring(0, 100) || ''
            });
          }
        } catch (e) {
          // 忽略无效选择器
        }
      }
      
      // 查找包含"工程师"、"开发"等关键词的元素
      const allElements = document.querySelectorAll('*');
      let matchCount = 0;
      const matches = [];
      
      allElements.forEach(el => {
        const text = el.textContent || '';
        if ((text.includes('工程师') || text.includes('开发')) && text.length < 200 && text.length > 10) {
          matchCount++;
          if (matches.length < 5) {
            matches.push({
              tagName: el.tagName,
              className: el.className,
              id: el.id,
              text: text.substring(0, 100),
              parentClass: el.parentElement?.className || '',
              depth: getElementDepth(el)
            });
          }
        }
      });
      
      result.jobContainers = matches;
      result.totalMatches = matchCount;
      
      return result;
    });
    
    function getElementDepth(el) {
      let depth = 0;
      let parent = el.parentElement;
      while (parent) {
        depth++;
        parent = parent.parentElement;
      }
      return depth;
    }
    
    console.log('找到的可能选择器:');
    structure.possibleSelectors.forEach(s => {
      console.log(`  - ${s.selector}: ${s.count}个元素`);
      console.log(`    示例文本: ${s.sampleText.substring(0, 80)}...`);
    });
    
    console.log(`\n包含职位关键词的元素总数: ${structure.totalMatches}`);
    console.log('\n前5个匹配元素的详细信息:');
    structure.jobContainers.forEach((match, idx) => {
      console.log(`\n[${idx + 1}]`);
      console.log(`  标签: ${match.tagName}`);
      console.log(`  类名: ${match.className}`);
      console.log(`  ID: ${match.id}`);
      console.log(`  父元素类名: ${match.parentClass}`);
      console.log(`  深度: ${match.depth}`);
      console.log(`  文本: ${match.text}...`);
    });
    
    // 尝试提取职位数据
    console.log('\n\n=== 尝试提取职位数据 ===\n');
    
    const jobs = await page.evaluate(() => {
      const jobList = [];
      
      // 策略：查找所有包含职位信息的卡片式元素
      // 通常职位卡片会有特定的class或data属性
      
      // 方法1: 查找所有链接中包含/job/的元素
      const jobLinks = document.querySelectorAll('a[href*="/job/"]');
      console.log(`找到 ${jobLinks.length} 个职位链接`);
      
      jobLinks.forEach(link => {
        const href = link.href;
        const text = link.textContent?.trim() || '';
        
        if (text.length > 5 && text.length < 100) {
          // 向上查找父容器
          let container = link.parentElement;
          let depth = 0;
          while (container && depth < 5) {
            const containerText = container.textContent || '';
            
            // 检查是否包含薪资、城市等信息
            if (containerText.match(/\d+[Kk万]/) || containerText.match(/北京|上海|广州|深圳/)) {
              // 提取企业名称
              const companyMatch = containerText.match(/([\u4e00-\u9fa5]{2,30}(?:公司|科技|信息|网络|软件))/);
              
              jobList.push({
                title: text,
                company: companyMatch ? companyMatch[1] : '',
                containerClass: container.className,
                containerTag: container.tagName
              });
              break;
            }
            
            container = container.parentElement;
            depth++;
          }
        }
      });
      
      return jobList.slice(0, 10); // 只返回前10个用于调试
    });
    
    console.log(`提取到 ${jobs.length} 个职位:\n`);
    jobs.forEach((job, idx) => {
      console.log(`${idx + 1}. ${job.title}`);
      console.log(`   企业: ${job.company}`);
      console.log(`   容器类名: ${job.containerClass}`);
      console.log(`   容器标签: ${job.containerTag}\n`);
    });
    
  } catch (error) {
    console.error('错误:', error.message);
  } finally {
    await browser.close();
    console.log('\n浏览器已关闭');
  }
})();
