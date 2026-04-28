# 智联招聘爬虫职位解析遗漏问题 - HTML快照诊断方案

## 📊 当前问题状态

### 任务 9bedbdf6 日志分析

**任务ID**: `9bedbdf6-533e-42b4-8606-ddcc2ad6746a`  
**第1页结果**: 18/20条职位 (缺失2条)

**关键日志**:
```
14:37:24 [ZhilianCrawler] 开始使用多策略DOM解析职位数据...
14:37:24 [ZhilianCrawler] 使用 Puppeteer 找到 18 个职位
14:37:24 [ZhilianCrawler] ✅ 已为 18 个职位添加keyword字段: "销售"
14:37:24 [ZhilianCrawler] 过滤后剩余 18 个职位
14:37:24 📊 第 1 页解析完成 | 找到 18 条职位 | 过滤后 18 条
```

### 🔍 问题分析

从日志可以明确看出:

1. ✅ **代码已更新**: 有"已为18个职位添加keyword字段"的日志,说明使用的是新代码
2. ✅ **滚动优化已生效**: 之前的优化(10次滚动+3-5秒等待)已部署
3. ❌ **但DOM解析阶段就丢失了2个职位**: `找到 18 个职位` 说明在page.evaluate中只提取到18个,而非20个
4. ✅ **过滤不是问题**: 过滤前后都是18条,说明没有职位被过滤条件拦截

**核心结论**: 问题出在**DOM选择器无法匹配所有职位卡片**,而非懒加载或过滤逻辑。

---

## 🔧 最新优化: HTML快照自动保存

### 实施内容

在 [zhilian.ts](file://d:\AICODEING\aitraining\code\backend\src\services\crawler\zhilian.ts) 中添加了HTML快照自动保存功能:

**触发条件**: 当单页解析到的职位数 < 18时

**保存位置**: `code/backend/debug/zhilian_failed_task{taskId}_page{page}_{timestamp}.html`

**功能特性**:
1. ✅ 自动检测解析数量异常
2. ✅ 保存完整HTML源码
3. ✅ 记录文件大小
4. ✅ 通过WebSocket通知前端
5. ✅ 异常处理(保存失败不影响主流程)

**代码位置**: 第835行之后

```typescript
if (jobs.length < 18 && io && taskId) {
  console.warn(`[ZhilianCrawler] ⚠️ 警告：本页仅解析到 ${jobs.length} 个职位，预期20个，保存HTML快照...`);
  
  const html = await page.content();
  const debugDir = path.join(__dirname, '../../../../debug');
  
  if (!fs.existsSync(debugDir)) {
    fs.mkdirSync(debugDir, { recursive: true });
  }
  
  const timestamp = Date.now();
  const snapshotFile = path.join(debugDir, `zhilian_failed_task${taskId.substring(0, 8)}_page${currentPage}_${timestamp}.html`);
  fs.writeFileSync(snapshotFile, html, 'utf-8');
  
  console.log(`[ZhilianCrawler] 📸 HTML快照已保存: ${snapshotFile}`);
  console.log(`[ZhilianCrawler]    文件大小: ${(html.length / 1024).toFixed(2)} KB`);
  
  io.to(`task:${taskId}`).emit('task:log', {
    taskId,
    level: 'warning',
    message: `⚠️ 第${currentPage}页仅解析到${jobs.length}个职位(预期20个)，HTML快照已保存至debug目录`
  });
}
```

---

## 🚀 下一步行动

### Phase 1: 立即执行 (今天)

#### 1. 重启后端服务 ⚠️ **关键步骤**

根据记忆规范 **"长运行任务代码更新与生效机制"**:

> 正在运行的任务实例加载的是启动时的编译代码(dist目录)。若在任务运行期间修改了源代码(src目录),正在运行的任务不会自动应用新逻辑,**只有新启动的任务才会使用新代码**。

**操作步骤**:
```bash
# 1. 停止当前后端服务 (Ctrl+C)
# 2. 重新启动
cd d:\AICODEING\aitraining\code\backend
npm run dev
```

#### 2. 创建测试任务

在前端创建一个新的测试任务:
- 关键词: "销售"
- 城市: "哈尔滨"
- 平台: 智联招聘
- 页数: 2页

#### 3. 观察日志输出

**预期日志**:
```
[ZhilianCrawler] 使用 Puppeteer 找到 20 个职位
[ZhilianCrawler] ✅ 本页解析正常：20/20 个职位
```

**如果仍然<18**:
```
[ZhilianCrawler] ⚠️ 警告：本页仅解析到 18 个职位，预期20个，保存HTML快照...
[ZhilianCrawler] 📸 HTML快照已保存: D:\AICODEING\aitraining\code\backend\debug\zhilian_failed_task9bedbdf6_page1_1234567890.html
[ZhilianCrawler]    文件大小: XXX.XX KB
```

---

### Phase 2: 离线分析 (获取HTML快照后)

#### 4. 打开HTML快照文件

在浏览器中打开保存的HTML文件:
```
file:///D:/AICODEING/aitraining/code/backend/debug/zhilian_failed_taskXXXX_pageX_XXXX.html
```

#### 5. 手动统计职位卡片

在浏览器开发者工具中执行:
```javascript
// 方法1: 统计jobinfo标签
document.querySelectorAll('jobinfo').length

// 方法2: 统计职位卡片类名
document.querySelectorAll('.joblist-box__item').length

// 方法3: 统计职位链接
document.querySelectorAll('a[href*="/job/"]').length

// 方法4: 查看所有可能的职位容器
Array.from(document.querySelectorAll('[class*="job"]')).map(el => el.className)
```

#### 6. 对比分析

**检查项**:
- [ ] 实际HTML中有多少个职位卡片?
- [ ] 未被捕获的职位使用了什么CSS类名?
- [ ] 是否有特殊的嵌套结构?
- [ ] 是否被JavaScript动态渲染但未等待完成?

**示例分析**:
```
预期: 20个职位
实际DOM中存在: 20个jobinfo标签
爬虫解析到: 18个

可能原因:
- 2个职位的jobinfo标签缺少.jobname子元素
- 2个职位的标题为空或被隐藏
- 2个职位使用了不同的HTML结构
```

---

### Phase 3: 针对性优化 (根据分析结果)

#### 场景A: CSS类名不匹配

**解决方案**: 添加新的选择器策略

```typescript
const selectors = [
  '.positionlist__list .joblist-box__item',
  '.job-list-box .job-card-wrapper',
  '.joblist-box__item',
  '[class*="job-item"]',
  // 新增发现的类名
  '.new-discovered-class',
  '[data-testid="job-card"]'
];
```

#### 场景B: 嵌套结构差异

**解决方案**: 优化查询逻辑,向上查找父容器

```typescript
// 如果直接选择器失败,尝试从链接向上查找
const link = card.querySelector('a[href*="/job/"]');
if (link) {
  const parentCard = link.closest('[class*="job"], [class*="card"]');
  // 从parentCard提取信息
}
```

#### 场景C: JavaScript动态渲染

**解决方案**: 增加等待时间或使用MutationObserver

```typescript
await page.waitForSelector('.joblist-box__item', { timeout: 10000 });
// 或使用MutationObserver监听DOM变化
```

---

## 📈 预期效果

| 阶段 | 措施 | 预期解析率 |
|------|------|-----------|
| 当前 | 滚动10次+等待3-5s | 82.5% (33/40) |
| Phase 1 | HTML快照诊断 | 定位根本原因 |
| Phase 2 | 针对性优化选择器 | ~95% (38/40) |
| Phase 3 | 多策略融合 | ~100% (40/40) |

---

## ⚠️ 重要提醒

### 1. 必须重启服务

**切记**: 修改代码后,**必须重启后端服务**才能使新任务使用优化后的代码。正在运行的任务不会自动应用新逻辑。

### 2. HTML快照的价值

HTML快照是**调试动态页面爬取问题的黄金标准**:
- ✅ 保留完整的页面状态
- ✅ 可离线反复分析
- ✅ 可对比不同页面的差异
- ✅ 便于发现隐藏的DOM结构

### 3. 持续优化循环

建立以下工作流:
```
发现问题 → 保存快照 → 离线分析 → 优化选择器 → 重新测试 → 验证效果
```

---

## 📝 相关文件

- 核心代码: [zhilian.ts](file://d:\AICODEING\aitraining\code\backend\src\services\crawler\zhilian.ts)
- 调试目录: `code/backend/debug/` (自动创建)
- 前期分析: [TASK_3B54C3A8_INVESTIGATION.md](file://d:\AICODEING\aitraining\TASK_3B54C3A8_INVESTIGATION.md)
- 历史报告: [TASK_C4CD2B1D_ANALYSIS.md](file://d:\AICODEING\aitraining\TASK_C4CD2B1D_ANALYSIS.md)

---

**更新日期**: 2026-04-24 14:40  
**更新内容**: 添加HTML快照自动保存功能  
**状态**: 待重启服务验证
