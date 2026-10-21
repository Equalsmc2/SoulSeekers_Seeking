@echo off
cd /d "%~dp0"
echo SOULSEEKERS SEEKING - LOCAL PREVIEW
start "" "http://localhost:8000/"
where py >nul 2>nul
if %errorlevel%==0 (
    py -3 -m http.server 8000
) else (
    python -m http.server 8000
)
pause
