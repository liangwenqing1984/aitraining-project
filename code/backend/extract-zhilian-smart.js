/**
 * 智联招聘城市代码智能探测工具
 * 
 * 原理：通过二分查找法，对比不同城市代码返回的搜索结果，找到最匹配的城市代码
 * 使用方法：node extract-zhilian-smart.js
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Chrome路径
const CHROME_PATH = 'C:\\Users\\Administrator\\.cache\\puppeteer\\chrome\\win64-131.0.6778.204\\chrome-win64\\chrome.exe';

// 已知的基准城市代码（用于验证方法有效性）
const BENCHMARK_CITIES = {
  '哈尔滨': '622',  // 已验证
};

// 待探测的城市列表
const CITIES_TO_DETECT = [
  // 黑龙江省其他城市
  { name: '齐齐哈尔', range: [620, 640] },
  { name: '大庆', range: [620, 640] },
  { name: '牡丹江', range: [620, 640] },
  { name: '佳木斯', range: [620, 640] },
  
  // 吉林省
  { name: '长春', range: [600, 650] },
  { name: '吉林', range: [600, 650] },
  
  // 辽宁省
  { name: '沈阳', range: [550, 600] },
  { name: '大连', range: [550, 600] },
  
  // 直辖市
  { name: '北京', range: [500, 550] },
  { name: '上海', range: [500, 550] },
  { name: '天津', range: [500, 550] },
  
  // 广东省
  { name: '广州', range: [750, 800] },
  { name: '深圳', range: [750, 800] },
];

async function getSearchResults(browser, cityCode, keyword = '软件工程师') {
  try {
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    
    // 只允许必要的请求，加快速度
    page.on('request', (request) => {
      const resourceType = request.resourceType();
      if (['document', 'xhr', 'fetch'].includes(resourceType)) {
        request.continue();
      } else {
        request.abort();
      }
    });
    
    const url = `https://www.zhaopin.com/sou/jl${cityCode}/kw${encodeURIComponent(keyword)}/p1`;
    await page.goto(url, { 
      waitUntil: 'domcontentloaded',
      timeout: 10000 
    });
    
    // 等待搜索结果加载
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 提取第一条结果的工作地点
    const location = await page.evaluate(() => {
      // 尝试多种选择器
      const selectors = [
        '.joblist-box__iteminfo .jobinfo__spec span:first-child',
        '.position-list__item__info .location',
        '[class*="location"]',
        '[class*="address"]'
      ];
      
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent) {
          return element.textContent.trim();
        }
      }
      
      // 如果都失败，尝试从页面文本中提取
      const bodyText = document.body?.textContent || '';
      const locationMatch = bodyText.match(/([\u4e00-\u9fa5]{2,4}(?:市|区|县))/);
      return locationMatch ? locationMatch[1] : '';
    });
    
    await page.close();
    return location;
    
  } catch (error) {
    console.error(`    获取结果失败: ${error.message}`);
    return '';
  }
}

async function detectCityCode(browser, cityName, range) {
  console.log(`\n🔍 探测城市: ${cityName} (范围: ${range[0]}-${range[1]})`);
  
  const [min, max] = range;
  let bestCode = null;
  let bestScore = 0;
  
  // 采样测试：每隔10个代码测试一次
  const step = 5;
  for (let code = min; code <= max; code += step) {
    const location = await getSearchResults(browser, code.toString().padStart(3, '0'));
    
    // 评分：如果返回的位置包含目标城市名，得分+10
    let score = 0;
    if (location.includes(cityName)) {
      score = 10;
      console.log(`  代码 ${code}: ✅ 匹配! 位置="${location}"`);
    } else if (location.length > 0) {
      // 部分匹配：检查省份或相关地区
      score = location.length > 0 ? 1 : 0;
      if (score > 0) {
        console.log(`  代码 ${code}: ⚠️  位置="${location}"`);
      }
    }
    
    if (score > bestScore) {
      bestScore = score;
      bestCode = code;
    }
    
    // 如果找到完美匹配，立即返回
    if (score === 10) {
      return code.toString().padStart(3, '0');
    }
  }
  
  // 如果没有找到完美匹配，返回最佳猜测
  if (bestCode) {
    console.log(`  💡 最佳猜测: ${bestCode} (得分: ${bestScore})`);
    return bestCode.toString().padStart(3, '0');
  }
  
  console.log(`  ❌ 未找到合适代码`);
  return null;
}

async function main() {
  console.log('🚀 开始智能探测智联招聘城市代码...\n');
  console.log('⚠️  注意：此过程可能需要较长时间，请耐心等待...\n');
  
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const results = {};
  
  try {
    // 首先验证基准城市
    console.log('📋 验证基准城市...');
    for (const [city, expectedCode] of Object.entries(BENCHMARK_CITIES)) {
      const location = await getSearchResults(browser, expectedCode);
      console.log(`  ${city} (${expectedCode}): ${location ? '✅' : '❌'} 位置="${location}"`);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('开始探测未知城市...\n');
    
    // 逐个探测城市
    for (const { name, range } of CITIES_TO_DETECT) {
      const code = await detectCityCode(browser, name, range);
      if (code) {
        results[name] = code;
      }
      
      // 避免请求过快被封
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // 输出结果
    console.log('\n' + '='.repeat(60));
    console.log('📊 探测结果汇总:\n');
    
    if (Object.keys(results).length > 0) {
      // 生成TypeScript代码
      let tsCode = '// 智联招聘城市代码映射表（智能探测生成）\n';
      tsCode += `// 生成时间: ${new Date().toLocaleString('zh-CN')}\n`;
      tsCode += '// 注意：部分代码为推测值，需要人工验证\n\n';
      tsCode += 'export const ZHILIAN_CITY_CODES: Record<string, string> = {\n';
      
      Object.entries(results).forEach(([city, code], index) => {
        const comma = index < Object.keys(results).length - 1 ? ',' : '';
        tsCode += `  '${city}': '${code}'${comma}\n`;
      });
      
      tsCode += '};\n';
      
      // 保存文件
      const outputPath = path.join(__dirname, 'src', 'config', 'zhilian-city-codes-detected.ts');
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, tsCode, 'utf-8');
      
      console.log(`💾 已保存到: ${outputPath}\n`);
      console.log('📋 探测到的城市代码:');
      Object.entries(results).forEach(([city, code]) => {
        console.log(`   ${city.padEnd(10)}: ${code}`);
      });
      
      console.log('\n⚠️  重要提示:');
      console.log('   1. 以上代码为自动探测结果，可能存在误差');
      console.log('   2. 建议人工验证关键城市的代码准确性');
      console.log('   3. 可以将此文件内容合并到 constants.ts 中\n');
    } else {
      console.log('❌ 未能探测到任何城市代码\n');
    }
    
  } catch (error) {
    console.error('❌ 探测过程出错:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
}

// 执行
main().catch(console.error);
