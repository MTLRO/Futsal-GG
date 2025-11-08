import { prisma } from "@/lib/prisma";

async function exportTestCases() {
    const games = await prisma.game.findMany({
        orderBy: { startDateTime: "asc" },
        include: {
            teamPlayers: {
                include: {
                    player: true,
                },
            },
        },
    });

    console.log("// Test cases exported from database");
    console.log("// Copy this into test-elo-calculator.ts\n");
    console.log("const testGames = [");

    for (const game of games) {
        const homePlayers = game.teamPlayers.filter(tp => tp.side === "HOME");
        const awayPlayers = game.teamPlayers.filter(tp => tp.side === "AWAY");

        console.log("    {");
        console.log(`        gameId: ${game.id},`);
        console.log(`        startDateTime: "${game.startDateTime.toISOString()}",`);
        console.log("        homeTeam: [");

        for (const tp of homePlayers) {
            console.log(`            { playerId: ${tp.playerId}, name: "${tp.player.name}", goals: ${tp.goals}, gameInARow: ${tp.gameInARow || 1} },`);
        }

        console.log("        ],");
        console.log("        awayTeam: [");

        for (const tp of awayPlayers) {
            console.log(`            { playerId: ${tp.playerId}, name: "${tp.player.name}", goals: ${tp.goals}, gameInARow: ${tp.gameInARow || 1} },`);
        }

        console.log("        ],");
        console.log("    },");
    }

    console.log("];");

    await prisma.$disconnect();
}

exportTestCases();
