/**
 * 智联招聘城市代码提取工具 - JavaScript分析版
 * 
 * 原理：加载智联招聘页面，拦截并分析所有网络请求，从JavaScript文件或API响应中提取城市代码映射
 * 使用方法：node extract-zhilian-from-js.js
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Chrome路径
const CHROME_PATH = 'C:\\Users\\Administrator\\.cache\\puppeteer\\chrome\\win64-131.0.6778.204\\chrome-win64\\chrome.exe';

async function extractCityCodes() {
  console.log('🚀 开始从JavaScript和API中提取城市代码...\n');
  
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const cityCodeMap = {};
  const jsFiles = [];
  
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    // 拦截所有网络请求
    page.on('response', async (response) => {
      const url = response.url();
      const status = response.status();
      
      // 只处理成功的请求
      if (status !== 200) return;
      
      // 策略1: 捕获JavaScript文件
      if (url.endsWith('.js') && url.includes('zhaopin')) {
        try {
          const content = await response.text();
          
          // 检查是否包含城市代码模式
          if (content.match(/jl\d{3}/)) {
            console.log(`📄 发现可能包含城市代码的JS文件: ${url.substring(0, 100)}...`);
            
            // 提取所有 jl{CODE} 模式
            const matches = content.match(/jl(\d{3})/g);
            if (matches) {
              const codes = [...new Set(matches.map(m => m.replace('jl', '')))];
              console.log(`   找到 ${codes.length} 个唯一代码: ${codes.slice(0, 10).join(', ')}${codes.length > 10 ? '...' : ''}`);
              
              // 尝试提取城市名称（通常在代码附近）
              const codeContexts = [];
              for (const code of codes.slice(0, 20)) {
                const regex = new RegExp(`([^"'\\s]{2,10}[市省]?)["'\\s,:}]jl${code}`, 'g');
                let match;
                while ((match = regex.exec(content)) !== null) {
                  const cityName = match[1].replace(/[^一-龟]/g, '');
                  if (cityName.length >= 2 && cityName.length <= 10) {
                    cityCodeMap[cityName] = code;
                    codeContexts.push(`${cityName}:${code}`);
                  }
                }
              }
              
              if (codeContexts.length > 0) {
                console.log(`   提取到城市映射: ${codeContexts.slice(0, 5).join(', ')}${codeContexts.length > 5 ? '...' : ''}`);
              }
            }
          }
        } catch (e) {
          // 忽略文本提取错误
        }
      }
      
      // 策略2: 捕获API响应
      if (url.includes('fe-api.zhaopin.com') || url.includes('/api/') || url.includes('/c/')) {
        try {
          const contentType = response.headers()['content-type'] || '';
          
          if (contentType.includes('application/json')) {
            const data = await response.json();
            
            // 递归搜索JSON中的城市代码
            function searchForCityCodes(obj, depth = 0) {
              if (depth > 5) return; // 限制递归深度
              
              if (typeof obj === 'string') {
                const match = obj.match(/jl(\d{3})/);
                if (match) {
                  console.log(`🔍 API响应中发现城市代码: ${match[1]} in ${url.substring(0, 80)}`);
                }
              } else if (typeof obj === 'object' && obj !== null) {
                Object.values(obj).forEach(value => searchForCityCodes(value, depth + 1));
              }
            }
            
            searchForCityCodes(data);
          }
        } catch (e) {
          // 忽略JSON解析错误
        }
      }
    });

    console.log('📄 步骤1: 访问首页，触发资源加载...\n');
    await page.goto('https://www.zhaopin.com/', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    // 等待更多动态内容加载
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('\n📄 步骤2: 访问城市地图页面...\n');
    await page.goto('https://www.zhaopin.com/citymap.html', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    // 等待页面完全加载
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('\n📄 步骤3: 模拟点击热门城市，触发更多API调用...\n');
    
    // 尝试点击几个热门城市
    const hotCities = ['北京', '上海', '广州', '深圳'];
    for (const cityName of hotCities) {
      try {
        // 查找城市链接并点击
        const cityLink = await page.$(`a[title="${cityName}"], a:has-text("${cityName}")`);
        if (cityLink) {
          console.log(`  点击城市: ${cityName}`);
          await cityLink.click();
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (e) {
        // 忽略点击失败
      }
    }
    
    // 额外等待，让所有请求完成
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 提取结果汇总:\n');
    
    if (Object.keys(cityCodeMap).length > 0) {
      // 去重并排序
      const sortedCities = Object.entries(cityCodeMap).sort((a, b) => 
        parseInt(a[1]) - parseInt(b[1])
      );
      
      console.log(`✅ 成功提取 ${sortedCities.length} 个城市代码\n`);
      
      // 生成TypeScript代码
      let tsCode = '// 智联招聘城市代码映射表（从JavaScript/API自动提取）\n';
      tsCode += `// 生成时间: ${new Date().toLocaleString('zh-CN')}\n`;
      tsCode += '// 来源: 分析智联招聘网站JavaScript文件和API响应\n\n';
      tsCode += 'export const ZHILIAN_CITY_CODES: Record<string, string> = {\n';
      
      sortedCities.forEach(([city, code], index) => {
        const comma = index < sortedCities.length - 1 ? ',' : '';
        tsCode += `  '${city}': '${code}'${comma}\n`;
      });
      
      tsCode += '};\n';
      
      // 保存文件
      const outputPath = path.join(__dirname, 'src', 'config', 'zhilian-city-codes-extracted.ts');
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, tsCode, 'utf-8');
      
      console.log(`💾 已保存到: ${outputPath}\n`);
      console.log('📋 提取到的城市代码（前30个）:');
      sortedCities.slice(0, 30).forEach(([city, code]) => {
        console.log(`   ${city.padEnd(10)}: ${code}`);
      });
      
      if (sortedCities.length > 30) {
        console.log(`   ... 还有 ${sortedCities.length - 30} 个城市`);
      }
      
      console.log('\n⚠️  重要提示:');
      console.log('   1. 以上代码为自动提取结果，建议人工验证关键城市');
      console.log('   2. 可以将此文件内容合并到 constants.ts 中\n');
    } else {
      console.log('❌ 未能从JavaScript或API中提取到城市代码\n');
      console.log('💡 建议方案:');
      console.log('   1. 手动查看智联招聘网站的JavaScript源代码');
      console.log('   2. 在浏览器开发者工具的Network标签中观察API请求');
      console.log('   3. 搜索包含 "jl" 和数字的代码片段\n');
    }
    
  } catch (error) {
    console.error('❌ 提取过程出错:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
}

// 执行
extractCityCodes().catch(console.error);
