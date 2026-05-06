# 免费代理池 HTTPS 隧道瓶颈 — 诊断与结论

日期: 2026-05-06 | 分支: `with_ip_proxy_pool`

## 背景

集成了 jhao104/proxy_pool 免费代理池，目标是通过自动切换代理 IP 绕过智联招聘和 51job 的 WAF 封锁。

## 现象

代理池积累 19-33 个免费代理后，所有代理无法被浏览器使用：
- Chrome 启动加 `--proxy-server=http://IP:port` 后，任何 HTTPS 页面都报 `ERR_TUNNEL_CONNECTION_FAILED`
- 即使 `checkHealth` 校验通过的代理，Chrome 也无法建立 CONNECT 隧道

## 排查过程

### 阶段 1：收紧健康检查（commit aa6a9be）

将 `checkHealth` 从 `status < 500` 收紧为 `status >= 200 && < 300`，并关闭重定向（`maxRedirects: 0`），防止 3xx/4xx 误判为可用。

**结果**: 无效。校验通过的代理在 Chrome 中仍然全部 `ERR_TUNNEL_CONNECTION_FAILED`。

### 阶段 2：代理获取时增加可用性验证 + 隧道失败自动切换（commit 6319c92）

在浏览器启动前做代理验证循环（最多 3 次换代理），在页面加载失败时自动删除死代理并触发 `BROWSER_RESTART`。

**结果**: 无效。所有代理在浏览器中都失败，切换耗尽后降级为直连。

### 阶段 3：策略切换 — 列表页直连 + 详情页 axios+代理（本次变更）

核心思路：既然 Chrome 用不了代理，就用 axios 通过代理直接 GET 详情页 HTML（`checkHealth` 已验证 axios 能连通）。

实施：
- 浏览器启动移除 `--proxy-server`（列表页直连，WAF 宽松）
- 新增 `fetchDetailViaProxy()` 方法，用 axios + cheerio 代替浏览器获取详情页
- 三级兜底：axios+代理 → 浏览器直连 → generateBasicJob

**结果**: 部分有效，但详情页数据获取仍然失败。

### 阶段 4：根因定位 — curl vs axios 对比测试

```bash
# curl 通过代理访问 HTTPS → exit code 56 (连接失败)
curl --proxy http://101.37.18.127:80 "https://www.zhaopin.com/" → FAIL

# axios 通过同一代理访问 HTTPS → 200 OK
axios.get("https://www.zhaopin.com/", { proxy }) → 200
```

**关键发现**: axios 和 curl 对 HTTP 代理的 CONNECT 隧道实现不同。axios 的 HTTP 客户端可以成功建立隧道，curl 不能。这解释了为什么 `checkHealth`（axios）通过但 Chrome（类似 curl 行为）失败。

### 阶段 5：详情页 SPA 问题

axios+代理成功 GET 到 zhilian 详情页 URL 后，返回的 HTML 只有 5KB，是 SPA 壳：

```html
<!DOCTYPE html><html lang="en"><head>...<title>智能微断</title>...</head>
<!-- 职位数据由 JS 异步加载，axios 无法执行 JS -->
```

智联招聘和 51job 都是完整 SPA，所有路由返回同一个 `index.html`，职位数据由客户端 JS 调用内部 API 填充。axios 无法渲染 SPA。

### 阶段 6：HTTPS 代理实测

代理池中出现 3 个标记为 `https: true` 的代理：

| 代理 | axios zhilian | axios 51job | 详情页 |
|------|:--:|:--:|:--:|
| `8.219.97.248:80` | 500 | 无限重定向 | ECONNRESET |
| `47.251.74.38:50` | 超时 | 超时 | - |
| `39.100.88.89:80` | 超时 | 超时 | - |

代理池的 `https: true` 标记不可靠，实际无一可用。

## 根因总结

```
免费 HTTP 代理 (port 80/8080)
    │
    ├── Chrome CONNECT 隧道 →  ERR_TUNNEL_CONNECTION_FAILED（协议层不兼容）
    │
    ├── axios CONNECT 隧道 →   200 OK（隧道可建立）
    │     │
    │     └── 详情页 GET →     SPA 空壳（5KB index.html，无职位数据）
    │
    └── axios 直接 API 调用 →   智联内部 API 端点隐藏在 JS bundle 中，无法发现
```

**三重瓶颈叠加**:
1. 免费代理不支持 Chrome 的 CONNECT 实现
2. 目标站点是 SPA，服务端不返回数据
3. 真正的职位 API 端点无法从 HTML 源码中发现

## 当前效果

| 路径 | 列表页 | 详情页 |
|------|:--:|:--:|
| 浏览器直连 | **可用**（211KB HTML，正常解析） | WAF "Security Verification" |
| axios+代理 | 不需要 | SPA 空壳 |
| generateBasicJob | - | **兜底**（title/company/salary/city） |

任务可从列表页提取基础字段（职位名、公司、薪资、城市），详情页富文本（职位描述、公司信息等）无法获取。

## 解决方案路线

| 方案 | 投入 | 预期效果 |
|------|------|----------|
| **接受现状** | 无 | 列表页基础数据，覆盖核心字段 |
| **付费代理 API**（快代理/Oxylabs/BrightData） | ¥¥/月 | 代理可走 Chrome CONNECT，浏览器正常渲染详情页 SPA |
| **逆向智联内部 API** | 高（需抓包分析 JS bundle） | axios+代理可直接调 API 取 JSON 数据 |
| **Selenium + undetected-chromedriver** | 中 | 可能绕过 WAF，但不解决代理问题 |

## 涉及文件

| 文件 | 变更 |
|------|------|
| `code/backend/src/services/crawler/proxyPool.ts` | 新增 — 代理池 HTTP 客户端 |
| `code/backend/src/services/crawler/zhilian.ts` | 修改 — 集成代理池 + axios fetchDetailViaProxy |
| `code/backend/src/services/crawler/job51.ts` | 修改 — 集成代理池 + axios fetchDetailViaProxy |
| `code/backend/src/config/constants.ts` | 修改 — 新增 PROXY_POOL_CONFIG |
| `start-dev.bat` / `start-dev.ps1` | 修改 — 集成代理池（Redis + proxy_pool）启动 |
| `start-proxy-pool.bat` | 新增 — 独立代理池启动脚本 |
