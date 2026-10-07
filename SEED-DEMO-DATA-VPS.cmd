@echo off
rem Loads demo data into the VPS database in its own "Samvid Demo Realty" company.
rem Log in afterwards as admin@samviddemo.in / 123456. A log is written to seed-demo-vps.log.
cd /d "%~dp0backend"
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\seed-demo-vps.ps1
echo.
pause
