const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
  console.log('='.repeat(80));
  console.log('智联招聘公司性质字段诊断');
  console.log('='.repeat(80));
  
  // 使用之前保存的HTML快照，或者访问真实页面
  const testUrl = 'http://www.zhaopin.com/jobdetail/CC347570330J40933614602.htm';
  
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
    
    console.log('导航到详情页...');
    await page.goto(testUrl, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    console.log('✓ 页面加载完成');
    console.log();
    
    // 等待动态内容加载
    console.log('等待3秒让动态内容加载...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 提取公司信息相关的所有元素
    console.log('提取公司信息相关元素...');
    const companyInfo = await page.evaluate(() => {
      const result = {};
      
      // 1. 公司名称
      const companyEl = document.querySelector('.company-info__name');
      result.companyName = companyEl ? companyEl.textContent.trim() : '';
      
      // 2. 公司描述信息（关键）
      const companyDescEl = document.querySelector('.company-info__desc');
      if (companyDescEl) {
        result.companyDescFull = companyDescEl.textContent.trim();
        result.companyDescParts = companyDescEl.textContent.split('·').map(p => p.trim());
      }
      
      // 3. 查找所有可能的公司性质相关元素
      const natureSelectors = [
        '.company-info__nature',
        '[class*="nature"]',
        '[class*="type"]',
        '.tag-item'
      ];
      
      result.natureElements = [];
      for (const selector of natureSelectors) {
        const els = Array.from(document.querySelectorAll(selector));
        if (els.length > 0) {
          result.natureElements.push({
            selector,
            count: els.length,
            texts: els.map(el => el.textContent.trim()).slice(0, 3)
          });
        }
      }
      
      // 4. 查找页面上所有包含"民营"、"国企"、"外企"等关键词的元素
      const allText = document.body.innerText;
      const keywords = ['民营', '国企', '外企', '合资', '上市公司', '事业单位', '股份制企业'];
      result.keywordMatches = [];
      
      keywords.forEach(keyword => {
        const regex = new RegExp(keyword, 'g');
        const matches = allText.match(regex);
        if (matches) {
          result.keywordMatches.push({
            keyword,
            count: matches.length
          });
        }
      });
      
      return result;
    });
    
    console.log('─'.repeat(80));
    console.log('公司名称:', companyInfo.companyName);
    console.log('─'.repeat(80));
    console.log();
    
    console.log('公司描述完整文本:');
    console.log(`  "${companyInfo.companyDescFull}"`);
    console.log();
    
    console.log('公司描述分割结果（按 "·" 分隔）:');
    companyInfo.companyDescParts.forEach((part, index) => {
      console.log(`  [${index}]: "${part}"`);
    });
    console.log();
    
    console.log('其他可能的性质元素:');
    if (companyInfo.natureElements.length > 0) {
      companyInfo.natureElements.forEach(item => {
        console.log(`  选择器: ${item.selector}`);
        console.log(`  数量: ${item.count}`);
        console.log(`  前3个文本: ${item.texts.join(', ')}`);
        console.log();
      });
    } else {
      console.log('  未找到其他性质相关元素');
      console.log();
    }
    
    console.log('关键词匹配统计:');
    if (companyInfo.keywordMatches.length > 0) {
      companyInfo.keywordMatches.forEach(item => {
        console.log(`  "${item.keyword}": 出现 ${item.count} 次`);
      });
    } else {
      console.log('  未找到常见公司性质关键词');
    }
    console.log();
    
    console.log('─'.repeat(80));
    console.log('分析结论:');
    console.log('─'.repeat(80));
    
    // 判断第一部分是什么类型
    const firstPart = companyInfo.companyDescParts[0] || '';
    const isFinancingStatus = ['未融资', '天使轮', 'A轮', 'B轮', 'C轮', 'D轮及以上', '已上市'].includes(firstPart);
    const isCompanyNature = ['民营', '国企', '外企', '合资', '上市公司', '事业单位', '股份制'].some(k => firstPart.includes(k));
    
    if (isFinancingStatus) {
      console.log('✅ 第一部分是"融资状态"（如：未融资、A轮等）');
      console.log('   建议：需要另外寻找"公司性质"字段，可能在其他地方');
    } else if (isCompanyNature) {
      console.log('✅ 第一部分是"公司性质"（如：民营企业、国企等）');
      console.log('   当前解析逻辑正确');
    } else {
      console.log('⚠️  第一部分既不是融资状态也不是公司性质');
      console.log(`   实际内容: "${firstPart}"`);
      console.log('   需要进一步分析HTML结构');
    }
    console.log();
    
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
