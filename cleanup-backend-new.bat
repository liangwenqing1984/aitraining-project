@echo off
echo Cleaning up backend_new...

:: 等待一下确保文件释放
timeout /t 3 /nobreak >nul

:: 尝试删除
echo Deleting backend_new directory...
rmdir /s /q "D:\AICODEING\aitraining\code\backend_new"

if %errorlevel% equ 0 (
    echo Successfully deleted backend_new
) else (
    echo Failed to delete backend_new, trying alternative method...
    :: 使用PowerShell作为备用
    powershell "Remove-Item -Path 'D:\AICODEING\aitraining\code\backend_new' -Recurse -Force -ErrorAction SilentlyContinue"
    if %errorlevel% equ 0 (
        echo Successfully deleted backend_new using PowerShell
    ) else (
        echo Could not delete backend_new. It might be in use by another process.
        echo Please close any programs using this directory and try again.
    )
)

pause