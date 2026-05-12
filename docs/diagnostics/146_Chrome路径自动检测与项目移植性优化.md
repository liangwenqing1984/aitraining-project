# Chrome路径自动检测与项目移植性优化

## 概述

修复 Puppeteer 爬虫中 Chrome 可执行路径硬编码问题——旧路径 `win64-131.0.6778.204` 失效后爬虫无法启动。新增 `chromePath.ts` 配置模块实现 Chrome 路径四级自动检测，同时将 `userDataDir` 从用户目录迁移到项目 `.cache/` 目录，提升项目移植性。

## 一、问题

### 现象
任务 `f6ca3c37-445d-4a33-8c87-1a9b53298020` 执行时报错：
```
Browser was not found at the configured executablePath
(C:\Users\Administrator\.cache\puppeteer\chrome\win64-131.0.6778.204\chrome-win64\chrome.exe)
```

### 根因
1. `zhilian.ts` 和 `job51.ts` 中 Chrome 路径硬编码为特定版本号 `131.0.6778.204`
2. Puppeteer 更新到 `147.0.7727.56` 后旧版本目录被清理
3. 用户名 `Administrator` 硬编码导致其他机器无法使用

## 二、解决方案

### 新增 `config/chromePath.ts`

四级自动检测，按优先级依次查找：

| 优先级 | 来源 | 说明 |
|--------|------|------|
| 1 | `CHROME_PATH` 环境变量 | 用户显式指定，最高优先级 |
| 2 | 项目 `.chrome/` 目录 | 项目级便携部署，可将 Chrome 放入此目录 |
| 3 | Puppeteer 缓存 | 自动扫描 `~/.cache/puppeteer/chrome/win64-*`，取最新版本 |
| 4 | 系统默认路径 | Windows `Program Files` / Linux `/usr/bin` 兜底 |

同时导出 `getUserDataDir(name)` 函数，将爬虫临时数据目录统一放到项目 `.cache/puppeteer/tmp/` 下。

### 修改爬虫文件

`zhilian.ts:149-150` 和 `job51.ts:84-85`：
- `chromePath` → 改为引用 `CHROME_PATH`
- `userDataDir` → 改为调用 `getUserDataDir('zhilian')` / `getUserDataDir('job51')`

## 验收清单

- [x] TypeScript 编译通过
- [x] Chrome 路径自动检测 147.0.7727.56 版本
- [x] `userDataDir` 生成到项目 `.cache/` 目录
- [x] 支持 `CHROME_PATH` 环境变量覆盖
- [x] 支持项目 `.chrome/` 目录便携部署
