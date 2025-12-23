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
        const playerGkElos = new Map<number, number>();
        for (const player of allPlayers) {
          playerElos.set(player.id, player.elo);
          playerGkElos.set(player.id, player.gkElo);
        }

        // Get player IDs for each team
        const homePlayerIds = game.teamPlayers.filter((t) => t.side === "HOME").map((tp) => tp.playerId);
        const awayPlayerIds = game.teamPlayers.filter((t) => t.side === "AWAY").map((tp) => tp.playerId);

        // Helper function to get chemistry data for a player with teammates
        const getChemistryData = async (playerId: number, teammateIds: number[]) => {
          const chemistryData = [];

          for (const teammateId of teammateIds) {
            // Fetch PlayerLink for this player pair (considering only games before current game)
            const [p1, p2] = [playerId, teammateId].sort((a, b) => a - b);
            const playerLink = await prisma.playerLink.findUnique({
              where: {
                player1Id_player2Id: { player1Id: p1, player2Id: p2 },
              },
            });

            chemistryData.push({
              playerId: teammateId,
              wins: playerLink?.wins || 0,
              losses: playerLink?.losses || 0,
              draws: playerLink?.draws || 0,
            });
          }

          return chemistryData;
        };

        // Build player data with fatigueX and chemistry for ELO calculation
        const homePlayersData = [];
        const awayPlayersData = [];

        for (const tp of game.teamPlayers.filter((t) => t.side === "HOME")) {
          const teammateIds = homePlayerIds.filter((id) => id !== tp.playerId);
          const teammatesChemistry = await getChemistryData(tp.playerId, teammateIds);

          // Use position-specific ELO: gkElo if goalkeeper, else regular elo
          const currentElo = tp.goalkeeper
            ? (playerGkElos.get(tp.playerId) || 1500)
            : (playerElos.get(tp.playerId) || 1500);

          homePlayersData.push({
            playerId: tp.playerId,
            elo: currentElo,
            goals: tp.goals,
            gamesPlayed: 0, // Will be calculated from all games
            fatigueX: tp.fatigueX,
            teammatesChemistry,
          });
        }

        for (const tp of game.teamPlayers.filter((t) => t.side === "AWAY")) {
          const teammateIds = awayPlayerIds.filter((id) => id !== tp.playerId);
          const teammatesChemistry = await getChemistryData(tp.playerId, teammateIds);

          // Use position-specific ELO: gkElo if goalkeeper, else regular elo
          const currentElo = tp.goalkeeper
            ? (playerGkElos.get(tp.playerId) || 1500)
            : (playerElos.get(tp.playerId) || 1500);

          awayPlayersData.push({
            playerId: tp.playerId,
            elo: currentElo,
            goals: tp.goals,
            gamesPlayed: 0, // Will be calculated from all games
            fatigueX: tp.fatigueX,
            teammatesChemistry,
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

          // Determine if this player was a goalkeeper in this game
          const teamPlayer = game.teamPlayers.find(tp => tp.playerId === playerId);
          const wasGoalkeeper = teamPlayer?.goalkeeper || false;

          // Update the appropriate ELO field
          if (wasGoalkeeper) {
            const newGkElo = (playerGkElos.get(playerId) || 1500) + eloChange;
            await prisma.player.update({
              where: { id: playerId },
              data: { gkElo: newGkElo },
            });
          } else {
            const newElo = (playerElos.get(playerId) || 1500) + eloChange;
            await prisma.player.update({
              where: { id: playerId },
              data: { elo: newElo },
            });
          }
        }

        // Update game with average ELOs
        await prisma.game.update({
          where: { id: game.id },
          data: {
            homeTeamAverageElo: homeAvgElo,
            awayTeamAverageElo: awayAvgElo,
          },
        });

        // Update PlayerLinks for this game
        const homeGoals = homePlayersData.reduce((sum, p) => sum + p.goals, 0);
        const awayGoals = awayPlayersData.reduce((sum, p) => sum + p.goals, 0);

        // Helper to generate player pairs
        const generatePlayerPairs = (playerIds: number[]): Array<[number, number]> => {
          const pairs: Array<[number, number]> = [];
          for (let i = 0; i < playerIds.length; i++) {
            for (let j = i + 1; j < playerIds.length; j++) {
              const [p1, p2] = [playerIds[i], playerIds[j]].sort((a, b) => a - b);
              pairs.push([p1, p2]);
            }
          }
          return pairs;
        };

        // Update home team pairs
        const homePairs = generatePlayerPairs(homePlayerIds);
        for (const [player1Id, player2Id] of homePairs) {
          const resultUpdate =
            homeGoals > awayGoals
              ? { wins: { increment: 1 } }
              : homeGoals < awayGoals
              ? { losses: { increment: 1 } }
              : { draws: { increment: 1 } };

          await prisma.playerLink.upsert({
            where: {
              player1Id_player2Id: { player1Id, player2Id },
            },
            create: {
              player1Id,
              player2Id,
              wins: homeGoals > awayGoals ? 1 : 0,
              losses: homeGoals < awayGoals ? 1 : 0,
              draws: homeGoals === awayGoals ? 1 : 0,
            },
            update: resultUpdate,
          });
        }

        // Update away team pairs
        const awayPairs = generatePlayerPairs(awayPlayerIds);
        for (const [player1Id, player2Id] of awayPairs) {
          const resultUpdate =
            awayGoals > homeGoals
              ? { wins: { increment: 1 } }
              : awayGoals < homeGoals
              ? { losses: { increment: 1 } }
              : { draws: { increment: 1 } };

          await prisma.playerLink.upsert({
            where: {
              player1Id_player2Id: { player1Id, player2Id },
            },
            create: {
              player1Id,
              player2Id,
              wins: awayGoals > homeGoals ? 1 : 0,
              losses: awayGoals < homeGoals ? 1 : 0,
              draws: awayGoals === homeGoals ? 1 : 0,
            },
            update: resultUpdate,
          });
        }
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
