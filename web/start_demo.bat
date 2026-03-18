@echo off
echo ========================================
echo Starting AffectGPT in DEMO MODE
echo ========================================
echo.
echo NOTE: Demo mode returns simulated responses
echo       without loading the actual model.
echo.

cd /d "%~dp0.."

REM Set demo mode environment variable
set DEMO_MODE=true
set PYTHONPATH=%cd%;%PYTHONPATH%

REM Start backend in demo mode
start "AffectGPT Backend (DEMO)" cmd /k "cd /d %~dp0backend && set DEMO_MODE=true && python -m uvicorn app:app --host 0.0.0.0 --port 8000 --reload"

timeout /t 3 /nobreak

REM Start frontend
start "AffectGPT Frontend" cmd /k "cd /d %~dp0frontend && npm install && npm run dev"

echo.
echo Demo servers starting...
echo Backend: http://localhost:8000
echo Frontend: http://localhost:3000
echo.
pause
