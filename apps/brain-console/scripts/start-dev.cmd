@echo off
setlocal
cd /d C:\Projects\ForgeOS\apps\brain-console
if "%1"=="" set PORT=7778 & goto run
if "%1"=="7777" set PORT=7777 & goto run
if "%1"=="7778" set PORT=7778 & goto run

:run
echo starting brain-console on :%PORT%
npx tsx server.ts
pause
