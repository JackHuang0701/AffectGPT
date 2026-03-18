@echo off
echo ========================================
echo Starting AffectGPT Web Application
echo ========================================
echo.

cd /d "%~dp0.."

REM Set Python path to include AffectGPT root
set PYTHONPATH=%cd%;%PYTHONPATH%

REM Set model checkpoint path (optional, modify as needed)
set AFFECTGPT_CKPT="E:\HW\checkpoint\checkpoint_000005_loss_0.000.pth"

REM Start backend in new window
start "AffectGPT Backend" cmd /k "cd /d %~dp0 && start_backend.bat"

REM Wait a bit for backend to start
timeout /t 3 /nobreak

REM Start frontend in new window  
start "AffectGPT Frontend" cmd /k "cd /d %~dp0 && start_frontend.bat"

echo.
echo Servers starting...
echo Backend: http://localhost:8000
echo Frontend: http://localhost:3000
echo.
echo Press any key to exit this window (servers will keep running)
pause
