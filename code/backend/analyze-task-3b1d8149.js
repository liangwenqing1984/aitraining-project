// 分析任务 3b1d8149 的数据
const XLSX = require('xlsx');
const path = require('path');

const taskId = '3b1d8149-f5f0-4721-9bd3-7dbd765c9c85';
const filePath = path.join(__dirname, 'data/csv', `job_data_${taskId}.xlsx`);

console.log('🔍 开始分析任务:', taskId);
console.log('📄 文件路径:', filePath);
console.log('');

try {
  // 读取Excel文件
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  // 转换为JSON
  const data = XLSX.utils.sheet_to_json(worksheet);
  
  console.log(`📊 总记录数: ${data.length}`);
  console.log('');
  
  if (data.length === 0) {
    console.log('⚠️  文件为空！');
    process.exit(1);
  }
  
  // 显示前3条记录的详细信息
  console.log('📋 前3条记录示例:');
  console.log('='.repeat(80));
  data.slice(0, 3).forEach((row, index) => {
    console.log(`\n记录 ${index + 1}:`);
    console.log(`  职位名称: ${row.jobName || row.职位名称 || 'N/A'}`);
    console.log(`  公司名称: ${row.companyName || row.公司名称 || 'N/A'}`);
    console.log(`  薪资范围: ${row.salaryRange || row.薪资范围 || 'N/A'}`);
    console.log(`  工作城市: ${row.workCity || row.工作城市 || 'N/A'}`);
    console.log(`  数据来源: ${row.dataSource || row.数据来源 || 'N/A'}`);
  });
  
  console.log('\n' + '='.repeat(80));
  
  // 统计分析
  console.log('\n📈 数据统计分析:');
  console.log('-'.repeat(80));
  
  // 按数据来源统计
  const dataSourceCount = {};
  data.forEach(row => {
    const source = row.dataSource || row.数据来源 || '未知';
    dataSourceCount[source] = (dataSourceCount[source] || 0) + 1;
  });
  
  console.log('\n数据来源分布:');
  Object.entries(dataSourceCount).forEach(([source, count]) => {
    console.log(`  ${source}: ${count} 条 (${(count/data.length*100).toFixed(1)}%)`);
  });
  
  // 按城市统计
  const cityCount = {};
  data.forEach(row => {
    const city = row.workCity || row.工作城市 || '未知';
    cityCount[city] = (cityCount[city] || 0) + 1;
  });
  
  console.log('\n城市分布:');
  Object.entries(cityCount).sort((a, b) => b[1] - a[1]).forEach(([city, count]) => {
    console.log(`  ${city}: ${count} 条`);
  });
  
  // 检查是否有空字段
  console.log('\n🔎 数据完整性检查:');
  console.log('-'.repeat(80));
  
  const emptyFields = {
    jobName: 0,
    companyName: 0,
    salaryRange: 0,
    workCity: 0,
    workExperience: 0,
    education: 0
  };
  
  data.forEach(row => {
    if (!row.jobName && !row.职位名称) emptyFields.jobName++;
    if (!row.companyName && !row.公司名称) emptyFields.companyName++;
    if (!row.salaryRange && !row.薪资范围) emptyFields.salaryRange++;
    if (!row.workCity && !row.工作城市) emptyFields.workCity++;
    if (!row.workExperience && !row.工作经验) emptyFields.workExperience++;
    if (!row.education && !row.学历) emptyFields.education++;
  });
  
  console.log('\n空字段统计:');
  console.log(`  职位名称: ${emptyFields.jobName}/${data.length} (${(emptyFields.jobName/data.length*100).toFixed(1)}%)`);
  console.log(`  公司名称: ${emptyFields.companyName}/${data.length} (${(emptyFields.companyName/data.length*100).toFixed(1)}%)`);
  console.log(`  薪资范围: ${emptyFields.salaryRange}/${data.length} (${(emptyFields.salaryRange/data.length*100).toFixed(1)}%)`);
  console.log(`  工作城市: ${emptyFields.workCity}/${data.length} (${(emptyFields.workCity/data.length*100).toFixed(1)}%)`);
  console.log(`  工作经验: ${emptyFields.workExperience}/${data.length} (${(emptyFields.workExperience/data.length*100).toFixed(1)}%)`);
  console.log(`  学历要求: ${emptyFields.education}/${data.length} (${(emptyFields.education/data.length*100).toFixed(1)}%)`);
  
  console.log('\n✅ 分析完成！');
  
} catch (error) {
  console.error('❌ 分析失败:', error.message);
  console.error(error.stack);
  process.exit(1);
}
