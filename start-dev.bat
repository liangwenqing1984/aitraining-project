@echo off
echo Cleaning up processes...
taskkill /f /im node.exe >nul 2>&1
timeout /t 2 /nobreak >nul

echo Starting backend...
cd /d D:\AICODEING\aitraining\code\backend
start "Backend Server" cmd /k npm run dev

timeout /t 3 /nobreak >nul

echo Starting frontend...
cd /d D:\AICODEING\aitraining\code\frontend
start "Frontend Server" cmd /k npm run dev

echo Servers started!
echo Backend: http://localhost:3004
echo Frontend: http://localhost:3000 (or 3002 if 3000 is taken)
pause