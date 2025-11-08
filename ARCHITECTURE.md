# Futsal-GG Architecture Documentation

## 🏛️ System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Layer                          │
│  (Web Browsers, Mobile Devices via Progressive Web App)     │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTPS (Port 443)
                     │
┌────────────────────▼────────────────────────────────────────┐
│                    Nginx Reverse Proxy                       │
│  - SSL/TLS Termination (Let's Encrypt)                      │
│  - Static Asset Caching                                      │
│  - Security Headers                                          │
│  - Request Routing                                           │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTP (Internal: Port 3000)
                     │
┌────────────────────▼────────────────────────────────────────┐
│                Next.js Application Layer                     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  App Router (src/app/)                                │  │
│  │  - API Routes (/api/*)                                │  │
│  │  - Server Components                                  │  │
│  │  - Client Components                                  │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Business Logic Layer                                 │  │
│  │  - ELO Calculator (src/lib/elo-calculator/)          │  │
│  │  - Game Management                                    │  │
│  │  - Player Management                                  │  │
│  │  - Team Management                                    │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Data Access Layer                                    │  │
│  │  - Prisma ORM                                         │  │
│  │  - Database Connection Pooling                        │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────────────────┘
                     │ PostgreSQL Protocol (Internal: Port 5432)
                     │
┌────────────────────▼────────────────────────────────────────┐
│                   PostgreSQL Database                        │
│  - Player Data                                               │
│  - Game History                                              │
│  - Team Compositions                                         │
│  - ELO Ratings & Statistics                                  │
└──────────────────────────────────────────────────────────────┘
```

## 🔧 Technology Stack

### Frontend
- **Framework**: Next.js 15.5.6
  - React 19.1.0 (Server Components, Client Components)
  - App Router
  - TypeScript 5.9.3
- **UI Library**:
  - Radix UI (Accessible components)
  - Tailwind CSS 4 (Utility-first styling)
  - Lucide React (Icons)
- **State Management**:
  - TanStack Query (Server state)
  - React Hooks (Component state)
- **Progressive Web App**:
  - next-pwa 5.6.0

### Backend
- **Runtime**: Node.js 20 LTS
- **Framework**: Next.js API Routes
- **ORM**: Prisma 6.17.1
- **Database**: PostgreSQL 16

### DevOps & Infrastructure
- **Containerization**: Docker + Docker Compose
- **Web Server**: Nginx (Alpine)
- **SSL/TLS**: Let's Encrypt (Certbot)
- **CI/CD**: GitHub Actions
- **Container Registry**: GitHub Container Registry (GHCR)
- **VPS**: Ubuntu (2 vCPU, 8GB RAM, 252GB Storage)

## 📊 Data Model

### Entity Relationship Diagram

```
┌─────────────┐
│   Player    │
├─────────────┤
│ id          │◄─────┐
│ name        │      │
│ lastName    │      │
│ elo         │      │
└─────────────┘      │
                     │
                     │ 1:N
                     │
┌─────────────┐      │
│    Game     │      │
├─────────────┤      │
│ id          │◄──┐  │
│ startTime   │   │  │
│ timePlayed  │   │  │
│ homeTeamElo │   │  │
│ awayTeamElo │   │  │
└─────────────┘   │  │
                  │  │
                  │  │
          N:1     │  │
          ┌───────┘  │
          │          │
┌─────────▼──────────▼─┐
│    TeamPlayer        │
├──────────────────────┤
│ id                   │
│ playerId            │─────┘
│ gameId              │
│ side (HOME/AWAY)    │
│ goals               │
│ deltaELO            │
│ gameInARow          │
└──────────────────────┘

┌─────────────────┐
│ TeamComposition │
├─────────────────┤
│ id              │
│ team (A/B/C)    │
│ playerIds[]     │
└─────────────────┘

┌─────────────┐
│ GameMaster  │
├─────────────┤
│ id          │
│ passwordHash│
│ createdAt   │
│ updatedAt   │
└─────────────┘
```

### Database Indexing Strategy
- **Player**: Index on `(lastName, name)` for fast leaderboard queries
- **TeamPlayer**: Index on `playerId` and `gameId` for relationship lookups
- **Game**: Index on `startDateTime` for chronological queries

## 🎯 API Architecture

### API Routes Structure

```
/api/
├── health/                  # Health check endpoint
│   └── GET                  # Returns system health status
│
├── players/                 # Player management
│   ├── GET                  # List all players
│   ├── POST                 # Create new player
│   └── [id]/
│       ├── GET              # Get player details
│       ├── PUT              # Update player
│       └── DELETE           # Delete player
│
├── games/                   # Game management
│   ├── GET                  # List all games
│   ├── POST                 # Create new game
│   └── [id]/
│       ├── GET              # Get game details
│       ├── PUT              # Update game score
│       └── DELETE           # Delete game
│
├── teams/                   # Team management
│   ├── GET                  # Get team compositions
│   └── POST                 # Update team composition
│
├── leaderboard/            # Leaderboard & statistics
│   └── GET                  # Get ranked players
│
├── scoreboard/             # Live scoreboard
│   └── GET                  # Get current game state
│
└── elo/                    # ELO calculations
    ├── calculate/          # Calculate ELO changes
    └── history/            # Get ELO history
```

### API Design Principles
1. **RESTful**: Follow REST conventions
2. **Type-Safe**: Full TypeScript coverage
3. **Error Handling**: Consistent error responses
4. **Validation**: Input validation on all endpoints
5. **Performance**: Database query optimization with Prisma

## 🧮 ELO Rating System

### Algorithm Design

The ELO calculation system is modular and configurable:

```typescript
// Core Components
┌─────────────────────┐
│  EloCalculator      │  // Main orchestrator
├─────────────────────┤
│ + calculateMatch()  │
│ + updateRatings()   │
└─────────────────────┘
         │
         ├──► ┌─────────────────┐
         │    │  EloParameters  │  // Configuration
         │    ├─────────────────┤
         │    │ - K-factor      │
         │    │ - Fatigue decay │
         │    │ - Goal bonus    │
         │    └─────────────────┘
         │
         ├──► ┌─────────────────┐
         │    │  Team           │  // Team representation
         │    ├─────────────────┤
         │    │ + getAvgELO()   │
         │    │ + getTotalGoals│
         │    └─────────────────┘
         │
         └──► ┌─────────────────┐
              │  Player         │  // Player with ELO
              ├─────────────────┤
              │ + currentELO    │
              │ + fatigueFactor │
              └─────────────────┘
```

### ELO Calculation Formula

```
Expected Score = 1 / (1 + 10^((OpponentELO - PlayerELO) / 400))

New ELO = Old ELO + K * (Actual Score - Expected Score)

Adjustments:
- Fatigue Factor: Reduces K-factor for consecutive games
- Goal Differential Bonus: Additional points for decisive wins
- Team Balance: Considers average team ELO
```

## 🔄 Request Flow

### Typical Game Recording Flow

```
1. User Action (Game Master)
   │
   ├─► Submit game result
   │
2. API Route (/api/games)
   │
   ├─► Validate input data
   │   └─► Check player IDs exist
   │   └─► Validate scores
   │
3. Business Logic Layer
   │
   ├─► Calculate ELO changes
   │   ├─► EloCalculator.calculateMatch()
   │   ├─► Apply fatigue factors
   │   └─► Calculate deltas
   │
4. Data Layer (Prisma)
   │
   ├─► Transaction Begin
   │   ├─► Create Game record
   │   ├─► Create TeamPlayer records
   │   ├─► Update Player ELO ratings
   │   └─► Commit Transaction
   │
5. Response
   │
   └─► Return updated game data + ELO changes
```

## 🐳 Docker Architecture

### Multi-Container Setup

```
Docker Network: futsal-network (Bridge)

┌──────────────────────────────────────────────────┐
│  Nginx Container                                  │
│  - Image: nginx:alpine                            │
│  - Ports: 80:80, 443:443 (External)              │
│  - Volumes: configs, SSL certs                    │
└────────────┬─────────────────────────────────────┘
             │
             │ Proxy Pass
             │
┌────────────▼─────────────────────────────────────┐
│  App Container                                    │
│  - Image: Custom (Multi-stage build)             │
│  - Port: 3000 (Internal only)                    │
│  - Depends on: postgres                          │
│  - Health Check: /api/health                     │
└────────────┬─────────────────────────────────────┘
             │
             │ DATABASE_URL
             │
┌────────────▼─────────────────────────────────────┐
│  PostgreSQL Container                             │
│  - Image: postgres:16-alpine                      │
│  - Port: 5432 (Internal only)                    │
│  - Volume: postgres_data (persistent)            │
│  - Health Check: pg_isready                      │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│  Certbot Container                                │
│  - Image: certbot/certbot                        │
│  - Cron: Auto-renewal every 12h                  │
│  - Volumes: SSL certificates                     │
└──────────────────────────────────────────────────┘
```

### Multi-Stage Docker Build

```dockerfile
Stage 1: deps     → Install dependencies only
Stage 2: builder  → Generate Prisma client + Build Next.js
Stage 3: runner   → Minimal production image (non-root user)
```

**Benefits**:
- Smaller final image (~200MB vs ~1GB)
- Faster builds with layer caching
- Enhanced security (non-root user)
- Separated build and runtime dependencies

## 🔐 Security Architecture

### Security Layers

```
Layer 1: Network Security
├─► Firewall (UFW)
│   ├─► Allow: 22 (SSH), 80 (HTTP), 443 (HTTPS)
│   └─► Deny: All other incoming
├─► Fail2ban (Brute-force protection)
└─► Docker Network Isolation

Layer 2: Transport Security
├─► TLS 1.2/1.3 (Let's Encrypt)
├─► HSTS (Strict-Transport-Security)
└─► Modern cipher suites

Layer 3: Application Security
├─► Security Headers (X-Frame-Options, CSP, etc.)
├─► Input Validation (Prisma, TypeScript)
├─► SQL Injection Prevention (Prisma ORM)
├─► XSS Protection (React auto-escaping)
└─► CSRF Protection (Next.js built-in)

Layer 4: Container Security
├─► Non-root user in containers
├─► Read-only filesystems where possible
├─► No privileged containers
└─► Minimal base images (Alpine Linux)

Layer 5: Data Security
├─► Environment variable secrets
├─► Database connection pooling
├─► Encrypted connections (DATABASE_URL)
└─► Regular automated backups
```

## 📈 Performance Optimizations

### Frontend Performance
1. **Server Components**: Reduce client-side JavaScript
2. **Static Asset Caching**: Nginx caching for `/_next/static/`
3. **Image Optimization**: Next.js automatic optimization
4. **Code Splitting**: Automatic route-based splitting
5. **Progressive Web App**: Offline capability, faster loads

### Backend Performance
1. **Database Indexing**: Strategic indexes on frequently queried columns
2. **Connection Pooling**: Prisma connection management
3. **Query Optimization**: Prisma select/include optimization
4. **Response Compression**: Nginx gzip compression
5. **HTTP/2**: Enabled in Nginx for multiplexing

### Infrastructure Performance
1. **Docker Layer Caching**: Faster builds in CI/CD
2. **Multi-stage Builds**: Smaller images, faster deployments
3. **Health Checks**: Automatic container recovery
4. **Zero-downtime Deployments**: Docker Compose rolling updates

## 🚀 Deployment Pipeline

### CI/CD Workflow

```
Developer Push
      │
      ▼
┌─────────────┐
│  GitHub     │
│  Push Event │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────┐
│  GitHub Actions Workflow             │
├─────────────────────────────────────┤
│  Job 1: Test                         │
│  ├─► Checkout code                   │
│  ├─► Install dependencies            │
│  ├─► Generate Prisma client          │
│  ├─► Run linter                      │
│  └─► Build application               │
│                                       │
│  Job 2: Build & Push (if tests pass) │
│  ├─► Build Docker image              │
│  ├─► Tag: latest, sha, branch        │
│  └─► Push to GHCR                    │
│                                       │
│  Job 3: Deploy (if build succeeds)   │
│  ├─► SSH to VPS                      │
│  ├─► Pull latest image               │
│  ├─► Run migrations                  │
│  ├─► Rolling update                  │
│  └─► Health check                    │
└─────────────────────────────────────┘
       │
       ▼
┌─────────────┐
│  Production │
│  Server     │
└─────────────┘
```

## 🔍 Monitoring & Observability

### Health Monitoring
- **Application Health**: `/api/health` endpoint
  - Database connectivity check
  - Response time measurement
  - Status code: 200 (healthy) / 503 (unhealthy)

- **Container Health**: Docker health checks
  - Nginx: HTTP probe on /health
  - App: Node.js HTTP health check
  - PostgreSQL: pg_isready

### Logging
- **Application Logs**: Docker Compose logs
- **Nginx Access Logs**: Request logging
- **Nginx Error Logs**: Error tracking
- **PostgreSQL Logs**: Database operations

### Maintenance
- **Automated Backups**: Daily database dumps
- **Certificate Renewal**: Automatic (certbot)
- **Security Updates**: Manual (recommended: unattended-upgrades)
- **Log Rotation**: System logrotate

## 📦 Project Structure

```
Futsal-GG/
├── .github/
│   └── workflows/
│       └── deploy.yml              # CI/CD pipeline
├── nginx/
│   ├── nginx.conf                  # Main nginx config
│   └── conf.d/
│       └── default.conf            # Site configuration
├── prisma/
│   └── schema.prisma               # Database schema
├── scripts/
│   ├── vps-initial-setup.sh       # VPS setup automation
│   ├── setup-ssl.sh               # SSL certificate setup
│   ├── deploy.sh                  # Manual deployment
│   ├── backup-db.sh               # Database backup
│   └── init-db.sh                 # DB initialization
├── src/
│   ├── app/                       # Next.js App Router
│   │   ├── api/                   # API routes
│   │   ├── game-master/          # Game master UI
│   │   └── page.tsx              # Landing page
│   ├── components/                # React components
│   └── lib/
│       ├── elo-calculator/       # ELO calculation engine
│       └── prisma.ts             # Prisma client singleton
├── Dockerfile                     # Multi-stage build
├── docker-compose.yml            # Container orchestration
├── .dockerignore                 # Docker build exclusions
├── .env.example                  # Environment template
├── DEPLOYMENT.md                 # Deployment guide
└── ARCHITECTURE.md              # This file
```

## 🎓 Design Decisions & Trade-offs

### Why Next.js App Router?
- **Server Components**: Better performance, reduced bundle size
- **File-based Routing**: Intuitive structure
- **API Routes**: Backend and frontend in one framework
- **TypeScript**: Type safety across stack

### Why Prisma ORM?
- **Type Safety**: Auto-generated types from schema
- **Migrations**: Version-controlled database changes
- **Developer Experience**: Excellent IDE integration
- **Connection Pooling**: Built-in optimization

### Why Docker?
- **Consistency**: Same environment dev to prod
- **Isolation**: Services in separate containers
- **Scalability**: Easy to add more containers
- **Portability**: Deploy anywhere

### Why PostgreSQL?
- **Reliability**: ACID compliance
- **Performance**: Advanced indexing, query optimization
- **Features**: JSON support, full-text search
- **Ecosystem**: Excellent Prisma support

## 🔮 Future Enhancements

### Scalability
- [ ] Redis caching layer
- [ ] Database read replicas
- [ ] CDN integration (Cloudflare)
- [ ] Horizontal app scaling

### Features
- [ ] Real-time updates (WebSocket)
- [ ] Advanced analytics dashboard
- [ ] Mobile native apps
- [ ] Admin panel

### DevOps
- [ ] Kubernetes orchestration
- [ ] Prometheus + Grafana monitoring
- [ ] Automated testing (Jest, Playwright)
- [ ] Blue-green deployments

---

**Document Version**: 1.0.0
**Last Updated**: 2025-11-08
**Maintained By**: Futsal-GG Team
