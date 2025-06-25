#!/bin/bash
set -e  # Exit on any error

echo "Current directory: $(pwd)"
echo "Listing current directory:"
ls -la

# Try to find the frontend directory from different possible locations
FRONTEND_DIR=""

if [ -d "frontend" ]; then
    FRONTEND_DIR="frontend"
    echo "Frontend directory found in current directory"
elif [ -d "../frontend" ]; then
    FRONTEND_DIR="../frontend"
    echo "Frontend directory found in parent directory"
elif [ -d "../../frontend" ]; then
    FRONTEND_DIR="../../frontend"
    echo "Frontend directory found in grandparent directory"
else
    echo "ERROR: Frontend directory not found"
    echo "Available directories:"
    ls -la
    if [ -d ".." ]; then
        echo "Parent directory contents:"
        ls -la ..
    fi
    if [ -d "../.." ]; then
        echo "Grandparent directory contents:"
        ls -la ../..
    fi
    exit 1
fi

echo "Changing to frontend directory: $FRONTEND_DIR"
cd "$FRONTEND_DIR"

echo "In frontend directory: $(pwd)"
echo "Frontend directory contents:"
ls -la

echo "Installing dependencies..."
npm install

echo "Building frontend..."
npm run build

echo "Build completed successfully"
