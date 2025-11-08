# ⚽ Futsal-GG

A professional futsal league management system with ELO rating calculations, built with Next.js, Prisma, and PostgreSQL. Features industry-standard DevOps practices including Docker containerization and automated CI/CD deployment.

## 🌟 Features

- **📊 ELO Rating System**: Advanced player ranking with fatigue factors and goal differential bonuses
- **🎮 Game Management**: Track matches, scores, and player performance
- **👥 Team Composition**: Dynamic team balancing and management
- **📈 Leaderboard**: Real-time player rankings and statistics
- **🎯 Progressive Web App**: Installable, offline-capable mobile experience
- **🔐 Secure Deployment**: HTTPS with Let's Encrypt, Docker containerization
- **🚀 Automated CI/CD**: GitHub Actions for continuous deployment

## 🏗️ Tech Stack

### Frontend
- **Next.js 15.5.6** - React framework with App Router
- **React 19** - UI library with Server Components
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **Radix UI** - Accessible component primitives
- **TanStack Query** - Server state management

### Backend
- **Next.js API Routes** - RESTful API endpoints
- **Prisma 6.17.1** - Type-safe ORM
- **PostgreSQL 16** - Relational database
- **Bcrypt** - Password hashing

### DevOps
- **Docker** - Containerization
- **Docker Compose** - Multi-container orchestration
- **Nginx** - Reverse proxy and SSL termination
- **Let's Encrypt** - Free SSL certificates
- **GitHub Actions** - CI/CD pipeline
- **GitHub Container Registry** - Docker image storage

## 🚀 Quick Start

### Local Development

```bash
# Clone repository
git clone https://github.com/YOUR_USERNAME/Futsal-GG.git
cd Futsal-GG

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database credentials

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# Seed database (optional)
npx prisma db seed

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

### Production Deployment

See [QUICK_START.md](./QUICK_START.md) for step-by-step VPS deployment guide (15 minutes).

Full deployment documentation: [DEPLOYMENT.md](./DEPLOYMENT.md)

## 📚 Documentation

- **[QUICK_START.md](./QUICK_START.md)** - Deploy to VPS in 5 steps (~15 min)
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Complete deployment guide with troubleshooting
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System architecture and design decisions
- **[API_ENDPOINTS.md](./API_ENDPOINTS.md)** - API documentation
- **[APPLICATION_LOGIC.md](./APPLICATION_LOGIC.md)** - Business logic documentation

## 🎯 Project Structure

```
Futsal-GG/
├── .github/workflows/     # CI/CD pipelines
├── nginx/                 # Nginx configuration
├── prisma/                # Database schema & migrations
├── scripts/               # Deployment & maintenance scripts
├── src/
│   ├── app/              # Next.js App Router
│   │   ├── api/          # API routes
│   │   ├── game-master/  # Game management UI
│   │   └── page.tsx      # Landing page (Leaderboard)
│   ├── components/       # React components
│   └── lib/
│       ├── elo-calculator/  # ELO calculation engine
│       └── prisma.ts        # Prisma client
├── Dockerfile            # Multi-stage Docker build
├── docker-compose.yml    # Container orchestration
└── README.md            # This file
```

## 🔧 Available Scripts

### Development

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm start        # Start production server
npm run lint     # Run ESLint
```

### Database

```bash
npx prisma generate        # Generate Prisma Client
npx prisma migrate dev     # Run migrations (development)
npx prisma migrate deploy  # Run migrations (production)
npx prisma studio          # Open Prisma Studio GUI
```

### Docker (Production)

```bash
docker compose up -d       # Start all services
docker compose down        # Stop all services
docker compose logs -f     # View logs
docker compose ps          # Check status
```

## 🐳 Docker Services

| Service | Description | Port |
|---------|-------------|------|
| **nginx** | Reverse proxy with SSL | 80, 443 |
| **app** | Next.js application | 3000 (internal) |
| **postgres** | PostgreSQL database | 5432 (internal) |
| **certbot** | SSL certificate management | - |

## 📊 Database Schema

### Main Entities

- **Player** - Player information and ELO rating
- **Game** - Match records with timestamps and team averages
- **TeamPlayer** - Player participation in games with stats
- **TeamComposition** - Team roster management
- **GameMaster** - Admin authentication

See [prisma/schema.prisma](./prisma/schema.prisma) for full schema.

## 🎮 ELO Calculation System

The ELO system considers:
- Team average ELO difference
- Game outcome (win/loss)
- Goal differential bonus
- Fatigue factor (consecutive games)
- Configurable K-factor

Implementation: [src/lib/elo-calculator/](./src/lib/elo-calculator/)

## 🔐 Environment Variables

Create a `.env` file in the root directory:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/futsalgg"

# Application
NODE_ENV="development"
NEXTAUTH_SECRET="your-secret-here"
NEXTAUTH_URL="http://localhost:3000"
```

See [.env.example](./.env.example) for all available options.

## 🚀 CI/CD Pipeline

Every push to `master` triggers:

1. **Test Job**
   - Install dependencies
   - Generate Prisma Client
   - Run linter
   - Build application

2. **Build & Push Job**
   - Build Docker image (multi-stage)
   - Tag with branch, SHA, and latest
   - Push to GitHub Container Registry

3. **Deploy Job**
   - SSH to VPS
   - Pull latest image
   - Run database migrations
   - Rolling update (zero-downtime)
   - Health check verification

Workflow: [.github/workflows/deploy.yml](./.github/workflows/deploy.yml)

## 🏆 Key Features for Employers

This project demonstrates:

✅ **Modern Full-Stack Development**
- Next.js 15 with App Router and Server Components
- TypeScript for type safety
- Prisma ORM for type-safe database access

✅ **Professional DevOps Practices**
- Docker multi-stage builds for optimized images
- Docker Compose for service orchestration
- Nginx reverse proxy with SSL termination
- Automated SSL certificate management

✅ **CI/CD Implementation**
- GitHub Actions automated pipeline
- Automated testing and linting
- Containerized deployments
- Zero-downtime updates

✅ **Security Best Practices**
- HTTPS/TLS encryption
- Environment variable management
- Non-root Docker containers
- Firewall configuration
- Fail2ban brute-force protection

✅ **Production-Ready Architecture**
- Health check endpoints
- Database connection pooling
- Automated backups
- Proper error handling
- Comprehensive logging

✅ **Documentation**
- Architecture documentation
- Deployment guides
- API documentation
- Code comments
- Troubleshooting guides

## 📈 Performance Optimizations

- **Frontend**: Server Components, static asset caching, code splitting
- **Backend**: Database indexing, connection pooling, query optimization
- **Infrastructure**: HTTP/2, gzip compression, CDN-ready

## 🛡️ Security Features

- SSL/TLS with Let's Encrypt
- Firewall (UFW) configuration
- Fail2ban for brute-force protection
- Security headers (HSTS, CSP, X-Frame-Options)
- Docker network isolation
- Prisma SQL injection prevention

## 🔄 Automated Tasks

- **SSL Renewal**: Every 12 hours via certbot
- **Health Checks**: Every 30 seconds
- **Database Backups**: Daily at 3 AM (configurable)
- **Deployment**: On every push to master

## 🆘 Troubleshooting

Common issues and solutions:

```bash
# View application logs
docker compose logs -f app

# Restart services
docker compose restart

# Database connection issues
docker compose exec postgres pg_isready

# SSL certificate issues
docker compose exec certbot certbot certificates

# Full system restart
docker compose down && docker compose up -d
```

See [DEPLOYMENT.md](./DEPLOYMENT.md#troubleshooting) for detailed troubleshooting.

## 📝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the ISC License.

## 👤 Author

Built with ❤️ to showcase full-stack development and DevOps skills.

## 🔗 Links

- **Live Demo**: https://server.futsalgg.com
- **Repository**: https://github.com/MTLRO/Futsal-GG
- **Documentation**: See `/docs` folder

---

**Built with Next.js** | **Deployed with Docker** | **Automated with GitHub Actions**
