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

    // Calculate fatigueX for each player based on game duration and time since last game
    const gameStartTime = new Date(startDateTime);
    const gameDurationMinutes = Math.round((duration || 0) / 60); // Convert seconds to minutes

    const fatigueXMap = new Map<number, number>();

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

        // Calculate minutes since last game ended
        const minutesSincePreviousGame = Math.floor(
          (gameStartTime.getTime() - previousGameEndTime) / (60 * 1000)
        );

        // Get the previous game's fatigue and duration
        const previousGameDurationMinutes = Math.round((previousGame.game.timePlayed || 0) / 60);
        const previousFatigueBefore = previousGame.fatigueX || 0;
        const previousFatigueAfter = previousFatigueBefore + previousGameDurationMinutes;

        // Decay fatigue by 1 per minute since last game, minimum 0
        const decayedFatigue = Math.max(
          0,
          previousFatigueAfter - minutesSincePreviousGame
        );

        fatigueXMap.set(playerId, decayedFatigue);
      } else {
        // No previous games - first game, player is fresh
        fatigueXMap.set(playerId, 0);
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
                fatigueX: fatigueXMap.get(p.playerId) || 0,
              })),
              ...awayTeamPlayers.map((p: PlayerGoals) => ({
                side: "AWAY" as const,
                playerId: p.playerId,
                goals: p.goals,
                fatigueX: fatigueXMap.get(p.playerId) || 0,
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

        // Build player data with fatigueX for ELO calculation
        const homePlayersData = [];
        const awayPlayersData = [];

        for (const tp of game.teamPlayers.filter((t) => t.side === "HOME")) {
          homePlayersData.push({
            playerId: tp.playerId,
            elo: playerElos.get(tp.playerId) || 1500,
            goals: tp.goals,
            gamesPlayed: 0, // Will be calculated from all games
            fatigueX: tp.fatigueX,
          });
        }

        for (const tp of game.teamPlayers.filter((t) => t.side === "AWAY")) {
          awayPlayersData.push({
            playerId: tp.playerId,
            elo: playerElos.get(tp.playerId) || 1500,
            goals: tp.goals,
            gamesPlayed: 0, // Will be calculated from all games
            fatigueX: tp.fatigueX,
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
