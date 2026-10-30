@echo off
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
 echo Please install Node.js 24 or newer, then reopen this file.
 pause
 exit /b 1
)
node scripts/open-research.mjs --prepare
if errorlevel 1 (
 pause
 exit /b 1
)
node scripts/open-replay.mjs --open
if errorlevel 1 pause
