// 修复变量名冲突的Node.js脚本
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'code/backend/src/services/crawler/zhilian.ts');

console.log('🔧 开始修复变量名冲突...');

// 读取文件内容（指定UTF-8编码）
let content = fs.readFileSync(filePath, 'utf-8');

// 将 jobs.length 和 jobs.forEach 和 jobs.filter 替换为 jobList.xxx
// 使用正则表达式确保只匹配独立的jobs变量，而不是其他包含jobs的单词
content = content.replace(/\bjobs\.length\b/g, 'jobList.length');
content = content.replace(/\bjobs\.forEach\b/g, 'jobList.forEach');
content = content.replace(/\bjobs\.filter\b/g, 'jobList.filter');

// 写回文件（保持UTF-8编码）
fs.writeFileSync(filePath, content, 'utf-8');

console.log('✅ 变量名修复完成！');
console.log('📋 已替换:');
console.log('  - jobs.length → jobList.length');
console.log('  - jobs.forEach → jobList.forEach');
console.log('  - jobs.filter → jobList.filter\n');
