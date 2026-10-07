@echo off
rem Loads demo accounts and data into the LOCAL database only (the seeder refuses non-local targets).
cd /d "%~dp0backend"
call npm run seed:local-demo > "%~dp0seed-demo.log" 2>&1
echo done>> "%~dp0seed-demo.log"
