@echo off
setlocal enabledelayedexpansion

title Fokk Shield Browser

echo ========================================================
echo                 FOKK SHIELD BROWSER
echo       Fast, Zero-Ad, Privacy Desktop Browser
echo ========================================================
echo.

set "SCRIPT_DIR=%~dp0"
set "DESKTOP_DIR=%SCRIPT_DIR%desktop"

REM 1. Verify desktop directory exists
if not exist "%DESKTOP_DIR%" (
    echo [ERROR] Could not locate desktop directory at:
    echo         "%DESKTOP_DIR%"
    echo.
    pause
    exit /b 1
)

cd /d "%DESKTOP_DIR%"

REM 2. Check Node.js installation
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed or not found in system PATH.
    echo Please install Node.js - LTS version recommended - from:
    echo    https://nodejs.org/
    echo.
    pause
    exit /b 1
)

REM 3. Check npm installation
where npm >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] npm is not found in your system PATH.
    echo Please ensure npm is installed and accessible in your environment.
    echo.
    pause
    exit /b 1
)

REM 4. Verify dependencies
if not exist "node_modules" (
    echo [INFO] Dependencies not found. Installing node packages...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo.
        echo [ERROR] Failed to install dependencies.
        echo Please verify your internet connection and try running 'npm install' in the desktop folder.
        echo.
        pause
        exit /b 1
    )
) else (
    if not exist "node_modules\electron" (
        echo [INFO] Electron binary missing in node_modules. Installing packages...
        call npm install
        if %ERRORLEVEL% NEQ 0 (
            echo.
            echo [ERROR] Failed to install dependencies.
            echo.
            pause
            exit /b 1
        )
    )
)

REM 5. Launch Fokk Browser
echo [INFO] Starting Fokk Browser...
echo.

if "%~1"=="" (
    call npm start
) else (
    call npm start -- %*
)

set "EXIT_CODE=%ERRORLEVEL%"
if %EXIT_CODE% NEQ 0 (
    echo.
    echo [WARNING] Fokk Browser stopped with exit code: %EXIT_CODE%
    echo If this was unexpected, please review the console output above.
    echo.
    pause
)

exit /b %EXIT_CODE%
