@echo off
cd /d "%~dp0"
title SoulSeekers Seeking - Integrated Multiplayer
where node >nul 2>nul
if errorlevel 1 (
 echo Install Node.js LTS, then run this file again.
 pause
 exit /b 1
)
if not exist node_modules\ws (
 echo Installing the WebSocket dependency...
 call npm ci --omit=dev
 if errorlevel 1 (
  echo Install failed. Check your internet connection, then retry.
  pause
  exit /b 1
 )
)
echo.
echo Open http://localhost:8787/dungeon.html
 echo Keep this window open while playing. Ctrl+C stops the server.
start "" "http://localhost:8787/dungeon.html"
node server/index.mjs
pause
