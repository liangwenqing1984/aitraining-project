# Puppeteer 爬虫优化指南

## ⚠️ 重要说明：Chrome 版本配置

**当前使用的版本组合：**
- Puppeteer: 24.41.0
- Chrome: 131.0.6778.204（稳定版）

**Chrome 安装位置：**
```
C:\Users\Administrator\.cache\puppeteer\chrome\win64-131.0.6778.204\chrome-win64\chrome.exe
```

**为什么使用 Chrome 131？**
Puppeteer 24.41.0 默认需要 Chrome 147.0.7727.56，但该版本在国内网络环境下下载困难且容易损坏。经过测试，Chrome 131 是稳定版本，完全可以满足爬虫需求。

**代码中的配置方式：**
所有爬虫文件（`zhilian.ts`、`job51.ts`）和测试脚本（`test-puppeteer.js`）都已配置为使用 Chrome 131：

```typescript
const chromePath = 'C:\\Users\\Administrator\\.cache\\puppeteer\\chrome\\win64-131.0.6778.204\\chrome-win64\\chrome.exe';
const browser = await puppeteer.launch({
  executablePath: chromePath,
  headless: true,
  args: [...]
});
```

---

## 🔍 爬取数据为 0 条的问题排查

### 问题现象
使用 Puppeteer 爬虫时，虽然页面能够成功加载，但提取到的职位数量为 0。

### 可能原因

1. **网站反爬机制**
   - 智联招聘等现代招聘网站有强大的反爬系统
   - 可能检测到自动化访问并返回简化页面
   - 可能需要登录才能查看完整职位列表

2. **动态内容加载**
   - 职位数据可能通过 AJAX 异步加载
   - 需要等待特定的网络请求完成
   - CSS 选择器可能与实际DOM结构不匹配

3. **页面结构变化**
   - 网站可能更新了前端框架或DOM结构
   - 原有的CSS选择器失效

### 已实施的改进措施

#### 1. 增强调试日志
在 `zhilian.ts` 中添加了详细的诊断信息：
- 页面标题检测
- 登录/验证码提示检测
- 页面内容长度检查
- 每个选择器的匹配结果

#### 2. 多策略数据提取
实现了三层提取策略：
- **策略1**: 标准职位卡片选择器（多种备选）
- **策略2**: 通用链接提取（查找所有职位相关链接）
- **策略3**: 父元素上下文分析（从周围文本提取企业和薪资信息）

#### 3. HTML 快照保存
每页爬取都会保存完整的 HTML 到 `debug/` 目录，便于后续分析。

### 调试工具

项目提供了以下调试脚本：

1. **test-puppeteer.js** - 基础功能测试
   ```bash
   node test-puppeteer.js
   ```

2. **analyze-html.js** - 分析HTML快照中的DOM结构
   ```bash
   node analyze-html.js
   ```

3. **debug-crawl.js** - 可视化调试（打开浏览器窗口）
   ```bash
   node debug-crawl.js
   ```

4. **test-api.js** - 捕获API请求
   ```bash
   node test-api.js
   ```

### 下一步建议

如果仍然无法获取数据，可以尝试：

1. **手动观察**
   - 运行 `node debug-crawl.js`
   - 在打开的浏览器中观察页面实际显示
   - 按 F12 打开开发者工具查看网络请求

2. **检查是否需要登录**
   - 某些招聘网站对未登录用户限制访问
   - 可能需要先登录再爬取

3. **考虑使用官方API**
   - 如果有条件，申请使用招聘平台的开放API
   - 比网页爬取更稳定可靠

4. **尝试其他招聘平台**
   - 前程无忧 (job51)
   - BOSS直聘
   - 拉勾网

### 技术要点

- ✅ 使用 `headless: false` 模式观察浏览器行为
- ✅ 监听 `page.on('response')` 捕获API请求
- ✅ 保存 HTML 快照用于离线分析
- ✅ 实现多选择器容错机制
- ✅ 增加等待时间确保动态内容加载

---

## 已完成的优化

### 1. 代码重构
- ✅ 已将智联招聘爬虫 (`zhilian.ts`) 从 axios + cheerio 迁移到 Puppeteer
- ✅ 已将前程无忧爬虫 (`job51.ts`) 从 axios + cheerio 迁移到 Puppeteer
- ✅ 添加了多选择器容错机制，提高爬取成功率
- ✅ 实现了 HTML 快照保存功能，便于调试和分析网站结构
- ✅ 保留了原有的多维度组合爬取（关键词 × 城市）
- ✅ 保留了实时日志推送功能（通过 WebSocket）

### 2. Puppeteer 优势
- **真实浏览器环境**：能够正确渲染 JavaScript 动态加载的内容
- **更好的反爬对抗**：模拟真实用户行为，降低被拦截的风险
- **更准确的数据提取**：直接操作 DOM，避免静态 HTML 解析的局限性
- **调试友好**：可以保存完整的 HTML 快照用于分析

### 3. Chrome 浏览器安装

#### 方法一：使用国内镜像源（推荐）
```powershell
cd d:\AICODEING\aitraining\code\backend
$env:PUPPETEER_DOWNLOAD_BASE_URL='https://registry.npmmirror.com/-/binary/chrome-for-testing'
npx puppeteer browsers install chrome@latest
```

#### 方法二：使用默认源
```powershell
cd d:\AICODEING\aitraining\code\backend
npx puppeteer browsers install chrome@latest
```

#### 方法三：手动下载（如果自动下载失败）
1. 访问 https://googlechromelabs.github.io/chrome-for-testing/
2. 下载对应版本的 Chrome
3. 将 Chrome 解压到 `C:\Users\Administrator\.cache\puppeteer\chrome\` 目录

### 4. 测试 Puppeteer 安装
```powershell
cd d:\AICODEING\aitraining\code\backend
node test-puppeteer.js
```

如果看到类似输出，说明安装成功：
```
开始测试 Puppeteer...
浏览器启动成功
正在访问智联招聘...
页面加载完成
找到职位列表元素
HTML快照已保存到: D:\AICODEING\aitraining\code\backend\debug\test_zhilian.html

找到 X 个职位:
1. Java开发工程师 - XX公司
2. ...

✅ Puppeteer 测试成功！
浏览器已关闭
```

## 使用方法

### 启动后端服务
```powershell
cd d:\AICODEING\aitraining\code\backend
npm run dev
```

### 创建爬虫任务
1. 访问前端页面：http://localhost:5173
2. 进入"爬虫管理" -> "创建任务"
3. 选择平台（智联招聘或前程无忧）
4. 填写关键词、城市等配置
5. 点击"开始爬取"

### 查看爬取结果
1. 在"任务监控"页面查看实时进度
2. 爬取完成后，在"文件管理"页面下载 CSV 文件

## 调试技巧

### 1. 查看 HTML 快照
所有爬取的页面 HTML 都会保存到 `code/backend/debug/` 目录：
- `zhilian_puppeteer_page_X.html` - 智联招聘页面快照
- `job51_puppeteer_page_X.html` - 前程无忧页面快照

可以用浏览器打开这些文件，检查 CSS 选择器是否正确。

### 2. 启用浏览器窗口（可视化调试）
修改爬虫代码中的 `headless` 选项：
```typescript
const browser = await puppeteer.launch({
  headless: false, // 改为 false 可以看到浏览器窗口
  // ... 其他配置
});
```

### 3. 调整等待时间
如果页面加载较慢，可以增加等待时间：
```typescript
await page.goto(url, { 
  waitUntil: 'networkidle2',
  timeout: 60000 // 增加到 60 秒
});

await this.randomDelay(3000, 5000); // 增加随机延迟
```

### 4. 更新 CSS 选择器
如果网站结构发生变化，需要更新选择器：
1. 打开 HTML 快照文件
2. 在浏览器开发者工具中检查元素
3. 找到正确的 CSS 选择器
4. 更新代码中的 `selectors` 数组

## 常见问题

### Q1: Chrome 下载很慢或失败
**解决方案**：使用国内镜像源（见上文"方法一"）

### Q2: 爬取不到数据
**排查步骤**：
1. 检查 `debug/` 目录下的 HTML 快照
2. 确认 CSS 选择器是否匹配
3. 查看后端控制台日志
4. 尝试启用浏览器窗口进行可视化调试

### Q3: 被网站封禁
**解决方案**：
1. 增加随机延迟时间
2. 减少并发请求
3. 使用代理 IP
4. 降低爬取频率

### Q4: TypeScript 编译错误
**说明**：代码中使用了 `// @ts-nocheck` 注释，因为 `page.evaluate()` 中的代码在浏览器环境中运行，TypeScript 无法识别 DOM API。这是正常的，不影响运行。

## 下一步优化建议

1. **添加代理支持**：实现 IP 轮换，避免被封禁
2. **优化选择器**：根据实际网站结构调整 CSS 选择器
3. **添加重试机制**：对失败的请求自动重试
4. **性能优化**：复用浏览器实例，减少启动开销
5. **数据验证**：添加更严格的数据清洗和验证逻辑

## 技术支持

如遇到问题，请检查：
1. 后端控制台日志
2. 前端浏览器控制台（F12）
3. `debug/` 目录下的 HTML 快照
4. Network 标签页的请求详情
