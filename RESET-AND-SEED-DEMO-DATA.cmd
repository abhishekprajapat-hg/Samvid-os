@echo off
rem Deletes ALL data in the LOCAL database (backup first), then loads fresh demo data.
rem Refuses to run against anything that is not the local Mongo. Output goes to reset-demo.log.
cd /d "%~dp0backend"
call npm run reset:local-demo > "%~dp0reset-demo.log" 2>&1
echo exit code %errorlevel%>> "%~dp0reset-demo.log"
echo done>> "%~dp0reset-demo.log"
