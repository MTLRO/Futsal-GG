import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

interface PlayerGoals {
  playerId: number;
  goals: number;
}

/**
 * POST /api/games/add
 *
 * Add a game that was already played (retroactive)
 *
 * Request body:
 * {
 *   homeTeamPlayers: Array<{playerId, goals}>,
 *   awayTeamPlayers: Array<{playerId, goals}>,
 *   startDateTime: ISO string,
 *   duration: number (seconds)
 * }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { homeTeamPlayers, awayTeamPlayers, startDateTime, duration } = body;

    // Validate input
    if (!Array.isArray(homeTeamPlayers) || !Array.isArray(awayTeamPlayers)) {
      return NextResponse.json(
        { error: "homeTeamPlayers and awayTeamPlayers must be arrays" },
        { status: 400 }
      );
    }

    if (!startDateTime || duration === undefined) {
      return NextResponse.json(
        { error: "Missing startDateTime or duration" },
        { status: 400 }
      );
    }

    // Validate all players exist and have goals data
    const allPlayerIds = [
      ...homeTeamPlayers.map((p: PlayerGoals) => p.playerId),
      ...awayTeamPlayers.map((p: PlayerGoals) => p.playerId),
    ];

    const existingPlayers = await prisma.player.findMany({
      where: { id: { in: allPlayerIds } },
    });

    if (existingPlayers.length !== allPlayerIds.length) {
      return NextResponse.json(
        { error: "One or more players not found" },
        { status: 404 }
      );
    }

    // Calculate gameInARow for each player by checking previous games
    const gameStartTime = new Date(startDateTime);
    const fatigueWindowMs = 3 * 60 * 1000; // 3 minutes

    const gameInARowMap = new Map<number, number>();

    for (const playerId of allPlayerIds) {
      // Find the most recent game this player participated in before the current game
      const previousGame = await prisma.teamPlayer.findFirst({
        where: {
          playerId,
          game: {
            startDateTime: {
              lt: gameStartTime,
            },
            timePlayed: {
              not: null, // Only finished games
            },
          },
        },
        orderBy: {
          game: {
            startDateTime: "desc",
          },
        },
        include: {
          game: true,
        },
      });

      if (previousGame) {
        const previousGameEndTime =
          new Date(previousGame.game.startDateTime).getTime() +
          (previousGame.game.timePlayed || 0) * 1000;

        // Check if previous game ended within 3 minutes
        if (gameStartTime.getTime() - previousGameEndTime <= fatigueWindowMs) {
          // Player is playing within 3 minutes of their last game
          const previousGameInARow = previousGame.gameInARow || 1;
          gameInARowMap.set(playerId, previousGameInARow + 1);
        } else {
          // Reset the streak
          gameInARowMap.set(playerId, 1);
        }
      } else {
        // No previous games
        gameInARowMap.set(playerId, 1);
      }
    }

    // Create the game with HOME and AWAY sides
    const game = await prisma.game.create({
      data: {
        startDateTime: gameStartTime,
        timePlayed: duration,
        teamPlayers: {
          createMany: {
            data: [
              ...homeTeamPlayers.map((p: PlayerGoals) => ({
                side: "HOME" as const,
                playerId: p.playerId,
                goals: p.goals,
                gameInARow: gameInARowMap.get(p.playerId) || 1,
              })),
              ...awayTeamPlayers.map((p: PlayerGoals) => ({
                side: "AWAY" as const,
                playerId: p.playerId,
                goals: p.goals,
                gameInARow: gameInARowMap.get(p.playerId) || 1,
              })),
            ],
          },
        },
      },
      include: {
        teamPlayers: {
          include: {
            player: true,
          },
        },
      },
    });

    // Check if this game is the latest one (newest startDateTime)
    // If yes, we only need to recompute this game's ELO, not all games
    const latestGame = await prisma.game.findFirst({
      orderBy: { startDateTime: "desc" },
      select: { startDateTime: true },
    });

    const isLatestGame =
      !latestGame || new Date(startDateTime).getTime() >= latestGame.startDateTime.getTime();

    if (isLatestGame) {
      // Game is at the end - only compute ELO for this game, not all games
      try {
        const { calculateGameElos } = await import("@/lib/elo-calculator");

        // Get all players with their current ELOs
        const allPlayers = await prisma.player.findMany();
        const playerElos = new Map<number, number>();
        for (const player of allPlayers) {
          playerElos.set(player.id, player.elo);
        }

        // Build player data with gameInARow for ELO calculation
        const homePlayersData = [];
        const awayPlayersData = [];

        for (const tp of game.teamPlayers.filter((t) => t.side === "HOME")) {
          homePlayersData.push({
            playerId: tp.playerId,
            elo: playerElos.get(tp.playerId) || 1500,
            goals: tp.goals,
            gamesPlayed: 0, // Will be calculated from all games
            gameInARow: tp.gameInARow,
          });
        }

        for (const tp of game.teamPlayers.filter((t) => t.side === "AWAY")) {
          awayPlayersData.push({
            playerId: tp.playerId,
            elo: playerElos.get(tp.playerId) || 1500,
            goals: tp.goals,
            gamesPlayed: 0, // Will be calculated from all games
            gameInARow: tp.gameInARow,
          });
        }

        // Calculate ELO changes for just this game
        const eloChanges = calculateGameElos(
          homePlayersData,
          awayPlayersData
        );

        // Calculate average ELOs at game time
        const homeAvgElo = Math.round(
          homePlayersData.reduce((sum, p) => sum + p.elo, 0) / homePlayersData.length
        );
        const awayAvgElo = Math.round(
          awayPlayersData.reduce((sum, p) => sum + p.elo, 0) / awayPlayersData.length
        );

        // Update TeamPlayer deltaELOs and game with average ELOs
        for (const [playerId, eloChange] of eloChanges.entries()) {
          await prisma.teamPlayer.updateMany({
            where: { gameId: game.id, playerId },
            data: { deltaELO: eloChange },
          });

          // Update player ELO
          const newElo = (playerElos.get(playerId) || 1500) + eloChange;
          await prisma.player.update({
            where: { id: playerId },
            data: { elo: newElo },
          });
        }

        // Update game with average ELOs
        await prisma.game.update({
          where: { id: game.id },
          data: {
            homeTeamAverageElo: homeAvgElo,
            awayTeamAverageElo: awayAvgElo,
          },
        });
      } catch (eloError) {
        console.error("Error computing ELO for latest game:", eloError);
        // Don't fail the game creation if ELO computation fails
      }
    } else {
      // Game is inserted in the middle - recompute all games
      try {
        await fetch(new URL("/api/elo/compute", request.url), {
          method: "POST",
        });
      } catch (eloError) {
        console.error("Error recomputing all ELOs:", eloError);
        // Don't fail the game creation if ELO computation fails
      }
    }

    return NextResponse.json(
      { game, message: isLatestGame ? "Game added, ELO computed for this game only" : "Game added and all ELOs recomputed" },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
