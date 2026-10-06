@echo off
rem Moves every account that is not an Admin or Manager under a Manager (rule of 29 Sep 2026).
rem Uses backend\.env (MONGO_URI). Output goes to fix-reporting.log.
cd /d "%~dp0backend"
call npm run fix:reporting -- --apply > "%~dp0fix-reporting.log" 2>&1
echo exit code %errorlevel%>> "%~dp0fix-reporting.log"
echo done>> "%~dp0fix-reporting.log"
