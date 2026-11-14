@echo off
setlocal enabledelayedexpansion

set "SCRIPT_DIR=%~dp0"
set "DESKTOP_DIR=%SCRIPT_DIR%desktop"

title Fokk Shield Browser v2.4.3 (Fokk AI Reality Engine & Multi-Source Intelligence)

echo ========================================================
echo             FOKK SHIELD BROWSER v2.4.3
echo       Fast, Zero-Ad, Privacy Desktop Browser
echo    [Live Dev/Runner: Synced with Release v2.4.3]
echo    [Fokk AI Multi-Layer Context Intelligence Active]
echo ========================================================
echo.

REM 1. Verify desktop directory exists
if not exist "%DESKTOP_DIR%" (
    echo [ERROR] Could not locate desktop directory at:
    echo         "%DESKTOP_DIR%"
    echo.
    pause
    exit /b 1
)

cd /d "%DESKTOP_DIR%"

REM 2. Clean up any dangling orphan electron instances to prevent locked cache
echo [INFO] Terminating any dangling browser processes...
taskkill /F /IM electron.exe /T >nul 2>&1
taskkill /F /IM fokk-desktop.exe /T >nul 2>&1
taskkill /F /IM fokk.exe /T >nul 2>&1
timeout /t 2 /nobreak >nul 2>&1

REM 2b. Check for full profile reset switch (--clean or --reset)
if "%~1"=="--clean" (
    echo [INFO] Performing full profile reset...
    rmdir /s /q "%APPDATA%\Fokk Browser" >nul 2>&1
    rmdir /s /q "%APPDATA%\Electron" >nul 2>&1
    rmdir /s /q "%APPDATA%\fokk-desktop" >nul 2>&1
) else if "%~1"=="--reset" (
    echo [INFO] Performing full profile reset...
    rmdir /s /q "%APPDATA%\Fokk Browser" >nul 2>&1
    rmdir /s /q "%APPDATA%\Electron" >nul 2>&1
    rmdir /s /q "%APPDATA%\fokk-desktop" >nul 2>&1
)

REM 2c. Automatically purge stale caches and V8 code cache on launch so updated scripts load fresh
echo [INFO] Purging browser disk cache, V8 code caches, and session buffers...
rmdir /s /q "%APPDATA%\Fokk Browser\Cache" >nul 2>&1
rmdir /s /q "%APPDATA%\Fokk Browser\Code Cache" >nul 2>&1
rmdir /s /q "%APPDATA%\Fokk Browser\GPUCache" >nul 2>&1
rmdir /s /q "%APPDATA%\Fokk Browser\DawnGraphiteCache" >nul 2>&1
rmdir /s /q "%APPDATA%\Fokk Browser\DawnWebGPUCache" >nul 2>&1
rmdir /s /q "%APPDATA%\Fokk Browser\Partitions\persist_fokk_default_session\Cache" >nul 2>&1
rmdir /s /q "%APPDATA%\Fokk Browser\Partitions\persist_fokk_default_session\Code Cache" >nul 2>&1
rmdir /s /q "%APPDATA%\Fokk Browser\Partitions\persist_fokk_default_session\GPUCache" >nul 2>&1
rmdir /s /q "%APPDATA%\Fokk Browser\Partitions\persist_fokk_default_session\DawnGraphiteCache" >nul 2>&1
rmdir /s /q "%APPDATA%\Fokk Browser\Partitions\persist_fokk_default_session\DawnWebGPUCache" >nul 2>&1
rmdir /s /q "%APPDATA%\Electron\Cache" >nul 2>&1
rmdir /s /q "%APPDATA%\Electron\Code Cache" >nul 2>&1
rmdir /s /q "%APPDATA%\Electron\GPUCache" >nul 2>&1
rmdir /s /q "%APPDATA%\fokk-desktop\Cache" >nul 2>&1
rmdir /s /q "%APPDATA%\fokk-desktop\Code Cache" >nul 2>&1
rmdir /s /q "%APPDATA%\fokk-desktop\GPUCache" >nul 2>&1
rmdir /s /q "%APPDATA%\fokk-desktop\DawnGraphiteCache" >nul 2>&1
rmdir /s /q "%APPDATA%\fokk-desktop\DawnWebGPUCache" >nul 2>&1
rmdir /s /q "%APPDATA%\fokk-desktop\Service Worker" >nul 2>&1

REM 3. Check Node.js installation
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed or not found in system PATH.
    echo Please install Node.js - LTS version recommended - from:
    echo    https://nodejs.org/
    echo.
    pause
    exit /b 1
)

REM 4. Check npm installation
where npm >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] npm is not found in your system PATH.
    echo Please ensure npm is installed and accessible in your environment.
    echo.
    pause
    exit /b 1
)

REM 5. Verify dependencies
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

REM 6. Launch Fokk Browser
echo [INFO] Starting fresh Fokk Browser instance with Fokk AI Reality Engine...
echo.

if "%~1"=="" (
    call npm start -- --disable-http-cache --js-flags="--no-v8-cache"
) else if "%~1"=="--clean" (
    call npm start -- --disable-http-cache --js-flags="--no-v8-cache"
) else if "%~1"=="--reset" (
    call npm start -- --disable-http-cache --js-flags="--no-v8-cache"
) else (
    call npm start -- --disable-http-cache --js-flags="--no-v8-cache" %*
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
