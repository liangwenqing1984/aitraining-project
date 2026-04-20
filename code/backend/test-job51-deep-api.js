// @ts-nocheck - 深度测试前程无忧API
const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function deepTestJob51API() {
  console.log('=== 深度测试前程无忧API接口 ===\n');

  const timestamp = Math.floor(Date.now() / 1000).toString();
  
  // 基于诊断脚本中发现的真实API端点
  const apiTests = [
    {
      name: 'Cupid推荐API (带正确时间戳)',
      url: `https://cupid.51job.com/pc/open/noauth/recommend/pc-job-mini-detail?api_key=51job&timestamp=${timestamp}`,
      method: 'POST',
      data: { keyword: '开发' },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Origin': 'https://www.51job.com',
        'Referer': 'https://www.51job.com/'
      }
    },
    {
      name: '默认城市API',
      url: `https://cupid.51job.com/pc/open/noauth/index/default-city?api_key=51job&timestamp=${timestamp}`,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      }
    },
    {
      name: '关键词建议API',
      url: `https://cupid.51job.com/open/noauth/keyword/ai-keyword-suggest?api_key=51job&timestamp=${timestamp}&keyword=开发`,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      }
    }
  ];

  for (let i = 0; i < apiTests.length; i++) {
    const test = apiTests[i];
    console.log(`\n${'='.repeat(80)}`);
    console.log(`测试 ${i + 1}/${apiTests.length}: ${test.name}`);
    console.log(`URL: ${test.url.substring(0, 150)}...`);
    console.log('='.repeat(80));

    try {
      const startTime = Date.now();
      
      let response;
      if (test.method === 'GET') {
        response = await axios.get(test.url, {
          headers: test.headers,
          timeout: 30000,
          validateStatus: () => true
        });
      } else {
        response = await axios.post(test.url, test.data, {
          headers: test.headers,
          timeout: 30000,
          validateStatus: () => true
        });
      }

      const duration = Date.now() - startTime;
      
      console.log(`\n[响应信息]`);
      console.log(`  状态码: ${response.status} ${response.statusText}`);
      console.log(`  耗时: ${duration}ms`);
      console.log(`  Content-Type: ${response.headers['content-type']}`);
      
      // 保存完整响应
      const debugDir = path.join(__dirname, 'debug');
      if (!fs.existsSync(debugDir)) {
        fs.mkdirSync(debugDir, { recursive: true });
      }
      
      const debugFile = path.join(debugDir, `deep_api_test_${i + 1}_${Date.now()}.json`);
      const responseData = typeof response.data === 'string' ? response.data : JSON.stringify(response.data, null, 2);
      fs.writeFileSync(debugFile, responseData);
      console.log(`  响应已保存: ${debugFile}`);
      
      // 分析响应
      if (response.status === 200 && typeof response.data === 'object') {
        console.log(`\n✅ API调用成功！`);
        console.log(`\n响应数据预览:`);
        console.log(JSON.stringify(response.data, null, 2).substring(0, 800));
        
        // 检查是否有职位数据
        const dataStr = JSON.stringify(response.data);
        if (dataStr.includes('job') || dataStr.includes('position') || dataStr.includes('salary')) {
          console.log(`\n🎉 发现职位相关数据！这个API可能可用！`);
        }
      } else {
        console.log(`\n❌ API调用失败或返回非预期数据`);
        if (typeof response.data === 'object') {
          console.log(`响应内容:`, JSON.stringify(response.data).substring(0, 300));
        }
      }
      
    } catch (error) {
      console.error(`\n❌ 请求出错:`, error.message);
    }
    
    if (i < apiTests.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('深度API测试完成！');
  console.log('='.repeat(80));
}

// 执行测试
deepTestJob51API().catch(console.error);
