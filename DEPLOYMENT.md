# Futsal-GG Deployment Guide

Complete guide for deploying Futsal-GG to a VPS with Docker, CI/CD, and industry-standard DevOps practices.

## 📋 Table of Contents

- [Architecture Overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [VPS Initial Setup](#vps-initial-setup)
- [SSL Certificate Setup](#ssl-certificate-setup)
- [GitHub Actions CI/CD Setup](#github-actions-cicd-setup)
- [Manual Deployment](#manual-deployment)
- [Monitoring & Maintenance](#monitoring--maintenance)
- [Troubleshooting](#troubleshooting)

## 🏗️ Architecture Overview

### Technology Stack
- **Application**: Next.js 15.5.6 (React 19, TypeScript)
- **Database**: PostgreSQL 16 (Dockerized)
- **ORM**: Prisma 6.17.1
- **Web Server**: Nginx (Reverse Proxy)
- **SSL**: Let's Encrypt (Certbot)
- **Container Orchestration**: Docker Compose
- **CI/CD**: GitHub Actions

### Infrastructure
```
Internet
   ↓
[VPS - 38.102.86.90]
   ↓
[Nginx Reverse Proxy] → SSL/TLS Termination
   ↓
[Next.js Application] → Port 3000 (Internal)
   ↓
[PostgreSQL Database] → Port 5432 (Internal)
```

### Docker Services
1. **nginx** - Reverse proxy with SSL termination (Ports: 80, 443)
2. **app** - Next.js application (Internal: 3000)
3. **postgres** - PostgreSQL database (Internal: 5432)
4. **certbot** - SSL certificate management

## 📦 Prerequisites

### VPS Requirements
- **OS**: Ubuntu 20.04 LTS or newer
- **RAM**: 8 GB (as per your VPS spec)
- **CPU**: 2 Cores (as per your VPS spec)
- **Disk**: 252 GB (as per your VPS spec)
- **IP**: 38.102.86.90 (server.futsalgg.com)

### Local Requirements
- Git
- SSH access to VPS
- GitHub account with repository access

### Domain Configuration
Ensure `server.futsalgg.com` points to `38.102.86.90`:
```bash
# Verify DNS
nslookup server.futsalgg.com
# Should return: 38.102.86.90
```

## 🚀 VPS Initial Setup

### Step 1: Connect to VPS

```bash
# From your local machine
ssh root@38.102.86.90
# Password: h*6boi8WslQ?
```

### Step 2: Run Initial Setup Script

```bash
# Download and run the setup script
curl -o setup.sh https://raw.githubusercontent.com/YOUR_USERNAME/Futsal-GG/master/scripts/vps-initial-setup.sh
chmod +x setup.sh
./setup.sh
```

This script will:
- ✅ Update system packages
- ✅ Install Docker and Docker Compose
- ✅ Configure firewall (UFW)
- ✅ Set up fail2ban for security
- ✅ Clone your repository to `/opt/futsal-gg`
- ✅ Generate secure environment variables

### Step 3: Verify Installation

```bash
# Check Docker
docker --version
docker compose version

# Check firewall
ufw status

# Check application directory
cd /opt/futsal-gg
ls -la
```

## 🔒 SSL Certificate Setup

### Step 1: Run SSL Setup Script

```bash
cd /opt/futsal-gg
chmod +x scripts/setup-ssl.sh
./scripts/setup-ssl.sh
```

### Step 2: Verify SSL Certificate

```bash
# Check certificate files
ls -la /opt/futsal-gg/certbot/conf/live/server.futsalgg.com/

# Test HTTPS
curl https://server.futsalgg.com/api/health
```

### Certificate Auto-Renewal
The `certbot` container automatically renews certificates every 12 hours.

## 🔄 GitHub Actions CI/CD Setup

### Step 1: Configure GitHub Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions

Add the following secrets:

| Secret Name | Value | Description |
|------------|-------|-------------|
| `VPS_HOST` | `38.102.86.90` | Your VPS IP address |
| `VPS_USERNAME` | `root` | SSH username |
| `VPS_PASSWORD` | `h*6boi8WslQ?` | SSH password (or use SSH key) |

**Security Note**: For production, use SSH keys instead of passwords:
```bash
# On your VPS
mkdir -p ~/.ssh
echo "YOUR_PUBLIC_KEY" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

### Step 2: Enable GitHub Container Registry

1. Go to GitHub Settings → Developer settings → Personal access tokens
2. Generate a token with `write:packages` permission
3. The workflow uses `GITHUB_TOKEN` automatically

### Step 3: Trigger Deployment

```bash
# From your local machine
git add .
git commit -m "Initial deployment setup"
git push origin master
```

This will trigger the CI/CD pipeline:
1. ✅ Run tests
2. ✅ Build Docker image
3. ✅ Push to GitHub Container Registry
4. ✅ Deploy to VPS
5. ✅ Run health checks

### Step 4: Monitor Deployment

View the deployment status:
- GitHub → Actions tab
- Watch the "Deploy to VPS" workflow

## 🛠️ Manual Deployment

If you need to deploy manually (without CI/CD):

```bash
# SSH into VPS
ssh root@38.102.86.90

# Navigate to application directory
cd /opt/futsal-gg

# Run deployment script
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

### Manual Docker Commands

```bash
# Pull latest changes
git pull origin master

# Build and start services
docker compose up -d --build

# View logs
docker compose logs -f app

# Check status
docker compose ps

# Run migrations
docker compose exec app npx prisma migrate deploy

# Restart specific service
docker compose restart app
```

## 📊 Monitoring & Maintenance

### View Application Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f app
docker compose logs -f postgres
docker compose logs -f nginx

# Last 100 lines
docker compose logs --tail=100 app
```

### Health Checks

```bash
# Application health
curl http://localhost:3000/api/health

# External health check
curl https://server.futsalgg.com/api/health

# Docker container health
docker compose ps
```

### Database Management

```bash
# Access PostgreSQL
docker compose exec postgres psql -U futsalgg -d futsalgg

# Create backup
./scripts/backup-db.sh

# Restore from backup
gunzip < backups/futsal_gg_backup_TIMESTAMP.sql.gz | \
  docker compose exec -T postgres psql -U futsalgg -d futsalgg
```

### Automated Backups (Cron)

```bash
# Edit crontab
crontab -e

# Add daily backup at 3 AM
0 3 * * * /opt/futsal-gg/scripts/backup-db.sh >> /var/log/futsal-backup.log 2>&1
```

### Update Application

```bash
# Via CI/CD (recommended)
git push origin master

# Manual update
cd /opt/futsal-gg
git pull origin master
docker compose up -d --build app
```

### Database Migrations

```bash
# Apply migrations
docker compose exec app npx prisma migrate deploy

# Create new migration (development)
docker compose exec app npx prisma migrate dev --name migration_name

# Reset database (⚠️ DANGEROUS - deletes all data)
docker compose exec app npx prisma migrate reset
```

## 🔧 Troubleshooting

### Container Won't Start

```bash
# Check logs
docker compose logs app

# Rebuild container
docker compose down
docker compose up -d --build

# Remove volumes and restart (⚠️ deletes data)
docker compose down -v
docker compose up -d
```

### Database Connection Issues

```bash
# Check if PostgreSQL is running
docker compose ps postgres

# Check database logs
docker compose logs postgres

# Verify DATABASE_URL in .env
cat /opt/futsal-gg/.env | grep DATABASE_URL

# Test connection
docker compose exec postgres pg_isready -U futsalgg
```

### SSL Certificate Issues

```bash
# Check certificate expiration
docker compose exec certbot certbot certificates

# Force certificate renewal
docker compose run --rm certbot renew --force-renewal

# Restart nginx after renewal
docker compose restart nginx
```

### Performance Issues

```bash
# Check resource usage
docker stats

# Check system resources
htop
df -h

# Check nginx access logs
docker compose logs nginx | grep -v "GET /api/health"

# Optimize Docker images
docker system prune -a
```

### Port Conflicts

```bash
# Check what's using port 80/443
netstat -tulpn | grep :80
netstat -tulpn | grep :443

# Kill process using port
kill -9 <PID>
```

## 🔐 Security Best Practices

### Implemented Security Features
- ✅ HTTPS/TLS encryption (Let's Encrypt)
- ✅ Firewall configuration (UFW)
- ✅ Fail2ban for brute-force protection
- ✅ Non-root user in Docker containers
- ✅ Security headers in Nginx
- ✅ Environment variables for secrets
- ✅ Database connection pooling

### Additional Recommendations

1. **Change default passwords**
   ```bash
   vim /opt/futsal-gg/.env
   # Update POSTGRES_PASSWORD and other secrets
   docker compose up -d --force-recreate
   ```

2. **Use SSH keys instead of passwords**
   ```bash
   ssh-copy-id root@38.102.86.90
   ```

3. **Enable automatic security updates**
   ```bash
   apt-get install unattended-upgrades
   dpkg-reconfigure -plow unattended-upgrades
   ```

4. **Regular backups**
   - Set up automated database backups (cron job)
   - Store backups off-site (S3, cloud storage)

5. **Monitor logs**
   ```bash
   # Set up log rotation
   vim /etc/logrotate.d/futsal-gg
   ```

## 📈 Scaling Considerations

For future growth:

1. **Horizontal Scaling**: Add more app containers
   ```yaml
   app:
     deploy:
       replicas: 3
   ```

2. **Database Optimization**: Connection pooling, read replicas

3. **CDN Integration**: Cloudflare or similar for static assets

4. **Container Orchestration**: Consider Kubernetes for multi-server setups

5. **Monitoring**: Integrate Prometheus + Grafana

## 📞 Support & Resources

- **Repository**: https://github.com/YOUR_USERNAME/Futsal-GG
- **Docker Documentation**: https://docs.docker.com
- **Next.js Deployment**: https://nextjs.org/docs/deployment
- **Prisma Deployment**: https://www.prisma.io/docs/guides/deployment
- **Let's Encrypt**: https://letsencrypt.org/docs/

## 🎯 Quick Reference Commands

```bash
# Start all services
docker compose up -d

# Stop all services
docker compose down

# View logs
docker compose logs -f

# Restart application
docker compose restart app

# Run migrations
docker compose exec app npx prisma migrate deploy

# Access database
docker compose exec postgres psql -U futsalgg -d futsalgg

# Create backup
./scripts/backup-db.sh

# Deploy latest changes
./scripts/deploy.sh

# Check health
curl https://server.futsalgg.com/api/health
```

---

**Last Updated**: 2025-11-08
**Version**: 1.0.0
