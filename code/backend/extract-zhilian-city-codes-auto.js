/**
 * 智联招聘城市代码自动提取工具
 * 
 * 功能：通过Puppeteer访问智联招聘网站，自动提取所有城市及其对应的代码
 * 使用方法：node extract-zhilian-city-codes-auto.js
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// 智联招聘城市列表页面URL
const CITY_PAGE_URL = 'https://www.zhaopin.com/citymap.html';

async function extractCityCodes() {
  console.log('🚀 开始提取智联招聘城市代码...\n');
  
  // 使用项目中已安装的Chrome路径
  const chromePath = 'C:\\Users\\Administrator\\.cache\\puppeteer\\chrome\\win64-131.0.6778.204\\chrome-win64\\chrome.exe';
  
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  });

  try {
    const page = await browser.newPage();
    
    // 设置视口和User-Agent
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    console.log('📄 正在访问城市列表页面...');
    await page.goto(CITY_PAGE_URL, { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });
    
    console.log('✅ 页面加载完成\n');

    // 等待城市链接加载
    await page.waitForSelector('a[href*="/sou/jl"]', { timeout: 10000 });

    // 在浏览器上下文中执行提取逻辑
    const cityData = await page.evaluate(() => {
      const cityMap = {};
      const processedCities = new Set();
      
      // 方法1: 查找所有包含城市代码的链接
      const allLinks = document.querySelectorAll('a[href*="/sou/jl"]');
      
      allLinks.forEach(link => {
        const href = link.href;
        
        // 匹配 jl{CODE} 模式
        const match = href.match(/jl(\d{3})/);
        
        if (match) {
          const cityCode = match[1];
          
          // 尝试从链接文本或父元素获取城市名称
          let cityName = link.textContent?.trim();
          
          // 如果链接文本为空，尝试从title属性获取
          if (!cityName || cityName.length === 0) {
            cityName = link.getAttribute('title')?.trim();
          }
          
          // 清理城市名称
          if (cityName) {
            // 移除多余空格和特殊字符
            cityName = cityName.replace(/\s+/g, '').replace(/[^\u4e00-\u9fa5]/g, '');
            
            // 只保留有效的中文城市名（2-10个字符）
            if (cityName.length >= 2 && cityName.length <= 10 && !processedCities.has(cityName)) {
              cityMap[cityName] = cityCode;
              processedCities.add(cityName);
            }
          }
        }
      });
      
      // 方法2: 查找省份和城市分组结构
      const provinceGroups = document.querySelectorAll('.city-list, .province-list, [class*="city"], [class*="province"]');
      
      provinceGroups.forEach(group => {
        const links = group.querySelectorAll('a[href*="/sou/jl"]');
        links.forEach(link => {
          const href = link.href;
          const match = href.match(/jl(\d{3})/);
          
          if (match) {
            const cityCode = match[1];
            let cityName = link.textContent?.trim() || link.getAttribute('title')?.trim();
            
            if (cityName) {
              cityName = cityName.replace(/\s+/g, '').replace(/[^\u4e00-\u9fa5]/g, '');
              
              if (cityName.length >= 2 && cityName.length <= 10 && !cityMap[cityName]) {
                cityMap[cityName] = cityCode;
              }
            }
          }
        });
      });
      
      return cityMap;
    });

    console.log(`📊 提取到 ${Object.keys(cityData).length} 个城市代码\n`);

    // 按代码排序
    const sortedCities = Object.entries(cityData).sort((a, b) => {
      return parseInt(a[1]) - parseInt(b[1]);
    });

    // 生成TypeScript代码
    let tsCode = 'export const ZHILIAN_CITY_CODES: Record<string, string> = {\n';
    
    let currentProvince = '';
    sortedCities.forEach(([city, code], index) => {
      // 简单的省份分组逻辑（可以根据实际情况优化）
      const isFirst = index === 0;
      const isLast = index === sortedCities.length - 1;
      
      if (!isFirst) {
        tsCode += ',\n';
      }
      
      tsCode += `  '${city}': '${code}'`;
    });
    
    tsCode += '\n};\n';

    // 保存结果
    const outputPath = path.join(__dirname, 'zhilian-city-codes-extracted.json');
    const tsOutputPath = path.join(__dirname, 'src', 'config', 'zhilian-city-codes-new.ts');

    // 保存JSON格式
    fs.writeFileSync(outputPath, JSON.stringify(cityData, null, 2), 'utf-8');
    console.log(`💾 JSON格式已保存到: ${outputPath}`);

    // 保存TypeScript格式
    fs.mkdirSync(path.dirname(tsOutputPath), { recursive: true });
    fs.writeFileSync(tsOutputPath, tsCode, 'utf-8');
    console.log(`💾 TypeScript格式已保存到: ${tsOutputPath}\n`);

    // 显示统计信息
    console.log('📈 统计信息:');
    console.log(`   - 总城市数: ${Object.keys(cityData).length}`);
    
    // 按代码范围分组统计
    const codeRanges = {};
    Object.values(cityData).forEach(code => {
      const range = Math.floor(parseInt(code) / 10) * 10;
      const rangeKey = `${range}-${range + 9}`;
      codeRanges[rangeKey] = (codeRanges[rangeKey] || 0) + 1;
    });
    
    console.log('\n   代码分布:');
    Object.entries(codeRanges).sort().forEach(([range, count]) => {
      console.log(`     ${range}: ${count} 个城市`);
    });

    // 显示部分示例
    console.log('\n📋 部分城市代码示例:');
    sortedCities.slice(0, 20).forEach(([city, code]) => {
      console.log(`   ${city.padEnd(10)}: ${code}`);
    });

    console.log('\n✅ 提取完成！\n');
    console.log('⚠️  注意事项:');
    console.log('   1. 请检查提取结果是否准确');
    console.log('   2. 可能需要手动调整某些城市的代码');
    console.log('   3. 建议对比现有的 constants.ts 文件');
    console.log('   4. 可以将 zhilian-city-codes-new.ts 的内容合并到 constants.ts\n');

    return cityData;

  } catch (error) {
    console.error('❌ 提取失败:', error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

// 执行提取
extractCityCodes().catch(error => {
  console.error('程序执行出错:', error);
  process.exit(1);
});
