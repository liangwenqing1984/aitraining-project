@echo off
echo Stopping all Node.js processes...
taskkill /f /im node.exe >nul 2>&1
echo All processes terminated.
pause