const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/config/zhilian-city-codes-generated.ts');

console.log('开始清理文件...');

let content = fs.readFileSync(filePath, 'utf8');

// 移除所有Emoji字符（包括⚠️和✅）
const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;

const beforeLength = content.length;
content = content.replace(emojiRegex, '');
const afterLength = content.length;

console.log(`清理完成！移除了 ${beforeLength - afterLength} 个字符`);

fs.writeFileSync(filePath, content, 'utf8');
console.log('文件已保存');
