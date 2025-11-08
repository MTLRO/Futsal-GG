#!/bin/bash

# VPS Initial Setup Script for Futsal-GG
# Run this script on your VPS as root user

set -e

echo "========================================"
echo "Futsal-GG VPS Initial Setup"
echo "========================================"
echo ""

# Update system packages
echo "[1/8] Updating system packages..."
apt-get update
apt-get upgrade -y

# Install essential tools
echo "[2/8] Installing essential tools..."
apt-get install -y \
    curl \
    wget \
    git \
    vim \
    htop \
    ufw \
    fail2ban \
    ca-certificates \
    gnupg \
    lsb-release

# Install Docker
echo "[3/8] Installing Docker..."
if ! command -v docker &> /dev/null; then
    # Add Docker's official GPG key
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg

    # Set up Docker repository
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

    # Install Docker Engine
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    # Start and enable Docker
    systemctl start docker
    systemctl enable docker

    echo "Docker installed successfully!"
else
    echo "Docker is already installed."
fi

# Configure firewall
echo "[4/8] Configuring firewall (UFW)..."
ufw --force enable
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw status

# Configure fail2ban
echo "[5/8] Configuring fail2ban..."
systemctl start fail2ban
systemctl enable fail2ban

# Create application directory
echo "[6/8] Creating application directory..."
mkdir -p /opt/futsal-gg
cd /opt/futsal-gg

# Set up Git repository
echo "[7/8] Setting up Git repository..."
if [ ! -d ".git" ]; then
    read -p "Enter your GitHub repository URL (e.g., git@github.com:username/Futsal-GG.git): " REPO_URL

    # Configure Git
    git config --global user.name "Futsal-GG Deploy"
    git config --global user.email "deploy@futsalgg.com"

    # Clone repository
    git clone "$REPO_URL" .

    echo "Repository cloned successfully!"
else
    echo "Git repository already exists."
fi

# Create necessary directories
echo "[8/8] Creating necessary directories..."
mkdir -p certbot/conf certbot/www nginx/conf.d

# Set up environment file
if [ ! -f ".env" ]; then
    echo "Creating .env file from template..."
    cp .env.production .env

    # Generate secure passwords
    POSTGRES_PASSWORD=$(openssl rand -base64 32)
    NEXTAUTH_SECRET=$(openssl rand -base64 32)
    APP_SECRET=$(openssl rand -base64 32)

    # Update .env file with generated secrets
    sed -i "s/CHANGE_THIS_TO_SECURE_PASSWORD/$POSTGRES_PASSWORD/g" .env
    sed -i "s/GENERATE_WITH_openssl_rand_base64_32/$NEXTAUTH_SECRET/g" .env
    sed -i "s/GENERATE_RANDOM_SECRET_HERE/$APP_SECRET/g" .env

    echo ""
    echo "Environment file created with secure random passwords!"
    echo "⚠️  IMPORTANT: The .env file contains sensitive information."
    echo "    Please review and update if necessary: /opt/futsal-gg/.env"
fi

echo ""
echo "========================================"
echo "Initial setup completed successfully!"
echo "========================================"
echo ""
echo "Next steps:"
echo "1. Run: ./scripts/setup-ssl.sh (to set up SSL certificates)"
echo "2. Configure GitHub Actions secrets (see DEPLOYMENT.md)"
echo "3. Push code to trigger automatic deployment"
echo ""
echo "Manual deployment: docker compose up -d"
echo ""
