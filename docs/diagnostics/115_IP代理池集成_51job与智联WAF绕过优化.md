# IP 代理池集成 — 51job 与智联招聘 WAF 绕过优化

## 涉及提交

| 提交 | 说明 |
|------|------|
| *待提交* | 新建 proxyPool.ts 代理池服务模块；job51.ts + zhilian.ts 集成代理池自动切换 IP |

## 问题现象

51job 和智联招聘爬虫在持续爬取过程中，单一 IP 频繁触发 WAF 拦截：

- **51job**：Aliyun WAF 返回 7884 字节空白页，虽然有 `reportType=1` 参数绕过，但高强度爬取下 IP 仍会被封
- **智联招聘**：触发 "Security Verification" 安全验证页面，页面标题变为 "Security Verification"，后续请求全部被拦截
- **共同问题**：两个爬虫都依赖 BROWSER_RESTART 机制重启浏览器恢复，但重启后仍是同一 IP，WAF 封禁状态持续

## 根因分析

### 根因 1：没有 IP 切换能力

两个爬虫的 BROWSER_RESTART 机制只能重启浏览器进程（换 userDataDir + 新 cookie），但网络出口 IP 不变。一旦 IP 被 WAF 标记为高风险，新浏览器同样被拦截。

### 根因 2：WAF 检测与恢复脱节

WAF 检测到拦截后，现有策略是：
1. 51job：尝试备用 URL → 首页搜索回退 → BROWSER_RESTART
2. 智联：降级为串行模式 → 加倍延迟 → 仍可能触发

这些策略都在同一 IP 下执行，无法从根本上解决问题。

### 根因 3：代理池基础设施缺失

项目没有代理池服务模块，Puppeteer 的 `--proxy-server` 参数从未被利用。

## 修复方案

### 整体架构

```
Job51Crawler / ZhilianCrawler
    │
    ├── 启动时：ProxyPool.getProxy() → --proxy-server=IP:port
    │
    ├── WAF 检测：ProxyPool.deleteProxy(IP) → BROWSER_RESTART
    │
    └── 降级：代理池不可用 → 自动直连模式
```

基于开源项目 [jhao104/proxy_pool](https://github.com/jhao104/proxy_pool)，提供 REST API 接口：
- `GET /get/` — 随机获取一个代理
- `GET /delete/?proxy=ip:port` — 删除失效代理
- `GET /pop/` — 获取并删除代理
- `GET /count` — 查看代理数量

### 修复 1：新建代理池服务模块 `proxyPool.ts`

```typescript
export class ProxyPool {
  constructor(poolUrl: string)  // default: http://127.0.0.1:5010

  async getProxy(): Promise<ProxyInfo | null>      // GET /get/
  async deleteProxy(proxy: string): Promise<boolean>  // GET /delete/
  async popProxy(): Promise<ProxyInfo | null>      // GET /pop/
  async getCount(): Promise<number>                // GET /count
  async checkHealth(proxy: string): Promise<boolean> // 代理可用性检测
  getProxyArgs(proxy: string): string[]            // → ['--proxy-server=http://ip:port']

  isAvailable(): boolean  // 连续失败 < 5 次
}
```

核心特性：
- **超时保护**：所有请求 5s 超时，防止代理池不可用时阻塞爬虫
- **连续失败计数**：连续失败 5 次后自动标记不可用，后续降级为直连
- **失败恢复**：`resetFailures()` 可在代理池恢复后重置计数器

### 修复 2：配置常量 `PROXY_POOL_CONFIG`

```typescript
export const PROXY_POOL_CONFIG = {
  enabled: process.env.PROXY_POOL_ENABLED !== 'false',  // 默认启用
  poolUrl: process.env.PROXY_POOL_URL || 'http://127.0.0.1:5010',
  maxProxyRetries: 3,                // 单代理最大重试次数
  maxProxySwitchesPerTask: 5,        // 单任务最多换代理次数（防无限循环）
  proxyHealthCheckTimeout: 8000,     // 可用性检测超时
  proxyPoolRequestTimeout: 5000,     // API 请求超时
};
```

### 修复 3：job51.ts 集成代理池（3 处接入点）

**接入点 1 — 浏览器启动：**

在 `puppeteer.launch()` 前获取代理，注入 `--proxy-server` 参数：

```typescript
// 初始化代理池
this.proxyPool = new ProxyPool(PROXY_POOL_CONFIG.poolUrl);

// 获取代理 IP
if (PROXY_POOL_CONFIG.enabled && this.proxyPool.isAvailable()) {
  const proxyInfo = await this.proxyPool.getProxy();
  if (proxyInfo) {
    this.currentProxy = proxyInfo.proxy;
  }
}

// 浏览器启动参数
const launchArgs = [/* ... */];
if (this.currentProxy) {
  launchArgs.push(`--proxy-server=http://${this.currentProxy}`);
}
```

**接入点 2 — WAF HTML 大小检测：**

HTML < 50000 字节时，删除失效代理并触发 BROWSER_RESTART：

```typescript
if (htmlLength < MIN_PAGE_HTML) {
  wafDetected = true;

  if (this.currentProxy && PROXY_POOL_CONFIG.enabled && this.proxyPool) {
    await this.proxyPool.deleteProxy(this.currentProxy);
    this.proxySwitchCount++;

    if (this.proxySwitchCount < PROXY_POOL_CONFIG.maxProxySwitchesPerTask) {
      const restartErr = new Error('BROWSER_RESTART_SCHEDULED: WAF拦截，切换代理IP重试');
      (restartErr as any).shouldRestart = true;
      throw restartErr;
    }
  }
  // 降级：达到最大切换次数后使用现有备用 URL 策略
}
```

**接入点 3 — 任务级 WAF 恢复：**

```typescript
if (totalYielded === 0 && wafDetected) {
  const proxyInfo = this.currentProxy ? ` (代理: ${this.currentProxy})` : '';
  const restartErr = new Error(`BROWSER_RESTART_SCHEDULED: 检测到WAF拦截${proxyInfo}`);
  (restartErr as any).shouldRestart = true;
  throw restartErr;
}
```

### 修复 4：zhilian.ts 集成代理池（4 处接入点）

**接入点 1 — 浏览器启动**（同 job51.ts，使用 zhilian 专属 userDataDir + launchArgs）

**接入点 2 — 页面健康检查 WAF 检测：**

在 `setupPageFingerprint` 的页面健康检查中，`isSecurityVerification === true` 时触发代理切换：

```typescript
if (pageHealth.isSecurityVerification) {
  // 删除失效代理 → proxySwitchCount++ → BROWSER_RESTART 换 IP
}
```

**接入点 3 — 详情页 WAF 检测：**

同上逻辑，在详情页抓取的健康检查中触发。

**接入点 4 — 批量并发 WAF 检测：**

批次中任意页面触发 WAF 时，删除当前代理（但不立即重启，先尝试降级串行）：

```typescript
if (wafInBatch) {
  wafDetected = true;
  if (this.currentProxy && PROXY_POOL_CONFIG.enabled && this.proxyPool) {
    await this.proxyPool.deleteProxy(this.currentProxy);
  }
  // 降级为串行模式处理剩余职位
}
```

## 修改文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `code/backend/src/services/crawler/proxyPool.ts` | **新增** | 代理池服务模块（160 行） |
| `code/backend/src/config/constants.ts` | 修改 | 添加 `PROXY_POOL_CONFIG` 配置 |
| `code/backend/src/services/crawler/job51.ts` | 修改 | 3 处集成代理池（启动 + WAF 检测 + 任务级恢复） |
| `code/backend/src/services/crawler/zhilian.ts` | 修改 | 4 处集成代理池（启动 + 页面健康检查 + 详情页 + 批量并发） |
| `code/backend/start-proxy-pool.bat` | **新增** | 一键启动代理池的批处理脚本 |

## 代理切换流程

```
任务启动
  │
  ├─ ProxyPool.getProxy()
  │   ├─ 成功 → currentProxy = "ip:port"
  │   └─ 失败 → 降级直连模式
  │
  ├─ puppeteer.launch({ args: [..., --proxy-server=IP] })
  │
  ├─ 爬取进行中...
  │   │
  │   ├─ WAF 检测触发 ──→ deleteProxy(IP)
  │   │                     proxySwitchCount++
  │   │                     │
  │   │                     ├─ < maxProxySwitchesPerTask → BROWSER_RESTART
  │   │                     │    └─ 新浏览器 + 新代理 IP（getProxy 获取新 IP）
  │   │                     │
  │   │                     └─ >= maxProxySwitchesPerTask → 降级继续
  │   │
  │   └─ 代理连续失败 5 次 → isAvailable() = false → 自动降级直连
  │
  └─ 任务结束（代理保留在池中，由代理池健康检查管理）
```

## 降级保障

| 场景 | 行为 |
|------|------|
| 代理池未启动 | `getCount()` 返回 -1 → 降级直连，不影响任务执行 |
| 代理池为空 | `getCount()` 返回 0 → 降级直连 |
| 获取代理失败 | `getProxy()` 返回 null → 降级直连 |
| 连续切换 5 次 | 不再触发 BROWSER_RESTART，使用现有备用 URL/串行策略 |
| 已切换 5 次仍被 WAF | 代理池耗尽或代理质量差 → 任务继续以直连模式运行 |

## 效果预期

| 指标 | 修复前 | 修复后 |
|------|--------|--------|
| WAF 拦截恢复方式 | 重启浏览器（同 IP） | 换 IP + 重启浏览器 |
| 单 IP 持续爬取时间 | 10-30 分钟（51job）/ 不定（智联） | 按代理质量，可数小时 |
| 代理池不可用时 | N/A | 自动降级直连，不影响任务 |
| WAF 切换响应 | 被动等待 + 降级串行 | 主动检测 → 删除代理 → 换 IP |
| 代理切换上限 | N/A | 每任务 5 次，防无限循环 |

## 部署说明

1. **安装代理池**：
   ```bash
   git clone https://github.com/jhao104/proxy_pool.git D:\proxy_pool
   cd D:\proxy_pool
   pip install -r requirements.txt
   ```

2. **启动代理池**（二选一）：
   - 双击 `code/backend/start-proxy-pool.bat` 一键启动
   - 手动：`python proxyPool.py schedule` + `python proxyPool.py webserver`

3. **配置环境变量**（可选）：
   - `PROXY_POOL_URL` — 代理池地址（默认 `http://127.0.0.1:5010`）
   - `PROXY_POOL_ENABLED=false` — 禁用代理池

4. **验证**：访问 `http://127.0.0.1:5010/count` 确认代理数量 > 0
