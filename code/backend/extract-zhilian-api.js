/**
 * 智联招聘城市代码提取工具 - API方式
 * 
 * 功能：通过调用智联招聘API获取城市代码映射
 * 使用方法：node extract-zhilian-api.js
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Chrome路径
const CHROME_PATH = 'C:\\Users\\Administrator\\.cache\\puppeteer\\chrome\\win64-131.0.6778.204\\chrome-win64\\chrome.exe';

// 需要测试的城市列表（基于前端定义）
const CITIES_TO_TEST = [
  // 黑龙江省
  { province: '黑龙江', city: '哈尔滨' },
  { province: '黑龙江', city: '齐齐哈尔' },
  { province: '黑龙江', city: '大庆' },
  { province: '黑龙江', city: '牡丹江' },
  
  // 吉林省
  { province: '吉林', city: '长春' },
  { province: '吉林', city: '吉林' },
  
  // 辽宁省
  { province: '辽宁', city: '沈阳' },
  { province: '辽宁', city: '大连' },
  
  // 直辖市
  { province: '', city: '北京' },
  { province: '', city: '上海' },
  { province: '', city: '天津' },
  { province: '', city: '重庆' },
  
  // 其他主要城市
  { province: '广东', city: '广州' },
  { province: '广东', city: '深圳' },
  { province: '江苏', city: '南京' },
  { province: '浙江', city: '杭州' },
  { province: '四川', city: '成都' },
  { province: '湖北', city: '武汉' },
];

async function extractCityCodes() {
  console.log('🚀 开始通过API提取智联招聘城市代码...\n');
  
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    // 拦截网络请求，捕获API响应
    const cityCodeMap = {};
    
    page.on('response', async (response) => {
      const url = response.url();
      
      // 捕获包含城市信息的API响应
      if (url.includes('fe-api.zhaopin.com') && url.includes('/c/i/sou')) {
        try {
          const data = await response.json();
          
          // 分析响应数据结构，提取城市代码
          if (data && data.data && data.data.results) {
            // 从搜索结果中提取城市信息
            const firstResult = data.data.results[0];
            if (firstResult && firstResult.city) {
              console.log(`API返回城市信息:`, firstResult.city);
            }
          }
        } catch (e) {
          // 忽略JSON解析错误
        }
      }
    });

    console.log('📊 开始测试各个城市...\n');
    
    for (const { province, city } of CITIES_TO_TEST) {
      try {
        console.log(`测试: ${province ? province + '-' : ''}${city}`);
        
        // 构建搜索URL（使用占位符代码）
        const testUrl = `https://www.zhaopin.com/sou/jl000/kw${encodeURIComponent(city)}/p1`;
        
        // 访问页面并观察重定向或URL变化
        await page.goto(testUrl, { 
          waitUntil: 'networkidle2',
          timeout: 10000 
        });
        
        // 获取最终URL（可能会有重定向）
        const finalUrl = page.url();
        console.log(`  最终URL: ${finalUrl}`);
        
        // 从URL中提取城市代码
        const match = finalUrl.match(/jl(\d{3})/);
        if (match) {
          const code = match[1];
          cityCodeMap[city] = code;
          console.log(`  ✅ 提取到代码: ${code}\n`);
        } else {
          console.log(`  ⚠️ 未找到城市代码\n`);
        }
        
        // 短暂延迟，避免请求过快
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`  ❌ 测试失败: ${error.message}\n`);
      }
    }

    console.log(`\n✅ 测试完成！共提取到 ${Object.keys(cityCodeMap).length} 个城市代码\n`);
    
    if (Object.keys(cityCodeMap).length > 0) {
      // 生成TypeScript代码
      let tsCode = '// 智联招聘城市代码映射表（通过API测试提取）\n';
      tsCode += `// 生成时间: ${new Date().toLocaleString('zh-CN')}\n\n`;
      tsCode += 'export const ZHILIAN_CITY_CODES: Record<string, string> = {\n';
      
      Object.entries(cityCodeMap).forEach(([city, code], index) => {
        const comma = index < Object.keys(cityCodeMap).length - 1 ? ',' : '';
        tsCode += `  '${city}': '${code}'${comma}\n`;
      });
      
      tsCode += '};\n';
      
      // 保存文件
      const outputPath = path.join(__dirname, 'src', 'config', 'zhilian-city-codes-api.ts');
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, tsCode, 'utf-8');
      
      console.log(`💾 已保存到: ${outputPath}\n`);
      console.log('📋 提取结果:');
      Object.entries(cityCodeMap).forEach(([city, code]) => {
        console.log(`   ${city.padEnd(10)}: ${code}`);
      });
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
