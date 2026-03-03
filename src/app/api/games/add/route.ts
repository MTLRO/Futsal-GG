import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

interface PlayerGoals {
  playerId: number;
  goals: number;
  goalkeeper?: boolean;
}

/**
 * POST /api/games/add
 *
 * Add a game that was already played (retroactive)
 * Triggers ridge regression recomputation for all games
 *
 * Request body:
 * {
 *   homeTeamPlayers: Array<{playerId, goals, goalkeeper?}>,
 *   awayTeamPlayers: Array<{playerId, goals, goalkeeper?}>,
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

    // Validate all players exist
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

    // Calculate fatigueX for each player based on time since last game
    // (Fatigue data is tracked but not used in ridge regression)
    const gameStartTime = new Date(startDateTime);
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

    // Calculate endDateTime (startDateTime + duration)
    const endDateTime = new Date(gameStartTime.getTime() + duration * 1000);

    // Create the game with HOME and AWAY sides
    const game = await prisma.game.create({
      data: {
        startDateTime: gameStartTime,
        endDateTime: endDateTime,
        timePlayed: duration,
        teamPlayers: {
          createMany: {
            data: [
              ...homeTeamPlayers.map((p: PlayerGoals) => ({
                side: "HOME" as const,
                playerId: p.playerId,
                goals: p.goals,
                goalkeeper: p.goalkeeper || false,
                fatigueX: fatigueXMap.get(p.playerId) || 0,
              })),
              ...awayTeamPlayers.map((p: PlayerGoals) => ({
                side: "AWAY" as const,
                playerId: p.playerId,
                goals: p.goals,
                goalkeeper: p.goalkeeper || false,
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

    // Trigger ridge regression recomputation for all games
    // Ridge regression always requires full recomputation since it's a batch algorithm
    try {
      const computeUrl = new URL("/api/elo/compute", request.url);
      const computeResponse = await fetch(computeUrl, {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!computeResponse.ok) {
        console.error("Failed to recompute ridge regression ratings");
        const errorData = await computeResponse.json();
        console.error("Recomputation error:", errorData);
      } else {
        const result = await computeResponse.json();
        console.log("Ridge regression recomputation successful:", result);
      }
    } catch (recomputeError) {
      console.error("Error recomputing all ratings:", recomputeError);
      // Don't fail the game creation if recomputation fails
      // The admin can manually trigger recomputation later
    }

    return NextResponse.json(
      { game, message: "Game added and all ratings recomputed using ridge regression" },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
