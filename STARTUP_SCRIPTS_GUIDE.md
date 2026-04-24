# 项目启动脚本使用说明

## 可用的启动脚本

本项目提供了三种启动脚本,适用于不同的使用场景:

### 1. start-dev.ps1 (推荐 - PowerShell 版本)

**特点:**
- ✅ 原生 PowerShell 语法,无兼容性问题
- ✅ 彩色输出,清晰的视觉反馈
- ✅ 支持中文显示
- ✅ 更好的错误处理

**使用方法:**
```powershell
.\start-dev.ps1
```

**首次运行可能需要设置执行策略:**
```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

---

### 2. start-dev-en.ps1 (英文版 PowerShell)

**特点:**
- ✅ 全英文界面,避免任何编码问题
- ✅ 适合国际化团队或服务器环境

**使用方法:**
```powershell
.\start-dev-en.ps1
```

---

### 3. start-dev.bat (传统批处理版本)

**特点:**
- ✅ 兼容所有 Windows 版本
- ✅ 可通过双击直接运行
- ⚠️ 必须通过 `cmd.exe` 执行,不能在 PowerShell 中直接运行

**使用方法:**

**方式1 - 在 PowerShell 中调用:**
```powershell
cmd /c .\start-dev.bat
```

**方式2 - 在 CMD 中运行:**
```cmd
start-dev.bat
```

**方式3 - 双击运行:**
直接在文件资源管理器中双击 `start-dev.bat`

---

## 脚本功能说明

所有启动脚本都会执行以下步骤:

1. **[1/5] 清理残留进程** - 终止所有 node、chrome、chromium 进程
2. **[2/5] 清理后端编译缓存** - 删除 dist 目录和 TypeScript 缓存
3. **[3/5] 重新编译后端代码** - 执行 `npm run build`
4. **[4/5] 启动后端服务** - 以 tsx watch 模式启动后端(端口 3004)
5. **[5/5] 启动前端服务** - 启动 Vite 开发服务器(端口 3000)

---

## 常见问题

### Q1: PowerShell 脚本执行被禁止?

**解决方案:**
```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

### Q2: 批处理文件显示乱码?

**原因:** PowerShell 尝试直接解析 `.bat` 文件而非通过 cmd.exe

**解决方案:** 使用 `cmd /c .\start-dev.bat` 或在 CMD 中运行

### Q3: 端口被占用?

**解决方案:** 脚本会自动清理旧进程。如果仍有问题,手动执行:
```powershell
Get-Process -Name "node" | Stop-Process -Force
```

### Q4: 编译失败?

**检查:**
- Node.js 是否正确安装
- 依赖是否已安装 (`npm install`)
- 查看错误信息修复代码问题

---

## 技术细节

### 编码说明

- **start-dev.ps1**: UTF-8 with BOM (UTF-8-SIG)
- **start-dev-en.ps1**: UTF-8 without BOM
- **start-dev.bat**: GBK/ANSI (Windows 批处理标准)

### 为什么需要不同的编码?

- **PowerShell + 中文**: 必须使用 UTF-8 with BOM,否则解析器无法正确处理中文字符
- **Batch + 中文**: 必须使用 GBK 编码,这是 Windows CMD 的标准编码
- **纯英文脚本**: 可以使用 UTF-8 without BOM,兼容性最好

---

## 推荐工作流

**日常开发:**
```powershell
.\start-dev.ps1
```

**CI/CD 或服务器环境:**
```powershell
.\start-dev-en.ps1
```

**快速测试(双击即可):**
```
start-dev.bat
```

---

*最后更新: 2026-04-24*
