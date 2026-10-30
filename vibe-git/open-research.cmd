@echo off
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
 echo Please install Node.js 24 or newer, then reopen this file.
 pause
 exit /b 1
)
node scripts/open-research.mjs %*
if errorlevel 1 pause
