import { calculateGameElos } from "@/lib/elo-calculator";

// Test cases exported from database
const testGames = [

    {
        gameId: 4,
        startDateTime: "2025-10-07T01:47:00.000Z",
        homeTeam: [
            { playerId: 35, name: "Ayman", goals: 0, gameInARow: 1 },
            { playerId: 10, name: "Bilel", goals: 0, gameInARow: 1 },
            { playerId: 15, name: "Ayoub", goals: 0, gameInARow: 1 },
            { playerId: 4, name: "Jose", goals: 1, gameInARow: 1 },
            { playerId: 3, name: "Camilo", goals: 0, gameInARow: 1 },
        ],
        awayTeam: [
            { playerId: 12, name: "Luca", goals: 0, gameInARow: 2 },
            { playerId: 6, name: "Jehan", goals: 0, gameInARow: 2 },
            { playerId: 7, name: "Bogdan", goals: 0, gameInARow: 2 },
            { playerId: 2, name: "Kevin", goals: 2, gameInARow: 2 },
            { playerId: 11, name: "William", goals: 0, gameInARow: 2 },
        ],
    },
    {
        gameId: 5,
        startDateTime: "2025-10-07T01:55:00.000Z",
        homeTeam: [
            { playerId: 5, name: "Bo", goals: 0, gameInARow: 1 },
            { playerId: 34, name: "Karim", goals: 0, gameInARow: 1 },
            { playerId: 16, name: "Charles", goals: 0, gameInARow: 1 },
            { playerId: 14, name: "Andrei", goals: 1, gameInARow: 1 },
            { playerId: 9, name: "Karl", goals: 1, gameInARow: 1 },
        ],
        awayTeam: [
            { playerId: 4, name: "Jose", goals: 0, gameInARow: 2 },
            { playerId: 3, name: "Camilo", goals: 0, gameInARow: 2 },
            { playerId: 35, name: "Ayman", goals: 0, gameInARow: 2 },
            { playerId: 10, name: "Bilel", goals: 1, gameInARow: 2 },
            { playerId: 15, name: "Ayoub", goals: 0, gameInARow: 2 },
        ],
    },
    {
        gameId: 6,
        startDateTime: "2025-10-07T02:03:00.000Z",
        homeTeam: [
            { playerId: 6, name: "Jehan", goals: 0, gameInARow: 1 },
            { playerId: 7, name: "Bogdan", goals: 0, gameInARow: 1 },
            { playerId: 2, name: "Kevin", goals: 0, gameInARow: 1 },
            { playerId: 11, name: "William", goals: 1, gameInARow: 1 },
            { playerId: 12, name: "Luca", goals: 1, gameInARow: 1 },
        ],
        awayTeam: [
            { playerId: 34, name: "Karim", goals: 1, gameInARow: 2 },
            { playerId: 16, name: "Charles", goals: 0, gameInARow: 2 },
            { playerId: 14, name: "Andrei", goals: 0, gameInARow: 2 },
            { playerId: 9, name: "Karl", goals: 0, gameInARow: 2 },
            { playerId: 5, name: "Bo", goals: 1, gameInARow: 2 },
        ],
    },
    {
        gameId: 7,
        startDateTime: "2025-10-07T02:10:00.000Z",
        homeTeam: [
            { playerId: 12, name: "Luca", goals: 0, gameInARow: 2 },
            { playerId: 6, name: "Jehan", goals: 0, gameInARow: 2 },
            { playerId: 7, name: "Bogdan", goals: 0, gameInARow: 2 },
            { playerId: 2, name: "Kevin", goals: 0, gameInARow: 2 },
            { playerId: 11, name: "William", goals: 0, gameInARow: 2 },
        ],
        awayTeam: [
            { playerId: 35, name: "Ayman", goals: 0, gameInARow: 1 },
            { playerId: 10, name: "Bilel", goals: 0, gameInARow: 1 },
            { playerId: 15, name: "Ayoub", goals: 0, gameInARow: 1 },
            { playerId: 4, name: "Jose", goals: 0, gameInARow: 1 },
            { playerId: 3, name: "Camilo", goals: 0, gameInARow: 1 },
        ],
    },
    {
        gameId: 8,
        startDateTime: "2025-10-07T02:18:00.000Z",
        homeTeam: [
            { playerId: 16, name: "Charles", goals: 0, gameInARow: 1 },
            { playerId: 14, name: "Andrei", goals: 2, gameInARow: 1 },
            { playerId: 9, name: "Karl", goals: 0, gameInARow: 1 },
            { playerId: 5, name: "Bo", goals: 0, gameInARow: 1 },
            { playerId: 34, name: "Karim", goals: 0, gameInARow: 1 },
        ],
        awayTeam: [
            { playerId: 10, name: "Bilel", goals: 0, gameInARow: 2 },
            { playerId: 15, name: "Ayoub", goals: 1, gameInARow: 2 },
            { playerId: 4, name: "Jose", goals: 0, gameInARow: 2 },
            { playerId: 3, name: "Camilo", goals: 0, gameInARow: 2 },
            { playerId: 35, name: "Ayman", goals: 0, gameInARow: 2 },
        ],
    },
    {
        gameId: 9,
        startDateTime: "2025-10-07T02:25:00.000Z",
        homeTeam: [
            { playerId: 6, name: "Jehan", goals: 0, gameInARow: 1 },
            { playerId: 7, name: "Bogdan", goals: 0, gameInARow: 1 },
            { playerId: 2, name: "Kevin", goals: 1, gameInARow: 1 },
            { playerId: 11, name: "William", goals: 0, gameInARow: 1 },
            { playerId: 12, name: "Luca", goals: 1, gameInARow: 1 },
        ],
        awayTeam: [
            { playerId: 16, name: "Charles", goals: 0, gameInARow: 2 },
            { playerId: 14, name: "Andrei", goals: 0, gameInARow: 2 },
            { playerId: 9, name: "Karl", goals: 0, gameInARow: 2 },
            { playerId: 5, name: "Bo", goals: 0, gameInARow: 2 },
            { playerId: 34, name: "Karim", goals: 0, gameInARow: 2 },
        ],
    },
    {
        gameId: 10,
        startDateTime: "2025-10-07T02:32:00.000Z",
        homeTeam: [
            { playerId: 2, name: "Kevin", goals: 0, gameInARow: 2 },
            { playerId: 11, name: "William", goals: 0, gameInARow: 2 },
            { playerId: 12, name: "Luca", goals: 1, gameInARow: 2 },
            { playerId: 6, name: "Jehan", goals: 0, gameInARow: 2 },
            { playerId: 7, name: "Bogdan", goals: 0, gameInARow: 2 },
        ],
        awayTeam: [
            { playerId: 35, name: "Ayman", goals: 0, gameInARow: 1 },
            { playerId: 10, name: "Bilel", goals: 0, gameInARow: 1 },
            { playerId: 15, name: "Ayoub", goals: 0, gameInARow: 1 },
            { playerId: 4, name: "Jose", goals: 1, gameInARow: 1 },
            { playerId: 3, name: "Camilo", goals: 0, gameInARow: 1 },
        ],
    },
];

// Track player ELOs and games played
const playerElos = new Map<number, number>();
const playerGamesPlayed = new Map<number, number>();
const playerNames = new Map<number, string>();

// Initialize all players at 1500 ELO
for (const game of testGames) {
    for (const player of [...game.homeTeam, ...game.awayTeam]) {
        if (!playerElos.has(player.playerId)) {
            playerElos.set(player.playerId, 1500);
            playerGamesPlayed.set(player.playerId, 0);
            playerNames.set(player.playerId, player.name);
        }
    }
}

console.log("========================================");
console.log("ELO PROGRESSION TEST");
console.log("========================================\n");

// Process each game
for (let i = 0; i < testGames.length; i++) {
    const game = testGames[i];

    console.log(`\n${"=".repeat(80)}`);
    console.log(`GAME ${i + 1} (ID: ${game.gameId}) - ${new Date(game.startDateTime).toLocaleString()}`);
    console.log("=".repeat(80));

    // Calculate home and away scores
    const homeScore = game.homeTeam.reduce((sum, p) => sum + p.goals, 0);
    const awayScore = game.awayTeam.reduce((sum, p) => sum + p.goals, 0);

    console.log(`\nScore: ${homeScore} - ${awayScore}`);

    // Prepare player data with current ELOs
    const homeTeamData = game.homeTeam.map(p => ({
        playerId: p.playerId,
        elo: playerElos.get(p.playerId) || 1500,
        goals: p.goals,
        gamesPlayed: playerGamesPlayed.get(p.playerId) || 0,
        gameInARow: p.gameInARow,
    }));

    const awayTeamData = game.awayTeam.map(p => ({
        playerId: p.playerId,
        elo: playerElos.get(p.playerId) || 1500,
        goals: p.goals,
        gamesPlayed: playerGamesPlayed.get(p.playerId) || 0,
        gameInARow: p.gameInARow,
    }));

    // Calculate ELO changes
    const eloChanges = calculateGameElos(homeTeamData, awayTeamData);

    // Display home team
    console.log("\nHOME TEAM:");
    for (const player of game.homeTeam) {
        const oldElo = playerElos.get(player.playerId) || 1500;
        const change = eloChanges.get(player.playerId) || 0;
        const newElo = oldElo + change;
        const gamesPlayed = playerGamesPlayed.get(player.playerId) || 0;

        console.log(`  ${player.name.padEnd(10)} | Goals: ${player.goals} | ELO: ${oldElo} → ${newElo} (${change >= 0 ? '+' : ''}${change}) | Games: ${gamesPlayed} | InARow: ${player.gameInARow}`);

        // Update player data
        playerElos.set(player.playerId, newElo);
        playerGamesPlayed.set(player.playerId, gamesPlayed + 1);
    }

    // Display away team
    console.log("\nAWAY TEAM:");
    for (const player of game.awayTeam) {
        const oldElo = playerElos.get(player.playerId) || 1500;
        const change = eloChanges.get(player.playerId) || 0;
        const newElo = oldElo + change;
        const gamesPlayed = playerGamesPlayed.get(player.playerId) || 0;

        console.log(`  ${player.name.padEnd(10)} | Goals: ${player.goals} | ELO: ${oldElo} → ${newElo} (${change >= 0 ? '+' : ''}${change}) | Games: ${gamesPlayed} | InARow: ${player.gameInARow}`);

        // Update player data
        playerElos.set(player.playerId, newElo);
        playerGamesPlayed.set(player.playerId, gamesPlayed + 1);
    }

    // Verify zero-sum
    const totalChange = Array.from(eloChanges.values()).reduce((sum, change) => sum + change, 0);
    console.log(`\n✓ Zero-sum check: ${totalChange} (should be 0)`);
}

// Final leaderboard
console.log("\n\n" + "=".repeat(80));
console.log("FINAL LEADERBOARD");
console.log("=".repeat(80) + "\n");

const leaderboard = Array.from(playerElos.entries())
    .map(([playerId, elo]) => ({
        playerId,
        name: playerNames.get(playerId) || "Unknown",
        elo,
        gamesPlayed: playerGamesPlayed.get(playerId) || 0,
    }))
    .sort((a, b) => b.elo - a.elo);

let rank = 1;
for (const player of leaderboard) {
    const eloDiff = player.elo - 1500;
    console.log(`${String(rank).padStart(2)}. ${player.name.padEnd(10)} | ELO: ${player.elo} (${eloDiff >= 0 ? '+' : ''}${eloDiff}) | Games: ${player.gamesPlayed}`);
    rank++;
}

console.log("\n" + "=".repeat(80));
