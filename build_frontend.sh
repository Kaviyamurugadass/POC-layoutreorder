#!/bin/bash
set -e  # Exit on any error

echo "Current directory: $(pwd)"
echo "Listing current directory:"
ls -la

echo "Checking if frontend directory exists:"
if [ -d "frontend" ]; then
    echo "Frontend directory found"
    cd frontend
elif [ -d "../frontend" ]; then
    echo "Frontend directory found in parent directory"
    cd ../frontend
else
    echo "ERROR: Frontend directory not found"
    echo "Available directories:"
    ls -la
    exit 1
fi

echo "In frontend directory: $(pwd)"
echo "Installing dependencies..."
npm install

echo "Building frontend..."
npm run build

echo "Build completed successfully"
