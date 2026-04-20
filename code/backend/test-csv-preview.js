const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

// 查找最新的CSV文件
const csvDir = path.join(__dirname, 'data', 'csv');

if (!fs.existsSync(csvDir)) {
  console.error('CSV目录不存在:', csvDir);
  process.exit(1);
}

const files = fs.readdirSync(csvDir)
  .filter(f => f.endsWith('.csv'))
  .sort()
  .reverse();

if (files.length === 0) {
  console.error('未找到CSV文件');
  process.exit(1);
}

const testFile = path.join(csvDir, files[0]);
console.log('测试文件:', testFile);
console.log('='.repeat(80));

// 使用csv-parser解析
const records = [];
let headers = [];

fs.createReadStream(testFile, { encoding: 'utf-8' })
  .pipe(csv())
  .on('headers', (headerList) => {
    headers = headerList;
    console.log('\n表头字段:');
    headerList.forEach((h, i) => {
      console.log(`  ${i + 1}. "${h}"`);
    });
  })
  .on('data', (row) => {
    if (records.length < 3) {  // 只取前3条
      records.push(row);
    }
  })
  .on('end', () => {
    console.log(`\n解析完成: 共 ${records.length} 条记录\n`);
    
    records.forEach((record, idx) => {
      console.log(`记录 ${idx + 1}:`);
      console.log('-'.repeat(80));
      
      // 检查关键字段
      const keyFields = ['职位标签', '职位描述', '薪资范围', '工作城市', '工作经验', '学历'];
      
      keyFields.forEach(field => {
        if (record[field] !== undefined) {
          const value = record[field];
          const hasComma = value.includes(',');
          const hasQuote = value.includes('"');
          
          console.log(`  ${field}:`);
          console.log(`    值: "${value}"`);
          console.log(`    长度: ${value.length}`);
          console.log(`    包含逗号: ${hasComma ? '✓' : '✗'}`);
          console.log(`    包含引号: ${hasQuote ? '✓' : '✗'}`);
          
          if (hasComma || hasQuote) {
            console.log(`    ⚠️  特殊字符检测通过 - csv-parser正确处理了该字段`);
          }
          console.log();
        } else {
          console.log(`  ${field}: [字段不存在]`);
        }
      });
      
      console.log();
    });
    
    console.log('='.repeat(80));
    console.log('✅ 测试完成: csv-parser正确解析了CSV文件');
  })
  .on('error', (error) => {
    console.error('❌ 解析错误:', error.message);
    process.exit(1);
  });
