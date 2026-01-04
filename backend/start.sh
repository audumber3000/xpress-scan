#!/bin/bash

# Change to backend directory
cd "$(dirname "$0")"

# Activate virtual environment
source venv/bin/activate

# Check if .env file exists
if [ -f .env ]; then
    echo "✅ .env file found (will be loaded by Python dotenv)"
else
    echo "⚠️  Warning: .env file not found"
fi

# Note: Environment variables are loaded by load_dotenv() in main.py
# No need to export them here, especially since .env may contain multiline values

# Start the backend server
echo "🚀 Starting backend server on http://0.0.0.0:8000"
echo "📝 Environment variables will be loaded from .env file"
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000

