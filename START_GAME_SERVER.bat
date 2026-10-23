@echo off
cd /d "%~dp0"
title SoulSeekers R02 - Multiplayer Game Server
where node >nul 2>nul
if errorlevel 1 (
 echo Node.js is required to run the R02 game server.
 echo Install Node.js LTS from https://nodejs.org/ and run this BAT again.
 pause
 exit /b 1
)
if not exist "node_modules\ws" (
 echo First-time setup: installing WebSocket server dependency...
 call npm install
 if errorlevel 1 (
   echo npm install failed. Check your Internet connection.
   pause
   exit /b 1
 )
)
echo.
echo OPEN http://localhost:8787 in two browser windows.
echo Keep this window open while testing multiplayer.
echo.
start "" "http://localhost:8787/"
node server/index.mjs
pause
