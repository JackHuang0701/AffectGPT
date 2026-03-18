@echo off
echo ========================================
echo Starting AffectGPT Frontend Server
echo ========================================

cd /d "%~dp0frontend"

REM Check if node_modules exists
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
)

echo Starting Vite dev server on http://localhost:3000
call npm run dev

pause
