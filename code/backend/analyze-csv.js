const fs = require('fs');

const csvPath = 'data/csv/job_data_3dac6afc-91e4-48cc-8bdd-ddb79bfadead.csv';

if (!fs.existsSync(csvPath)) {
  console.log('文件不存在:', csvPath);
  process.exit(1);
}

const content = fs.readFileSync(csvPath, 'utf-8');
const lines = content.split('\n').filter(line => line.trim());

console.log('\n=== CSV文件分析 ===\n');
console.log('总行数:', lines.length);
console.log('数据行数:', lines.length - 1);

// 显示表头
console.log('\n表头:');
console.log(lines[0]);

// 检测是否有page_number列
const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
console.log('\n所有列:', headers.join(' | '));

const pageNumIndex = headers.findIndex(h => 
  h.toLowerCase().includes('page') || h.includes('页')
);

if (pageNumIndex !== -1) {
  console.log(`\n✓ 检测到页码字段: "${headers[pageNumIndex]}" (第${pageNumIndex + 1}列)`);
  
  // 统计每页的记录数
  const pageStats = {};
  for (let i = 1; i < lines.length; i++) {
    // 简单分割，不考虑引号内的逗号
    const parts = lines[i].split(',');
    if (parts.length > pageNumIndex) {
      const pageNum = parts[pageNumIndex].trim().replace(/"/g, '');
      if (pageNum) {
        pageStats[pageNum] = (pageStats[pageNum] || 0) + 1;
      }
    }
  }
  
  console.log('\n=== 每页记录数统计 ===\n');
  Object.keys(pageStats).sort((a, b) => parseInt(a) - parseInt(b)).forEach(page => {
    const count = pageStats[page];
    const bar = '█'.repeat(Math.floor(count / 2));
    console.log(`第${page}页: ${count}条 ${bar}`);
  });
  
  const totalPages = Object.keys(pageStats).length;
  const totalRecords = Object.values(pageStats).reduce((sum, count) => sum + count, 0);
  const avgPerPage = (totalRecords / totalPages).toFixed(1);
  
  console.log(`\n=== 汇总 ===`);
  console.log(`总页数: ${totalPages}`);
  console.log(`总记录数: ${totalRecords}`);
  console.log(`平均每页: ${avgPerPage}条`);
  console.log(`预期: ${totalPages * 20}条 (${totalPages}页 × 20条/页)`);
  console.log(`差异: ${totalRecords - totalPages * 20}条`);
} else {
  console.log('\n未检测到页码字段');
  console.log('\n前5行数据示例:');
  lines.slice(1, 6).forEach((line, idx) => {
    console.log(`${idx + 1}: ${line.substring(0, 200)}...`);
  });
}
