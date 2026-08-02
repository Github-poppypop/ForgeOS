@echo off
REM ForgeOS Brain Console — Task Scheduler wrapper script
REM Kills stale bun.exe before starting to avoid EPERM / port conflicts.
REM Place this in scripts/start-server.bat and point Task Scheduler to it.
setlocal

set "BUN_INSTALL=C:\Users\pop\.bun"
set "PATH=%BUN_INSTALL%\bin;%PATH%"
set "GBRAIN_HOME=C:\ForgeOS"
set "GBRAIN_CWD=C:\Users\pop\forge-gbrain"
set "OLLAMA_BASE_URL=http://localhost:11434/v1"
set "GBRAIN_EMBEDDING_DIMENSIONS=1024"
set "OLLAMA_MODELS=D:\ollama"
set "DATABASE_URL="
set "PORT=7777"

set "LOG_DIR=%~dp0..\logs"
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

set "LOG=%LOG_DIR%\server-%DATE:~-4%%DATE:~4,2%%DATE:~7,2%-%TIME:~0,2%%TIME:~3,2%%TIME:~6,2%.log"
REM Sanitize TIME spaces (e.g. " 9" -> "09")
set "LOG=%LOG: =0%"

echo [start-server] Killing stale bun.exe before launch...
tasklist /FI "IMAGENAME eq bun.exe" /FO CSV /NH 2>nul | find /I "bun.exe" >nul
if %ERRORLEVEL% EQU 0 (
    taskkill /F /IM bun.exe >nul 2>&1
    echo [start-server] bun.exe terminated.
    timeout /t 2 /nobreak >nul
) else (
    echo [start-server] No stale bun.exe found.
)

echo [start-server] Starting ForgeOS Brain Console on :%PORT%
cd /d "%~dp0.."

REM Append to daily log so Task Scheduler history is inspectable.
set "DAILY_LOG=%LOG_DIR%\server-today.log"
echo [%DATE% %TIME%] === boot ===>> "%DAILY_LOG%"

REM Launch detached so Task Scheduler doesn't wait on the process.
REM The /min flag keeps the console window out of the way.
start "ForgeOSBrainConsole" /min cmd /c "bun run server.ts >> "%DAILY_LOG%" 2>&1"

echo [start-server] Launched. Tail %DAILY_LOG% for output.
timeout /t 3 /nobreak >nul
if exist "%DAILY_LOG%" (
    powershell -Command "Get-Content -Path '%DAILY_LOG%' -Tail 20"
)

endlocal
