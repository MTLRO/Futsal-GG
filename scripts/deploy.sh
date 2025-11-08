#!/bin/bash

# Manual Deployment Script
# Use this for manual deployments or testing

set -e

echo "========================================"
echo "Futsal-GG Manual Deployment"
echo "========================================"
echo ""

cd /opt/futsal-gg

# Pull latest changes
echo "[1/5] Pulling latest changes from git..."
git pull origin master

# Build and pull Docker images
echo "[2/5] Building and pulling Docker images..."
docker compose build app
docker compose pull

# Run database migrations
echo "[3/5] Running database migrations..."
docker compose run --rm app npx prisma migrate deploy

# Start/restart services
echo "[4/5] Starting/restarting services..."
docker compose up -d

# Wait for health check
echo "[5/5] Waiting for application to be healthy..."
sleep 10

# Health check
if curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
    echo ""
    echo "========================================"
    echo "Deployment successful!"
    echo "========================================"
    echo ""
    docker compose ps
else
    echo ""
    echo "⚠️  Warning: Health check failed!"
    echo "Check logs with: docker compose logs app"
    exit 1
fi
