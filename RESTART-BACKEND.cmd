@echo off
rem Restarts only the CRM backend (http://127.0.0.1:5000) in a new window.
rem Use this after backend code changes when the frontend (Vite :5173) is already running.
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 5000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"
timeout /t 2 /nobreak >nul
cd /d "%~dp0backend"
start "CRM backend" powershell -NoProfile -NoExit -Command "npm run start 2>&1 | Tee-Object -FilePath %~dp0backend-start.log"
