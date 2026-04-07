#!/bin/bash

# Configuration
SERVER_IP="89.167.103.199"
SERVER_PASSWORD="Prashant@135"
SERVER_USER="root"
TARGET_DIR="/root/xpress-scan"
BASE_DIR="/Users/audii3000/Documents/Personal Projects/xpress-scan"

echo "🚀 Starting automated deployment to $SERVER_IP..."

# Function to run SSH command via expect
run_ssh() {
    ./ssh_exec.exp "$SERVER_IP" "$SERVER_PASSWORD" "$1"
}

# Function to run SCP via expect
run_scp() {
    ./scp_exec.exp "$1" "$SERVER_IP" "$SERVER_PASSWORD" "$2"
}

# 1. Setup/Update on server
echo "🔄 Updating repository on server..."
run_ssh "cd $TARGET_DIR && git pull origin test-branch"

# 2. Transfer configuration files
echo "📤 Transferring configuration files..."
run_scp "$BASE_DIR/.env" "$TARGET_DIR/.env"
run_scp "$BASE_DIR/backend/.env" "$TARGET_DIR/backend/.env"
run_scp "$BASE_DIR/backend/betterclinic-f1179-firebase-adminsdk-fbsvc-89ea2e663e.json" "$TARGET_DIR/backend/"

# 3. Finalize deployment
echo "🏗️ Building and starting containers..."
run_ssh "cd $TARGET_DIR && docker-compose down && docker-compose up -d --build"

echo "✅ Deployment complete!"
run_ssh "cd $TARGET_DIR && docker-compose ps"
