#!/usr/bin/env bash
set -e
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"
cd "$DIR"

export PYTHONPATH="$DIR"
/Users/krishnajyothiswarooppothamsetti/opt/anaconda3/envs/py312/bin/pytest agent/tests/test_browser_agent.py -v
