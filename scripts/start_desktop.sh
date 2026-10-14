#!/usr/bin/env bash
set -e
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"
cd "$DIR"

echo "Building latest UI and Electron bundle..."
npm run build

echo "Starting FastAPI Agent Backend..."
export PYTHONPATH="$DIR"
/Users/krishnajyothiswarooppothamsetti/opt/anaconda3/envs/py312/bin/python -m uvicorn agent.api.main:app --host 127.0.0.1 --port 8765 &
BACKEND_PID=$!

trap "kill $BACKEND_PID 2>/dev/null" EXIT

sleep 2

echo "Launching Electron Desktop Shell..."
npx electron .
