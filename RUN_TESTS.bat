@echo off
cd /d "%~dp0"
node --version
if errorlevel 1 (echo Node.js 20+ required.&pause&exit /b 1)
node --test tests/*.test.mjs
pause
