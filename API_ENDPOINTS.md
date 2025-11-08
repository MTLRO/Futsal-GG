# Futsal-GG API Endpoints

## Core Game APIs

### POST /api/games/add
**Add a game that was already played (retroactive)**

Automatically triggers ELO recomputation after adding.

Request:
```json
{
  "homeTeamPlayers": [
    { "playerId": 1, "goals": 2 },
    { "playerId": 2, "goals": 1 },
    { "playerId": 3, "goals": 0 }
  ],
  "awayTeamPlayers": [
    { "playerId": 4, "goals": 1 },
    { "playerId": 5, "goals": 2 }
  ],
  "startDateTime": "2024-10-29T19:00:00Z",
  "duration": 420
}
```

Response:
```json
{
  "game": { ... },
  "message": "Game added and ELO recomputed"
}
```

### POST /api/elo/compute
**Recompute all ELOs chronologically**

Resets all players to 1500 ELO, then processes all games in order of `startDateTime`, recalculating ELO changes based on current formula.

Use this when:
- You add a historical game that changes the chronological order
- You update the ELO calculation formula

Response:
```json
{
  "success": true,
  "message": "Recomputed ELO for 25 games",
  "gamesProcessed": 25
}
```

### POST /api/games
**Start a new live game**

Request:
```json
{
  "homeTeam": "A",
  "awayTeam": "B"
}
```

### GET /api/games
**Get current active game** (timePlayed = null)

### PATCH /api/games/[gameId]
**End a game**

Request:
```json
{
  "timePlayed": 420
}
```

### POST /api/games/[gameId]/goal
**Record a goal for a player**

Request:
```json
{
  "playerId": 5
}
```

---

## Player APIs

### POST /api/players
**Add a new player**

Players start with 1500 ELO by default.

Request:
```json
{
  "name": "John",
  "lastName": "Doe"
}
```

### GET /api/players
**Get all players**

### GET /api/scoreboard
**Get scoreboard with stats**

Returns players ranked by ELO with:
- gamesPlayed
- current ELO
- lastGameDeltaELO (ELO change from most recent game)

---

## Team APIs

### POST /api/teams
**Setup teams for next game**

Request:
```json
{
  "teamA": [1, 2, 3, 4, 5],
  "teamB": [6, 7, 8, 9, 10],
  "teamC": [11, 12, 13, 14, 15]
}
```

### GET /api/teams
**Get current team compositions**

---

## Data Model

### TeamPlayer
- `side`: "HOME" or "AWAY" (which side in a game)
- `goals`: Goals scored in that game
- `deltaELO`: ELO change from that specific game

### Game
- `homeTeam`: Team A, B, or C as home side
- `awayTeam`: Team A, B, or C as away side
- `startDateTime`: When the game was played
- `timePlayed`: Duration in seconds (null if active)

### Player
- `elo`: Current ELO (starts at 1500)

---

## ELO System

### Formula (Simple)
- Base K-factor: 32 (adjusted by ELO rating)
- Expected score calculated against average opponent ELO
- Win: positive change, Loss: negative change, Draw: 0

### K-factor by ELO
- ELO > 2000: K = 16
- ELO > 1800: K = 24
- ELO ≤ 1800: K = 32

### Game-level ELO
ELO changes are calculated at the **team level** (by total goals):
- Home team goals vs Away team goals determines win/loss/draw
- Each player on the team gets the same ELO change
- Change is based on team's average ELO vs opponent's average ELO
