#!/bin/bash

# Start all services for Better Clinic Application
# This script starts: Node.js WhatsApp service, Python FastAPI backend, and React frontend

echo "🚀 Starting all services for Better Clinic Application..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to check if a port is in use
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        return 0
    else
        return 1
    fi
}

# Function to kill process on port
kill_port() {
    if check_port $1; then
        echo -e "${YELLOW}⚠️  Port $1 is in use. Killing existing process...${NC}"
        lsof -ti:$1 | xargs kill -9 2>/dev/null
        sleep 2
    fi
}

# Check and kill existing processes
echo "Checking for existing processes..."
kill_port 3001  # WhatsApp Service
kill_port 8000  # Python Backend
kill_port 5173  # React Frontend (Vite default)

echo ""
echo "Starting services..."
echo ""

# Start WhatsApp Service (Node.js)
echo -e "${GREEN}📱 Starting WhatsApp Service (Node.js) on port 3001...${NC}"
cd whatsapp-service
if [ ! -d "node_modules" ]; then
    echo "Installing WhatsApp service dependencies..."
    npm install
fi
npm start > ../logs/whatsapp-service.log 2>&1 &
WHATSAPP_PID=$!
echo "WhatsApp Service PID: $WHATSAPP_PID"
cd ..

# Wait a bit for WhatsApp service to start
sleep 3

# Start Python Backend (FastAPI)
echo -e "${GREEN}🐍 Starting Python Backend (FastAPI) on port 8000...${NC}"
cd backend
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi
source venv/bin/activate
if [ ! -f "venv/.installed" ]; then
    echo "Installing Python dependencies..."
    pip install -r requirements.txt
    touch venv/.installed
fi
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000 > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"
cd ..

# Wait a bit for backend to start
sleep 3

# Start React Frontend
echo -e "${GREEN}⚛️  Starting React Frontend (Vite) on port 5173...${NC}"
cd frontend
if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install
fi
npm run dev > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"
cd ..

# Create logs directory if it doesn't exist
mkdir -p logs

# Save PIDs to file for easy cleanup
echo "$WHATSAPP_PID" > logs/whatsapp.pid
echo "$BACKEND_PID" > logs/backend.pid
echo "$FRONTEND_PID" > logs/frontend.pid

echo ""
echo -e "${GREEN}✅ All services started!${NC}"
echo ""
echo "Service URLs:"
echo "  📱 WhatsApp Service: http://localhost:3001"
echo "  🐍 Python Backend:  http://localhost:8000"
echo "  ⚛️  React Frontend:  http://localhost:5173"
echo ""
echo "Logs are available in the 'logs' directory:"
echo "  - logs/whatsapp-service.log"
echo "  - logs/backend.log"
echo "  - logs/frontend.log"
echo ""
echo "To stop all services, run: ./stop-services.sh"
echo "Or manually kill PIDs: $WHATSAPP_PID, $BACKEND_PID, $FRONTEND_PID"
echo ""

# Wait a moment and check if services are running
sleep 5
echo "Checking service status..."

if check_port 3001; then
    echo -e "${GREEN}✅ WhatsApp Service is running${NC}"
else
    echo -e "${RED}❌ WhatsApp Service failed to start${NC}"
    echo "Check logs/whatsapp-service.log for errors"
fi

if check_port 8000; then
    echo -e "${GREEN}✅ Backend is running${NC}"
else
    echo -e "${RED}❌ Backend failed to start${NC}"
    echo "Check logs/backend.log for errors"
fi

if check_port 5173; then
    echo -e "${GREEN}✅ Frontend is running${NC}"
else
    echo -e "${RED}❌ Frontend failed to start${NC}"
    echo "Check logs/frontend.log for errors"
fi

echo ""
echo "Press Ctrl+C to stop all services (or run ./stop-services.sh)"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "Stopping all services..."
    kill $WHATSAPP_PID 2>/dev/null
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    echo "Services stopped."
    exit 0
}

# Trap Ctrl+C
trap cleanup INT TERM

# Keep script running
wait


