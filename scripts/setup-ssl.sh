#!/bin/bash

# SSL Certificate Setup Script
# Run this after initial VPS setup

set -e

echo "========================================"
echo "SSL Certificate Setup"
echo "========================================"
echo ""

DOMAIN="futsalgg.com"
EMAIL="admin@futsalgg.com"  # Change this to your email

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo "This script must be run as root"
   exit 1
fi

cd /opt/futsal-gg

# Create temporary nginx config for initial certificate
echo "Creating temporary nginx configuration for certificate generation..."
cat > nginx/conf.d/temp.conf << 'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name server.futsalgg.com;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 200 "Temporary server for SSL setup";
        add_header Content-Type text/plain;
    }
}
EOF

# Start nginx temporarily
echo "Starting nginx temporarily..."
docker compose up -d nginx

# Wait for nginx to be ready
sleep 5

# Request SSL certificate
echo "Requesting SSL certificate from Let's Encrypt..."
docker compose run --rm certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email $EMAIL \
    --agree-tos \
    --no-eff-email \
    -d $DOMAIN

# Remove temporary config
rm nginx/conf.d/temp.conf

# Restart nginx with proper config
echo "Restarting nginx with SSL configuration..."
docker compose restart nginx

echo ""
echo "========================================"
echo "SSL Certificate setup completed!"
echo "========================================"
echo ""
echo "Your site should now be accessible at: https://$DOMAIN"
echo ""
echo "SSL certificates will auto-renew via the certbot container."
echo ""
