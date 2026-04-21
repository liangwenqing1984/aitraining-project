const puppeteer = require('puppeteer');

async function testZhilianPage() {
  console.log('=== 开始测试智联招聘页面解析 ===\n');
  
  const browser = await puppeteer.launch({
    headless: false, // 使用有头模式便于观察
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // 设置User-Agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    const url = 'https://www.zhaopin.com/sou/jl622/kw%E5%BC%80%E5%8F%91/p1';
    console.log(`访问URL: ${url}\n`);
    
    // 拦截资源，只加载必要的
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const resourceType = request.resourceType();
      if (['document', 'script', 'xhr', 'fetch'].includes(resourceType)) {
        request.continue();
      } else {
        request.abort();
      }
    });
    
    // 访问页面
    await page.goto(url, { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });
    
    console.log('页面加载完成，等待内容渲染...\n');
    
    // 等待一段时间让动态内容加载
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 获取页面文本内容
    const pageText = await page.evaluate(() => {
      return document.body.textContent || '';
    });
    
    console.log(`页面文本长度: ${pageText.length} 字符\n`);
    
    // 查找包含职位关键词的行
    const lines = pageText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    console.log(`总行数: ${lines.length}\n`);
    
    // 查找职位标题
    const jobTitles = [];
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
      
      if (hasJobKeyword) {
        // 应用当前的过滤条件
        const shouldExclude = 
          line.length < 4 || line.length > 80 ||
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
          (line.match(/[A-Z][a-z]+/g) && line.match(/[A-Z][a-z]+/g).length >= 5 && !line.includes('工程师') && !line.includes('开发') && !line.includes('经理')) ||
          /^(房地产|互联网|金融|教育|医疗|制造)[\u4e00-\u9fa5]{0,15}$/.test(line) ||
          /^北京[市区县]$/.test(line) ||
          /\(.{20,}\)/.test(line) ||
          (line.match(/(?:Spring|Cloud|Boot|Java|JavaScript|Python|C\+\+|MySQL|Oracle|Linux|Git)/gi) && 
           line.match(/(?:Spring|Cloud|Boot|Java|JavaScript|Python|C\+\+|MySQL|Oracle|Linux|Git)/gi).length >= 5);
        
        if (!shouldExclude) {
          jobTitles.push({
            index: jobTitles.length + 1,
            title: line,
            length: line.length
          });
        } else {
          console.log(`❌ 被过滤: ${line.substring(0, 60)}...`);
        }
      }
    }
    
    console.log(`\n=== 成功提取的职位 (${jobTitles.length}个) ===\n`);
    jobTitles.forEach((job, idx) => {
      console.log(`${idx + 1}. [${job.length}字符] ${job.title}`);
    });
    
    console.log(`\n=== 分析总结 ===`);
    console.log(`预期职位数: 20`);
    console.log(`实际提取数: ${jobTitles.length}`);
    console.log(`缺失数量: ${20 - jobTitles.length}`);
    
    // 保存HTML用于分析
    const html = await page.content();
    const fs = require('fs');
    const path = require('path');
    const debugDir = path.join(__dirname, 'debug');
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true });
    }
    const htmlPath = path.join(debugDir, 'zhilian-page.html');
    fs.writeFileSync(htmlPath, html, 'utf-8');
    console.log(`\n✓ HTML已保存到: ${htmlPath}`);
    
  } catch (error) {
    console.error('错误:', error);
  } finally {
    await browser.close();
  }
}

testZhilianPage();
