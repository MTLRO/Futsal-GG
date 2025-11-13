# Developer Documentation

This document provides an overview of the project structure, technology stack, and guidelines for navigating the codebase.

## Technology Stack

### Core Framework
- **Next.js 15** - React-based full-stack framework
- **React 19** - UI library
- **TypeScript** - Type-safe JavaScript

### Database & ORM
- **PostgreSQL** - Primary database
- **Prisma** - Modern ORM for type-safe database access

### Styling & UI
- **Tailwind CSS** - Utility-first CSS framework
- **shadcn/ui** - Reusable component library built on Radix UI
- **Lucide React** - Icon library

### State Management & Data Fetching
- **TanStack Query (React Query)** - Server state management and caching

### Development Tools
- **ESLint** - Code linting with TypeScript support
- **Docker** - Containerization for deployment

## Project Structure

```
Futsal-GG/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/                # API routes (backend endpoints)
│   │   │   ├── auth/           # Authentication endpoints
│   │   │   ├── elo/            # ELO calculation endpoints
│   │   │   ├── games/          # Game management endpoints
│   │   │   ├── leaderboard/    # Leaderboard data
│   │   │   ├── players/        # Player management
│   │   │   ├── scoreboard/     # Scoreboard with filters
│   │   │   └── teams/          # Team generation
│   │   ├── game-master/        # Game master interface page
│   │   ├── layout.tsx          # Root layout with metadata
│   │   ├── page.tsx            # Home page (main scoreboard)
│   │   └── error.tsx           # Error boundary
│   │
│   ├── components/             # React components
│   │   ├── ui/                 # shadcn/ui base components
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── input.tsx
│   │   │   └── ...
│   │   ├── providers/          # Context providers
│   │   │   └── query-provider.tsx
│   │   ├── add-game-modal.tsx
│   │   ├── add-player-modal.tsx
│   │   ├── change-teams-modal.tsx
│   │   ├── game-history-modal.tsx
│   │   ├── player-game-history-modal.tsx
│   │   └── scoreboard-table.tsx
│   │
│   └── lib/                    # Utility functions and shared code
│       ├── elo-calculator/     # ELO calculation logic
│       │   ├── elo-calculator.ts
│       │   ├── types.ts
│       │   └── constants.ts
│       ├── prisma.ts           # Prisma client singleton
│       └── utils.ts            # Helper functions (cn, etc.)
│
├── prisma/
│   ├── schema.prisma           # Database schema definition
│   ├── seed.ts                 # Database seeding script
│   └── migrations/             # Database migrations
│
├── public/                     # Static assets
│
└── Configuration files
    ├── next.config.ts          # Next.js configuration
    ├── tailwind.config.ts      # Tailwind CSS configuration
    ├── tsconfig.json           # TypeScript configuration
    ├── components.json         # shadcn/ui configuration
    └── docker-compose.yml      # Docker configuration
```

## Database Schema

The application uses four main models:

### Player
- Stores player information
- Fields: `id`, `name`, `registeredAt`
- Relationships: Games, Goals, ELO history

### Game
- Records game details
- Fields: `id`, `date`, `duration`, `videoLink`, `createdAt`
- Relationships: Teams, Goals

### Team
- Represents teams in a game
- Fields: `id`, `score`, `outcome` (WIN/LOSS/DRAW)
- Relationships: Game, Players

### Goal
- Tracks individual goals
- Fields: `id`, `timestamp`
- Relationships: Game, Player

### PlayerGameElo
- Historical ELO tracking per game
- Fields: `eloBefore`, `eloAfter`, `eloChange`, `goalsScored`
- Relationships: Player, Game

## How to Navigate the Code

### Adding a New Feature

1. **Database Changes**: Start with `prisma/schema.prisma` if you need new models or fields
2. **API Endpoint**: Create a route in `src/app/api/[feature]/route.ts`
3. **Frontend Component**: Build UI in `src/components/`
4. **Page Integration**: Add to existing pages or create new pages in `src/app/`

### Understanding the ELO System

The ELO calculation logic lives in `src/lib/elo-calculator/`:
- **elo-calculator.ts**: Core ELO calculation functions
  - Handles win/loss/draw scenarios
  - Adjusts for goals scored
  - Implements draw dampening
- **types.ts**: TypeScript interfaces for ELO calculations
- **constants.ts**: Configuration values (K-factor, base ratings, etc.)

API endpoint: `src/app/api/elo/compute/route.ts`

### Key Pages

#### Home Page (`src/app/page.tsx`)
- Displays the main scoreboard
- Shows player rankings filtered by minimum games (default: 12)
- Includes modals for:
  - Adding new players
  - Viewing game history
  - Viewing player-specific history

#### Game Master Page (`src/app/game-master/page.tsx`)
- Interface for recording live games
- Team creation based on ELO
- Real-time game tracking
- Goal recording

### API Routes Structure

All API routes follow REST conventions:

- `GET /api/players` - List all players
- `POST /api/players` - Create new player
- `GET /api/games` - List games with filters
- `POST /api/games/add` - Record a new game
- `GET /api/scoreboard` - Get scoreboard data
- `POST /api/teams` - Generate balanced teams
- `POST /api/elo/compute` - Calculate ELO changes

### Component Organization

**UI Components** (`src/components/ui/`):
- Base components from shadcn/ui
- Reusable, unstyled primitives
- Customized with Tailwind classes

**Feature Components** (`src/components/`):
- Modal components for specific features
- Composite components using UI primitives
- Business logic integration with React Query

### State Management Pattern

The app uses **React Query** for server state:
1. API calls are wrapped in query hooks
2. Mutations handle POST/PUT/DELETE operations
3. Automatic cache invalidation on mutations
4. Optimistic updates for better UX

Example pattern:
```typescript
const { data } = useQuery({
  queryKey: ['players'],
  queryFn: () => fetch('/api/players').then(r => r.json())
})

const mutation = useMutation({
  mutationFn: (newPlayer) => fetch('/api/players', {...}),
  onSuccess: () => queryClient.invalidateQueries(['players'])
})
```

### Common Tasks

#### Adding a New Modal
1. Create component in `src/components/[feature]-modal.tsx`
2. Use shadcn/ui Dialog component
3. Integrate with React Query for data fetching
4. Add trigger button in parent page

#### Modifying ELO Calculation
1. Update logic in `src/lib/elo-calculator/elo-calculator.ts`
2. Adjust constants in `constants.ts` if needed
3. Test with `src/app/api/elo/compute/route.ts`

#### Adding a New API Endpoint
1. Create `src/app/api/[route]/route.ts`
2. Export `GET`, `POST`, `PUT`, or `DELETE` functions
3. Use Prisma client from `src/lib/prisma.ts`
4. Return `NextResponse.json()`

## Development Workflow

1. **Start Database**: `docker-compose up -d` (if using Docker)
2. **Apply Schema**: `npx prisma db push` or `npx prisma migrate dev`
3. **Run Dev Server**: `npm run dev`
4. **View Database**: `npx prisma studio` (optional GUI)

## Code Style

- Use TypeScript for all files
- Follow ESLint rules (run `npm run lint`)
- Use Tailwind utility classes for styling
- Prefer server components when possible (Next.js 15)
- Use client components only when needed (add `'use client'` directive)

## Database Operations

### Running Migrations
```bash
npx prisma migrate dev --name description_of_change
```

### Seeding the Database
```bash
npx tsx prisma/seed.ts
```

### Resetting the Database
```bash
npx prisma db push --force-reset --accept-data-loss
```

## Environment Setup

Required environment variables in `.env.local`:
```
DATABASE_URL="postgresql://user:password@localhost:5432/futsalgg"
```

## Useful Commands

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npx prisma studio` - Open Prisma Studio (database GUI)
- `npx prisma generate` - Generate Prisma Client
