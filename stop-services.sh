#!/bin/bash

# Stop all services

echo "🛑 Stopping all services..."

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Kill processes by PID files if they exist
if [ -f "logs/whatsapp.pid" ]; then
    PID=$(cat logs/whatsapp.pid)
    if ps -p $PID > /dev/null 2>&1; then
        echo -e "${YELLOW}Stopping WhatsApp Service (PID: $PID)...${NC}"
        kill $PID 2>/dev/null
    fi
    rm logs/whatsapp.pid
fi

if [ -f "logs/backend.pid" ]; then
    PID=$(cat logs/backend.pid)
    if ps -p $PID > /dev/null 2>&1; then
        echo -e "${YELLOW}Stopping Backend (PID: $PID)...${NC}"
        kill $PID 2>/dev/null
    fi
    rm logs/backend.pid
fi

if [ -f "logs/frontend.pid" ]; then
    PID=$(cat logs/frontend.pid)
    if ps -p $PID > /dev/null 2>&1; then
        echo -e "${YELLOW}Stopping Frontend (PID: $PID)...${NC}"
        kill $PID 2>/dev/null
    fi
    rm logs/frontend.pid
fi

# Also kill by port (in case PID files are missing)
echo "Killing processes on ports 3001, 8000, 5173..."
lsof -ti:3001 | xargs kill -9 2>/dev/null
lsof -ti:8000 | xargs kill -9 2>/dev/null
lsof -ti:5173 | xargs kill -9 2>/dev/null

echo -e "${GREEN}✅ All services stopped${NC}"


