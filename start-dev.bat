@echo off
chcp 65001 >nul
echo ========================================
echo   AI Training - Dev Environment Startup
echo ========================================
echo.

echo [1/5] Cleaning residual processes...
taskkill /f /im node.exe >nul 2>&1
taskkill /f /im chrome.exe >nul 2>&1
taskkill /f /im chromium.exe >nul 2>&1
timeout /t 2 /nobreak >nul
echo [OK] Processes cleaned
echo.

echo [2/5] Cleaning backend build cache...
cd /d D:\AICODEING\aitraining\code\backend
if exist dist (
    echo   Removing old dist directory...
    rmdir /s /q dist 2>nul
)
if exist node_modules\.cache (
    echo   Cleaning TypeScript cache...
    rmdir /s /q node_modules\.cache 2>nul
)
echo [OK] Cache cleaned
echo.

echo [3/5] Rebuilding backend code...
echo   Running npm run build...
call npm run build
if errorlevel 1 (
    echo.
    echo [ERROR] Backend build failed! Please check for errors
    pause
    exit /b 1
)
echo [OK] Backend build successful
echo.

echo [4/5] Starting backend service (dev mode - tsx watch)...
start "Backend Server" cmd /k "cd /d D:\AICODEING\aitraining\code\backend & echo Backend starting... & npm run dev"
echo [OK] Backend service started
echo.

timeout /t 3 /nobreak >nul

echo [5/5] Starting frontend service...
cd /d D:\AICODEING\aitraining\code\frontend
start "Frontend Server" cmd /k "echo Frontend starting... & npm run dev"
echo [OK] Frontend service started
echo.

echo ========================================
echo   [SUCCESS] All services started!
echo ========================================
echo.
echo Service URLs:
echo   Backend API: http://localhost:3004
echo   Frontend UI: http://localhost:3000 (or 3002)
echo.
echo Tips:
echo   - Backend uses tsx watch mode, auto-recompiles on code changes
echo   - To force recompile, close this window and rerun the script
echo   - Check "Backend Server" window for backend logs
echo.

timeout /t 5 /nobreak >nul

echo Opening browser...
start "" "http://localhost:3000"
echo [OK] Browser opened to http://localhost:3000
echo.

pause
