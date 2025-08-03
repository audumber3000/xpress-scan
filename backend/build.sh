#!/usr/bin/env bash
# Build script for Render deployment

# Install Python dependencies
pip install -r requirements.txt

# Install Playwright browsers
playwright install chromium

echo "Build completed successfully!" 