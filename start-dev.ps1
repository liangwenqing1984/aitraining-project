# AI Training - Dev Environment Startup Script (PowerShell)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  AI Training - Dev Environment Startup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/5] Cleaning residual processes..." -ForegroundColor Yellow
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process -Name "chrome" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process -Name "chromium" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Write-Host "[OK] Processes cleaned" -ForegroundColor Green
Write-Host ""

Write-Host "[2/5] Cleaning backend build cache..." -ForegroundColor Yellow
Set-Location "D:\AICODEING\aitraining\code\backend"
if (Test-Path "dist") {
    Write-Host "  Removing old dist directory..." -ForegroundColor Gray
    Remove-Item -Recurse -Force "dist" -ErrorAction SilentlyContinue
}
if (Test-Path "node_modules\.cache") {
    Write-Host "  Cleaning TypeScript cache..." -ForegroundColor Gray
    Remove-Item -Recurse -Force "node_modules\.cache" -ErrorAction SilentlyContinue
}
if (Test-Path ".tsx") {
    Write-Host "  Cleaning tsx cache..." -ForegroundColor Gray
    Remove-Item -Recurse -Force ".tsx" -ErrorAction SilentlyContinue
}
Remove-Item "*.tsbuildinfo" -ErrorAction SilentlyContinue
Write-Host "[OK] Cache cleaned" -ForegroundColor Green
Write-Host ""

Write-Host "[3/5] Rebuilding backend code..." -ForegroundColor Yellow
Write-Host "  Running npm run build..." -ForegroundColor Gray
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "[ERROR] Backend build failed! Please check for errors" -ForegroundColor Red
    Read-Host "Press Enter to continue"
    exit 1
}
Write-Host "[OK] Backend build successful" -ForegroundColor Green
Write-Host ""

Write-Host "[4/5] Starting backend service (dev mode - tsx watch)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'D:\AICODEING\aitraining\code\backend'; Write-Host 'Backend starting...' -ForegroundColor Cyan; npm run dev" -WindowStyle Normal
Write-Host "[OK] Backend service started" -ForegroundColor Green
Write-Host ""

Start-Sleep -Seconds 3

Write-Host "[5/5] Starting frontend service..." -ForegroundColor Yellow
Set-Location "D:\AICODEING\aitraining\code\frontend"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host 'Frontend starting...' -ForegroundColor Cyan; npm run dev" -WindowStyle Normal
Write-Host "[OK] Frontend service started" -ForegroundColor Green
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  [SUCCESS] All services started!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Service URLs:" -ForegroundColor White
Write-Host "  Backend API: http://localhost:3004" -ForegroundColor White
Write-Host "  Frontend UI: http://localhost:3000 (or 3002)" -ForegroundColor White
Write-Host ""
Write-Host "Tips:" -ForegroundColor White
Write-Host "  - Backend uses tsx watch mode, auto-recompiles on code changes" -ForegroundColor Gray
Write-Host "  - To force recompile, close this window and rerun the script" -ForegroundColor Gray
Write-Host "  - Check new PowerShell windows for logs" -ForegroundColor Gray
Write-Host ""

Start-Sleep -Seconds 5

Write-Host "Opening browser..." -ForegroundColor Yellow
Start-Process "http://localhost:3000"
Write-Host "[OK] Browser opened to http://localhost:3000" -ForegroundColor Green
Write-Host ""

Read-Host "Press Enter to exit"
