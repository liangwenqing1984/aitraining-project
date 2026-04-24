# 智联招聘爬虫诊断日志修复方案

**问题**: `page.evaluate()` 中的 `console.log` 不会输出到 Node.js 控制台  
**原因**: Puppeteer 的浏览器环境和 Node.js 环境是隔离的  
**解决方案**: 将统计信息作为返回值传递，在 Node.js 端输出

---

## 🔧 需要修改的位置

### 位置1: 策略3统计变量初始化（约第740行）

在 `jobLinks` 定义后添加：

```typescript
// 🔧 诊断日志：记录策略3的匹配情况
const strategy3Stats = {
  foundLinks: jobLinks.length,
  extractedJobs: 0,
  duplicateCount: 0,
  failedExtractions: 0
};
```

### 位置2: 策略3链接处理循环（约第750-845行）

在每个判断分支中添加计数逻辑：

```typescript
jobLinks.forEach((link: any) => {
  try {
    const href = link.href || '';
    if (!href) {
      strategy3Stats.failedExtractions++;
      return;
    }
    
    if (globalSeenHrefs.has(href)) {
      strategy3Stats.duplicateCount++;
      return;
    }
    
    const title = (link.textContent || '').trim();
    if (!title || title.length < 2 || title.length > 150) {
      strategy3Stats.failedExtractions++;
      return;
    }
    
    if (title.includes('立即沟通') || title.includes('立即投递') || 
        title.includes('收藏') || title.includes('分享')) {
      strategy3Stats.failedExtractions++;
      return;
    }
    
    if (globalSeenTitles.has(title)) {
      strategy3Stats.duplicateCount++;
      return;
    }
    
    // ... 提取企业信息等逻辑 ...
    
    jobList.push({...});
    strategy3Stats.extractedJobs++;
    
  } catch (e) {
    strategy3Stats.failedExtractions++;
  }
});

console.log(`[ZhilianCrawler] 策略3提取完成，共找到 ${strategy3Stats.extractedJobs} 个职位 (链接总数${strategy3Stats.foundLinks}, 重复${strategy3Stats.duplicateCount}, 失败${strategy3Stats.failedExtractions})`);
```

### 位置3: 修改返回值（约第849行）

**当前代码**:
```typescript
return jobList;
```

**修改为**:
```typescript
// 🔧 返回职位列表和统计信息
return {
  jobs: jobList,
  stats: {
    strategy1: strategy1Stats || { foundContainers: 0, extractedJobs: 0, failedExtractions: 0 },
    strategy2: strategy2Stats || { extractedJobs: 0, failedExtractions: 0 },
    strategy3: strategy3Stats || { foundLinks: 0, extractedJobs: 0, duplicateCount: 0, failedExtractions: 0 }
  }
};
```

### 位置4: 解构返回结果并输出日志（约第851行）

**当前代码**:
```typescript
console.log(`[ZhilianCrawler] 使用 Puppeteer 找到 ${jobs.length} 个职位`);
```

**修改为**:
```typescript
// 🔧 解构返回结果
const jobs = result.jobs || [];
const stats = result.stats || {};

console.log(`[ZhilianCrawler] 📊 多策略解析汇总:`);
console.log(`[ZhilianCrawler]    策略1 (div.jobinfo): 提取 ${stats.strategy1?.extractedJobs || 0} 个职位 (失败${stats.strategy1?.failedExtractions || 0}次)`);
console.log(`[ZhilianCrawler]    策略2 (卡片容器): 提取 ${stats.strategy2?.extractedJobs || 0} 个职位 (失败${stats.strategy2?.failedExtractions || 0}次)`);
console.log(`[ZhilianCrawler]    策略3 (职位链接): 提取 ${stats.strategy3?.extractedJobs || 0} 个职位 (重复${stats.strategy3?.duplicateCount || 0}, 失败${stats.strategy3?.failedExtractions || 0})`);
console.log(`[ZhilianCrawler]    最终结果: ${jobs.length} 个职位（已去重）`);
console.log(`[ZhilianCrawler] 使用 Puppeteer 找到 ${jobs.length} 个职位`);
```

---

## 📋 完整修改步骤

1. **打开文件**: `d:\AICODEING\aitraining\code\backend\src\services\crawler\zhilian.ts`

2. **搜索定位**:
   - 搜索 `return jobList;` （约第849行）
   - 搜索 `jobLinks.forEach` （约第750行）

3. **按上述4个位置依次修改**

4. **编译代码**:
   ```powershell
   cd d:\AICODEING\aitraining\code\backend
   npm run build
   ```

5. **重启服务**:
   ```powershell
   taskkill /F /IM node.exe
   npm run dev
   ```

6. **测试验证**:
   - 创建新任务或重新运行现有任务
   - 观察日志中是否出现 "📊 多策略解析汇总"

---

## ✅ 预期效果

修改后的日志输出应该是：

```
[ZhilianCrawler] 开始使用多策略DOM解析职位数据...
[ZhilianCrawler] 策略1: 找到 20 个 div.jobinfo 容器
[ZhilianCrawler] 策略1提取完成，共找到 18 个职位 (失败2次)
[ZhilianCrawler] 策略2: 使用选择器 ".positionlist__list .joblist-box__item" 找到 20 个卡片
[ZhilianCrawler] 策略2提取完成，共找到 0 个职位 (失败20次) [全部因重复被过滤]
[ZhilianCrawler] 策略3提取完成，共找到 0 个职位 (链接总数35, 重复35, 失败0)
[ZhilianCrawler] 📊 多策略解析汇总:
[ZhilianCrawler]    策略1 (div.jobinfo): 提取 18 个职位 (失败2次)
[ZhilianCrawler]    策略2 (卡片容器): 提取 0 个职位 (失败20次)
[ZhilianCrawler]    策略3 (职位链接): 提取 0 个职位 (重复35, 失败0)
[ZhilianCrawler]    最终结果: 18 个职位（已去重）
[ZhilianCrawler] 使用 Puppeteer 找到 18 个职位
[ZhilianCrawler] ℹ️ 提示：本页解析到 18/20 个职位，略低于预期
```

---

## 💡 关键洞察

通过这个诊断系统，我们可以清楚地看到：

1. **哪个策略有效**: 如果策略1提取了18个，其他策略都是0，说明策略1已经覆盖大部分职位
2. **失败原因**: 如果策略1失败2次，可以进一步分析是标题过滤、重复还是字段提取失败
3. **优化方向**: 如果策略2/3有大量成功但被去重过滤，说明存在冗余策略；如果都失败，说明选择器需要调整

---

**文档生成时间**: 2026-04-24 18:10  
**状态**: 待手动实施
