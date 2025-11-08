# Futsal-GG Quick Start Guide

## 🚀 Deploy to VPS in 5 Steps

### Prerequisites
- VPS running Ubuntu 20.04+ (Your VPS: `38.102.86.90`)
- Domain pointing to VPS (`server.futsalgg.com` → `38.102.86.90`)
- GitHub account with repository access

---

## Step 1: Initial VPS Setup (5 minutes)

SSH into your VPS:
```bash
ssh root@38.102.86.90
# Password: h*6boi8WslQ?
```

Run the automated setup script:
```bash
cd /opt
git clone https://github.com/YOUR_USERNAME/Futsal-GG.git futsal-gg
cd futsal-gg
chmod +x scripts/vps-initial-setup.sh
./scripts/vps-initial-setup.sh
```

This installs Docker, configures firewall, and sets up the application.

---

## Step 2: SSL Certificate Setup (3 minutes)

```bash
cd /opt/futsal-gg
chmod +x scripts/setup-ssl.sh
./scripts/setup-ssl.sh
```

This obtains a free SSL certificate from Let's Encrypt.

---

## Step 3: Configure Environment (2 minutes)

Edit the `.env` file created by the setup script:
```bash
vim /opt/futsal-gg/.env
```

The script auto-generates secure passwords. Verify they look correct.

---

## Step 4: GitHub Actions Setup (3 minutes)

On GitHub, go to: **Repository → Settings → Secrets → Actions**

Add these secrets:

| Secret | Value |
|--------|-------|
| `VPS_HOST` | `38.102.86.90` |
| `VPS_USERNAME` | `root` |
| `VPS_PASSWORD` | `h*6boi8WslQ?` |

---

## Step 5: Deploy! (1 minute)

From your local machine:
```bash
git add .
git commit -m "Initial deployment setup"
git push origin master
```

GitHub Actions will automatically:
1. ✅ Run tests
2. ✅ Build Docker image
3. ✅ Deploy to VPS
4. ✅ Run migrations
5. ✅ Start services

---

## ✅ Verify Deployment

Visit: **https://server.futsalgg.com**

Check health: **https://server.futsalgg.com/api/health**

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-11-08T...",
  "database": "connected"
}
```

---

## 🎯 Common Commands

### On VPS

```bash
# View logs
docker compose logs -f

# Restart application
docker compose restart app

# Check status
docker compose ps

# Manual deploy
cd /opt/futsal-gg && ./scripts/deploy.sh

# Backup database
./scripts/backup-db.sh

# Access database
docker compose exec postgres psql -U futsalgg -d futsalgg
```

### From Local Machine

```bash
# Deploy (push triggers CI/CD)
git push origin master

# SSH to VPS
ssh root@38.102.86.90

# View deployment status
# Go to: GitHub → Actions tab
```

---

## 🐛 Troubleshooting

### Deployment Failed?
```bash
# SSH to VPS
ssh root@38.102.86.90

# Check logs
cd /opt/futsal-gg
docker compose logs app

# Restart services
docker compose down
docker compose up -d
```

### Database Issues?
```bash
# Check database status
docker compose exec postgres pg_isready -U futsalgg

# View database logs
docker compose logs postgres

# Restart database
docker compose restart postgres
```

### SSL Certificate Issues?
```bash
# Check certificate
docker compose exec certbot certbot certificates

# Renew certificate
docker compose run --rm certbot renew --force-renewal
docker compose restart nginx
```

### Container Won't Start?
```bash
# View detailed logs
docker compose logs <service_name>

# Rebuild and restart
docker compose down
docker compose up -d --build
```

---

## 📚 Full Documentation

- **Deployment Guide**: See [DEPLOYMENT.md](./DEPLOYMENT.md)
- **Architecture**: See [ARCHITECTURE.md](./ARCHITECTURE.md)
- **API Documentation**: See [API_ENDPOINTS.md](./API_ENDPOINTS.md)

---

## 🔐 Security Checklist

After deployment, ensure:

- [x] Firewall enabled (ports 22, 80, 443 only)
- [x] SSL certificate active (HTTPS)
- [x] Strong passwords in `.env` file
- [x] Fail2ban running for brute-force protection
- [ ] Change VPS root password (recommended)
- [ ] Set up SSH keys (disable password auth)
- [ ] Configure automated backups (cron job)

### Recommended: Set up SSH keys

```bash
# On your local machine
ssh-keygen -t ed25519 -C "your_email@example.com"

# Copy to VPS
ssh-copy-id root@38.102.86.90

# Test SSH key login
ssh root@38.102.86.90

# Disable password authentication (optional)
# On VPS: edit /etc/ssh/sshd_config
# Set: PasswordAuthentication no
# Then: systemctl restart sshd
```

---

## 🎉 What's Next?

### Add Daily Database Backups

```bash
# On VPS
crontab -e

# Add this line (backup at 3 AM daily):
0 3 * * * /opt/futsal-gg/scripts/backup-db.sh >> /var/log/futsal-backup.log 2>&1
```

### Monitor Your Application

```bash
# Watch logs in real-time
docker compose logs -f app

# Check resource usage
docker stats

# View system resources
htop
```

### Make Changes

1. Edit code locally
2. Commit and push: `git push origin master`
3. GitHub Actions automatically deploys
4. Check deployment: GitHub → Actions tab

---

## 📊 Key Endpoints

| Endpoint | Purpose |
|----------|---------|
| `/` | Landing page (Leaderboard) |
| `/game-master` | Game management interface |
| `/api/health` | Health check |
| `/api/leaderboard` | Player rankings |
| `/api/games` | Game management |
| `/api/players` | Player management |

---

## 💡 Pro Tips

1. **Always check logs first**: `docker compose logs -f`
2. **Use health checks**: `curl https://server.futsalgg.com/api/health`
3. **Backup before major changes**: `./scripts/backup-db.sh`
4. **Monitor GitHub Actions**: Check build status after every push
5. **Keep documentation updated**: Update README when adding features

---

## 🆘 Need Help?

1. Check logs: `docker compose logs -f`
2. Review [DEPLOYMENT.md](./DEPLOYMENT.md)
3. Check GitHub Actions build output
4. Verify environment variables in `.env`
5. Ensure domain DNS is correct: `nslookup server.futsalgg.com`

---

## 📝 Deployment Checklist

Before showing to employer:

- [ ] Application accessible via HTTPS
- [ ] Health check returns 200 OK
- [ ] No errors in logs
- [ ] Database connected and populated
- [ ] GitHub Actions workflow passing
- [ ] CI/CD pipeline documented
- [ ] Architecture documented
- [ ] Code properly commented
- [ ] `.env` file secured (not committed to git)
- [ ] SSL certificate active and auto-renewing

---

**Time to Deploy**: ~15 minutes total
**Difficulty**: Beginner-friendly (automated scripts)
**Maintenance**: Mostly automated (CI/CD, SSL renewal, health checks)

---

*Last Updated: 2025-11-08*
