#!/bin/bash

# Configuration
SERVER_IP="89.167.103.199"
SERVER_USER="root"
REPO_URL="https://github.com/audumber3000/xpress-scan.git"
BRANCH="test-branch"
TARGET_DIR="/root/xpress-scan"

echo "🚀 Starting deployment to $SERVER_IP..."

# 1. SSH into server and perform setup/update
ssh -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_IP << EOF
    # Install Docker if not present
    if ! command -v docker &> /dev/null; then
        echo "Installing Docker..."
        curl -fsSL https://get.docker.com -o get-docker.sh
        sh get-docker.sh
    fi

    # Install Docker Compose if not present
    if ! command -v docker-compose &> /dev/null; then
        echo "Installing Docker Compose..."
        apt-get update
        apt-get install -y docker-compose-plugin
        ln -s /usr/libexec/docker/cli-plugins/docker-compose /usr/local/bin/docker-compose
    fi

    # Clone or pull the repository
    if [ ! -d "$TARGET_DIR" ]; then
        echo "Cloning repository..."
        git clone -b $BRANCH $REPO_URL $TARGET_DIR
    else
        echo "Updating repository..."
        cd $TARGET_DIR
        git checkout $BRANCH
        git pull origin $BRANCH
    fi

    cd $TARGET_DIR
EOF

# 2. Copy local .env and certificates if needed
echo "📤 Transferring configuration files..."
scp ./backend/.env $SERVER_USER@$SERVER_IP:$TARGET_DIR/backend/.env
scp ./backend/betterclinic-f1179-firebase-adminsdk-fbsvc-89ea2e663e.json $SERVER_USER@$SERVER_IP:$TARGET_DIR/backend/

# 3. Finalize deployment
ssh -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_IP << EOF
    cd $TARGET_DIR
    echo "🏗️ Building and starting containers..."
    docker-compose down
    docker-compose up -d --build
    
    echo "✅ Deployment complete!"
    docker-compose ps
EOF
