@echo off
setlocal

cd /d "%~dp0"

if "%~1"=="--check" goto check

echo.
echo EssayCraft local setup
echo ======================
echo.

:check
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found.
  echo Install Node.js 20 or newer from https://nodejs.org/
  if not "%~1"=="--check" pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo npm was not found.
  echo Reinstall Node.js 20 or newer from https://nodejs.org/
  if not "%~1"=="--check" pause
  exit /b 1
)

echo Node:
node --version
echo npm:
call npm --version

if "%~1"=="--check" (
  echo Setup prerequisites look OK.
  exit /b 0
)

if not exist ".env.local" (
  if exist ".env.example" (
    copy ".env.example" ".env.local" >nul
    echo Created .env.local from .env.example.
  ) else (
    echo .env.example was not found; continuing without .env.local.
  )
)

echo.
echo Installing dependencies...
call npm install
if errorlevel 1 (
  echo npm install failed.
  pause
  exit /b 1
)

echo.
echo Starting EssayCraft...
echo Open the Local URL printed by Next.js, usually http://localhost:3000
echo Press Ctrl+C in this window to stop the server.
echo.
call npm run dev

endlocal
