@echo off
setlocal enabledelayedexpansion

title Fokk Desktop Browser & Fokk Search Engine

echo ========================================================
echo               FOKK SEARCH & DESKTOP BROWSER             
echo    Private, Multi-Source Intelligence • Zero Tracking   
echo ========================================================
echo.

set "SCRIPT_DIR=%~dp0"
set "DESKTOP_DIR=%SCRIPT_DIR%desktop"

where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not found in your system PATH.
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

where npm >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] npm is not found in your system PATH.
    pause
    exit /b 1
)

REM 1. Clean up dangling processes to release locks
echo [INFO] Ensuring clean session buffers and releasing ports...
taskkill /F /IM electron.exe /T >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :4040 ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1

REM 2. Start Fokk Search Engine locally in background if not already running
echo [INFO] Starting Fokk Search Service on http://localhost:4040 ...
start /B node "%SCRIPT_DIR%fokk_search\server.js" >nul 2>&1

timeout /t 1 /nobreak >nul 2>&1

REM 3. Launch Fokk Desktop Browser
echo [INFO] Launching Full Fokk Desktop Browser...
echo.

cd /d "%DESKTOP_DIR%"
call npm start -- --disable-http-cache --js-flags="--no-v8-cache"

exit /b %ERRORLEVEL%
