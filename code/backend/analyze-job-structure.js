const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function analyzeJobStructure() {
  console.log('=== 深度分析智联招聘职位DOM结构 ===\n');
  
  const htmlPath = path.join(__dirname, 'debug', 'test_zhilian.html');
  
  if (!fs.existsSync(htmlPath)) {
    console.error('HTML快照文件不存在:', htmlPath);
    return;
  }
  
  const html = fs.readFileSync(htmlPath, 'utf-8');
  console.log(`HTML文件大小: ${(html.length / 1024).toFixed(2)} KB\n`);
  
  const chromePath = 'C:\\Users\\Administrator\\.cache\\puppeteer\\chrome\\win64-131.0.6778.204\\chrome-win64\\chrome.exe';
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html);
    
    console.log('=== 第一步：查找所有可能的容器元素 ===\n');
    
    // 查找所有包含"开发"或"工程师"等关键词的元素
    const keywordElements = await page.evaluate(() => {
      const results = [];
      const allElements = document.querySelectorAll('*');
      
      let count = 0;
      allElements.forEach(el => {
        const text = el.textContent?.trim() || '';
        if ((text.includes('开发') || text.includes('工程师') || text.includes('Java')) && 
            text.length > 5 && text.length < 200) {
          // 获取元素的标签和类名
          const tag = el.tagName.toLowerCase();
          const className = el.className || '';
          const id = el.id || '';
          
          // 获取父元素信息
          const parent = el.parentElement;
          const parentTag = parent ? parent.tagName.toLowerCase() : '';
          const parentClass = parent ? (parent.className || '') : '';
          
          results.push({
            tag,
            class: className.substring(0, 100),
            id,
            text: text.substring(0, 100),
            parentTag,
            parentClass: parentClass.substring(0, 100)
          });
          
          count++;
          if (count >= 20) return; // 只取前20个
        }
      });
      
      return results;
    });
    
    console.log('找到包含职位关键词的元素（前20个）：\n');
    keywordElements.forEach((el, i) => {
      console.log(`${i + 1}. [${el.tag}] ${el.class || el.id}`);
      console.log(`   文本: ${el.text}`);
      console.log(`   父元素: <${el.parentTag}> class="${el.parentClass}"`);
      console.log('');
    });
    
    console.log('\n=== 第二步：分析常见的列表容器 ===\n');
    
    // 检查常见的列表容器
    const containers = await page.evaluate(() => {
      const selectors = [
        'ul',
        'ol',
        'div[class*="list"]',
        'div[class*="job"]',
        'div[class*="position"]',
        'section',
        'article'
      ];
      
      const results = [];
      selectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          // 检查是否包含职位相关文本
          const hasJobContent = Array.from(elements).some(el => {
            const text = el.textContent || '';
            return text.includes('开发') || text.includes('薪资') || text.includes('招聘');
          });
          
          if (hasJobContent) {
            results.push({
              selector,
              count: elements.length,
              sampleClass: elements[0].className?.substring(0, 100) || ''
            });
          }
        }
      });
      
      return results;
    });
    
    containers.forEach(container => {
      console.log(`选择器: ${container.selector}`);
      console.log(`  数量: ${container.count} 个`);
      console.log(`  示例class: ${container.sampleClass}`);
      console.log('');
    });
    
    console.log('\n=== 第三步：查找职位卡片的完整结构 ===\n');
    
    // 尝试找到一个完整的职位卡片结构
    const jobCardStructure = await page.evaluate(() => {
      // 查找第一个包含"开发"的链接
      const jobLink = Array.from(document.querySelectorAll('a[href]')).find(a => {
        const text = a.textContent?.trim() || '';
        return (text.includes('开发') || text.includes('工程师')) && text.length > 5;
      });
      
      if (!jobLink) {
        return null;
      }
      
      // 向上遍历找到卡片容器
      let container = jobLink;
      let depth = 0;
      while (container && depth < 5) {
        const className = container.className || '';
        if (className.includes('card') || className.includes('item') || className.includes('job')) {
          // 找到候选容器，提取其结构
          return {
            containerTag: container.tagName.toLowerCase(),
            containerClass: className,
            children: Array.from(container.children).map(child => ({
              tag: child.tagName.toLowerCase(),
              class: (child.className || '').substring(0, 50),
              text: (child.textContent?.trim() || '').substring(0, 100)
            }))
          };
        }
        container = container.parentElement;
        depth++;
      }
      
      return null;
    });
    
    if (jobCardStructure) {
      console.log('职位卡片结构：');
      console.log(`容器: <${jobCardStructure.containerTag}> class="${jobCardStructure.containerClass}"`);
      console.log('\n子元素：');
      jobCardStructure.children.forEach((child, i) => {
        console.log(`  ${i + 1}. <${child.tag}> class="${child.class}"`);
        console.log(`     文本: ${child.text}`);
      });
    } else {
      console.log('未找到明显的职位卡片结构');
    }
    
    console.log('\n✅ 分析完成！请根据以上信息调整CSS选择器');
    
  } catch (error) {
    console.error('分析过程中出错:', error);
  } finally {
    await browser.close();
  }
}

analyzeJobStructure().catch(console.error);
