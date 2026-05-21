# Linux 跨平台部署适配

## 概述

移除项目中所有 Windows 硬编码依赖，使系统支持在 Linux（CentOS）环境下部署运行。涉及 Chrome 路径自动检测、Python 命令探测、启动脚本、JS 脚本等 17 个文件的修改。

## 一、Chrome 路径跨平台检测

### 需求/问题
原 `chromePath.ts` 仅支持 Windows：硬编码 `win64-` 目录前缀、`.exe` 后缀、`C:\Program Files` 系统路径。10 个 JS/TS 爬虫脚本各自硬编码 `C:\Users\Administrator\.cache\puppeteer\chrome\win64-131.0.6778.204\chrome-win64\chrome.exe`。

### 实现/修复

**`src/config/chromePath.ts`** — 核心检测逻辑重写：
- `.chrome/` 目录：Linux 侧不检查 `.exe` 后缀，改为检查文件可执行权限 `fs.accessSync(X_OK)`
- Puppeteer 缓存：根据平台切换 `linux-` / `win64-` 前缀、`chrome-linux64` / `chrome-win64` 目录、`chrome` / `chrome.exe` 名称
- 系统路径：Linux 侧增加 6 个路径覆盖 deb/rpm/snap 安装 (`/usr/bin/google-chrome-stable`, `/snap/bin/chromium`, `/opt/google/chrome/chrome`)
- 跨平台回退：缓存目录为空时遍历所有子目录做模式匹配

**新建 `chrome-path.js`** — JS 脚本共享检测模块，逻辑与 TS 版本一致。

**`src/controllers/dashboardController.ts:259`** — 硬编码路径 `C:\Users\Administrator\...\chrome.exe` 替换为 `CHROME_PATH` 导入。

**4 个 sniff TS 脚本 + 7 个 JS 爬虫脚本** — 全部改为使用自动检测。

## 二、Python 命令探测

### 需求/问题
原代码 `process.platform === 'win32' ? 'python' : 'python3'`，CentOS 7 上 `python3` 可能不存在（仅 `python`）。

### 实现/修复

**`src/controllers/trainingController.ts`** — 新增 `getPythonCmd()` 函数，Linux 下依次探测 `python3` → `python`，使用 `spawnSync` 验证可用性后缓存结果。

## 三、Linux 启动脚本

### 需求/问题
原 `start-dev.bat` / `start-dev.ps1` / `kill-node.bat` / `kill-node.ps1` 依赖 `taskkill`、`start`、`cmd /c`、`wmic` 等 Windows 专属命令，在 Linux 上完全无法运行。

### 实现/修复

**新建 `start-dev.sh`** — Linux 一键启动脚本：
- `pkill` 替代 `taskkill` 清理旧进程
- `nohup ... &` 替代 `start "Title" cmd /c`
- `command -v` 检测 redis-server、Python 可用性
- `xdg-open` 替代 `start ""` 打开浏览器
- 彩色输出标记 OK/WARN/ERROR 状态

**新建 `kill-node.sh`** — Linux 停止服务脚本：
- `pkill -f "tsx watch"` / `pkill -f "vite"` 停止前后端

## 四、文档更新

### 需求/问题
`Docs.vue` 帮助页面仅包含 Windows 版 Redis 启动命令。

### 实现/修复
补充 Linux 版 Redis 启动方式（systemctl / redis-server daemon）和配置文件路径说明。

## 五、数据库迁移脚本

### 需求/问题
需要将源库 `10.1.1.113:7300` 的表和数据完整迁移到目标库 `192.168.137.20:5432`。

### 实现/修复

**新建 `scripts/migrateDatabase.ts`** — 完整迁移脚本：
- 按外键依赖拓扑排序建表
- 自动处理 SERIAL 序列、自定义类型（vector → TEXT 降级）
- 批量插入数据（50 行/批）+ ON CONFLICT DO NOTHING 幂等
- 外部键约束延迟添加、序列值自动对齐
- 迁移前自动检测 pgvector 扩展可用性

**新建 `scripts/verifyMigration.ts`** — 逐表对比行数验证脚本。

## 验收清单

- [x] `chromePath.ts` 支持 Linux 平台自动检测 Chrome/Chromium
- [x] `chrome-path.js` 提供 CommonJS 兼容的检测模块
- [x] `dashboardController.ts` PDF 生成使用共享 Chrome 路径
- [x] `trainingController.ts` Python 命令自动探测
- [x] 4 个 sniff TS 脚本移除硬编码 Chrome 路径
- [x] 7 个 JS 爬虫脚本移除硬编码 Chrome 路径
- [x] `start-dev.sh` / `kill-node.sh` 可执行
- [x] `Docs.vue` 帮助文档含 Linux 命令
- [x] `migrateDatabase.ts` 可完成完整的表结构和数据迁移
- [x] 源库 23 张表 6,370 行数据完整迁移到目标库
