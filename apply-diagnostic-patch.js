// 智联招聘爬虫诊断日志补丁应用脚本
// 使用方法: node apply-diagnostic-patch.js

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'code/backend/src/services/crawler/zhilian.ts');

console.log('🔧 开始应用诊断日志补丁...');
console.log(`📄 目标文件: ${filePath}\n`);

// 读取文件内容
let content = fs.readFileSync(filePath, 'utf-8');

// ========== 修改1: 策略2成功计数和最终日志 ==========
console.log('📝 修改1: 添加策略2成功计数和最终日志...');

const strategy2OldCode = `                          });
                        } catch (e) {
                          // 忽略单个卡片错误
                        }
                      });
                      
                      // 🔧 关键修复：移除硬编码的15个职位限制
                      console.log(\`[ZhilianCrawler] 策略2提取完成，共找到 \${jobList.length} 个职位\`);
                    }
                  } catch (e) {
                    // Ignore error
                  }
                }
                
                // 🔧 关键修复：移除硬编码的15个职位限制，继续尝试策略3以补充更多职位`;

const strategy2NewCode = `                          });
                          
                          strategy2Stats.extractedJobs++;  // 🔧 统计成功提取的职位数
                        } catch (e) {
                          strategy2Stats.failedExtractions++;  // 🔧 统计失败的提取
                          // 忽略单个卡片错误
                        }
                      });
                      
                      // 🔧 关键修复：移除硬编码的15个职位限制
                      console.log(\`[ZhilianCrawler] 策略2提取完成，共找到 \${strategy2Stats.extractedJobs} 个职位 (失败\${strategy2Stats.failedExtractions}次)\`);
                      break;  // 🔧 策略2成功后跳出选择器循环
                    }
                  } catch (e) {
                    // Ignore error
                  }
                }
                
                if (!foundCards) {  // 🔧 如果所有选择器都未匹配到容器
                  console.log(\`[ZhilianCrawler] ⚠️ 策略2: 未找到任何匹配的职位卡片容器\`);
                }
                
                // 🔧 关键修复：移除硬编码的15个职位限制，继续尝试策略3以补充更多职位`;

if (content.includes(strategy2OldCode)) {
  content = content.replace(strategy2OldCode, strategy2NewCode);
  console.log('✅ 修改1完成\n');
} else {
  console.log('⚠️  修改1: 未找到目标代码（可能已修改或代码结构变化）\n');
}

// ========== 修改2: 策略3统计变量初始化 ==========
console.log('📝 修改2: 添加策略3统计变量初始化...');

const strategy3InitOldCode = `                // ========== 策略3: 基于职位链接提取（最可靠）==========
                const jobLinks = Array.from(document.querySelectorAll('a[href*="/jobdetail/"], a[href*="/job/"]'));
                
                // 🔧 移除局部seenHrefs和seenTitles，使用全局去重集合
                let duplicateCount = 0;`;

const strategy3InitNewCode = `                // ========== 策略3: 基于职位链接提取（最可靠）==========
                const jobLinks = Array.from(document.querySelectorAll('a[href*="/jobdetail/"], a[href*="/job/"]'));
                
                // 🔧 诊断日志：记录策略3的匹配情况
                const strategy3Stats = {
                  foundLinks: jobLinks.length,
                  extractedJobs: 0,
                  duplicateCount: 0,
                  failedExtractions: 0
                };
                
                // 🔧 移除局部seenHrefs和seenTitles，使用全局去重集合
                let duplicateCount = 0;`;

if (content.includes(strategy3InitOldCode)) {
  content = content.replace(strategy3InitOldCode, strategy3InitNewCode);
  console.log('✅ 修改2完成\n');
} else {
  console.log('⚠️  修改2: 未找到目标代码（可能已修改或代码结构变化）\n');
}

// ========== 修改3: 策略3链接处理循环中的计数逻辑 ==========
console.log('📝 修改3: 添加策略3计数逻辑...');

// 在jobLinks.forEach中添加计数逻辑
const forEachOldPattern = /jobLinks\.forEach\(\(link: any\) => \{\s+try \{\s+const href = link\.href \|\| '';\s+if \(!href\) return;/g;

const forEachNewCode = `jobLinks.forEach((link: any) => {
                  try {
                    const href = link.href || '';
                    if (!href) {
                      strategy3Stats.failedExtractions++;
                      return;
                    }`;

if (forEachOldPattern.test(content)) {
  content = content.replace(forEachOldPattern, forEachNewCode);
  console.log('✅ 修改3.1完成 (href检查)\n');
} else {
  console.log('⚠️  修改3.1: 未找到href检查代码\n');
}

// 添加重复检查计数
const duplicateCheckOldPattern = /if \(globalSeenHrefs\.has\(href\)\) return;/g;
const duplicateCheckNewCode = `if (globalSeenHrefs.has(href)) {
                      strategy3Stats.duplicateCount++;
                      return;
                    }`;

if (duplicateCheckOldPattern.test(content)) {
  content = content.replace(duplicateCheckOldPattern, duplicateCheckNewCode);
  console.log('✅ 修改3.2完成 (重复检查)\n');
} else {
  console.log('⚠️  修改3.2: 未找到重复检查代码\n');
}

// 添加标题长度检查计数
const titleLengthOldPattern = /if \(!title \|\| title\.length < 2 \|\| title\.length > 150\) return;/g;
const titleLengthNewCode = `if (!title || title.length < 2 || title.length > 150) {
                      strategy3Stats.failedExtractions++;
                      return;
                    }`;

if (titleLengthOldPattern.test(content)) {
  content = content.replace(titleLengthOldPattern, titleLengthNewCode);
  console.log('✅ 修改3.3完成 (标题长度检查)\n');
} else {
  console.log('⚠️  修改3.3: 未找到标题长度检查代码\n');
}

// 添加无效标题过滤计数
const invalidTitleOldPattern = /if \(title\.includes\('立即沟通'\) \|\| title\.includes\('立即投递'\) \|\s+title\.includes\('收藏'\) \|\| title\.includes\('分享'\)\) return;/g;
const invalidTitleNewCode = `if (title.includes('立即沟通') || title.includes('立即投递') || 
                        title.includes('收藏') || title.includes('分享')) {
                      strategy3Stats.failedExtractions++;
                      return;
                    }`;

if (invalidTitleOldPattern.test(content)) {
  content = content.replace(invalidTitleOldPattern, invalidTitleNewCode);
  console.log('✅ 修改3.4完成 (无效标题过滤)\n');
} else {
  console.log('⚠️  修改3.4: 未找到无效标题过滤代码\n');
}

// 添加重复标题检查计数
const duplicateTitleOldPattern = /if \(globalSeenTitles\.has\(title\)\) \{/g;
const duplicateTitleNewCode = `if (globalSeenTitles.has(title)) {
                      strategy3Stats.duplicateCount++;`;

if (duplicateTitleOldPattern.test(content)) {
  content = content.replace(duplicateTitleOldPattern, duplicateTitleNewCode);
  console.log('✅ 修改3.5完成 (重复标题检查)\n');
} else {
  console.log('⚠️  修改3.5: 未找到重复标题检查代码\n');
}

// 添加成功提取计数
const pushSuccessOldPattern = /businessScope\s*\}\s*\);\s+\} catch \(e\) \{\s+\/\/ Ignore error/g;
const pushSuccessNewCode = `businessScope
                    });
                    
                    strategy3Stats.extractedJobs++;  // 🔧 统计成功提取
                    
                  } catch (e) {
                    strategy3Stats.failedExtractions++;  // 🔧 统计失败
                    // Ignore error`;

if (pushSuccessOldPattern.test(content)) {
  content = content.replace(pushSuccessOldPattern, pushSuccessNewCode);
  console.log('✅ 修改3.6完成 (成功/失败计数)\n');
} else {
  console.log('⚠️  修改3.6: 未找到jobList.push位置\n');
}

// 添加策略3最终日志
const strategy3EndOldPattern = /\}\);\s+return jobList;/g;
const strategy3EndNewCode = `});
                
                console.log(\`[ZhilianCrawler] 策略3提取完成，共找到 \${strategy3Stats.extractedJobs} 个职位 (链接总数\${strategy3Stats.foundLinks}, 重复\${strategy3Stats.duplicateCount}, 失败\${strategy3Stats.failedExtractions})\`);
                
                return jobList;`;

if (strategy3EndOldPattern.test(content)) {
  content = content.replace(strategy3EndOldPattern, strategy3EndNewCode);
  console.log('✅ 修改3.7完成 (策略3最终日志)\n');
} else {
  console.log('⚠️  修改3.7: 未找到策略3结束位置\n');
}

// ========== 修改4: 返回值结构和Node.js端日志输出 ==========
console.log('📝 修改4: 修改返回值结构并添加汇总日志...');

const returnOldCode = `              return jobList;
              });

              console.log(\`[ZhilianCrawler] 使用 Puppeteer 找到 \${jobs.length} 个职位\`);`;

const returnNewCode = `              // 🔧 返回职位列表和统计信息
              return {
                jobs: jobList,
                stats: {
                  strategy1: strategy1Stats || { foundContainers: 0, extractedJobs: 0, failedExtractions: 0 },
                  strategy2: strategy2Stats || { extractedJobs: 0, failedExtractions: 0 },
                  strategy3: strategy3Stats || { foundLinks: 0, extractedJobs: 0, duplicateCount: 0, failedExtractions: 0 }
                }
              };
              });

              // 🔧 解构返回结果
              const jobs = result.jobs || [];
              const stats = result.stats || {};
              
              console.log(\`[ZhilianCrawler] 📊 多策略解析汇总:\`);
              console.log(\`[ZhilianCrawler]    策略1 (div.jobinfo): 提取 \${stats.strategy1?.extractedJobs || 0} 个职位 (失败\${stats.strategy1?.failedExtractions || 0}次)\`);
              console.log(\`[ZhilianCrawler]    策略2 (卡片容器): 提取 \${stats.strategy2?.extractedJobs || 0} 个职位 (失败\${stats.strategy2?.failedExtractions || 0}次)\`);
              console.log(\`[ZhilianCrawler]    策略3 (职位链接): 提取 \${stats.strategy3?.extractedJobs || 0} 个职位 (重复\${stats.strategy3?.duplicateCount || 0}, 失败\${stats.strategy3?.failedExtractions || 0})\`);
              console.log(\`[ZhilianCrawler]    最终结果: \${jobs.length} 个职位（已去重）\`);
              console.log(\`[ZhilianCrawler] 使用 Puppeteer 找到 \${jobs.length} 个职位\`);`;

if (content.includes(returnOldCode)) {
  content = content.replace(returnOldCode, returnNewCode);
  console.log('✅ 修改4完成\n');
} else {
  console.log('⚠️  修改4: 未找到返回值代码（可能已修改或代码结构变化）\n');
}

// 写回文件
fs.writeFileSync(filePath, content, 'utf-8');

console.log('✨ 补丁应用完成！');
console.log('\n📋 下一步操作:');
console.log('1. 编译代码: npm run build');
console.log('2. 重启服务: taskkill /F /IM node.exe && npm run dev');
console.log('3. 测试验证: 创建新任务观察诊断日志输出\n');
