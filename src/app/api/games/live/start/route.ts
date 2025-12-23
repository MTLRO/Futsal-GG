import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

interface PlayerGoals {
  playerId: number;
  goals: number;
  goalkeeper: boolean;
}

/**
 * POST /api/games/live/start
 *
 * Start a live game
 *
 * Request body:
 * {
 *   homeTeamPlayers: Array<{playerId, goals, goalkeeper}>,
 *   awayTeamPlayers: Array<{playerId, goals, goalkeeper}>,
 *   expectedDuration: number (seconds)
 * }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { homeTeamPlayers, awayTeamPlayers, expectedDuration } = body;

    // Validate input
    if (!Array.isArray(homeTeamPlayers) || !Array.isArray(awayTeamPlayers)) {
      return NextResponse.json(
        { error: "homeTeamPlayers and awayTeamPlayers must be arrays" },
        { status: 400 }
      );
    }

    // Check if there's already a live game today
    const now = new Date();
    const estOffset = -5 * 60; // EST is UTC-5
    const estNow = new Date(now.getTime() + estOffset * 60 * 1000);

    const startOfTodayEST = new Date(estNow);
    startOfTodayEST.setHours(0, 0, 0, 0);

    const startOfTodayUTC = new Date(startOfTodayEST.getTime() - estOffset * 60 * 1000);

    const existingLiveGame = await prisma.game.findFirst({
      where: {
        endDateTime: null,
        startDateTime: {
          gte: startOfTodayUTC,
        },
      },
    });

    if (existingLiveGame) {
      return NextResponse.json(
        { error: "A live game is already in progress" },
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

    // Calculate fatigueX for each player
    const gameStartTime = new Date();
    const fatigueXMap = new Map<number, number>();

    for (const playerId of allPlayerIds) {
      const previousGame = await prisma.teamPlayer.findFirst({
        where: {
          playerId,
          game: {
            startDateTime: {
              lt: gameStartTime,
            },
            timePlayed: {
              not: null,
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

        const minutesSincePreviousGame = Math.floor(
          (gameStartTime.getTime() - previousGameEndTime) / (60 * 1000)
        );

        const previousGameDurationMinutes = Math.round((previousGame.game.timePlayed || 0) / 60);
        const previousFatigueBefore = previousGame.fatigueX || 0;
        const previousFatigueAfter = previousFatigueBefore + previousGameDurationMinutes;

        const decayedFatigue = Math.max(
          0,
          previousFatigueAfter - minutesSincePreviousGame
        );

        fatigueXMap.set(playerId, decayedFatigue);
      } else {
        fatigueXMap.set(playerId, 0);
      }
    }

    // Create the live game (endDateTime is null, timePlayed will be calculated when game ends)
    const game = await prisma.game.create({
      data: {
        startDateTime: gameStartTime,
        endDateTime: null, // Live game
        timePlayed: expectedDuration, // Store expected duration temporarily
        teamPlayers: {
          createMany: {
            data: [
              ...homeTeamPlayers.map((p: PlayerGoals) => ({
                side: "HOME" as const,
                playerId: p.playerId,
                goals: p.goals || 0,
                goalkeeper: p.goalkeeper || false,
                fatigueX: fatigueXMap.get(p.playerId) || 0,
              })),
              ...awayTeamPlayers.map((p: PlayerGoals) => ({
                side: "AWAY" as const,
                playerId: p.playerId,
                goals: p.goals || 0,
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

    return NextResponse.json({ game }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
