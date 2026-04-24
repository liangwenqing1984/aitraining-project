// 修复策略1和策略2的重复计数Bug
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'code/backend/src/services/crawler/zhilian.ts');

console.log('🔧 开始修复重复计数Bug...\n');

try {
  // 读取文件
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // 修复策略1的重复计数（第442-445行）
  const strategy1Pattern = /if \(globalSeenTitles\.has\(title\)\) \{\s+strategy3Stats\.duplicateCount\+\+;\s+strategy3Stats\.duplicateCount\+\+;\s+strategy1Stats\.failedExtractions\+\+;/g;
  const strategy1Replacement = `if (globalSeenTitles.has(title)) {
                        strategy1Stats.duplicateCount++;  // ✅ 修复：使用正确的统计对象，移除重复计数
                        strategy1Stats.failedExtractions++;`;
  
  const matches1 = (content.match(strategy1Pattern) || []).length;
  console.log(`📝 找到策略1重复计数模式: ${matches1} 处`);
  
  content = content.replace(strategy1Pattern, strategy1Replacement);
  
  // 修复策略2的重复计数（第603-607行附近）
  const strategy2Pattern = /if \(globalSeenTitles\.has\(title\)\) \{\s+strategy3Stats\.duplicateCount\+\+;\s+strategy3Stats\.duplicateCount\+\+;\s+strategy2Stats\.failedExtractions\+\+;/g;
  const strategy2Replacement = `if (globalSeenTitles.has(title)) {
                            strategy2Stats.duplicateCount++;  // ✅ 修复：使用正确的统计对象，移除重复计数
                            strategy2Stats.failedExtractions++;`;
  
  const matches2 = (content.match(strategy2Pattern) || []).length;
  console.log(`📝 找到策略2重复计数模式: ${matches2} 处`);
  
  content = content.replace(strategy2Pattern, strategy2Replacement);
  
  // 写入文件
  fs.writeFileSync(filePath, content, 'utf-8');
  
  console.log('\n✅ Bug修复完成！');
  console.log(`   - 策略1: 修复 ${matches1 > 0 ? '1' : '0'} 处`);
  console.log(`   - 策略2: 修复 ${matches2 > 0 ? '1' : '0'} 处`);
  console.log('\n📋 修复内容:');
  console.log('   ❌ 旧代码: strategy3Stats.duplicateCount++ (两次)');
  console.log('   ✅ 新代码: strategy{1|2}Stats.duplicateCount++ (一次)');
  
} catch (error) {
  console.error('❌ 修复失败:', error.message);
  console.error(error.stack);
  process.exit(1);
}
