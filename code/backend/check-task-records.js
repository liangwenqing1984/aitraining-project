const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// 数据库配置
const pool = new Pool({
  host: '10.1.1.113',
  port: 7300,
  database: 'training_exercises',
  user: 'liangwenqing',
  password: 'liangwenqing'
});

async function analyzeCSVFile() {
  let client;
  try {
    client = await pool.connect();
    
    const taskId = '3dac6afc-91e4-48cc-8bdd-ddb79bfadead';
    
    // 查询CSV文件信息
    const csvResult = await client.query(
      'SELECT * FROM csv_files WHERE task_id = $1 ORDER BY created_at DESC LIMIT 1',
      [taskId]
    );
    
    if (csvResult.rows.length === 0) {
      console.log('未找到CSV文件记录');
      return;
    }
    
    const csvRecord = csvResult.rows[0];
    console.log('\n=== CSV文件信息 ===\n');
    console.log('文件名:', csvRecord.filename);
    console.log('文件大小:', csvRecord.file_size, 'bytes');
    console.log('创建时间:', csvRecord.created_at);
    
    // CSV文件可能在多个位置，尝试常见路径
    const possiblePaths = [
      csvRecord.file_path,
      path.join(__dirname, '..', 'uploads', csvRecord.filename),
      path.join(__dirname, '..', 'data', csvRecord.filename),
      path.join(__dirname, csvRecord.filename),
      path.join(process.cwd(), 'uploads', csvRecord.filename),
      path.join(process.cwd(), 'data', csvRecord.filename)
    ];
    
    let csvPath = null;
    for (const p of possiblePaths) {
      if (p && fs.existsSync(p)) {
        csvPath = p;
        console.log('\n✓ 找到CSV文件:', csvPath);
        break;
      }
    }
    
    if (!csvPath) {
      console.log('\n❌ 未找到CSV文件实体');
      console.log('尝试的路径:');
      possiblePaths.forEach(p => console.log('  -', p));
      return;
    }
    
    // 读取并分析CSV文件
    const content = fs.readFileSync(csvPath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    console.log('\n=== CSV文件内容分析 ===\n');
    console.log('总行数:', lines.length);
    console.log('数据行数:', lines.length - 1, '(排除表头)');
    
    // 显示表头
    if (lines.length > 0) {
      console.log('\n表头:', lines[0]);
    }
    
    // 按页统计（如果CSV中有page_number字段）
    const headerParts = lines[0].split(',');
    const pageNumberIndex = headerParts.findIndex(h => 
      h.trim().toLowerCase().includes('page') || 
      h.trim().toLowerCase().includes('页')
    );
    
    if (pageNumberIndex !== -1) {
      console.log(`\n检测到页码字段在第${pageNumberIndex + 1}列`);
      
      // 统计每页的记录数
      const pageStats = {};
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',');
        if (parts.length > pageNumberIndex) {
          const pageNum = parts[pageNumberIndex].trim();
          pageStats[pageNum] = (pageStats[pageNum] || 0) + 1;
        }
      }
      
      console.log('\n每页记录数统计:');
      Object.keys(pageStats).sort((a, b) => parseInt(a) - parseInt(b)).forEach(page => {
        const count = pageStats[page];
        const bar = '█'.repeat(count);
        console.log(`  第${page}页: ${count}条 ${bar}`);
      });
      
      const totalPages = Object.keys(pageStats).length;
      const totalRecords = Object.values(pageStats).reduce((sum, count) => sum + count, 0);
      const avgPerpage = (totalRecords / totalPages).toFixed(1);
      
      console.log(`\n总计: ${totalRecords}条记录`);
      console.log(`页数: ${totalPages}页`);
      console.log(`平均每页: ${avgPerpage}条`);
    } else {
      console.log('\n未检测到页码字段，显示前5行数据:');
      lines.slice(0, 6).forEach((line, idx) => {
        console.log(`${idx}: ${line.substring(0, 200)}${line.length > 200 ? '...' : ''}`);
      });
    }
    
  } catch (error) {
    console.error('错误:', error.message);
    console.error(error.stack);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

analyzeCSVFile();
