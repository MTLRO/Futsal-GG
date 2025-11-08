# 🚀 Deployment Steps - Follow These Exactly

## ✅ Build Status: PASSING

Your project is now ready for production deployment!

---

## 📋 Pre-Deployment Checklist

- [x] Docker configuration created
- [x] CI/CD pipeline configured
- [x] Nginx reverse proxy configured
- [x] SSL certificate automation configured
- [x] VPS setup scripts created
- [x] Health check endpoint implemented
- [x] Build passing locally
- [x] Documentation complete

---

## 🎯 Deployment Process

### Step 1: Push to GitHub (2 minutes)

```bash
# Navigate to your project directory
cd C:\Users\aburc\OneDrive\Desktop\Futsal-GG

# Commit all changes
git add .
git commit -m "Add production DevOps infrastructure with Docker, CI/CD, and comprehensive documentation"

# Push to GitHub
git push origin master
```

---

### Step 2: Configure GitHub Secrets (3 minutes)

**Go to:** `https://github.com/MTLRO/Futsal-GG/settings/secrets/actions`

Click **"New repository secret"** and add these three secrets:

| Name | Secret Value | Notes |
|------|--------------|-------|
| `VPS_HOST` | `38.102.86.90` | Your VPS IP |
| `VPS_USERNAME` | `root` | SSH username |
| `VPS_PASSWORD` | `h*6boi8WslQ?` | SSH password |

**Important:** Don't skip this step - the CI/CD pipeline needs these to deploy!

---

### Step 3: Initial VPS Setup (5 minutes)

Open PowerShell or Windows Terminal and SSH to your VPS:

```bash
# SSH to VPS
ssh root@38.102.86.90
# Password: h*6boi8WslQ?

# Once logged in, run these commands:
cd /opt
git clone https://github.com/MTLRO/Futsal-GG.git futsal-gg
cd futsal-gg

# Make scripts executable
chmod +x scripts/*.sh

# Run automated setup (installs Docker, configures firewall, etc.)
./scripts/vps-initial-setup.sh
```

**What this does:**
- ✅ Updates system packages
- ✅ Installs Docker & Docker Compose
- ✅ Configures UFW firewall (ports 22, 80, 443)
- ✅ Sets up fail2ban for security
- ✅ Generates secure random passwords in `.env`

**Time:** ~5 minutes

---

### Step 4: SSL Certificate Setup (3 minutes)

Still on the VPS, run:

```bash
cd /opt/futsal-gg
./scripts/setup-ssl.sh
```

**What this does:**
- ✅ Obtains free SSL certificate from Let's Encrypt
- ✅ Configures auto-renewal (every 12 hours)
- ✅ Sets up HTTPS for your domain

**Time:** ~3 minutes

---

### Step 5: Initial Deployment (2 minutes)

```bash
# Still on VPS
cd /opt/futsal-gg

# Start all services
docker compose up -d

# Wait for services to start (~30 seconds)
sleep 30

# Check status
docker compose ps

# View logs
docker compose logs -f app
# Press Ctrl+C to exit logs
```

---

### Step 6: Verify Deployment (1 minute)

**Test 1: Health Check**
```bash
# From VPS
curl http://localhost:3000/api/health

# Should return:
# {"status":"healthy","timestamp":"...","database":"connected"}
```

**Test 2: External HTTPS Access**

Open your browser and visit:
- **https://server.futsalgg.com** - Should show your landing page
- **https://server.futsalgg.com/api/health** - Should show health status
- **https://server.futsalgg.com/game-master** - Game master interface

---

## 🎉 Deployment Complete!

### What Happens Now?

Every time you push to `master`, GitHub Actions will:
1. ✅ Run tests and linting
2. ✅ Build Docker image
3. ✅ Push to GitHub Container Registry
4. ✅ SSH to your VPS
5. ✅ Pull latest image
6. ✅ Run database migrations
7. ✅ Perform zero-downtime deployment
8. ✅ Run health checks

**You can monitor deployments at:**
`https://github.com/MTLRO/Futsal-GG/actions`

---

## 🔧 Common Commands

### On VPS

```bash
# View application logs
docker compose logs -f app

# View all service logs
docker compose logs -f

# Check service status
docker compose ps

# Restart a service
docker compose restart app

# Stop all services
docker compose down

# Start all services
docker compose up -d

# Manually deploy latest changes
cd /opt/futsal-gg
./scripts/deploy.sh

# Create database backup
./scripts/backup-db.sh

# Access PostgreSQL
docker compose exec postgres psql -U futsalgg -d futsalgg
```

### From Your Local Machine

```bash
# Deploy (just push!)
git push origin master

# Watch deployment
# Go to: https://github.com/MTLRO/Futsal-GG/actions

# SSH to VPS
ssh root@38.102.86.90
```

---

## 🐛 Troubleshooting

### Build Failing on GitHub Actions?

1. Check logs: `GitHub → Actions → Click on failed workflow`
2. Common issues:
   - Missing GitHub secrets (Step 2)
   - TypeScript errors (run `npm run build` locally first)
   - Database connection (check DATABASE_URL in `.env` on VPS)

### Can't Access Site?

```bash
# SSH to VPS
ssh root@38.102.86.90

# Check if services are running
docker compose ps

# Check nginx logs
docker compose logs nginx

# Check app logs
docker compose logs app

# Restart everything
docker compose down
docker compose up -d
```

### SSL Certificate Issues?

```bash
# Check certificate status
docker compose exec certbot certbot certificates

# Force renewal
docker compose run --rm certbot renew --force-renewal

# Restart nginx
docker compose restart nginx
```

### Database Connection Issues?

```bash
# Check if PostgreSQL is running
docker compose ps postgres

# Test connection
docker compose exec postgres pg_isready -U futsalgg

# View database logs
docker compose logs postgres

# Check .env file for correct DATABASE_URL
cat /opt/futsal-gg/.env | grep DATABASE_URL
```

---

## 📊 Monitoring Your Application

### Health Checks

```bash
# Application health
curl https://server.futsalgg.com/api/health

# Container health
docker compose ps

# Resource usage
docker stats
```

### Set Up Daily Backups

```bash
# On VPS, edit crontab
crontab -e

# Add this line (backup at 3 AM daily):
0 3 * * * /opt/futsal-gg/scripts/backup-db.sh >> /var/log/futsal-backup.log 2>&1
```

---

## 🎯 Showing This to Your Employer

### Key Highlights

1. **Full CI/CD Pipeline** - Automated testing and deployment
2. **Docker Containerization** - Production-grade infrastructure
3. **Security** - HTTPS, firewall, fail2ban, security headers
4. **Monitoring** - Health checks, logging, automated backups
5. **Documentation** - Comprehensive guides and architecture docs

### Files to Show

- `README.md` - Professional overview
- `ARCHITECTURE.md` - System design and technical depth
- `DEPLOYMENT.md` - DevOps knowledge
- `.github/workflows/deploy.yml` - CI/CD implementation
- `docker-compose.yml` - Infrastructure as code
- `Dockerfile` - Multi-stage optimization

### Live Demo

- **Production Site**: https://server.futsalgg.com
- **Health Endpoint**: https://server.futsalgg.com/api/health
- **GitHub Actions**: https://github.com/MTLRO/Futsal-GG/actions

---

## 🔐 Security Checklist

After deployment:

- [x] HTTPS enabled (Let's Encrypt)
- [x] Firewall configured (UFW)
- [x] Fail2ban active
- [x] Strong passwords generated
- [x] Environment variables secured
- [x] Non-root Docker containers
- [ ] Change VPS root password (recommended)
- [ ] Set up SSH keys (recommended)
- [ ] Enable 2FA on GitHub (recommended)

---

## 📚 Additional Resources

- **Quick Start**: See [QUICK_START.md](./QUICK_START.md)
- **Full Deployment Guide**: See [DEPLOYMENT.md](./DEPLOYMENT.md)
- **Architecture**: See [ARCHITECTURE.md](./ARCHITECTURE.md)
- **API Docs**: See [API_ENDPOINTS.md](./API_ENDPOINTS.md)

---

## ⏱️ Timeline Summary

| Step | Duration | Status |
|------|----------|--------|
| Push to GitHub | 2 min | ⏳ Pending |
| Configure GitHub Secrets | 3 min | ⏳ Pending |
| VPS Initial Setup | 5 min | ⏳ Pending |
| SSL Setup | 3 min | ⏳ Pending |
| Initial Deployment | 2 min | ⏳ Pending |
| Verify Deployment | 1 min | ⏳ Pending |
| **Total** | **~16 min** | **Ready** |

---

## ✅ Success Criteria

Your deployment is successful when:

- ✅ `https://server.futsalgg.com` loads without SSL warnings
- ✅ `https://server.futsalgg.com/api/health` returns `{"status":"healthy"}`
- ✅ GitHub Actions workflow completes successfully
- ✅ All Docker containers are "healthy" (`docker compose ps`)
- ✅ No errors in logs (`docker compose logs`)

---

## 🆘 Need Help?

1. **Check logs first**: `docker compose logs -f`
2. **Review troubleshooting section** in [DEPLOYMENT.md](./DEPLOYMENT.md)
3. **Check GitHub Actions output** for CI/CD issues
4. **Verify DNS**: `nslookup server.futsalgg.com` should return `38.102.86.90`

---

**Ready to deploy? Start with Step 1! 🚀**

*Created: 2025-11-08*
*Project: Futsal-GG*
*VPS: 38.102.86.90 (server.futsalgg.com)*
