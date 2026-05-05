@echo off
chcp 65001 >nul
echo ========================================
echo   AI Training - Dev Environment Startup
echo ========================================
echo.

echo [1/6] Cleaning residual processes...
taskkill /f /im node.exe >nul 2>&1
:: Kill old proxy pool / Redis processes
taskkill /FI "WINDOWTITLE eq ProxyPool-Schedule" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq ProxyPool-API" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Redis-Server" /F >nul 2>&1
taskkill /F /IM redis-server.exe >nul 2>&1
:: Skip Chrome cleanup to preserve user browser sessions
timeout /t 2 /nobreak >nul
echo [OK] Processes cleaned
echo.

echo [2/6] Starting IP proxy pool (Redis + proxy_pool)...
set REDIS_DIR=C:\Program Files\Redis
set PROXY_POOL_DIR=D:\proxy_pool
set PYTHON=D:\Python\Python38\python.exe

:: Start Redis
if exist "%REDIS_DIR%\redis-server.exe" (
    findstr /C:"requirepass pwd" "%REDIS_DIR%\redis.windows.conf" >nul 2>&1
    if %errorlevel% neq 0 echo requirepass pwd >> "%REDIS_DIR%\redis.windows.conf"
    start "Redis-Server" /MIN "%REDIS_DIR%\redis-server.exe" "%REDIS_DIR%\redis.windows.conf"
    timeout /t 2 /nobreak >nul
    "%REDIS_DIR%\redis-cli.exe" -a pwd ping >nul 2>&1
    if %errorlevel% equ 0 (
        echo [OK] Redis started - port 6379
    ) else (
        echo [WARN] Redis may not have started correctly
    )
) else (
    echo [WARN] Redis not found, proxy pool unavailable
)

:: Start proxy_pool schedule + API
if exist "%PYTHON%" (
    if exist "%PROXY_POOL_DIR%" (
        start "ProxyPool-Schedule" /MIN cmd /c "cd /d %PROXY_POOL_DIR% && %PYTHON% proxyPool.py schedule"
        timeout /t 1 /nobreak >nul
        start "ProxyPool-API" /MIN cmd /c "cd /d %PROXY_POOL_DIR% && %PYTHON% proxyPool.py server"
        timeout /t 2 /nobreak >nul
        echo [OK] Proxy pool started - port 5010
    ) else (
        echo [WARN] Proxy pool project not found at %PROXY_POOL_DIR%
    )
) else (
    echo [WARN] Python 3.8 not found at %PYTHON%
)
echo.

echo [3/6] Cleaning backend build cache...
cd /d D:\AICODEING\aitraining\code\backend
if exist dist (
    echo   Removing old dist directory...
    rmdir /s /q dist 2>nul
)
if exist node_modules\.cache (
    echo   Cleaning TypeScript cache...
    rmdir /s /q node_modules\.cache 2>nul
)
if exist .tsx (
    echo   Cleaning tsx cache...
    rmdir /s /q .tsx 2>nul
)
del /q *.tsbuildinfo 2>nul
echo [OK] Cache cleaned
echo.

echo [4/6] Rebuilding backend code...
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

echo [5/6] Starting backend service (dev mode - tsx watch)...
start "Backend Server" cmd /k "cd /d D:\AICODEING\aitraining\code\backend & echo Backend starting... & npm run dev"
echo [OK] Backend service started
echo.

timeout /t 3 /nobreak >nul

echo [6/6] Starting frontend service...
cd /d D:\AICODEING\aitraining\code\frontend
start "Frontend Server" cmd /k "echo Frontend starting... & npm run dev"
echo [OK] Frontend service started
echo.

echo ========================================
echo   [SUCCESS] All services started!
echo ========================================
echo.
echo Service URLs:
echo   Proxy Pool: http://127.0.0.1:5010
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
