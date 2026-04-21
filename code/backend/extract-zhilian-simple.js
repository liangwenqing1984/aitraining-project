/**
 * 智联招聘城市代码自动提取工具 - 增强版
 * 
 * 功能：通过分析智联招聘网站提取所有城市及其对应的代码
 * 使用方法：node extract-zhilian-simple.js
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Chrome路径
const CHROME_PATH = 'C:\\Users\\Administrator\\.cache\\puppeteer\\chrome\\win64-131.0.6778.204\\chrome-win64\\chrome.exe';

async function extractCityCodes() {
  console.log('🚀 开始提取智联招聘城市代码...\n');
  
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: false, // 改为可见模式，方便调试
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // 方法1: 直接访问城市地图页面
    console.log('📄 方法1: 访问城市地图页面...');
    await page.goto('https://www.zhaopin.com/citymap.html', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    // 等待页面完全加载
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('✅ 页面加载完成\n');

    // 保存HTML用于分析
    const html = await page.content();
    fs.writeFileSync(path.join(__dirname, 'zhilian-citymap-debug.html'), html, 'utf-8');
    console.log('💾 已保存页面HTML: zhilian-citymap-debug.html\n');

    // 提取城市数据
    console.log('📊 正在提取城市代码...\n');
    
    const cityData = await page.evaluate(() => {
      const cities = {};
      
      // 策略1: 从整个HTML中提取所有jl{CODE}模式
      const html = document.documentElement.innerHTML;
      const codePattern = /jl(\d{3})/g;
      let match;
      const codes = new Set();
      
      while ((match = codePattern.exec(html)) !== null) {
        codes.add(match[1]);
      }
      
      console.log(`从HTML中找到 ${codes.size} 个唯一的城市代码`);
      console.log('代码列表:', Array.from(codes).slice(0, 20).join(', '));
      
      // 策略2: 查找所有包含城市代码的链接并尝试获取城市名称
      const allLinks = document.querySelectorAll('a[href*="/sou/jl"]');
      console.log(`\n找到 ${allLinks.length} 个城市相关链接`);
      
      allLinks.forEach((link, index) => {
        const href = link.href;
        const match = href.match(/jl(\d{3})/);
        
        if (match) {
          const code = match[1];
          
          // 尝试多种方式获取城市名称
          let name = '';
          
          // 方式1: 链接文本
          name = link.textContent?.trim() || '';
          
          // 方式2: title属性
          if (!name) {
            name = link.getAttribute('title') || '';
          }
          
          // 方式3: aria-label
          if (!name) {
            name = link.getAttribute('aria-label') || '';
          }
          
          // 方式4: 父元素或兄弟元素的文本
          if (!name && link.parentElement) {
            name = link.parentElement.textContent?.trim() || '';
          }
          
          // 清理城市名
          name = name.replace(/\s+/g, '').replace(/[^\u4e00-\u9fa5]/g, '');
          
          if (name && name.length >= 2 && name.length <= 10) {
            if (!cities[name]) {
              cities[name] = code;
              if (index < 15) {
                console.log(`提取: ${name.padEnd(10)} -> ${code}`);
              }
            }
          }
        }
      });
      
      console.log(`\n最终提取到 ${Object.keys(cities).length} 个城市`);
      
      return cities;
    });

    console.log(`\n✅ 提取到 ${Object.keys(cityData).length} 个城市\n`);

    if (Object.keys(cityData).length > 0) {
      // 按代码排序
      const sortedCities = Object.entries(cityData).sort((a, b) => 
        parseInt(a[1]) - parseInt(b[1])
      );

      // 生成TypeScript代码
      let tsCode = '// 智联招聘城市代码映射表\n';
      tsCode += `// 自动生成于: ${new Date().toLocaleString('zh-CN')}\n`;
      tsCode += '// 来源: 自动从智联招聘网站提取\n\n';
      tsCode += 'export const ZHILIAN_CITY_CODES: Record<string, string> = {\n';
      
      sortedCities.forEach(([city, code], index) => {
        const comma = index < sortedCities.length - 1 ? ',' : '';
        tsCode += `  '${city}': '${code}'${comma}\n`;
      });
      
      tsCode += '};\n';

      // 保存文件
      const outputPath = path.join(__dirname, 'src', 'config', 'zhilian-city-codes-auto.ts');
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, tsCode, 'utf-8');
      
      console.log(`💾 已保存到: ${outputPath}\n`);
      
      // 显示统计信息
      console.log('📈 统计信息:');
      console.log(`   - 总城市数: ${Object.keys(cityData).length}\n`);
      
      // 按代码范围分组
      const codeRanges = {};
      Object.values(cityData).forEach(code => {
        const range = Math.floor(parseInt(code) / 10) * 10;
        const rangeKey = `${range}-${range + 9}`;
        codeRanges[rangeKey] = (codeRanges[rangeKey] || 0) + 1;
      });
      
      console.log('   代码分布:');
      Object.entries(codeRanges).sort().forEach(([range, count]) => {
        console.log(`     ${range}: ${count} 个城市`);
      });
      
      // 显示部分示例
      console.log('\n📋 前30个城市代码:');
      sortedCities.slice(0, 30).forEach(([city, code]) => {
        console.log(`   ${city.padEnd(10)}: ${code}`);
      });
      
      console.log('\n✅ 提取完成！请检查生成的文件并合并到 constants.ts\n');
    } else {
      console.warn('⚠️ 未提取到任何城市代码\n');
      console.log('建议:');
      console.log('1. 检查保存的 zhilian-citymap-debug.html 文件');
      console.log('2. 手动分析HTML结构，调整提取策略');
      console.log('3. 可能需要登录或特殊权限才能查看城市列表\n');
    }

  } catch (error) {
    console.error('❌ 提取失败:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
}

// 执行
extractCityCodes().catch(console.error);
