@echo off
cd /d "%~dp0"
node --version >nul 2>&1
if errorlevel 1 (
 echo Install Node.js 24 or later, then reopen this file.
 pause
 exit /b 1
)
if not exist apps\host\dist\app.js (
 echo Run npm ci and npm run build in this folder first.
 pause
 exit /b 1
)
call npm run research:acceptance -- %*
pause
