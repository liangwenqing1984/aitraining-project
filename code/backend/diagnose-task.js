const { Pool } = require('pg');

// 数据库配置
const pool = new Pool({
  host: '10.1.1.113',
  port: 7300,
  database: 'training_exercises',
  user: 'liangwenqing',
  password: 'liangwenqing'
});

async function analyzeTaskRecords() {
  let client;
  try {
    client = await pool.connect();
    
    // 查询任务信息
    const taskResult = await client.query(
      'SELECT id, name, config, record_count FROM tasks WHERE id = $1',
      ['60fbbfd5-05f4-4be9-926f-b23b5f6f9498']
    );
    
    if (taskResult.rows.length === 0) {
      console.log('未找到该任务');
      return;
    }
    
    const task = taskResult.rows[0];
    const config = typeof task.config === 'string' ? JSON.parse(task.config) : task.config;
    
    console.log('\n=== 任务信息 ===\n');
    console.log('任务ID:', task.id);
    console.log('任务名称:', task.name);
    console.log('记录数:', task.record_count);
    console.log('配置:', JSON.stringify(config, null, 2));
    
    // 查询该任务的职位记录数量（按页分组）
    const recordsResult = await client.query(
      `SELECT 
         page_number,
         COUNT(*) as count,
         MIN(created_at) as first_record_time,
         MAX(created_at) as last_record_time
       FROM job_listings 
       WHERE task_id = $1
       GROUP BY page_number
       ORDER BY page_number`,
      [task.id]
    );
    
    console.log('\n=== 每页记录数统计 ===\n');
    let totalRecords = 0;
    recordsResult.rows.forEach(row => {
      const pageNum = row.page_number || '未知';
      const count = parseInt(row.count);
      totalRecords += count;
      console.log(`第${pageNum}页: ${count}条记录`);
    });
    
    console.log(`\n总计: ${totalRecords}条记录`);
    console.log(`预期: ${config.maxPages * 20}条记录 (${config.maxPages}页 × 20条/页)`);
    console.log(`缺失: ${config.maxPages * 20 - totalRecords}条记录`);
    
    // 检查是否有重复的职位
    const duplicatesResult = await client.query(
      `SELECT title, company, city, COUNT(*) as duplicate_count
       FROM job_listings
       WHERE task_id = $1
       GROUP BY title, company, city
       HAVING COUNT(*) > 1
       ORDER BY duplicate_count DESC
       LIMIT 10`,
      [task.id]
    );
    
    if (duplicatesResult.rows.length > 0) {
      console.log('\n=== 可能的重复职位（前10个）===\n');
      duplicatesResult.rows.forEach((row, idx) => {
        console.log(`${idx + 1}. "${row.title}" - ${row.company} (${row.city}) - 重复${row.duplicate_count}次`);
      });
    } else {
      console.log('\n✓ 未发现重复职位');
    }
    
  } catch (error) {
    console.error('错误:', error.message);
  } finally {
    if (client) {
      client.release();
    }
    try {
      await pool.end();
    } catch (e) {
      // 忽略end错误
    }
  }
}

analyzeTaskRecords();

async function checkTaskConfig() {
  try {
    const client = await pool.connect();
    const result = await client.query(
      'SELECT id, name, config FROM tasks WHERE id = $1',
      ['60fbbfd5-05f4-4be9-926f-b23b5f6f9498']
    );
    
    if (result.rows.length === 0) {
      console.log('未找到该任务');
      client.release();
      await pool.end();
      return;
    }
    
    const task = result.rows[0];
    const config = typeof task.config === 'string' ? JSON.parse(task.config) : task.config;
    
    console.log('\n=== 任务配置信息 ===\n');
    console.log('任务ID:', task.id);
    console.log('任务名称:', task.name);
    console.log('配置信息:');
    console.log(JSON.stringify(config, null, 2));
    console.log();
    
    client.release();
    await pool.end();
    
  } catch (error) {
    console.error('错误:', error);
  }
}

checkTaskConfig();

async function verifyTaskNames() {
  try {
    const client = await pool.connect();
    const result = await client.query(
      'SELECT id, name FROM tasks ORDER BY created_at DESC LIMIT 5'
    );
    
    console.log('\n=== 当前数据库中的任务名称 ===\n');
    result.rows.forEach((row, i) => {
      console.log(`${i + 1}. ${row.name}`);
    });
    console.log();
    
    client.release();
    await pool.end();
    
  } catch (error) {
    console.error('错误:', error);
  }
}

verifyTaskNames();

async function updateTaskNames() {
  try {
    console.log('\n=== 开始批量更新任务名称 ===\n');
    
    const client = await pool.connect();
    
    // 查询所有任务
    const result = await client.query(
      'SELECT id, name, config FROM tasks ORDER BY created_at DESC'
    );
    
    console.log(`找到 ${result.rows.length} 个任务\n`);
    
    let updatedCount = 0;
    
    for (const task of result.rows) {
      const config = typeof task.config === 'string' ? JSON.parse(task.config) : task.config;
      
      // 生成新的任务名称
      const parts = [];
      
      if (config.sites && config.sites.length > 0) {
        const siteNames = config.sites.map(s => s === 'zhilian' ? '智联' : '前程无忧');
        parts.push(siteNames.join('+'));
      }
      
      if (config.city) {
        parts.push(config.city);
      } else if (config.province) {
        parts.push(config.province);
      }
      
      const newName = parts.join(' - ') || '全部职位';
      
      // 如果名称不同，则更新
      if (newName !== task.name) {
        console.log(`更新任务: ${task.id}`);
        console.log(`  旧名称: ${task.name}`);
        console.log(`  新名称: ${newName}\n`);
        
        await client.query(
          'UPDATE tasks SET name = $1 WHERE id = $2',
          [newName, task.id]
        );
        
        updatedCount++;
      }
    }
    
    client.release();
    await pool.end();
    
    console.log(`\n=== 更新完成 ===`);
    console.log(`总共更新: ${updatedCount} 个任务\n`);
    
  } catch (error) {
    console.error('错误:', error);
  }
}

updateTaskNames();

async function testTaskNameGeneration() {
  try {
    // 模拟generateTaskName函数
    function generateTaskName(config) {
      const parts = [];

      if (config.sites && config.sites.length > 0) {
        const siteNames = config.sites.map(s => s === 'zhilian' ? '智联' : '前程无忧');
        parts.push(siteNames.join('+'));
      }

      // 🔧 修改：去掉职位关键词，只保留城市信息
      if (config.city) {
        parts.push(config.city);
      } else if (config.province) {
        parts.push(config.province);
      }

      return parts.join(' - ') || '全部职位';
    }

    // 测试用例
    console.log('\n=== 任务名称生成测试 ===\n');
    
    const testCases = [
      {
        name: '单城市+多关键词',
        config: {
          sites: ['zhilian'],
          keywords: ['Java工程师', '前端开发'],
          city: '北京'
        },
        expected: '智联 - 北京'
      },
      {
        name: '双平台+单城市',
        config: {
          sites: ['zhilian', '51job'],
          keywords: ['产品经理'],
          city: '上海'
        },
        expected: '智联+前程无忧 - 上海'
      },
      {
        name: '仅省份',
        config: {
          sites: ['zhilian'],
          keywords: ['测试工程师'],
          province: '广东'
        },
        expected: '智联 - 广东'
      },
      {
        name: '无地域限制',
        config: {
          sites: ['51job'],
          keywords: ['运营']
        },
        expected: '前程无忧'
      }
    ];

    testCases.forEach((testCase, index) => {
      const result = generateTaskName(testCase.config);
      const passed = result === testCase.expected;
      
      console.log(`测试 ${index + 1}: ${testCase.name}`);
      console.log(`  输入:`, JSON.stringify(testCase.config, null, 2));
      console.log(`  期望: ${testCase.expected}`);
      console.log(`  实际: ${result}`);
      console.log(`  结果: ${passed ? '✅ 通过' : '❌ 失败'}\n`);
    });

    // 查询数据库中最近创建的任务
    console.log('\n=== 最近创建的任务 ===\n');
    const client = await pool.connect();
    const result = await client.query(
      'SELECT id, name, config FROM tasks ORDER BY created_at DESC LIMIT 5'
    );
    
    result.rows.forEach((task, index) => {
      const config = typeof task.config === 'string' ? JSON.parse(task.config) : task.config;
      console.log(`任务 ${index + 1}:`);
      console.log(`  ID: ${task.id}`);
      console.log(`  名称: ${task.name}`);
      console.log(`  配置:`, JSON.stringify({
        sites: config.sites,
        keywords: config.keywords || config.keyword,
        city: config.city || config.cities,
        province: config.province
      }, null, 2));
      console.log();
    });
    
    client.release();
    await pool.end();
    
  } catch (error) {
    console.error('错误:', error);
  }
}

testTaskNameGeneration();
