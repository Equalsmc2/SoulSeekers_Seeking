@echo off
cd /d "%~dp0"
title SoulSeekers Seeking - Multiplayer Dungeon M1
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js LTS ^(20 or newer^) from https://nodejs.org/
  pause
  exit /b 1
)
echo SoulSeekers Dungeon M1 - local dedicated server
echo Production Render uses npm install to load ws ^(recommended^).
echo Local development can start without an Internet connection.
echo.
echo Open http://localhost:8787/dungeon.html
start "" "http://localhost:8787/dungeon.html"
node server/index.mjs
pause
