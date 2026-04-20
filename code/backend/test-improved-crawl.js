const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function testImprovedCrawl() {
  console.log('=== 测试改进后的爬取策略 ===\n');
  
  const chromePath = 'C:\\Users\\Administrator\\.cache\\puppeteer\\chrome\\win64-131.0.6778.204\\chrome-win64\\chrome.exe';
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,  // 改为 false 可以观察浏览器行为
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
    
    // 使用 networkidle0 确保所有资源加载完成
    await page.goto(url, { 
      waitUntil: 'networkidle0',
      timeout: 60000 
    });
    
    console.log('✓ 页面初始加载完成');
    
    // 检查初始内容
    let content = await page.evaluate(() => {
      return {
        title: document.title,
        bodyLength: document.body.textContent?.length || 0,
        hasJobKeywords: document.body.textContent?.includes('开发') || false
      };
    });
    console.log('初始检查:', content);
    
    // 额外等待5-8秒
    console.log('等待动态内容加载 (5-8秒)...');
    await new Promise(resolve => setTimeout(resolve, 5000 + Math.random() * 3000));
    
    // 再次检查
    content = await page.evaluate(() => {
      return {
        bodyLength: document.body.textContent?.length || 0,
        hasJobKeywords: document.body.textContent?.includes('开发') || 
                        document.body.textContent?.includes('工程师') || false
      };
    });
    console.log('等待后检查:', content);
    
    // 如果没有关键词，尝试滚动
    if (!content.hasJobKeywords) {
      console.log('未检测到职位关键词，尝试滚动页面...');
      await page.evaluate(async () => {
        for (let i = 0; i < 5; i++) {
          window.scrollBy(0, window.innerHeight);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      });
      
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      content = await page.evaluate(() => {
        return {
          bodyLength: document.body.textContent?.length || 0,
          hasJobKeywords: document.body.textContent?.includes('开发') || false
        };
      });
      console.log('滚动后最终检查:', content);
    }
    
    // 保存HTML快照
    const html = await page.content();
    const debugDir = path.join(__dirname, 'debug');
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true });
    }
    const debugFile = path.join(debugDir, 'zhilian_improved.html');
    fs.writeFileSync(debugFile, html);
    console.log('\nHTML快照已保存到:', debugFile);
    
    // 尝试提取职位
    const jobs = await page.evaluate(() => {
      const jobList = [];
      
      // 查找所有包含职位信息的元素
      const allTexts = document.body.textContent || '';
      const lines = allTexts.split('\n').map(l => l.trim()).filter(l => l.length > 5);
      
      // 简单分析：查找包含"开发"的行
      const jobLines = lines.filter(line => 
        line.includes('开发') || line.includes('工程师') || line.includes('Java')
      );
      
      console.log(`找到 ${jobLines.length} 行包含职位关键词的文本`);
      
      // 返回前10行作为示例
      return jobLines.slice(0, 10);
    });
    
    console.log('\n=== 找到的职位相关文本（前10行）===');
    jobs.forEach((line, i) => {
      console.log(`${i + 1}. ${line}`);
    });
    
    if (jobs.length > 0) {
      console.log('\n✅ 成功！页面包含职位数据');
    } else {
      console.log('\n❌ 失败！页面仍不包含职位数据');
      console.log('\n可能原因：');
      console.log('1. 智联招聘的反爬机制非常强，需要登录或特殊Cookie');
      console.log('2. 可能需要特定的User-Agent或请求头');
      console.log('3. 建议尝试前程无忧(51job)等其他平台');
    }
    
  } catch (error) {
    console.error('测试过程中出错:', error);
  } finally {
    await browser.close();
  }
}

testImprovedCrawl().catch(console.error);
