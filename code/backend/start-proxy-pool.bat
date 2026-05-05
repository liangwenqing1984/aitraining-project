@echo off
chcp 65001 >nul
echo ============================================
echo    IP 代理池启动脚本 (jhao104/proxy_pool)
echo ============================================
echo.

REM ======================================
REM 第 0 步：查杀旧进程
REM ======================================
echo [0/4] 清理旧进程...

REM 杀掉旧的代理池进程（按窗口标题）
taskkill /FI "WINDOWTITLE eq ProxyPool-Schedule" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq ProxyPool-API" /F >nul 2>&1

REM 杀掉旧的 Redis 进程
taskkill /FI "IMAGENAME eq redis-server.exe" /F >nul 2>&1

REM 等待进程退出
timeout /t 2 /nobreak >nul

REM 确认端口释放
netstat -ano | findstr ":5010" >nul 2>&1
if %errorlevel% equ 0 (
    echo [警告] 端口 5010 仍被占用，强制释放...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5010.*LISTENING"') do (
        taskkill /F /PID %%a >nul 2>&1
    )
    timeout /t 1 /nobreak >nul
)

netstat -ano | findstr ":6379" >nul 2>&1
if %errorlevel% equ 0 (
    echo [警告] 端口 6379 仍被占用，强制释放...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":6379.*LISTENING"') do (
        taskkill /F /PID %%a >nul 2>&1
    )
    timeout /t 1 /nobreak >nul
)

echo       旧进程已清理
echo.

REM ======================================
REM 第 1 步：启动 Redis
REM ======================================
echo [1/4] 启动 Redis 服务...

set REDIS_DIR=C:\Program Files\Redis
set REDIS_CONF=%REDIS_DIR%\redis.windows.conf

if not exist "%REDIS_DIR%\redis-server.exe" (
    echo [错误] 未找到 Redis，请先安装: winget install Redis.Redis
    pause
    exit /b 1
)

REM 确保 Redis 配置文件包含密码
findstr /C:"requirepass pwd" "%REDIS_CONF%" >nul 2>&1
if %errorlevel% neq 0 (
    echo [提示] Redis 配置文件缺少密码，正在添加...
    echo requirepass pwd >> "%REDIS_CONF%"
)

start "Redis-Server" /MIN "%REDIS_DIR%\redis-server.exe" "%REDIS_CONF%"

REM 等待 Redis 启动
timeout /t 3 /nobreak >nul

REM 验证 Redis 是否启动成功
"%REDIS_DIR%\redis-cli.exe" -a pwd ping >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] Redis 启动失败
    pause
    exit /b 1
)
echo       Redis 启动成功 (端口 6379)
echo.

REM ======================================
REM 第 2 步：检查代理池项目 & 安装依赖
REM ======================================
echo [2/4] 检查代理池项目...

set PROXY_POOL_DIR=D:\proxy_pool
set PYTHON=D:\Python\Python38\python.exe

if not exist "%PYTHON%" (
    echo [错误] 未找到 Python 3.8: %PYTHON%
    pause
    exit /b 1
)

if not exist "%PROXY_POOL_DIR%" (
    echo [提示] 代理池项目未找到，正在克隆...
    git clone https://github.com/jhao104/proxy_pool.git "%PROXY_POOL_DIR%"
    if %errorlevel% neq 0 (
        echo [错误] 克隆失败
        pause
        exit /b 1
    )
)

cd /d "%PROXY_POOL_DIR%"

REM 安装依赖
echo       安装 Python 依赖...
%PYTHON% -m pip install -r requirements.txt -q 2>&1
if %errorlevel% neq 0 (
    echo [警告] 依赖安装可能不完整，尝试继续...
)

echo       代理池项目就绪
echo.

REM ======================================
REM 第 3 步：启动代理池调度器
REM ======================================
echo [3/4] 启动代理采集调度器...

start "ProxyPool-Schedule" /MIN cmd /c "%PYTHON% proxyPool.py schedule"

timeout /t 3 /nobreak >nul
echo       调度器已启动
echo.

REM ======================================
REM 第 4 步：启动代理池 API 服务
REM ======================================
echo [4/4] 启动代理池 API 服务 (端口 5010)...

start "ProxyPool-API" /MIN cmd /c "%PYTHON% proxyPool.py server"

timeout /t 3 /nobreak >nul

REM 验证 API 是否启动成功
curl -s http://127.0.0.1:5010/count/ >nul 2>&1
if %errorlevel% neq 0 (
    echo [警告] API 服务可能未就绪，请稍后验证 http://127.0.0.1:5010/count/
) else (
    echo       API 服务启动成功
)

echo.
echo ============================================
echo    代理池已启动！
echo    API 地址: http://127.0.0.1:5010
echo    获取代理: http://127.0.0.1:5010/get/
echo    查看数量: http://127.0.0.1:5010/count/
echo ============================================
echo.
echo 按任意键退出（代理池将在后台运行）...
pause >nul
