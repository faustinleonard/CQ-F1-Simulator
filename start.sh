#!/bin/bash

# F1 What-If Race Simulator - Start Script (Linux/Mac)
# This script starts both the backend and opens the frontend in the browser

set -e

echo "🏎️  F1 What-If Race Simulator"
echo "=================================="

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.8 or higher."
    exit 1
fi

# Check if requirements are installed
if ! python3 -c "import flask" 2>/dev/null; then
    echo "📦 Installing dependencies..."
    pip install -r requirements.txt
fi

echo "✓ Dependencies installed"
echo ""

# Start backend in background
echo "🔧 Starting backend server..."
python3 backend.py &
BACKEND_PID=$!

# Wait for backend to start
sleep 2

# Check if backend is running
if ! curl -s http://localhost:5000/api/health > /dev/null 2>&1; then
    echo "❌ Backend failed to start. Check the error above."
    kill $BACKEND_PID 2>/dev/null || true
    exit 1
fi

echo "✓ Backend running on http://localhost:5000"
echo ""

# Start frontend HTTP server in background
echo "🌐 Starting frontend server..."
cd "$(dirname "$0")"
python3 -m http.server 8000 > /dev/null 2>&1 &
FRONTEND_PID=$!

# Wait for frontend to start
sleep 1

echo "✓ Frontend running on http://localhost:8000"
echo ""

# Open browser
if command -v xdg-open &> /dev/null; then
    xdg-open http://localhost:8000
elif command -v open &> /dev/null; then
    open http://localhost:8000
else
    echo "📱 Open your browser and navigate to: http://localhost:8000"
fi

echo ""
echo "=================================="
echo "🏁 Simulator is ready!"
echo ""
echo "Frontend: http://localhost:8000"
echo "Backend:  http://localhost:5000"
echo "API Docs: http://localhost:5000/api/health"
echo ""
echo "Press Ctrl+C to stop."
echo "=================================="

# Wait for Ctrl+C
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true; echo ''; echo 'Simulator stopped.'; exit 0" SIGINT SIGTERM

wait
