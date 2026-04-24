// 完整应用诊断日志增强
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'code/backend/src/services/crawler/zhilian.ts');

console.log('🔧 开始应用完整的诊断日志增强...\n');

try {
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // 1. 增强策略1的标题长度检查日志
  content = content.replace(
    /if \(!title \|\| title\.length < 2 \|\| title\.length > 150\) \{\s+strategy1Stats\.failedExtractions\+\+;\s+return;\s+\}/g,
    `if (!title || title.length < 2 || title.length > 150) {
                        console.log(\`[ZhilianCrawler] ⚠️ 策略1跳过: [标题长度异常] 长度=\${title?.length || 0}, 内容="\${(title || '').substring(0, 30)}"\`);
                        strategy1Stats.failedExtractions++;
                        return;
                      }`
  );
  
  // 2. 增强策略1的无效关键词检查日志
  content = content.replace(
    /if \(title\.includes\('立即沟通'\) \|\| title\.includes\('立即投递'\)\) \{\s+strategy1Stats\.failedExtractions\+\+;\s+return;\s+\}/g,
    `if (title.includes('立即沟通') || title.includes('立即投递')) {
                        console.log(\`[ZhilianCrawler] ⚠️ 策略1跳过: [包含无效关键词] "\${title}"\`);
                        strategy1Stats.failedExtractions++;
                        return;
                      }`
  );
  
  // 3. 增强策略1的重复检查日志并修复计数Bug
  content = content.replace(
    /if \(globalSeenTitles\.has\(title\)\) \{\s+strategy3Stats\.duplicateCount\+\+;\s+strategy3Stats\.duplicateCount\+\+;\s+strategy1Stats\.failedExtractions\+\+;\s+return;\s+\}/g,
    `if (globalSeenTitles.has(title)) {
                        console.log(\`[ZhilianCrawler] ⚠️ 策略1跳过: [标题重复] "\${title}"\`);
                        strategy1Stats.duplicateCount++;  // ✅ 修复：使用正确的统计对象
                        strategy1Stats.failedExtractions++;
                        return;
                      }`
  );
  
  // 4. 增强策略1的catch块日志
  content = content.replace(
    /} catch \(e\) \{\s+strategy1Stats\.failedExtractions\+\+;\s+\/\/ Ignore error\s+}/g,
    `} catch (e) {
                      const errorMsg = e instanceof Error ? e.message : String(e);
                      console.log(\`[ZhilianCrawler] ⚠️ 策略1跳过: [DOM提取异常] 错误="\${errorMsg.substring(0, 100)}"\`);
                      strategy1Stats.failedExtractions++;
                      // Ignore error
                    }`
  );
  
  // 5. 增强策略2的catch块日志
  content = content.replace(
    /} catch \(e\) \{\s+strategy2Stats\.failedExtractions\+\+;\s*\/\/ 🔧 统计失败的提取\s+\/\/ 忽略单个卡片错误\s+}/g,
    `} catch (e) {
                          const errorMsg = e instanceof Error ? e.message : String(e);
                          console.log(\`[ZhilianCrawler] ⚠️ 策略2跳过: [DOM提取异常] 错误="\${errorMsg.substring(0, 100)}"\`);
                          strategy2Stats.failedExtractions++;  // 🔧 统计失败的提取
                          // 忽略单个卡片错误
                        }`
  );
  
  // 6. 增强策略1的最终汇总日志
  content = content.replace(
    /console\.log\(`\[ZhilianCrawler\] 策略1提取完成，共找到 \$\{strategy1Stats\.extractedJobs\} 个职位 \(失败$\{strategy1Stats\.failedExtractions\}次\)`\);/g,
    `console.log(\`[ZhilianCrawler] 策略1提取完成，共找到 \${strategy1Stats.extractedJobs} 个职位 (失败\${strategy1Stats.failedExtractions}次, 其中重复\${strategy1Stats.duplicateCount || 0}次)\`);`
  );
  
  // 7. 增强多策略汇总日志 - 策略1
  content = content.replace(
    /console\.log\(`\[ZhilianCrawler\]\s+策略1 \(div\.jobinfo\): 提取 $\{stats\.strategy1\?\.extractedJobs \|\| 0\} 个职位 \(失败$\{stats\.strategy1\?\.failedExtractions \|\| 0\}次\)`\);/g,
    `console.log(\`[ZhilianCrawler]    策略1 (div.jobinfo): 提取 \${stats.strategy1?.extractedJobs || 0} 个职位 (失败\${stats.strategy1?.failedExtractions || 0}次, 其中重复\${stats.strategy1?.duplicateCount || 0}次)\`);`
  );
  
  // 8. 增强多策略汇总日志 - 策略2
  content = content.replace(
    /console\.log\(`\[ZhilianCrawler\]\s+策略2 \(卡片容器\): 提取 $\{stats\.strategy2\?\.extractedJobs \|\| 0\} 个职位 \(失败$\{stats\.strategy2\?\.failedExtractions \|\| 0\}次\)`\);/g,
    `console.log(\`[ZhilianCrawler]    策略2 (卡片容器): 提取 \${stats.strategy2?.extractedJobs || 0} 个职位 (失败\${stats.strategy2?.failedExtractions || 0}次, 其中重复\${stats.strategy2?.duplicateCount || 0}次)\`);`
  );
  
  // 写入文件
  fs.writeFileSync(filePath, content, 'utf-8');
  
  console.log('✅ 所有诊断日志增强已应用！');
  console.log('\n增强的内容包括:');
  console.log('  1. 策略1标题长度异常日志');
  console.log('  2. 策略1无效关键词日志');
  console.log('  3. 策略1标题重复日志 + Bug修复');
  console.log('  4. 策略1 DOM提取异常日志');
  console.log('  5. 策略2 DOM提取异常日志');
  console.log('  6. 策略1最终汇总日志（含重复次数）');
  console.log('  7. 多策略汇总日志 - 策略1（含重复次数）');
  console.log('  8. 多策略汇总日志 - 策略2（含重复次数）');
  
} catch (error) {
  console.error('❌ 应用失败:', error.message);
  console.error(error.stack);
  process.exit(1);
}
