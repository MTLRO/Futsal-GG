# Futsal-GG Application Logic

## Player System

### ELO Rating
- **Initial ELO**: Each new player starts with **1500 ELO**
- **ELO Changes**: Players' ELO changes based on game results
- **Last Game Delta**: The scoreboard displays the ELO change from the most recent game a player participated in

## Game System

### Game Structure
- A game consists of two teams competing against each other (Team A vs Team B, Team A vs Team C, or Team B vs Team C)
- There can be a third team (Team C) available but a specific game is always between two teams
- Each team can have up to 5 players

### Game States
- **Active Game**: A game with `timePlayed = null` is considered active/in-progress
- **Completed Game**: A game with a `timePlayed` value (in seconds) is completed
- Only one active game can exist at a time

## Team Management

### Team Setup
- Teams are organized with player IDs
- There are three team slots available: Team A, Team B, and Team C
- Each team can have up to 5 players

### Team Assignment
- Players are assigned to teams before a game starts
- The `changeTeams` API endpoint allows setting all team compositions at once (3 arrays of 5 player IDs)
- The `startGame` endpoint specifies which two teams will compete

## Scoreboard

### Scoreboard Data
- **Rank**: Players ranked by ELO (highest to lowest)
- **Name**: Player's first and last name
- **Games Played**: Total number of games a player has participated in
- **ELO**: Current ELO rating
- **Last Game Δ (Delta)**: ELO change from the most recent game

### Scoreboard Updates
- Scoreboard updates in real-time as games progress
- Goal scoring updates the game state immediately
- Game completion records final ELO changes

## Database Schema

### Tables
- **Player**: Basic player information (id, name, lastName, elo)
- **Game**: Game records (id, team1, team2, timePlayed, startDateTime)
- **TeamPlayer**: Player participation in games (id, team, playerId, goals, deltaELO, gameId)
- **GameMaster**: Authentication for game master role

### Relationships
- A Player can participate in multiple TeamPlayer records (many games)
- A Game has many TeamPlayer records (multiple players across two teams)
- Each TeamPlayer record represents a player's stats for a specific game on a specific team
