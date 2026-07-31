@echo off
REM ForgeOS Brain Console — persistent launcher (run by Task Scheduler)
set BUN_INSTALL=C:\Users\pop\.bun
set PATH=%BUN_INSTALL%\bin;%PATH%
set GBRAIN_HOME=C:\ForgeOS
set GBRAIN_CWD=C:\Users\pop\forge-gbrain
set OLLAMA_BASE_URL=http://localhost:11434/v1
set GBRAIN_EMBEDDING_DIMENSIONS=1024
set OLLAMA_MODELS=D:\ollama
set DATABASE_URL=
cd /d C:\Projects\ForgeOS\apps\brain-console
set PORT=7777
bun run server.ts
