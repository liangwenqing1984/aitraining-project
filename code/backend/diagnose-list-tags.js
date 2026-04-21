const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  console.log('='.repeat(80));
  console.log('智联招聘列表页标签元素诊断');
  console.log('='.repeat(80));
  
  const testUrl = 'https://sou.zhaopin.com/?jl=538&kw=%E5%89%8D%E7%AB%AF%E5%BC%80%E5%8F%91&p=1';
  
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
    console.log('等待5秒让动态内容加载...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 滚动触发更多内容加载
    console.log('滚动页面触发懒加载...');
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => {
        window.scrollBy(0, window.innerHeight);
      });
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log();
    console.log('提取职位卡片和标签元素...');
    const tagInfo = await page.evaluate(() => {
      const result = {
        totalJobs: 0,
        sampleJobs: []
      };
      
      // 查找所有职位卡片
      const jobItems = Array.from(document.querySelectorAll('.joblist-box__item'));
      result.totalJobs = jobItems.length;
      
      console.log(`找到 ${jobItems.length} 个职位卡片`);
      
      // 分析前5个职位卡片的标签
      jobItems.slice(0, 5).forEach((item, index) => {
        const jobInfo = {
          index: index + 1,
          title: '',
          company: '',
          tags: [],
          tagElements: []
        };
        
        // 职位名称
        const titleEl = item.querySelector('.jobinfo__name');
        if (titleEl) {
          jobInfo.title = titleEl.textContent.trim();
        }
        
        // 公司名称
        const companyEl = item.querySelector('.company-info__name');
        if (companyEl) {
          jobInfo.company = companyEl.textContent.trim();
        }
        
        // 查找所有标签元素
        const tagContainers = item.querySelectorAll('.joblist-box__item-tag');
        if (tagContainers.length > 0) {
          tagContainers.forEach((container, tagIndex) => {
            const tagText = container.textContent.trim();
            const tagName = container.tagName.toLowerCase();
            const className = container.className;
            
            jobInfo.tags.push(tagText);
            jobInfo.tagElements.push({
              index: tagIndex,
              text: tagText,
              tagName,
              className
            });
          });
        }
        
        // 同时查找其他可能的标签容器
        const otherTags = item.querySelectorAll('[class*="tag"], [class*="label"]');
        if (otherTags.length > 0) {
          jobInfo.otherTags = Array.from(otherTags).map(el => ({
            text: el.textContent.trim(),
            className: el.className
          })).slice(0, 10); // 最多取10个
        }
        
        result.sampleJobs.push(jobInfo);
      });
      
      return result;
    });
    
    console.log('─'.repeat(80));
    console.log(`总共找到 ${tagInfo.totalJobs} 个职位卡片`);
    console.log('─'.repeat(80));
    console.log();
    
    // 详细展示每个职位的标签信息
    tagInfo.sampleJobs.forEach(job => {
      console.log(`【职位 ${job.index}】`);
      console.log(`  职位: ${job.title || '未知'}`);
      console.log(`  公司: ${job.company || '未知'}`);
      console.log();
      
      if (job.tags.length > 0) {
        console.log(`  标签数量: ${job.tags.length}`);
        job.tagElements.forEach(tag => {
          console.log(`    [${tag.index}] "${tag.text}"`);
          console.log(`         标签名: <${tag.tagName}>`);
          console.log(`         类名: ${tag.className}`);
        });
      } else {
        console.log(`  ⚠️  未找到 .joblist-box__item-tag 元素`);
      }
      
      if (job.otherTags && job.otherTags.length > 0) {
        console.log();
        console.log(`  其他可能的标签元素（前10个）:`);
        job.otherTags.forEach((tag, idx) => {
          console.log(`    ${idx + 1}. "${tag.text}" - 类名: ${tag.className}`);
        });
      }
      
      console.log();
      console.log('─'.repeat(80));
      console.log();
    });
    
    // 分析标签内容模式
    console.log('📊 标签内容分析:');
    console.log();
    
    const allTags = [];
    tagInfo.sampleJobs.forEach(job => {
      job.tags.forEach(tag => {
        allTags.push(tag);
      });
    });
    
    if (allTags.length > 0) {
      console.log('所有找到的标签内容:');
      allTags.forEach((tag, idx) => {
        console.log(`  ${idx + 1}. "${tag}"`);
      });
      console.log();
      
      // 判断是否包含公司性质关键词
      const natureKeywords = ['民营', '国企', '外企', '合资', '股份制', '上市公司', '事业单位'];
      const financingKeywords = ['未融资', '天使轮', 'A轮', 'B轮', 'C轮', 'D轮', '已上市'];
      
      console.log('检查是否包含公司性质关键词:');
      natureKeywords.forEach(keyword => {
        const matches = allTags.filter(tag => tag.includes(keyword));
        if (matches.length > 0) {
          console.log(`  ✅ "${keyword}": 出现 ${matches.length} 次`);
          matches.forEach(m => console.log(`     - "${m}"`));
        }
      });
      
      console.log();
      console.log('检查是否包含融资状态关键词:');
      financingKeywords.forEach(keyword => {
        const matches = allTags.filter(tag => tag.includes(keyword));
        if (matches.length > 0) {
          console.log(`  ⚠️  "${keyword}": 出现 ${matches.length} 次`);
          matches.forEach(m => console.log(`     - "${m}"`));
        }
      });
    } else {
      console.log('  ⚠️  未找到任何标签内容');
    }
    
    console.log();
    console.log('='.repeat(80));
    console.log('诊断完成');
    console.log('='.repeat(80));
    
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
})();
