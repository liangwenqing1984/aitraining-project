# 并发模式浏览器崩溃最终修复方案

## 📋 问题总结

### 失败日志分析

```
12:17:50 [6-9/17] ✅ 标签页创建成功
12:17:50 [6-9/17] ❌ Session closed. Most likely the page has been closed.
```

**根本原因**：
- ✅ 标签页创建成功（在锁保护下）
- ❌ 但在调用 `page.setViewport()` 时浏览器崩溃
- 💥 **互斥锁只保护了 `browser.newPage()`，没有保护页面初始化操作**

---

## ✅ 完整修复方案

需要修改两个地方：

### 修改1：扩展互斥锁保护范围

**文件**：`code/backend/src/services/crawler/zhilian.ts`  
**位置**：约第1280-1320行（并发批次处理部分）

**当前代码**（简化版）：
```typescript
const createPageWithLock = async () => {
  // ... 重试逻辑
  const page = await browser.newPage();
  return page;
};

const page = await createPageWithLock();

// ❌ 问题：这里在锁外执行，5个任务并发调用
await page.setRequestInterception(true);
await page.setViewport({ width: 1920, height: 1080 });
await page.setUserAgent('...');

jobData = await this.fetchJobDetailWithPage(page, job.link, job);
```

**修复后**：
```typescript
// 🔧 关键修复：使用全局互斥锁串行化标签页创建和初始化
const lockAcquired = await this.acquireLock('createPage', 30000);

if (!lockAcquired) {
  throw new Error('LOCK_TIMEOUT');
}

try {
  this.log('info', `[ZhilianCrawler] [${globalIndex}/${filteredJobs.length}] 🔒 已获取锁，开始创建并初始化标签页...`);
  
  if (!browser.isConnected()) {
    throw new Error('BROWSER_DISCONNECTED');
  }
  
  // 创建新标签页（带超时控制）
  const createPageTimeout = new Promise<any>((_, reject) => {
    setTimeout(() => reject(new Error('创建标签页超时（15秒）')), 15000);
  });
  
  const page = await Promise.race([
    browser.newPage(),
    createPageTimeout
  ]);
  
  this.log('info', `[ZhilianCrawler] [${globalIndex}/${filteredJobs.length}] ✅ 标签页创建成功`);
  
  // 🔧 关键：在锁保护下完成所有页面初始化操作
  try {
    await page.setRequestInterception(true);
    page.on('request', (request: any) => {
      if (['image', 'stylesheet', 'font', 'media'].includes(request.resourceType())) {
        request.abort();
      } else {
        request.continue();
      }
    });
    
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
    
    this.log('info', `[ZhilianCrawler] [${globalIndex}/${filteredJobs.length}] ✅ 页面初始化完成`);
  } catch (initError: any) {
    this.log('error', `[ZhilianCrawler] [${globalIndex}/${filteredJobs.length}] ❌ 页面初始化失败: ${initError.message}`);
    try {
      await page.close();
    } catch (e) {}
    throw initError;
  }
  
} finally {
  // 释放锁
  this.releaseLock('createPage');
  this.log('info', `[ZhilianCrawler] [${globalIndex}/${filteredJobs.length}] 🔓 已释放锁`);
}

// 现在使用初始化好的页面进行详情抓取（并行执行）
jobData = await this.fetchJobDetailWithPage(page, job.link, job);
```

---

### 修改2：移除fetchJobDetailWithPage中的重复初始化

**文件**：`code/backend/src/services/crawler/zhilian.ts`  
**方法**：`fetchJobDetailWithPage`  
**位置**：约第1930-1950行

**当前代码**：
```typescript
private async fetchJobDetailWithPage(page: any, jobUrl: string, basicInfo: any): Promise<JobData> {
  try {
    this.log('info', `[ZhilianCrawler] 📑 开始抓取详情页: ${jobUrl.substring(0, 60)}...`);

    // 🔧 设置资源拦截，减少内存占用
    await page.setRequestInterception(true);  // ❌ 重复设置！
    page.on('request', (request: any) => {
      if (['image', 'stylesheet', 'font', 'media'].includes(request.resourceType())) {
        request.abort();
      } else {
        request.continue();
      }
    });
    
    // 设置视口和用户代理
    await page.setViewport({ width: 1920, height: 1080 });  // ❌ 重复设置！
    await page.setUserAgent('Mozilla/5.0...');  // ❌ 重复设置！
    
    // 导航到详情页
    this.log('info', `[ZhilianCrawler] 🌐 正在导航至详情页...`);
    await page.goto(jobUrl, { 
      waitUntil: 'domcontentloaded',
      timeout: 15000 
    });
    // ...
  }
}
```

**修复后**：
```typescript
private async fetchJobDetailWithPage(page: any, jobUrl: string, basicInfo: any): Promise<JobData> {
  try {
    this.log('info', `[ZhilianCrawler] 📑 开始抓取详情页: ${jobUrl.substring(0, 60)}...`);

    // 🔧 页面已在并发控制中初始化完成（setRequestInterception、setViewport、setUserAgent）
    // 这里直接导航到详情页
    
    // 导航到详情页
    this.log('info', `[ZhilianCrawler] 🌐 正在导航至详情页...`);
    await page.goto(jobUrl, { 
      waitUntil: 'domcontentloaded',
      timeout: 15000 
    });
    // ... 后续代码保持不变
  }
}
```

---

### 修改3：添加互斥锁实现（如果还没有）

**文件**：`code/backend/src/services/crawler/zhilian.ts`  
**位置**：类开头，约第10-70行

在 `export class ZhilianCrawler {` 之后添加：

```typescript
export class ZhilianCrawler {
  private signal: AbortSignal | null = null;
  private logger: any = null;
  
  // 🔧 新增：全局互斥锁管理（防止并发创建标签页导致浏览器崩溃）
  private locks: Map<string, { locked: boolean; queue: Array<() => void> }> = new Map();
  
  // 🔧 获取锁（异步等待）
  private async acquireLock(lockName: string, timeout: number = 30000): Promise<boolean> {
    return new Promise((resolve) => {
      // 初始化锁
      if (!this.locks.has(lockName)) {
        this.locks.set(lockName, { locked: false, queue: [] });
      }
      
      const lock = this.locks.get(lockName)!;
      
      // 如果锁空闲，立即获取
      if (!lock.locked) {
        lock.locked = true;
        resolve(true);
        return;
      }
      
      // 锁被占用，加入等待队列
      let resolved = false;
      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          const index = lock.queue.indexOf(resolveWrapper);
          if (index > -1) {
            lock.queue.splice(index, 1);
          }
          resolve(false);  // 超时
        }
      }, timeout);
      
      const resolveWrapper = () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          resolve(true);
        }
      };
      
      lock.queue.push(resolveWrapper);
    });
  }
  
  // 🔧 释放锁
  private releaseLock(lockName: string): void {
    const lock = this.locks.get(lockName);
    if (!lock) return;
    
    // 如果有等待者，唤醒第一个
    if (lock.queue.length > 0) {
      const next = lock.queue.shift();
      if (next) next();
    } else {
      // 否则释放锁
      lock.locked = false;
    }
  }
  
  // 🔧 新增：设置日志记录器
  setLogger(logger: any) {
    this.logger = logger;
  }
  
  // 🔧 辅助方法：根据是否有logger选择输出方式
  private log(level: string, ...args: any[]) {
    if (this.logger) {
      (this.logger as any)[level](...args);
    } else {
      console[level](...args);
    }
  }
  
  // ... 其他方法
}
```

---

### 修改4：保存断点续传位置（已完成）

**文件**：`code/backend/src/services/crawler/zhilian.ts`  
**位置**：约第1570行

确保抛出重启错误时包含位置信息：

```typescript
const restartError = new Error(`BROWSER_RESTART_SCHEDULED: 已处理${currentCombination}个组合`);
(restartError as any).shouldRestart = true;
(restartError as any).combinationIndex = currentCombination;  // ✅ 保存组合索引
(restartError as any).currentPage = 1;  // ✅ 新组合从第1页开始
throw restartError;
```

---

## 🎯 修复原理

### 为什么需要扩展锁的保护范围？

**时间线对比**：

#### 修复前（有问题）：
```
T0: 任务1获取锁 → 创建标签页 → 释放锁
T1: 任务2获取锁 → 创建标签页 → 释放锁
T2: 任务3获取锁 → 创建标签页 → 释放锁
T3: 任务4获取锁 → 创建标签页 → 释放锁
T4: 任务5获取锁 → 创建标签页 → 释放锁
T5: 任务1调用 setViewport()  ← 5个任务同时调用！
T5: 任务2调用 setViewport()  ← 浏览器崩溃！
T5: 任务3调用 setViewport()
T5: 任务4调用 setViewport()
T5: 任务5调用 setViewport()
```

#### 修复后（正确）：
```
T0: 任务1获取锁 → 创建标签页 → setViewport → setUserAgent → 释放锁
T1: 任务2获取锁 → 创建标签页 → setViewport → setUserAgent → 释放锁
T2: 任务3获取锁 → 创建标签页 → setViewport → setUserAgent → 释放锁
T3: 任务4获取锁 → 创建标签页 → setViewport → setUserAgent → 释放锁
T4: 任务5获取锁 → 创建标签页 → setViewport → setUserAgent → 释放锁
T5: 任务1-5并行抓取详情页  ← 只有数据抓取是并行的
```

**关键区别**：
- ❌ 修复前：只保护 `newPage()`，不保护初始化
- ✅ 修复后：保护整个初始化过程（newPage + setViewport + setUserAgent）

---

## 📊 预期效果

| 维度 | 修复前 | 修复后 |
|------|--------|--------|
| **标签页创建** | 串行 ✅ | 串行 ✅ |
| **页面初始化** | 并发 ❌ | 串行 ✅ |
| **详情抓取** | 并发 ✅ | 并发 ✅ |
| **浏览器稳定性** | 🔴 易崩溃 | 🟢 稳定 |
| **Session closed错误** | 频繁出现 | 不再出现 |

---

## ⚠️ 注意事项

1. **不要删除任何现有代码**，只在指定位置插入或替换
2. **保持缩进一致**，使用2空格或4空格（与现有代码保持一致）
3. **编译检查**：每次修改后运行 `npm run build` 验证
4. **测试验证**：创建多关键词多城市的任务，观察是否还有 `Session closed` 错误

---

<div align="center">

**修复版本**: v1.0.10  
**状态**: 📝 待实施

</div>
