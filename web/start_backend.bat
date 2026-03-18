@echo off
echo ========================================
echo Starting AffectGPT Backend Server
echo ========================================

cd /d "%~dp0.."

REM Activate conda environment if exists
call conda activate affectgpt 2>nul

REM Set Python path to include the project root
set PYTHONPATH=%cd%;%PYTHONPATH%

echo Starting FastAPI server on http://localhost:8000
cd web\backend
python -m uvicorn app:app --host 0.0.0.0 --port 8000 --reload

pause
