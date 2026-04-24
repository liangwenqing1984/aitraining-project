# AI Training - 开发环境启动脚本 (PowerShell版本)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  AI Training - 开发环境启动脚本" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/5] 清理残留进程..." -ForegroundColor Yellow
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process -Name "chrome" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process -Name "chromium" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Write-Host "[OK] 进程清理完成" -ForegroundColor Green
Write-Host ""

Write-Host "[2/5] 清理后端编译缓存..." -ForegroundColor Yellow
Set-Location "D:\\AICODEING\\aitraining\\code\\backend"
if (Test-Path "dist") {
    Write-Host "  删除旧的dist目录..." -ForegroundColor Gray
    Remove-Item -Recurse -Force "dist" -ErrorAction SilentlyContinue
}
if (Test-Path "node_modules\\.cache") {
    Write-Host "  清理TypeScript缓存..." -ForegroundColor Gray
    Remove-Item -Recurse -Force "node_modules\\.cache" -ErrorAction SilentlyContinue
}
Write-Host "[OK] 编译缓存清理完成" -ForegroundColor Green
Write-Host ""

Write-Host "[3/5] 重新编译后端代码..." -ForegroundColor Yellow
Write-Host "  执行 npm run build..." -ForegroundColor Gray
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "[ERROR] 后端编译失败！请检查代码错误" -ForegroundColor Red
    Read-Host "按回车键继续"
    exit 1
}
Write-Host "[OK] 后端编译成功" -ForegroundColor Green
Write-Host ""

Write-Host "[4/5] 启动后端服务（开发模式 - tsx watch）..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'D:\\AICODEING\\aitraining\\code\\backend'; Write-Host '后端服务启动中...' -ForegroundColor Cyan; npm run dev" -WindowStyle Normal
Write-Host "[OK] 后端服务已启动" -ForegroundColor Green
Write-Host ""

Start-Sleep -Seconds 3

Write-Host "[5/5] 启动前端服务..." -ForegroundColor Yellow
Set-Location "D:\\AICODEING\\aitraining\\code\\frontend"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host '前端服务启动中...' -ForegroundColor Cyan; npm run dev" -WindowStyle Normal
Write-Host "[OK] 前端服务已启动" -ForegroundColor Green
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  [SUCCESS] 所有服务启动成功！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "服务地址：" -ForegroundColor White
Write-Host "  后端API: http://localhost:3004" -ForegroundColor White
Write-Host "  前端界面: http://localhost:3000 (或 3002)" -ForegroundColor White
Write-Host ""
Write-Host "提示：" -ForegroundColor White
Write-Host "  - 后端使用 tsx watch 模式，代码修改后自动重新编译" -ForegroundColor Gray
Write-Host "  - 如需强制重新编译，请关闭此窗口并重新运行本脚本" -ForegroundColor Gray
Write-Host "  - 查看后端日志请关注新打开的PowerShell窗口" -ForegroundColor Gray
Write-Host ""
Read-Host "按回车键退出"
