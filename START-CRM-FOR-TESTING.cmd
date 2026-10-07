@echo off
rem Starts the local CRM (MongoDB, backend :5000, frontend :5173) for testing.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run-web.ps1"
