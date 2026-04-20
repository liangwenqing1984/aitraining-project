@echo off
echo 正在清理Node.js进程...

:: 方法1: 使用taskkill
taskkill /f /im node.exe /t >nul 2>&1
timeout /t 2 /nobreak >nul

:: 方法2: 使用wmic（如果taskkill失败）
wmic process where "name='node.exe'" call terminate >nul 2>&1
timeout /t 2 /nobreak >nul

:: 方法3: 使用PowerShell
powershell -ExecutionPolicy Bypass -File "D:\AICODEING\aitraining\kill-node.ps1"

echo 清理完成！
pause