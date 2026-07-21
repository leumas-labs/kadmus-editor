#!/bin/bash

# Clean shutdown handler
cleanup() {
    if [ ! -z "$VITE_PID" ]; then
        echo "[launcher] Stopping background Vite dev server (PID: $VITE_PID)..."
        kill $VITE_PID 2>/dev/null
    fi
    exit 0
}

# Trap exit signals to ensure clean shutdown of all spawned processes
trap cleanup SIGINT SIGTERM EXIT

DEV_MODE=true
for arg in "$@"; do
    if [ "$arg" == "--prod" ]; then
        DEV_MODE=false
    fi
done

# 1. Compile C++ backend automatically if code changed
echo "[launcher] Checking C++ compilation..."
make || { echo "[launcher] C++ Compilation failed."; exit 1; }

# 2. Handle launching based on mode
if [ "$DEV_MODE" = true ]; then
    echo "[launcher] Starting Kadmus in DEVELOPMENT mode..."
    
    # Check if Vite dev server is already running on port 5173
    if ! lsof -i :5173 >/dev/null 2>&1; then
        echo "[launcher] Launching Vite dev server in background..."
        cd frontend
        npm run dev > /dev/null 2>&1 &
        VITE_PID=$!
        cd ..
        
        # Give Vite a moment to bind to the port
        sleep 1.5
    else
        echo "[launcher] Vite dev server detected running on port 5173."
    fi
    
    # Launch Kadmus executable with --dev flag
    ./kadmus --dev
else
    echo "[launcher] Starting Kadmus in PRODUCTION mode..."
    
    # Check if a production bundle exists, if not build it
    if [ ! -d "frontend/dist" ]; then
        echo "[launcher] No production build found. Bundling frontend assets..."
        cd frontend && npm run build && cd ..
    fi
    
    # Launch Kadmus executable (which will load static files directly)
    ./kadmus
fi
