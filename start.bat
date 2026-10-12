
@echo off
title SmartResolve AI - Full Stack
cd /d G:\SmartResolve-AI

echo ======================================
echo       SmartResolve AI Launcher
echo ======================================

echo Starting Flask Backend...
start "SmartResolve Backend" cmd /k "cd /d G:\SmartResolve-AI\backend && py app.py"

timeout /t 3 /nobreak >nul

echo Starting React Frontend...
start "SmartResolve Frontend" cmd /k "cd /d G:\SmartResolve-AI\frontend && npm run dev"

echo.
echo Both servers are starting.
echo Backend: http://127.0.0.1:5000/api/health
echo Frontend: http://localhost:5173/
echo.
pause
