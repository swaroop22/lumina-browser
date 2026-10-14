#!/usr/bin/env bash
set -e
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"
cd "$DIR"

export PYTHONPATH="$DIR"
/Users/krishnajyothiswarooppothamsetti/opt/anaconda3/envs/py312/bin/python -m uvicorn agent.api.main:app --host 127.0.0.1 --port 8765
