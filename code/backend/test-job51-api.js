// @ts-nocheck - 测试脚本，尝试直接调用前程无忧API
const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function testJob51API() {
  console.log('=== 测试前程无忧API接口 ===\n');

  // 尝试不同的API端点
  const apiEndpoints = [
    {
      name: '搜索API v1',
      url: 'https://search.51job.com/list/010000,000000,0000,00,9,99,%E5%BC%80%E5%8F%91,2,1.html',
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Referer': 'https://www.51job.com/',
        'Connection': 'keep-alive'
      }
    },
    {
      name: '职位搜索API',
      url: 'https://fe-api.51job.com/api/v1/search/job',
      method: 'POST',
      data: {
        keyword: '开发',
        city: '010000',
        page: 1,
        pageSize: 20
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/plain, */*',
        'Origin': 'https://www.51job.com',
        'Referer': 'https://www.51job.com/'
      }
    },
    {
      name: 'Cupid API',
      url: 'https://cupid.51job.com/pc/open/noauth/search/jobs',
      method: 'POST',
      data: {
        keyword: '开发',
        area: '010000',
        pageNum: 1,
        pageSize: 20
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'api_key': '51job',
        'timestamp': Math.floor(Date.now() / 1000).toString()
      }
    }
  ];

  for (let i = 0; i < apiEndpoints.length; i++) {
    const endpoint = apiEndpoints[i];
    console.log(`\n${'='.repeat(80)}`);
    console.log(`测试 ${i + 1}/${apiEndpoints.length}: ${endpoint.name}`);
    console.log(`URL: ${endpoint.url}`);
    console.log('='.repeat(80));

    try {
      const startTime = Date.now();
      
      let response;
      if (endpoint.method === 'GET') {
        response = await axios.get(endpoint.url, {
          headers: endpoint.headers,
          timeout: 30000,
          validateStatus: () => true // 接受所有状态码
        });
      } else {
        response = await axios.post(endpoint.url, endpoint.data, {
          headers: endpoint.headers,
          timeout: 30000,
          validateStatus: () => true
        });
      }

      const duration = Date.now() - startTime;
      
      console.log(`\n[响应信息]`);
      console.log(`  状态码: ${response.status} ${response.statusText}`);
      console.log(`  耗时: ${duration}ms`);
      console.log(`  Content-Type: ${response.headers['content-type']}`);
      console.log(`  数据长度: ${typeof response.data === 'string' ? response.data.length : JSON.stringify(response.data).length} 字符`);
      
      // 保存响应数据
      const debugDir = path.join(__dirname, 'debug');
      if (!fs.existsSync(debugDir)) {
        fs.mkdirSync(debugDir, { recursive: true });
      }
      
      const debugFile = path.join(debugDir, `api_test_${i + 1}_${Date.now()}.json`);
      const responseData = typeof response.data === 'string' ? response.data : JSON.stringify(response.data, null, 2);
      fs.writeFileSync(debugFile, responseData.substring(0, 10000)); // 只保存前10000字符
      console.log(`  响应已保存: ${debugFile}`);
      
      // 分析响应内容
      if (response.status === 200) {
        if (typeof response.data === 'object') {
          console.log(`\n✅ API调用成功！`);
          console.log(`响应结构:`);
          console.log(JSON.stringify(response.data, null, 2).substring(0, 500));
          
          // 检查是否有职位数据
          const dataStr = JSON.stringify(response.data);
          if (dataStr.includes('job') || dataStr.includes('position')) {
            console.log(`\n🎉 发现职位相关数据！`);
          }
        } else {
          console.log(`\n⚠️ 返回HTML而非JSON`);
          if (response.data.length > 1000) {
            console.log(`HTML内容长度: ${response.data.length} 字符`);
            console.log(`前500字符:\n${response.data.substring(0, 500)}`);
          } else {
            console.log(`❌ HTML内容过短(${response.data.length}字符)，可能被拦截`);
          }
        }
      } else {
        console.log(`\n❌ API调用失败: HTTP ${response.status}`);
      }
      
    } catch (error) {
      console.error(`\n❌ 请求出错:`, error.message);
      if (error.response) {
        console.error(`  状态码: ${error.response.status}`);
        console.error(`  响应数据:`, error.response.data);
      }
    }
    
    // 每个测试之间等待
    if (i < apiEndpoints.length - 1) {
      console.log('\n等待2秒后继续下一个测试...\n');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('所有API测试完成！请检查debug目录中的响应文件。');
  console.log('='.repeat(80));
}

// 执行测试
testJob51API().catch(console.error);
