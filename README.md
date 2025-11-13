# Futsal GG

A comprehensive ELO-based rating and team management system for King of the Court futsal sessions.

## Overview

Futsal GG helps organize and track weekly King of the Court futsal sessions. The application provides fair team creation, detailed game tracking, and a sophisticated ELO rating system to measure player performance over time.

## Features

- **Smart Team Creation**: Generates balanced teams based on player ELO ratings and ensures variety week-to-week
- **Complex ELO System**: Tracks player performance with a dynamic rating system that accounts for:
  - Goals scored
  - Game outcomes (win/loss/draw)
  - Team performance
  - Draw dampening for draws
- **Game Tracking**: Records game details including:
  - Goals and scorers
  - Game duration and timing
  - Final scores
  - Video links to game footage on YouTube
- **Real-Time Updates**: Players can check their phones during breaks to see how their ELO changed after their last game
- **Scoreboard**: View rankings and statistics for all participants (minimum 12 games required)
- **Game Master Interface**: On-site game recording during live sessions at the gymnasium

## How It Works

Every Monday, King of the Court futsal sessions are held at a local gymnasium. The game master uses the application to:

1. Create balanced teams before the session starts
2. Record game details as matches are played
3. Track goals, times, and outcomes in real-time
4. Link recorded game footage from YouTube

Players on the bench can:
- View their current ELO rating
- See how their rating changed after each game
- Review game history and statistics
- Watch game replays via linked YouTube videos

## Tech Stack

- **Framework**: Next.js (React)
- **Database**: PostgreSQL with Prisma ORM
- **Styling**: Tailwind CSS + shadcn/ui components
- **Language**: TypeScript
- **Deployment**: Docker-ready

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up your database:
   ```bash
   npx prisma db push
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000)

## Environment Variables

Create a `.env.local` file with:
```
DATABASE_URL="your_postgresql_connection_string"
```

## Contributing

This is a personal project for managing local futsal sessions. Feel free to fork and adapt for your own use!

## License

MIT
