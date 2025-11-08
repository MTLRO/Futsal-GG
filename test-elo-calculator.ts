

/**
 * Test format:
 * player: [name, goals, gameInARow, eloBeforeGame, gamesPlayed]
 */

interface TestPlayer {
    playerId: number;
    name: string;
    goals: number;
    gameInARow: number;
    elo: number;
    gamesPlayed: number;
}

// Helper to convert test format to calculateGameElos format
function formatTeam(players: TestPlayer[]) {
    return players.map((p) => ({
        playerId: p.playerId,
        elo: p.elo,
        goals: p.goals,
        gamesPlayed: p.gamesPlayed,
        gameInARow: p.gameInARow,
    }));
}

// Test Case 1: Equal teams, home wins 2-1
console.log("\n========================================");
console.log("TEST 1: Draw 2-2");
console.log("========================================");

const test1Home: TestPlayer[] = [
    { playerId: 1, name: "Andrei", goals: 0, gameInARow: 1, elo: 1500, gamesPlayed: 3 },
    { playerId: 2, name: "Karl", goals: 0, gameInARow: 1, elo: 1500, gamesPlayed: 3 },
    { playerId: 3, name: "Bo", goals: 1, gameInARow: 1, elo: 1500, gamesPlayed: 3 },
    { playerId: 4, name: "Karim", goals: 1, gameInARow: 1, elo: 1500, gamesPlayed: 3 },
    { playerId: 5, name: "Charles", goals: 0, gameInARow: 1, elo: 1500, gamesPlayed: 3 },
];

const test1Away: TestPlayer[] = [
    { playerId: 6, name: "Jehan", goals: 0, gameInARow: 1, elo: 1510, gamesPlayed: 3 },
    { playerId: 7, name: "Bogdan", goals: 0, gameInARow: 1, elo: 1510, gamesPlayed: 3 },
    { playerId: 8, name: "Kevin", goals: 0, gameInARow: 1, elo: 1510, gamesPlayed: 3 },
    { playerId: 9, name: "William", goals: 1, gameInARow: 1, elo: 1510, gamesPlayed: 3 },
    { playerId: 10, name: "Luca", goals: 1, gameInARow: 1, elo: 1510, gamesPlayed: 3 },
];

const result1 = calculateGameElos(formatTeam(test1Home), formatTeam(test1Away));

console.log("2-2 Draw");
test1Home.forEach((p) => {
    const change = result1.get(p.playerId) || 0;
    console.log(`  ${p.name}: ${p.elo} → ${p.elo + change} (${change > 0 ? "+" : ""}${change})`);
});

console.log("Away Team (Loss):");
test1Away.forEach((p) => {
    const change = result1.get(p.playerId) || 0;
    console.log(`  ${p.name}: ${p.elo} → ${p.elo + change} (${change > 0 ? "+" : ""}${change})`);
});

const totalChange1 = Array.from(result1.values()).reduce((a, b) => a + b, 0);
console.log(`\nZero-sum check: Total ELO change = ${totalChange1} (should be 0)`);

