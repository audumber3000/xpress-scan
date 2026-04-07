#!/bin/bash

# Start all services for Better Clinic Application
# Fix for macOS fork safety issues
export OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES

echo "🚀 Starting all services for Better Clinic Application..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Create logs directory if it doesn't exist
mkdir -p logs

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
kill_port 8000  # Python Backend
kill_port 8001  # MolarPlus Nexus
kill_port 5173  # React Frontend (Vite default)

echo ""
echo "Starting services..."
echo ""

# ── Step 0: Start Docker containers (PostgreSQL + Redis) ──
echo -e "${GREEN}🐘 Starting Docker containers (PostgreSQL + Redis)...${NC}"
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed or not in PATH${NC}"
    exit 1
fi

if ! docker info &> /dev/null; then
    echo -e "${RED}❌ Docker daemon is not running. Please start Docker Desktop first.${NC}"
    exit 1
fi

docker compose up -d db redis 2>&1 | tail -5

# Wait for PostgreSQL to be healthy
echo "Waiting for PostgreSQL to be ready..."
for i in {1..30}; do
    if docker compose exec -T db pg_isready -U postgres &> /dev/null; then
        echo -e "${GREEN}✅ PostgreSQL is ready${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}❌ PostgreSQL failed to start within 30 seconds${NC}"
        echo "Check: docker compose logs db"
        exit 1
    fi
    sleep 1
done

echo -e "${GREEN}✅ Redis is running${NC}"
echo ""

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

# Start MolarPlus Nexus (FastAPI Microservice)
echo -e "${GREEN}⚖️  Starting MolarPlus Nexus (FastAPI) on port 8001...${NC}"
cd nexus-service
if [ ! -d "venv" ]; then
    echo "Creating Nexus virtual environment..."
    python3 -m venv venv
fi
source venv/bin/activate
if [ ! -f "venv/.installed" ]; then
    echo "Installing Nexus dependencies..."
    pip install -r requirements.txt
    touch venv/.installed
fi
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8001 > ../logs/nexus.log 2>&1 &
NEXUS_PID=$!
echo "Nexus PID: $NEXUS_PID"

# Start Nexus Worker
echo -e "${GREEN}👷 Starting Nexus Worker...${NC}"
python worker.py > ../logs/nexus_worker.log 2>&1 &
WORKER_PID=$!
echo "Worker PID: $WORKER_PID"
echo "$WORKER_PID" > ../logs/nexus_worker.pid
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

# Save PIDs to file for easy cleanup
echo "$BACKEND_PID" > logs/backend.pid
echo "$NEXUS_PID" > logs/nexus.pid
echo "$WORKER_PID" > logs/nexus_worker.pid
echo "$FRONTEND_PID" > logs/frontend.pid

echo ""
echo -e "${GREEN}✅ All services started!${NC}"
echo ""
echo "Service URLs:"
echo "  🐍 Python Backend:  http://localhost:8000"
echo "  ⚖️  MolarPlus Nexus: http://localhost:8001"
echo "  ⚛️  React Frontend:  http://localhost:5173"
echo ""
echo "Logs are available in the 'logs' directory:"
echo "  - logs/backend.log"
echo "  - logs/nexus.log"
echo "  - logs/frontend.log"
echo ""
echo "To stop all services, run: ./stop-services.sh"
echo "Or manually kill PIDs: $BACKEND_PID, $NEXUS_PID, $WORKER_PID, $FRONTEND_PID"
echo ""

# Wait a moment and check if services are running
sleep 5
echo "Checking service status..."

if check_port 8000; then
    echo -e "${GREEN}✅ Backend is running${NC}"
else
    echo -e "${RED}❌ Backend failed to start${NC}"
    echo "Check logs/backend.log for errors"
fi

if check_port 8001; then
    echo -e "${GREEN}✅ MolarPlus Nexus is running${NC}"
else
    echo -e "${RED}❌ MolarPlus Nexus failed to start${NC}"
    echo "Check logs/nexus.log for errors"
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
    kill $BACKEND_PID 2>/dev/null
    kill $NEXUS_PID 2>/dev/null
    kill $WORKER_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    echo "Services stopped."
    exit 0
}

# Trap Ctrl+C
trap cleanup INT TERM

# Keep script running
wait


