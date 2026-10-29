@echo off
setlocal EnableExtensions DisableDelayedExpansion
cd /d "%~dp0"
title SoulSeekers Seeking - GitHub Sync

set "SOURCE=%~dp0"
set "CFGDIR=%LOCALAPPDATA%\SoulSeekersSeeking"
set "CFGFILE=%CFGDIR%\github-repo-path.txt"
set "REPO="

cls
echo ==========================================================
echo       SOULSEEKERS: SEEKING - GITHUB SYNC
echo ==========================================================
echo.
echo This imports this ZIP's game files into your GitHub Desktop
echo repository, then helps you push them to GitHub.
echo.
echo SOURCE: %SOURCE%
echo.

if exist "%CFGFILE%" (
  set /p "REPO="<"%CFGFILE%"
)
if defined REPO if not exist "%REPO%\.git" set "REPO="
if not defined REPO goto PICK_REPO
goto CHECK_REPO

:PICK_REPO
echo FIRST-TIME SETUP - find your repository folder:
echo   1. In GitHub Desktop, choose SoulSeekers_Seeking.
echo   2. Choose Repository - Show in Explorer.
echo   3. In Explorer, click the ADDRESS BAR and press Ctrl+C.
echo   4. Come back here, paste with Ctrl+V, then press Enter.
echo.
set /p "REPO=Repository folder: "
set "REPO=%REPO:"=%"
if not defined REPO goto NO_REPO
if not exist "%REPO%\.git" (
  echo.
  echo ERROR: That folder is not a GitHub Desktop repository.
  echo Use Repository - Show in Explorer, NOT your Downloads folder.
  echo.
  choice /C YN /N /M "Try again? [Y/N] "
  if errorlevel 2 goto END
  goto PICK_REPO
)
if not exist "%CFGDIR%" mkdir "%CFGDIR%" >nul 2>nul
>"%CFGFILE%" <nul set /p "=%REPO%"

:CHECK_REPO
for %%A in ("%SOURCE%.") do set "SOURCEFULL=%%~fA"
for %%A in ("%REPO%\.") do set "REPOFULL=%%~fA"
echo.
echo GitHub repository: %REPOFULL%
if /i "%SOURCEFULL%"=="%REPOFULL%" (
  echo Game is ALREADY inside your repository. Nothing to copy.
  goto AFTER_COPY
)
if not exist "%SOURCE%index.html" (
  echo ERROR: Could not find index.html beside this BAT file.
  echo Extract the entire game ZIP before running it.
  goto END
)
if not exist "%REPO%\.git" (
  echo ERROR: The repository folder cannot be found.
  goto END
)
echo.
echo IMPORTANT: Existing game files at the destination may be
echo overwritten with files from this extracted ZIP.
echo Your Git history and any other files are NOT deleted.
echo.
choice /C YN /N /M "Copy/update game files into this repository? [Y/N] "
if errorlevel 2 goto END

echo.
echo Copying files (without touching .git)...
robocopy "%SOURCE%." "%REPO%\." /E /XD ".git" "node_modules" /XF "Thumbs.db" "desktop.ini" ".DS_Store" /R:1 /W:1 /NP /NFL /NDL
set "ROBORESULT=%ERRORLEVEL%"
if %ROBORESULT% GEQ 8 (
  echo.
  echo ERROR: File copy failed. robocopy returned %ROBORESULT%.
  goto END
)
if not exist "%REPO%\index.html" (
  echo ERROR: index.html is missing from the destination!
  goto END
)
echo.
echo Files are now in your GitHub Desktop repository.

:AFTER_COPY
echo.
echo Next step: commit and push the changes to GitHub.
echo.
echo   [1] Use GitHub Desktop (recommended and easiest)
echo   [2] Attempt automatic Git COMMIT + PUSH
echo.
choice /C 12 /N /M "Choose 1 or 2: "
if errorlevel 2 goto AUTO_PUSH
goto DESKTOP

:AUTO_PUSH
set "GITEXE="
for %%G in (git.exe) do set "GITEXE=%%~$PATH:G"
if not defined GITEXE (
  for /d %%D in ("%LOCALAPPDATA%\GitHubDesktop\app-*") do (
    if exist "%%~fD\resources\app\git\cmd\git.exe" set "GITEXE=%%~fD\resources\app\git\cmd\git.exe"
  )
)
if not defined GITEXE (
  echo.
  echo Git command not found. Use the GitHub Desktop buttons instead.
  goto DESKTOP
)
echo.
echo AUTO PUSH will stage ALL repository changes and make a commit.
echo It requires a working GitHub remote and credentials.
choice /C YN /N /M "Proceed with automatic commit + push? [Y/N] "
if errorlevel 2 goto DESKTOP
"%GITEXE%" -C "%REPO%" remote get-url origin >nul 2>nul
if errorlevel 1 (
  echo No 'origin' remote yet. Publish the repository in GitHub Desktop first.
  goto DESKTOP
)
"%GITEXE%" -C "%REPO%" add -A
if errorlevel 1 (
  echo ERROR: git add failed.
  goto DESKTOP
)
"%GITEXE%" -C "%REPO%" diff --cached --quiet
if not errorlevel 1 (
  echo No changed files to commit. Checking push anyway...
  goto PUSH
)
"%GITEXE%" -C "%REPO%" commit -m "Update SoulSeekers Seeking"
if errorlevel 1 (
  echo ERROR: Commit failed. See GitHub Desktop for details.
  goto DESKTOP
)
:PUSH
"%GITEXE%" -C "%REPO%" push -u origin HEAD
if errorlevel 1 (
  echo.
  echo Push did not succeed. You can use GitHub Desktop to finish.
  goto DESKTOP
)
echo.
echo SUCCESS: Files committed (if changed) and pushed to GitHub.
echo If GitHub Pages is enabled, publishing happens separately.
goto END

:DESKTOP
echo.
echo GitHub Desktop steps:
echo   1. Switch to GitHub Desktop and select SoulSeekers_Seeking.
echo   2. Under Changes, you should now see the game files.
echo   3. Enter a summary, for example: SoulSeekers Seeking R03.4 SoulSeekers UI.
echo   4. Click Commit to main at the bottom left.
echo   5. Click Push origin (or Publish repository) at the top.
echo.
echo NOTE: Copying is local; the website updates only AFTER push
echo and after GitHub Pages finishes deploying.
echo.
echo Opening the destination folder for you...
start "" "%REPO%"

:END
echo.
echo ==========================================================
pause
exit /b

:NO_REPO
echo No repository folder entered. Nothing changed.
goto END
