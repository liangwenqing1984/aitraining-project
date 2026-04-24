# AI Training - Development Environment Startup Script

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  AI Training - Dev Startup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Clean processes
Write-Host "[1/5] Cleaning processes..." -ForegroundColor Yellow
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process -Name "chrome" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process -Name "chromium" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Write-Host "[OK] Processes cleaned" -ForegroundColor Green
Write-Host ""

# Step 2: Clean cache
Write-Host "[2/5] Cleaning backend cache..." -ForegroundColor Yellow
Set-Location "D:\AICODEING\aitraining\code\backend"
if (Test-Path "dist") {
    Write-Host "  Removing old dist..." -ForegroundColor Gray
    Remove-Item -Recurse -Force "dist" -ErrorAction SilentlyContinue
}
if (Test-Path "node_modules\.cache") {
    Write-Host "  Cleaning TypeScript cache..." -ForegroundColor Gray
    Remove-Item -Recurse -Force "node_modules\.cache" -ErrorAction SilentlyContinue
}
Write-Host "[OK] Cache cleaned" -ForegroundColor Green
Write-Host ""

# Step 3: Build backend
Write-Host "[3/5] Building backend..." -ForegroundColor Yellow
Write-Host "  Running npm run build..." -ForegroundColor Gray
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "[ERROR] Build failed!" -ForegroundColor Red
    Read-Host "Press Enter to continue"
    exit 1
}
Write-Host "[OK] Build successful" -ForegroundColor Green
Write-Host ""

# Step 4: Start backend
Write-Host "[4/5] Starting backend service..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'D:\AICODEING\aitraining\code\backend'; Write-Host 'Backend starting...' -ForegroundColor Cyan; npm run dev" -WindowStyle Normal
Write-Host "[OK] Backend started" -ForegroundColor Green
Write-Host ""

Start-Sleep -Seconds 3

# Step 5: Start frontend
Write-Host "[5/5] Starting frontend service..." -ForegroundColor Yellow
Set-Location "D:\AICODEING\aitraining\code\frontend"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host 'Frontend starting...' -ForegroundColor Cyan; npm run dev" -WindowStyle Normal
Write-Host "[OK] Frontend started" -ForegroundColor Green
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  [SUCCESS] All services started!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Service URLs:" -ForegroundColor White
Write-Host "  Backend API: http://localhost:3004" -ForegroundColor White
Write-Host "  Frontend UI: http://localhost:3000" -ForegroundColor White
Write-Host ""
Read-Host "Press Enter to exit"
