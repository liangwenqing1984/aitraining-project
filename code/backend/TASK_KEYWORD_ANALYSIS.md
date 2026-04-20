# 任务 e22c0626-3832-43f6-8d5b-8acfe5de9c0a 只爬取部分关键词问题分析

## 🐛 问题描述

**任务ID**: `e22c0626-3832-43f6-8d5b-8acfe5de9c0a`  
**配置的关键词**: `["开发", "售前"]`  
**实际爬取结果**: 只爬取了"售前"的职位,遗漏了"开发"的职位

---

## 🔍 根本原因分析

### 1. 代码逻辑检查

通过分析爬虫代码,我发现 **多关键词遍历逻辑是正确的**:

#### [`zhilian.ts`](d:\AICODEING\aitraining\code\backend\src\services\crawler\zhilian.ts) 第58-73行:
```typescript
// 遍历所有关键词和城市的组合
for (const keyword of keywords) {
  for (const city of cities) {
    currentCombination++;
    
    if (this.checkAborted()) {
      console.log(`[ZhilianCrawler] 任务已中止`);
      return;
    }

    const cityCode = city ? ZHILIAN_CITY_CODES[city] : '';
    console.log(`[ZhilianCrawler] 开始爬取组合 ${currentCombination}/${totalCombinationCount}: 关键词="${keyword}", 城市="${city}"`);
    
    // ... 爬取逻辑
  }
}
```

✅ **这段代码逻辑正确**,会遍历所有关键词×城市的组合。

### 2. 可能的原因

既然代码逻辑正确,那么问题可能出在以下几个方面:

#### ❌ **原因1: 第一个关键词爬取失败导致中断**

如果"开发"关键词在爬取过程中遇到以下情况:
- 网站反爬拦截(返回空页面)
- 网络超时
- 选择器失效
- 触发异常且未正确处理

**可能导致整个任务提前终止**,后续的"售前"关键词根本没有执行。

但根据您说"只爬取了售前",这说明:
- **"售前"执行成功了** ✅
- **"开发"可能被跳过了** ❌

这与"第一个失败导致中断"矛盾。

#### ❌ **原因2: 任务配置中keywords数组只有一个元素**

可能前端创建任务时,**只添加了"售前"到keywords数组**,"开发"虽然在输入框中但未点击"添加"按钮。

**验证方法**: 查看数据库中该任务的config字段:
```sql
SELECT config FROM tasks WHERE id = 'e22c0626-3832-43f6-8d5b-8acfe5de9c0a';
```

预期应该看到:
```json
{
  "keywords": ["开发", "售前"],
  "cities": ["北京"],
  ...
}
```

如果实际是:
```json
{
  "keywords": ["售前"],  // ❌ 只有售前
  "cities": ["北京"],
  ...
}
```

那就说明**前端提交时就遗漏了"开发"**。

#### ⚠️ **原因3: "开发"关键词爬取结果为0条**

如果"开发"关键词确实执行了,但该关键词在该城市**确实没有匹配的职位**,或者:
- 网站改版导致选择器失效
- 被反爬机制拦截返回空数据
- 过滤条件过严(如企业名称过滤)

**会导致爬取到0条数据**,用户误以为"没爬取"。

#### ⚠️ **原因4: 日志隔离问题导致看不到"开发"的日志**

由于之前修复的**日志隔离bug**,如果您在"开发"爬取时打开了任务详情页,然后切换到其他任务,再回来查看,可能**只能看到最新任务的日志**。

但这不影响实际爬取,只是显示问题。

---

## 📋 诊断步骤

### 步骤1: 检查任务配置

请在PostgreSQL数据库中执行:

```sql
SELECT 
  id,
  name,
  status,
  record_count,
  config
FROM tasks 
WHERE id = 'e22c0626-3832-43f6-8d5b-8acfe5de9c0a';
```

**重点关注**:
- `config` 字段中的 `keywords` 数组是否包含 `["开发", "售前"]`
- `record_count` 是多少(如果只有"售前"的数据,数量会偏少)

### 步骤2: 查看后端日志

在后端控制台或日志文件中搜索:

```bash
grep "e22c0626-3832-43f6-8d5b-8acfe5de9c0a" backend.log
```

或直接查看控制台输出,寻找类似日志:

```
[ZhilianCrawler] 开始爬取组合 1/2: 关键词="开发", 城市="北京"
[ZhilianCrawler] 开始爬取组合 2/2: 关键词="售前", 城市="北京"
```

**如果只看到**:
```
[ZhilianCrawler] 开始爬取组合 1/1: 关键词="售前", 城市="北京"
```

说明**配置中只有一个关键词**。

**如果看到两个组合但第一个很快结束**:
```
[ZhilianCrawler] 开始爬取组合 1/2: 关键词="开发", 城市="北京"
[ZhilianCrawler] 使用 Puppeteer 找到 0 个职位  ← 关键!
[ZhilianCrawler] 开始爬取组合 2/2: 关键词="售前", 城市="北京"
```

说明**"开发"爬取了但没找到数据**。

### 步骤3: 检查CSV文件

查看生成的CSV文件:
```bash
cat data/csv/job_data_e22c0626-3832-43f6-8d5b-8acfe5de9c0a.csv | head -20
```

检查是否有"开发"相关的职位标题。

---

## ✅ 解决方案

### 方案A: 如果是配置问题(最可能)

**症状**: 数据库config中keywords只有`["售前"]`

**原因**: 前端创建任务时,"开发"输入后未点击"添加"按钮

**解决**:
1. 删除当前任务
2. 重新创建任务,确保:
   - 输入"开发" → 点击"添加"按钮 → 出现在标签列表 ✅
   - 输入"售前" → 点击"添加"按钮 → 出现在标签列表 ✅
   - 确认两个关键词都在下方标签列表中
3. 再次启动任务

**预防措施**: 
- 前端增加视觉提示,当输入框有内容但未添加时显示警告
- 提交前自动将输入框内容添加到列表(可选)

### 方案B: 如果是爬取失败

**症状**: 日志显示"开发"组合执行了,但找到0个职位

**可能原因**:
1. **网站反爬**: 第一个关键词就被拦截
2. **选择器失效**: 智联招聘页面结构变化
3. **网络问题**: 请求超时或失败

**解决**:
1. 查看后端日志中的详细错误信息
2. 尝试单独创建一个只爬取"开发"的任务测试
3. 检查debug目录中的HTML快照,确认页面是否正常加载
4. 如果确认被反爬,考虑:
   - 增加等待时间
   - 更换User-Agent
   - 使用代理IP
   - 切换到其他招聘平台

### 方案C: 增强日志输出(推荐)

无论哪种情况,都建议**增强日志输出**,让问题更容易排查:

在 [`zhilian.ts`](d:\AICODEING\aitraining\code\backend\src\services\crawler\zhilian.ts) 的第58行附近添加:

```typescript
console.log(`[ZhilianCrawler] ========== 开始遍历关键词和城市组合 ==========`);
console.log(`[ZhilianCrawler] 关键词列表: [${keywords.join(', ')}]`);
console.log(`[ZhilianCrawler] 城市列表: [${cities.join(', ')}]`);
console.log(`[ZhilianCrawler] 总组合数: ${totalCombinationCount}`);
console.log(`[ZhilianCrawler] ==============================================`);

// 遍历所有关键词和城市的组合
for (const keyword of keywords) {
  for (const city of cities) {
    currentCombination++;
    
    console.log(`[ZhilianCrawler] >>>>>> 开始处理组合 ${currentCombination}/${totalCombinationCount} <<<<<<`);
    console.log(`[ZhilianCrawler]   关键词: "${keyword}"`);
    console.log(`[ZhilianCrawler]   城市: "${city}"`);
    
    // ... 原有逻辑
  }
}

console.log(`[ZhilianCrawler] ========== 所有组合处理完成 ==========`);
```

这样即使出现问题,也能从日志中清晰看到:
- 哪些组合被执行了
- 每个组合找到了多少数据
- 哪个环节出了问题

---

## 🎯 立即行动建议

### 1. 先确认问题根源

请执行以下SQL查询并告诉我结果:

```sql
SELECT 
  id,
  name,
  status,
  record_count,
  created_at,
  config->'keywords' as keywords,
  config->'cities' as cities
FROM tasks 
WHERE id = 'e22c0626-3832-43f6-8d5b-8acfe5de9c0a';
```

**我需要看到**:
- `keywords` 的值是什么?
- `record_count` 是多少?

### 2. 根据结果采取对应措施

| 情况 | 判断 | 解决方案 |
|------|------|---------|
| `keywords = ["售前"]` | 配置问题 | 重新创建任务,确保两个关键词都添加 |
| `keywords = ["开发", "售前"]` 且 `record_count > 0` | 爬取成功但数据显示问题 | 检查前端展示逻辑 |
| `keywords = ["开发", "售前"]` 且 `record_count` 很小 | "开发"爬取失败 | 查看后端日志找原因 |
| `keywords = ["开发", "售前"]` 且 `record_count = 0` | 全部失败 | 检查网络和反爬 |

### 3. 优化代码防止再次发生

我建议在爬虫代码中添加更详细的日志,并在前端增加关键词添加的视觉提示。

---

## 📝 总结

根据我的分析,**最可能的原因是前端创建任务时,"开发"关键词未成功添加到keywords数组中**。

**验证方法**: 检查数据库中该任务的config字段的keywords数组。

**解决方法**: 
1. 如果确实是配置问题 → 重新创建任务
2. 如果是爬取问题 → 查看详细日志定位具体原因
3. 无论如何 → 增强日志输出便于未来排查

请提供上述SQL查询的结果,我将据此给出更精确的解决方案!
