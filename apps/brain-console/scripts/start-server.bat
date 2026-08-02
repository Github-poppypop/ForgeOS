@echo off
REM ForgeOS Brain Console — Task Scheduler wrapper
REM Kills stale bun.exe before starting to avoid EADDRINUSE.
setlocal
echo [%date% %time%] Starting ForgeOS Brain Console...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :7777 ^| findstr LISTENING') do (
    echo Killing stale bun.exe (PID %%a)...
    taskkill /F /PID %%a >nul 2>&1
)
timeout /t 2 /nobreak >nul
cd /d C:\Projects\ForgeOS\apps\brain-console
set GBRAIN_HOME=C:\ForgeOS
set GBRAIN_CWD=C:\Users\pop\forge-gbrain
set OLLAMA_BASE_URL=http://localhost:11434/v1
set GBRAIN_EMBEDDING_DIMENSIONS=1024
set PORT=7777
echo [%date% %time%] Launching bun run server.ts...
bun run server.ts
endlocal
