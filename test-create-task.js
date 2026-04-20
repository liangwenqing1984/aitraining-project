const http = require('http');

// 测试配置
const API_BASE_URL = 'http://localhost:3004';
const API_PATH = '/api/tasks';

console.log('========================================');
console.log('开始测试创建任务功能');
console.log('========================================\n');

// 发送HTTP请求的辅助函数
function sendRequest(method, path, data) {
  return new Promise((resolve, reject) => {
    const postData = data ? JSON.stringify(data) : null;
    
    const options = {
      hostname: 'localhost',
      port: 3004,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': postData ? Buffer.byteLength(postData) : 0
      }
    };
    
    console.log(`\n发送 ${method} 请求到: ${API_BASE_URL}${path}`);
    if (postData) {
      console.log('请求体:', postData);
    }
    
    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve({
            statusCode: res.statusCode,
            data: parsed
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            data: responseData
          });
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

// 测试用例1：正常创建任务
async function testCreateTask() {
  console.log('【测试1】正常创建任务');
  console.log('----------------------------------------');
  
  const config = {
    sites: ['zhilian'],
    keywords: ['Java工程师'],
    keyword: 'Java工程师',
    cities: ['北京'],
    city: '北京',
    province: 'beijing',
    maxPages: 5,
    delay: [2, 5],
    concurrency: 2
  };
  
  console.log('请求配置:', JSON.stringify(config, null, 2));
  
  try {
    const startTime = Date.now();
    const response = await sendRequest('POST', API_PATH, config);
    const endTime = Date.now();
    
    console.log('\n✅ 收到响应!');
    console.log('响应时间:', endTime - startTime, 'ms');
    console.log('HTTP状态码:', response.statusCode);
    console.log('响应数据:', JSON.stringify(response.data, null, 2));
    
    if (response.data && response.data.success) {
      console.log('\n🎉 任务创建成功!');
      console.log('任务ID:', response.data.data.taskId);
      console.log('任务名称:', response.data.data.name);
      return true;
    } else {
      console.log('\n❌ 业务逻辑失败:', response.data?.error || '未知错误');
      return false;
    }
  } catch (error) {
    console.log('\n❌ 请求失败!');
    console.log('错误消息:', error.message);
    console.log('错误代码:', error.code);
    if (error.code === 'ECONNREFUSED') {
      console.log('提示：后端服务可能未启动');
    }
    return false;
  }
}

// 测试用例2：缺少必要参数
async function testCreateTaskWithoutKeyword() {
  console.log('\n\n【测试2】缺少关键词（应该失败）');
  console.log('----------------------------------------');
  
  const config = {
    sites: ['zhilian'],
    // 故意不提供keywords
    maxPages: 5
  };
  
  console.log('请求配置:', JSON.stringify(config, null, 2));
  
  try {
    const response = await sendRequest('POST', API_PATH, config);
    console.log('\n响应数据:', JSON.stringify(response.data, null, 2));
    
    if (response.data && response.data.success) {
      console.log('⚠️  意外成功：应该返回验证错误');
    } else {
      console.log('✅ 符合预期：返回验证错误');
      console.log('错误信息:', response.data.error);
    }
  } catch (error) {
    console.log('\n❌ 请求异常');
    console.log('错误消息:', error.message);
  }
}

// 测试用例3：检查后端健康状态
async function testBackendHealth() {
  console.log('\n\n【测试0】检查后端服务状态');
  console.log('----------------------------------------');
  
  try {
    const response = await sendRequest('GET', API_PATH);
    console.log('✅ 后端服务正常运行');
    console.log('HTTP状态码:', response.statusCode);
    return true;
  } catch (error) {
    console.log('❌ 后端服务无法访问');
    console.log('错误:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('提示：后端服务可能未启动，请运行 start-dev.bat');
    }
    return false;
  }
}

// 主函数
async function main() {
  console.log('测试开始时间:', new Date().toLocaleString());
  console.log('API地址:', `${API_BASE_URL}${API_PATH}`);
  console.log('\n');
  
  // 步骤1：检查后端是否运行
  const isBackendRunning = await testBackendHealth();
  if (!isBackendRunning) {
    console.log('\n⛔ 测试中止：后端服务未运行');
    process.exit(1);
  }
  
  // 步骤2：测试正常创建
  const test1Result = await testCreateTask();
  
  // 步骤3：测试参数验证
  await testCreateTaskWithoutKeyword();
  
  // 总结
  console.log('\n\n========================================');
  console.log('测试完成');
  console.log('========================================');
  console.log('测试1（正常创建）:', test1Result ? '✅ 通过' : '❌ 失败');
  console.log('结束时间:', new Date().toLocaleString());
  console.log('\n请查看上方输出，特别关注：');
  console.log('1. 是否有 "请求失败" 或 "错误" 字样');
  console.log('2. HTTP状态码是否为200');
  console.log('3. 响应数据中 success 是否为 true');
  console.log('4. 是否有 taskId 返回');
  console.log('\n如果测试通过但前端仍无反应，问题在前端代码');
  console.log('如果测试失败，问题在后端或网络层');
}

// 执行测试
main().catch(err => {
  console.error('\n💥 测试脚本执行出错:', err);
  process.exit(1);
});
