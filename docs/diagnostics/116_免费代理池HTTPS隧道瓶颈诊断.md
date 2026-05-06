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

## 阶段 7：智联内部 API 逆向成功（2026-05-06）

### 方法

1. 通过 Puppeteer 网络拦截抓包捕获智联 SPA 的 XHR 请求
2. 发现 API 域名为 `fe-api.zhaopin.com`，路径 `/c/i/jobs/position-detail-new`
3. 参数名为 `number`（即 URL 中的 `CCL...` 编号）

### API 端点

```
GET https://fe-api.zhaopin.com/c/i/jobs/position-detail-new?number=CCL1393716650J40938718704
```

无需鉴权，直接返回完整 JSON：

```json
{
  "code": 200,
  "data": {
    "detailedCompany": {
      "companyName": "...",
      "companySize": "1000-9999人",
      "industryNameLevel": "...",
      "companyDescription": "...",
      "financingStageName": "未融资",
      "companyNumber": "CZL...",
      "companyUrl": "..."
    },
    "detailedPosition": {
      "number": "CCL...",
      "name": "职位名",
      "salary60": "8000-12000元",
      "workCity": "哈尔滨",
      "cityDistrict": "道里区",
      "education": "大专",
      "workingExp": "不限",
      "emplType": "全职",
      "recruitNumber": 2,
      "jobDesc": "HTML格式职位描述",
      "jobDescPC": "PC版HTML职位描述",
      "workAddress": "...",
      "positionPublishTime": "2026-05-06 01:10:39",
      "skillLabel": [{"state": 0, "value": "演员"}],
      "welfareLabel": [],
      "jobTypeLevelName": "...",
      "latitude": "45.72...",
      "longitude": "126.51..."
    }
  }
}
```

### zhilian.ts 变更

- `fetchDetailViaProxy()` 重写为调用 JSON API，不再使用 cheerio 解析 HTML
- 新增 `extractPositionNumber()` 从 URL 提取 `number` 参数
- `buildJobDataFromDetail()` 增强，支持 `YYYY-MM-DD HH:mm:ss` 格式的发布日期
- `jobDescription`、`jobDetailUrl`、`companyDetailUrl` 等字段现在有值
- 移除 `cheerio` 依赖导入

### 效果

| 路径 | 列表页 | 详情页 |
|------|:--:|:--:|
| 浏览器直连 | 可用 | WAF "Security Verification" |
| **axios+代理 → JSON API** | - | **可用（完整 JSON 数据）** |
| generateBasicJob | - | 兜底 |

zhilian 详情页数据获取问题**已解决**。

### 51job API 探索

51job 详情 API 探索未完全成功：
- `cupid.51job.com` API 网关有时间戳鉴权（`api_key=51job&timestamp=...`），过期时间很短
- 详情页有 Geetest 验证码保护（`api.geetest.com`）
- `jobs.51job.com/{city}/{jobId}.html` 是服务端渲染页面（非 SPA），axios+代理+cheerio 方案理论上可解析
- 51job 暂时保持 cheerio HTML 解析方案

### 阶段 8：51job 详情页深入诊断与改造（2026-05-06）

#### 8.1 SPA 详情 API 抓包（sniff_51job_detail_v2.ts）

通过 Puppeteer 访问 `we.51job.com/pc/detail?jobId=XXX`（SPA 详情页），拦截 XHR 请求：

**结果**: SPA 详情页仅触发 Geetest CAPTCHA 初始化 API（`vapi.51job.com/open.php?module=initgeetest`），**未捕获到任何职位数据 API**。说明 51job SPA 的职位数据加载被 Geetest 验证码门控。

#### 8.2 旧版页面测试（jobs.51job.com）

访问 `jobs.51job.com/beijing/155549199.html`：
- **axios 直连**: 返回 26KB **JS 混淆保护页面**（`function M(){var GH=['XK392UY'...`），cheerio 无法提取任何内容
- **Puppeteer 浏览器**: 返回 98KB 渲染后 HTML（浏览器执行 JS 解密后得到真实 DOM）

#### 8.3 搜索 API 字段分析（pc-job-mini-detail）

通过抓包数据确认搜索 API 实际返回字段：
- **有**: `jobName`, `companyName`, `fullCompanyName`, `provideSalaryString`, `jobAreaString`, `hrefAreaPinYin`, `degreeString`, `workYearString`, `companySizeString`, `companyTypeString`, `industryType1Str`, `industryType2Str`, `jobDescribe`（完整 HTML 格式职位描述）, `jobTagsList`, `termStr`, `issueDateString`, `lon`, `lat`, `landmarkString`
- **无**: `workAddress`（工作地址）、`registeredAddress`（注册地址）、`companyAddress`（公司地址）

**结论**: 51job 搜索 API 不提供地址字段，这些字段仅在详情页（受 Geetest CAPTCHA 保护）中存在。

#### 8.4 job51.ts 改造方案

**问题**: 当前 `fetchDetailViaProxy()` 用 axios 获取 `we.51job.com/pc/detail?jobId=XXX`（SPA 壳），cheerio 提取不到数据但也不报错，导致浏览器回退路径永远不触发。

**改造**:

1. **详情 URL 改用旧版格式**：
   ```
   jobs.51job.com/{hrefAreaPinYin}/{jobId}.html
   ```
   旧版页面是服务端渲染（含 JS 混淆），Puppeteer 浏览器执行 JS 后可获得 98KB 真实 DOM。

2. **`fetchDetailViaProxy()` 增加混淆检测**：
   - 检测 JS 混淆页面特征（`function M(){`, `var GH=`）
   - cheerio 解析结果校验：`jobDescription` 不足 30 字则抛出异常
   - 异常触发浏览器回退路径

3. **浏览器回退路径增强**：
   - `page.goto()` 超时从 30s 延长到 45s（JS 解密需要时间）
   - 额外等待 2s 确保 DOM 渲染完成
   - `page.evaluate()` 中已有完整的旧版页面选择器（`.cn h1`, `.bmsg`, `.tCompany_sidebar` 等）

4. **搜索 API 字段映射增强**：
   - 新增 `fullCompanyName`、`hrefAreaPinYin`、`landmarkString`、`publishDate`、`lon`、`lat`、`jobTagsList` 字段
   - `address` 回退链增加 `landmarkString`
   - `updateDate` 增加 `publishDate` 回退

5. **搜索页浏览器直连**：
   - 移除启动时的代理验证循环（免费代理对搜索页全触发 Aliyun WAF）
   - 代理仅用于 axios 详情页回退

**数据流**:
```
搜索 API (JSON)
  → 提取基础字段 + hrefAreaPinYin
  → 构建 jobs.51job.com/{city}/{jobId}.html URL
  → fetchDetailViaProxy() axios 尝试 → 检测到 JS 混淆 → 抛异常
  → fetchJobDetail() 浏览器回退 → page.goto(旧版URL) → JS 解密渲染
  → page.evaluate() 提取完整数据 → buildJobData() 合并
```

---

## 涉及文件

| 文件 | 变更 |
|------|------|
| `code/backend/src/services/crawler/proxyPool.ts` | 新增 — 代理池 HTTP 客户端 |
| `code/backend/src/services/crawler/zhilian.ts` | 修改 — 集成代理池 + **API JSON 解析**（替代 cheerio） |
| `code/backend/src/services/crawler/job51.ts` | 修改 — 集成代理池 + 旧版 URL 格式 + 浏览器回退提取详情 |
| `code/backend/src/config/constants.ts` | 修改 — 新增 PROXY_POOL_CONFIG |
| `code/backend/src/scripts/sniff_zhilian_api.ts` | 新增 — 智联 API 抓包诊断脚本 |
| `code/backend/src/scripts/sniff_51job_api.ts` | 新增 — 51job API 抓包诊断脚本 |
| `code/backend/src/scripts/sniff_51job_detail.ts` | 新增 — 51job SPA 详情页 API 抓包脚本 |
| `code/backend/src/scripts/sniff_51job_detail_v2.ts` | 新增 — 51job 详情页 v2 诊断脚本（搜索→SPA导航→旧版页面） |
| `start-dev.bat` / `start-dev.ps1` | 修改 — 集成代理池（Redis + proxy_pool）启动 |
| `start-proxy-pool.bat` | 新增 — 独立代理池启动脚本 |
