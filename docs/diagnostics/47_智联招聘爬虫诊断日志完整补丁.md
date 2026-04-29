# 智联招聘爬虫诊断日志完整补丁

**创建时间**: 2026-04-24 18:15  
**目标文件**: `d:\AICODEING\aitraining\code\backend\src\services\crawler\zhilian.ts`

---

## 📝 修改清单

### ✅ 已完成部分（无需修改）
1. 策略1诊断日志 - 已完全实现
2. 策略2统计变量 - 已添加
3. 策略2失败计数 - 已添加（titleEl为空、标题长度、重复等）
4. HTML快照功能 - 已存在
5. 标题长度限制放宽 - 已存在

### ⏳ 待完成部分（需要手动添加）

#### 修改1: 策略2成功计数和最终日志（约第713-730行）

**找到以下代码**:
```typescript
jobList.push({ 
  title, 
  company, 
  salary, 
  city, 
  link,
  companyNature,    // ✅ 新增：企业性质
  companyScale,     // ✅ 新增：公司规模
  businessScope     // ✅ 新增：行业范围
});
} catch (e) {
  // 忽略单个卡片错误
}
});

// 🔧 关键修复：移除硬编码的15个职位限制
console.log(`[ZhilianCrawler] 策略2提取完成，共找到 ${jobList.length} 个职位`);
```

**修改为**:
```typescript
jobList.push({ 
  title, 
  company, 
  salary, 
  city, 
  link,
  companyNature,    // ✅ 新增：企业性质
  companyScale,     // ✅ 新增：公司规模
  businessScope     // ✅ 新增：行业范围
});

strategy2Stats.extractedJobs++;  // ← 添加这一行
} catch (e) {
  strategy2Stats.failedExtractions++;  // ← 添加这一行
  // 忽略单个卡片错误
}
});

// 🔧 关键修复：移除硬编码的15个职位限制
console.log(`[ZhilianCrawler] 策略2提取完成，共找到 ${strategy2Stats.extractedJobs} 个职位 (失败${strategy2Stats.failedExtractions}次)`);
break;  // ← 添加这一行
}
} catch (e) {
  // Ignore error
}
}

if (!foundCards) {  // ← 添加以下3行
  console.log(`[ZhilianCrawler] ⚠️ 策略2: 未找到任何匹配的职位卡片容器`);
}
```

---

#### 修改2: 策略3统计变量初始化（约第740行）

**找到以下代码**:
```typescript
// ========== 策略3: 基于职位链接提取（最可靠）==========
const jobLinks = Array.from(document.querySelectorAll('a[href*="/jobdetail/"], a[href*="/job/"]'));

// 🔧 移除局部seenHrefs和seenTitles，使用全局去重集合
let duplicateCount = 0;
```

**修改为**:
```typescript
// ========== 策略3: 基于职位链接提取（最可靠）==========
const jobLinks = Array.from(document.querySelectorAll('a[href*="/jobdetail/"], a[href*="/job/"]'));

// 🔧 诊断日志：记录策略3的匹配情况
const strategy3Stats = {
  foundLinks: jobLinks.length,
  extractedJobs: 0,
  duplicateCount: 0,
  failedExtractions: 0
};

// 🔧 移除局部seenHrefs和seenTitles，使用全局去重集合
let duplicateCount = 0;
```

---

#### 修改3: 策略3链接处理循环中的计数逻辑（约第745-845行）

**在 `jobLinks.forEach` 循环中，找到以下判断并添加计数**:

```typescript
jobLinks.forEach((link: any) => {
  try {
    const href = link.href || '';
    if (!href) {
      strategy3Stats.failedExtractions++;  // ← 添加
      return;
    }
    
    if (globalSeenHrefs.has(href)) {
      strategy3Stats.duplicateCount++;  // ← 添加
      return;
    }
    
    const title = (link.textContent || '').trim();
    
    if (!title || title.length < 2 || title.length > 150) {
      strategy3Stats.failedExtractions++;  // ← 添加
      return;
    }
    
    if (title.includes('立即沟通') || title.includes('立即投递') || 
        title.includes('收藏') || title.includes('分享')) {
      strategy3Stats.failedExtractions++;  // ← 添加
      return;
    }
    
    if (globalSeenTitles.has(title)) {
      strategy3Stats.duplicateCount++;  // ← 添加
      return;
    }
    
    // ... 中间的企业信息提取逻辑保持不变 ...
    
    jobList.push({
      title: title.trim(),
      company: company.trim() || '未知企业',
      salary: salary.trim(),
      city: city.trim(),
      link: href,
      companyNature,
      companyScale,
      businessScope
    });
    
    strategy3Stats.extractedJobs++;  // ← 添加这一行
    
  } catch (e) {
    strategy3Stats.failedExtractions++;  // ← 添加这一行
    // Ignore error
  }
});

console.log(`[ZhilianCrawler] 策略3提取完成，共找到 ${strategy3Stats.extractedJobs} 个职位 (链接总数${strategy3Stats.foundLinks}, 重复${strategy3Stats.duplicateCount}, 失败${strategy3Stats.failedExtractions})`);
```

---

#### 修改4: 修改返回值结构（约第849行）

**找到以下代码**:
```typescript
return jobList;
});

console.log(`[ZhilianCrawler] 使用 Puppeteer 找到 ${jobs.length} 个职位`);
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
});

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

## 🎯 验证步骤

1. **保存修改后的文件**

2. **编译代码**:
   ```powershell
   cd d:\AICODEING\aitraining\code\backend
   npm run build
   ```

3. **重启服务**:
   ```powershell
   taskkill /F /IM node.exe
   npm run dev
   ```

4. **测试任务**:
   - 关键词: "销售"
   - 城市: "哈尔滨"
   - 页数: 1页

5. **观察日志输出**:
   ```
   [ZhilianCrawler] 📊 多策略解析汇总:
   [ZhilianCrawler]    策略1 (div.jobinfo): 提取 X 个职位 (失败Y次)
   [ZhilianCrawler]    策略2 (卡片容器): 提取 X 个职位 (失败Y次)
   [ZhilianCrawler]    策略3 (职位链接): 提取 X 个职位 (重复Y, 失败Z)
   [ZhilianCrawler]    最终结果: N 个职位（已去重）
   ```

---

## 💡 预期收益

通过这个诊断系统，我们可以：

1. **精确定位问题**: 知道哪个策略有效、哪个失效
2. **量化失败原因**: 看到是过滤导致还是提取失败
3. **优化方向明确**: 根据数据决定是否需要调整选择器或等待策略
4. **性能评估**: 了解各策略的贡献度，避免冗余计算

---

**文档状态**: 完整补丁方案  
**下一步**: 按上述4个修改点依次应用
