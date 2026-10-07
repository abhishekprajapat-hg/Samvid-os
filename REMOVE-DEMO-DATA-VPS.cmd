@echo off
rem Deletes ONLY the "Samvid Demo Realty" demo company (its users, leads, inventory...) from the VPS database.
cd /d "%~dp0backend"
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\seed-demo-vps.ps1 -Remove
echo.
pause
