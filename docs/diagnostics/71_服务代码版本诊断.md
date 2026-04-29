# 服务代码版本诊断报告

## 📋 诊断时间
**2026-04-27 15:44**

---

## ❌ 诊断结果：**当前运行的服务不是最新代码**

### 🔍 详细分析

| 检查项 | 状态 | 详情 |
|--------|------|------|
| **Git HEAD** | ✅ 最新 | `c1eeab9` (feat: 增强反爬检测与诊断能力) |
| **Git提交时间** | ✅ 14:25 | 2026-04-27 14:25左右 |
| **编译文件时间** | ❌ 旧版本 | `dist/zhilian.js`: **14:25:35** |
| **Node进程启动** | ❌ 旧版本 | 启动于 **14:25:36** |
| **源代码状态** | ❌ **已回滚** | `src/zhilian.ts` 第1085行仍是 `|| 1` |
| **并发修复** | ❌ **未应用** | 之前修改过但已回滚 |

---

## 🔎 问题根源

### 1. **并发修复代码从未真正生效**

**时间线**：
```
14:25 - Git提交 c1eeab9（不包含并发修复）
14:25:35 - 编译生成 dist/zhilian.js
14:25:36 - Node.js进程启动（加载旧代码）
───────
15:44 - 我尝试修复并发问题，但因语法错误执行了 git checkout 回滚
```

**当前源代码**（第1085行）：
```typescript
const concurrency = config.concurrency || 1; // ❌ 错误的默认值
```

**应该的代码**：
```typescript
const concurrency = config.concurrency != null ? config.concurrency : 2; // ✅ 正确的默认值
```

### 2. **为什么任务 8ece6a12 并发5仍然失败？**

因为运行的代码是**14:25编译的旧版本**，包含两个致命缺陷：

1. **默认值错误**：`config.concurrency || 1`
   - 如果前端传来的 [concurrency](file://d:\AICODEING\aitraining\code\frontend\src\api\task.ts#L23-L23) 是 `undefined` 或 `0`，会被强制改为 `1`
   - 导致即使配置了并发5，也可能进入串行模式

2. **没有串行模式的延迟优化**：
   - 串行模式下只有固定的 1-2秒延迟
   - 没有针对WAF优化的 5-10秒随机延迟

---

## ✅ 解决方案

### 立即执行步骤

#### 步骤1：重新应用并发修复

需要修改 `code/backend/src/services/crawler/zhilian.ts` 第1085行：

**修改前**：
```typescript
const concurrency = config.concurrency || 1; // 默认串行（兼容旧配置）
```

**修改后**：
```typescript
const concurrency = config.concurrency != null ? config.concurrency : 2; // 默认并发数为2
```

#### 步骤2：在串行模式下增加延迟

在第1088行的 `if (concurrency <= 1)` 分支内，将延迟从固定的 1-2秒改为 5-10秒随机延迟：

**修改前**：
```typescript
await this.randomDelay(1000, 2000);
```

**修改后**：
```typescript
// 串行模式下，每个职位间增加随机延迟（模拟人类浏览，降低WAF风险）
if (i < filteredJobs.length - 1) {
  const delay = 5000 + Math.random() * 5000;  // 5-10秒随机延迟
  this.log('info', `[ZhilianCrawler] ⏳ 等待 ${(delay/1000).toFixed(1)} 秒后处理下一个...`);
  await new Promise(resolve => setTimeout(resolve, delay));
}
```

#### 步骤3：重新编译并重启服务

```bash
# 1. 停止所有Node.js进程
taskkill /F /IM node.exe

# 2. 清理缓存
Remove-Item -Recurse -Force .tsx,node_modules\.cache,dist -ErrorAction SilentlyContinue

# 3. 重新编译
cd code/backend
npm run build

# 4. 启动服务
cd ..\..
start-dev.bat
```

#### 步骤4：验证新版本

创建测试任务，观察日志中是否出现：
```
[ZhilianCrawler] ⚡ 使用串行模式处理（最安全，避免WAF拦截）
[ZhilianCrawler] [1/17] 🔄 串行抓取: 职位名称
[ZhilianCrawler] ⏳ 等待 7.3 秒后处理下一个...
```

如果看到这些日志，说明新版本已生效。

---

## 📊 预期效果对比

| 维度 | 当前旧版本 | 修复后新版本 |
|------|-----------|-------------|
| **并发默认值** | 1（错误） | 2（正确） |
| **串行延迟** | 1-2秒固定 | 5-10秒随机 |
| **WAF拦截概率** | ~100% | ~20-30% |
| **详情页成功率** | 0% | 50-70% |
| **17职位耗时** | 29秒（全失败） | 1.5-3分钟（预期成功8-12条） |

---

## 🎯 总结

**核心问题**：
- ❌ 当前运行的是**14:25编译的旧代码**
- ❌ 并发修复代码**已被回滚**，未真正应用
- ❌ 任务 `8ece6a12` 使用的就是旧代码，所以并发5仍然失败

**解决步骤**：
1. ✅ 重新应用并发修复（修改默认值 + 增加串行延迟）
2. ✅ 重新编译代码
3. ✅ 重启Node.js服务
4. ✅ 创建新任务验证

**预期结果**：
- ✅ 并发功能正常工作
- ✅ 串行模式下WAF拦截概率大幅降低
- ✅ 详情页成功率从0%提升至50-70%

---

<div align="center">

**诊断完成时间**: 2026-04-27 15:44  
**状态**: ❌ 需要重新应用修复并重启服务

</div>
