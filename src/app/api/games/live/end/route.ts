import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/**
 * POST /api/games/live/end
 *
 * End the current live game
 *
 * Request body:
 * {
 *   gameId: number
 * }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { gameId } = body;

    if (!gameId) {
      return NextResponse.json(
        { error: "gameId is required" },
        { status: 400 }
      );
    }

    // Find the game
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        teamPlayers: {
          include: {
            player: true,
          },
        },
      },
    });

    if (!game) {
      return NextResponse.json(
        { error: "Game not found" },
        { status: 404 }
      );
    }

    if (game.endDateTime !== null) {
      return NextResponse.json(
        { error: "Game has already ended" },
        { status: 400 }
      );
    }

    // Calculate actual duration
    const endTime = new Date();
    const startTime = new Date(game.startDateTime);
    const actualDuration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000); // in seconds

    // Update the game with endDateTime and actual duration
    const updatedGame = await prisma.game.update({
      where: { id: gameId },
      data: {
        endDateTime: endTime,
        timePlayed: actualDuration,
      },
      include: {
        teamPlayers: {
          include: {
            player: true,
          },
        },
      },
    });

    // Calculate and update ELO ratings
    try {
      const { calculateGameElos } = await import("@/lib/elo-calculator");

      // Get all players with their current ELOs (before this game)
      const allPlayers = await prisma.player.findMany();
      const playerElos = new Map<number, number>();
      for (const player of allPlayers) {
        playerElos.set(player.id, player.elo);
      }

      // Get player IDs for each team
      const homePlayerIds = updatedGame.teamPlayers.filter((t) => t.side === "HOME").map((tp) => tp.playerId);
      const awayPlayerIds = updatedGame.teamPlayers.filter((t) => t.side === "AWAY").map((tp) => tp.playerId);

      // Helper function to get chemistry data for a player with teammates
      const getChemistryData = async (playerId: number, teammateIds: number[]) => {
        const chemistryData = [];

        for (const teammateId of teammateIds) {
          // Fetch PlayerLink for this player pair
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

      for (const tp of updatedGame.teamPlayers.filter((t) => t.side === "HOME")) {
        const teammateIds = homePlayerIds.filter((id) => id !== tp.playerId);
        const teammatesChemistry = await getChemistryData(tp.playerId, teammateIds);

        homePlayersData.push({
          playerId: tp.playerId,
          elo: playerElos.get(tp.playerId) || 1500,
          goals: tp.goals,
          gamesPlayed: 0,
          fatigueX: tp.fatigueX,
          teammatesChemistry,
        });
      }

      for (const tp of updatedGame.teamPlayers.filter((t) => t.side === "AWAY")) {
        const teammateIds = awayPlayerIds.filter((id) => id !== tp.playerId);
        const teammatesChemistry = await getChemistryData(tp.playerId, teammateIds);

        awayPlayersData.push({
          playerId: tp.playerId,
          elo: playerElos.get(tp.playerId) || 1500,
          goals: tp.goals,
          gamesPlayed: 0,
          fatigueX: tp.fatigueX,
          teammatesChemistry,
        });
      }

      // Calculate ELO changes
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

      // Update TeamPlayer deltaELOs and player ELOs
      for (const [playerId, eloChange] of eloChanges.entries()) {
        await prisma.teamPlayer.updateMany({
          where: { gameId: updatedGame.id, playerId },
          data: { deltaELO: eloChange },
        });

        const newElo = (playerElos.get(playerId) || 1500) + eloChange;
        await prisma.player.update({
          where: { id: playerId },
          data: { elo: newElo },
        });
      }

      // Update game with average ELOs
      await prisma.game.update({
        where: { id: updatedGame.id },
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
      console.error("Error computing ELO:", eloError);
    }

    return NextResponse.json({ game: updatedGame }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
