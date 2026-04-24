// 修复策略3的重复计数Bug
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'code/backend/src/services/crawler/zhilian.ts');

console.log('🔧 开始修复策略3的重复计数Bug...\n');

try {
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // 修复策略3的重复计数（移除第二次累加，并添加诊断日志）
  const pattern = /\/\/ 🔧 使用全局去重集合检查重复\s+if \(globalSeenTitles\.has\(title\)\) \{\s+strategy3Stats\.duplicateCount\+\+;\s+strategy3Stats\.duplicateCount\+\+;\s+duplicateCount\+\+;\s+return;\s+\}/g;
  
  const replacement = `// 🔧 使用全局去重集合检查重复
                    if (globalSeenTitles.has(title)) {
                      console.log(\`[ZhilianCrawler] ⚠️ 策略3跳过: [标题重复] "\${title}"\`);
                      strategy3Stats.duplicateCount++;  // ✅ 修复：移除重复计数，只累加一次
                      duplicateCount++;
                      return;
                    }`;
  
  const matches = (content.match(pattern) || []).length;
  console.log(`📝 找到策略3重复计数Bug: ${matches} 处`);
  
  if (matches > 0) {
    content = content.replace(pattern, replacement);
    console.log('✅ 策略3重复计数Bug已修复');
    
    // 写入文件
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log('✅ 文件已保存');
  } else {
    console.log('⚠️  未找到需要修复的代码，可能已经修复或代码结构已变化');
  }
  
} catch (error) {
  console.error('❌ 修复失败:', error.message);
  console.error(error.stack);
  process.exit(1);
}
