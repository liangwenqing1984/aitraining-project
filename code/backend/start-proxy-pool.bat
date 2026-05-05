@echo off
chcp 65001 >nul
echo ============================================
echo    IP 代理池启动脚本 (jhao104/proxy_pool)
echo ============================================
echo.

REM 检查 Python 环境
where python >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未找到 Python，请先安装 Python 3.6+
    pause
    exit /b 1
)

REM 代理池项目路径（如已克隆则使用，否则提示）
set PROXY_POOL_DIR=D:\proxy_pool

if not exist "%PROXY_POOL_DIR%" (
    echo [提示] 代理池项目未找到，正在克隆...
    git clone https://github.com/jhao104/proxy_pool.git "%PROXY_POOL_DIR%"
    if %errorlevel% neq 0 (
        echo [错误] 克隆失败，请手动下载: https://github.com/jhao104/proxy_pool
        pause
        exit /b 1
    )
)

cd /d "%PROXY_POOL_DIR%"

REM 安装依赖
echo [1/3] 安装 Python 依赖...
pip install -r requirements.txt -q
if %errorlevel% neq 0 (
    echo [警告] 依赖安装可能不完整，尝试继续...
)

echo.
echo [2/3] 启动代理采集调度器 (schedule)...
start "ProxyPool-Schedule" cmd /c "python proxyPool.py schedule"

REM 等待调度器启动
timeout /t 3 /nobreak >nul

echo [3/3] 启动代理池 Web API 服务 (端口 5010)...
start "ProxyPool-API" cmd /c "python proxyPool.py server"

timeout /t 2 /nobreak >nul

echo.
echo ============================================
echo    代理池已启动！
echo    API 地址: http://127.0.0.1:5010
echo    获取代理: http://127.0.0.1:5010/get/
echo    查看数量: http://127.0.0.1:5010/count
echo ============================================
echo.
echo 按任意键退出（代理池将在后台运行）...
pause >nul
