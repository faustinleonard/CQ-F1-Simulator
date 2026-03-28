@echo off
REM F1 What-If Race Simulator - Start Script (Windows)
REM This script starts both the backend and opens the frontend in the browser

echo.
echo 🏎️ F1 What-If Race Simulator
echo ===================================

REM Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Python is not installed or not in PATH.
    echo Please install Python 3.8 or higher from https://www.python.org/
    pause
    exit /b 1
)

echo ✓ Python found

REM Check if requirements are installed
python -c "import flask" >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo 📦 Installing dependencies...
    pip install -r requirements.txt
    if %errorlevel% neq 0 (
        echo ❌ Failed to install dependencies
        pause
        exit /b 1
    )
)

echo ✓ Dependencies installed
echo.

REM Start backend
echo 🔧 Starting backend server...
start "F1 Simulator Backend" python backend.py

REM Wait for backend to start
timeout /t 2 /nobreak

REM Check if backend is accessible
for /f %%i in ('python -c "import requests; requests.get('http://localhost:5000/api/health')"') do set BACKEND_OK=1
if not defined BACKEND_OK (
    echo ⚠️ Warning: Backend may not have started correctly
)

echo ✓ Backend running on http://localhost:5000
echo.

REM Start frontend
echo 🌐 Starting frontend server...
start "F1 Simulator Frontend" python -m http.server 8000

REM Wait for servers to start
timeout /t 2 /nobreak

REM Open browser
echo.
echo Opening browser...
start http://localhost:8000

echo.
echo ===================================
echo 🏁 Simulator is ready!
echo.
echo Frontend: http://localhost:8000
echo Backend:  http://localhost:5000
echo API Docs: http://localhost:5000/api/health
echo.
echo Close these windows or press Ctrl+C to stop
echo ===================================
echo.

pause
