/**
 * 验证智联招聘城市代码的唯一性
 * 
 * 功能：检查constants.ts中的ZHILIAN_CITY_CODES，确保每个城市都有唯一的代码
 */

const fs = require('fs');
const path = require('path');

// 读取constants.ts文件
const constantsPath = path.join(__dirname, 'src', 'config', 'constants.ts');
const content = fs.readFileSync(constantsPath, 'utf-8');

// 简单解析：提取所有 '城市名': '代码' 的模式
const cityCodeMap = {};
const codeToCities = {}; // 用于检测重复代码

const matches = content.matchAll(/'([^']+)':\s*'(\d{3})'/g);
for (const match of matches) {
  const [, city, code] = match;
  
  // 只处理看起来像城市名的（2-10个中文字符）
  if (/^[\u4e00-\u9fa5]{2,10}$/.test(city)) {
    cityCodeMap[city] = code;
    
    // 记录代码对应的城市列表
    if (!codeToCities[code]) {
      codeToCities[code] = [];
    }
    codeToCities[code].push(city);
  }
}

console.log('📊 城市代码统计报告\n');
console.log('=' .repeat(60));
console.log(`总城市数: ${Object.keys(cityCodeMap).length}`);
console.log(`唯一代码数: ${Object.keys(codeToCities).length}`);
console.log('=' .repeat(60));

// 检查是否有重复的代码
const duplicateCodes = Object.entries(codeToCities)
  .filter(([code, cities]) => cities.length > 1);

if (duplicateCodes.length > 0) {
  console.log('\n⚠️  发现重复的城市代码:\n');
  duplicateCodes.forEach(([code, cities]) => {
    console.log(`  代码 ${code}: ${cities.join(', ')}`);
  });
  console.log(`\n总计: ${duplicateCodes.length} 个代码被重复使用`);
} else {
  console.log('\n✅ 所有城市代码都是唯一的！没有重复。\n');
}

// 按代码范围分组统计
console.log('\n📋 按代码范围分组:\n');
const codeRanges = {};
Object.entries(cityCodeMap).forEach(([city, code]) => {
  const codeNum = parseInt(code);
  const rangeStart = Math.floor(codeNum / 10) * 10;
  const rangeKey = `${rangeStart}-${rangeStart + 9}`;
  
  if (!codeRanges[rangeKey]) {
    codeRanges[rangeKey] = [];
  }
  codeRanges[rangeKey].push(city);
});

Object.entries(codeRanges)
  .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
  .forEach(([range, cities]) => {
    console.log(`  ${range}: ${cities.length} 个城市`);
  });

// 输出前20个城市及其代码
console.log('\n📝 示例城市代码（前20个）:\n');
Object.entries(cityCodeMap)
  .slice(0, 20)
  .forEach(([city, code]) => {
    console.log(`  ${city.padEnd(10)}: ${code}`);
  });

console.log('\n✨ 验证完成！\n');
