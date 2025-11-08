#!/bin/bash

# Quick script to create .env file with secure passwords
# Run this on VPS if .env file is missing or incomplete

set -e

echo "Creating .env file with secure random passwords..."

# Generate secure passwords
POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
NEXTAUTH_SECRET=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
APP_SECRET=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)

# Create .env file
cat > .env << EOF
# Production Environment Variables
# Generated: $(date)

# Database Configuration
POSTGRES_USER=futsalgg
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=futsalgg

# Application Configuration
NODE_ENV=production
DATABASE_URL=postgresql://futsalgg:${POSTGRES_PASSWORD}@postgres:5432/futsalgg?schema=public&connection_limit=10&pool_timeout=20

# NextAuth Configuration
NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
NEXTAUTH_URL=https://futsalgg.com

# Application Secrets
APP_SECRET=${APP_SECRET}
EOF

chmod 600 .env

echo ""
echo "✅ .env file created successfully!"
echo ""
echo "⚠️  IMPORTANT: Secure passwords have been generated."
echo "    The .env file contains sensitive information."
echo ""
echo "Generated passwords are stored in: $(pwd)/.env"
echo ""
