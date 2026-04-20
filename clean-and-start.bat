@echo off
echo Cleaning up Node processes...
taskkill /f /im node.exe >nul 2>&1
timeout /t 3 /nobreak >nul

echo Starting backend...
cd /d D:\AICODEING\aitraining\code\backend
start "Backend" cmd /k npm run dev

timeout /t 4 /nobreak >nul

echo Starting frontend...
cd /d D:\AICODEING\aitraining\code\frontend
start "Frontend" cmd /k npm run dev

echo.
echo Servers started!
echo Backend: http://localhost:3004
echo Frontend: http://localhost:3000 or 3002
echo.
echo Expected processes: 2 (1 backend + 1 frontend)
pause