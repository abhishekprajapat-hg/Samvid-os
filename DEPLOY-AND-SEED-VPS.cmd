@echo off
rem Pushes main, deploys Samvid OS on the VPS, then loads the demo company.
rem Type the VPS password when the SSH prompts appear. Log: deploy-vps.log
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File deploy\deploy-and-seed-vps.ps1
echo.
pause
