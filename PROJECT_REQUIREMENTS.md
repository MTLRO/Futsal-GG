# Futsal-GG Project Requirements

## Project Overview

### Project Name
Futsal-GG

### Project Type
Mobile PWA Web Application (React + Next.js)

### Target Platform
- [ ] iOS (Safari/Chrome)
- [ ] Android (Chrome/Samsung Internet)
- [ ] Desktop Web (optional)

### Project Description
<!-- Describe what your app does, its purpose, and target audience -->
It is a web app designed to help me with my weekly king of the hill futsal sessions.
We are 3 teams of 5 in a gym for 60 minutes, playing 7 minute games. Each player has a elo score, and after each game it gets updated. 
If you do not win your second game in a row (or all other games after first), you go on the bench. 
This means sometimes you only need to draw to stay on the court.
The app is designed to help the game master start and end games, and keep track of player's goal scored during each game,
and create the teams for next session, either manually or by making teams with similar average elos. It is also a place where players can see the rankings and statistics of all players.

---

## Core Features

### Must-Have Features (MVP)
<!-- List essential features required for initial launch -->

1. Admin section to create teams, be game master.
2. A leaderboard where players can see their ranking, and click a player to see their match history.

### Nice-to-Have Features (Future)
<!-- Features that can be added later -->

1.
2.
3.

---

## User Roles & Permissions
There is no log in. Only a game master password that I will share with people I want. To be an admin, you just type the admin password.

## User Interface & Experience

### Design Requirements
- **Design System**: SHADCN
- **Color Scheme**: white and dark navy blue, slick and modern.
- **Typography**: You tell me
- **Mobile-First**: Yes, PWA

### Key Pages/Screens
<!-- List main pages and their purpose -->

1. **Home/Landing Page**
   - Purpose: See the leaderboard and admin button
   - Key elements: The interactive leaderboard, and at the bottom, a button to access game master functionality.

2. **Game master page**
   - Purpose: Create the teams for the session, and then start,stop game, stop session, keep track of goal scorers and scores.
   - Key elements: The first thing that shows up is team creation. A list of the players show up with 3 buttons (team A,B or C). you can then choose the teams. or you can ask computer to do it for you depending on player elo. If during the day teams were already created, then its the game page, where at the top is a list of 5 players of team 1, then in the middle is the score and start stop, and the bottom is a list of 5 players of team B.

3. **Game history**
   - Purpose: Show the game history of a player.
   - Key elements: Its a table of games, listing the player's performance, game result, and teamates.

### Navigation Structure
<!-- How users navigate through the app -->
Users can only click a row in the player table to check the game history. Nothing else a part from that. They can interact with the table and sort by columns.

---

## Data & Database

### Data Models
<!-- Define your main data entities -->

#### Model 1: Player
```
Player {
    id: number,
    elo : number,
    firstName: string,
    lastName: string,
    goals: number,
    wins: number,
    draws: number,
    losses: number,
    favoritePartner: number
}
```

#### Model 2: Game
```
Game {
    id: number
    time: Time
    sessionId: number
    homeTeam: 1 | 2 | 3
    awayTeam: 1 | 2 | 3
    duration: number
}
```

#### Model 3: GamePlayer
```
GamePlayer {
    gameId: number
    playerId: number
    goals: number
    team: 1 | 2 | 3
}
```
#### Model 3: GameMaster
```
GameMaster {
password (hashed): string
}

```

#### Model 3: Session
```
Session {
id: number
date: Date
firstGame: id
lastGame: id
}

```





## Authentication & Authorization

---

## API Requirements


### Internal API Endpoints
<!-- API routes you need to build -->

1. `POST /api/game/{id}/goal` - When a player scores a goal in game {id}
2. `POST /api/game/{id}/end` - end game {id}
3.`POST /api/game/{id}/start` - start {id}
4. `GET /api/session/{id}/start` - start session {id}
5.  `GET /api/session/{id}/end` - end session {id}

---

## PWA Specific Requirements

### Offline Functionality
- GameMaster should work fully offline, sending info to server when user gets connection. Leaderboard should just display the most recent results (from last online)


### Installation
- [ ] No install prompt


### Push Notifications
- [ ] Not needed



---

## Technical Requirements



### UI Component Library
- [ ] shadcn/ui



### Data Fetching
- [ ] React Query (TanStack Query)



---

## Deployment & Environment

### Hosting Platform
- [ ] Vercel


### Environment Variables Needed
<!-- List environment variables (don't include actual values) -->

```
DATABASE_URL=
NEXT_PUBLIC_API_URL=
NEXT_PUBLIC_APP_NAME=
```
### CI/CD Requirements
- [ ] Automatic deployment on push to main
---

## Testing Requirements

### Testing Strategy
- [ ] Unit tests (Jest/Vitest)

---

## Analytics & Monitoring


### Error Tracking
- [ ] Not needed initially

---

## Security Requirements

### Security Considerations
- [ ] HTTPS only
- [ ] Input validation
- [ ] XSS protection
- [ ] CSRF protection
- [ ] Rate limiting
- [ ] Data encryption at rest

---




### Browser Support
- [ ] Modern browsers only (Chrome, Safari, Firefox, Edge - last 2 versions)

---

## Additional Notes

### Special Requirements
<!-- Any other important information -->


### Questions & Clarifications
<!-- Things you're unsure about or need to decide -->
1. Security

---
---

**Instructions for Claude:**
Please review this requirements document and:
1. Identify any missing information or ambiguities
2. Suggest architectural decisions based on requirements
3. Create a development roadmap
4. Identify potential technical challenges
5. Recommend specific libraries and tools
6. Provide implementation guidance