#!/bin/bash
set -e

cd /backend

echo "Running database setup..."
PYTHONPATH=/backend python scripts/setup_db.py

echo "Starting server..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 "$@"
