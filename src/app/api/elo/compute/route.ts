import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { calculateGameElos } from "@/lib/elo-calculator";

/**
 * POST /api/elo/compute
 *
 * Recomputes ELO for all games chronologically.
 * This recalculates all player ELOs from scratch based on game history.
 *
 * Process:
 * 1. Reset all players to 1500 ELO
 * 2. Sort games by startDateTime (oldest first)
 * 3. For each game, recalculate ELO deltas
 * 4. Update player ELOs and TeamPlayer deltaELOs
 */
export async function POST() {
  try {
    // Get all games sorted by startDateTime
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

    if (games.length === 0) {
      return NextResponse.json({ message: "No games to recompute" });
    }

    // Reset all players to 1500 ELO
    await prisma.player.updateMany({
      data: { elo: 1500 },
    });

    // Track current ELO for each player during recomputation
    const playerElos = new Map<number, number>();
    // Track games played for each player
    const playerGamesPlayed = new Map<number, number>();

    // Initialize all players with 1500 ELO and 0 games
    const allPlayers = await prisma.player.findMany();
    for (const player of allPlayers) {
      playerElos.set(player.id, 1500);
      playerGamesPlayed.set(player.id, 0);
    }

    // Process each game in chronological order
    for (const game of games) {
      // Group players by side
      const homePlayers = game.teamPlayers.filter((tp) => tp.side === "HOME");
      const awayPlayers = game.teamPlayers.filter((tp) => tp.side === "AWAY");

      // Calculate gameInARow for each player
      const playerGameInARow = new Map<number, number>();
      const fatigueWindowMs = 3 * 60 * 1000; // 3 minutes

      for (const player of [...homePlayers, ...awayPlayers]) {
        // Find this player's most recent previous game
        const previousGameTeamPlayer = games
          .filter((g) => g.startDateTime < game.startDateTime)
          .reverse() // Search backwards (most recent first)
          .find((g) => g.teamPlayers.some((tp) => tp.playerId === player.playerId))
          ?.teamPlayers.find((tp) => tp.playerId === player.playerId);

        if (previousGameTeamPlayer) {
          const previousGame = games.find((g) =>
            g.teamPlayers.some((tp) => tp.id === previousGameTeamPlayer.id)
          );

          if (previousGame) {
            const previousGameEndTime =
              new Date(previousGame.startDateTime).getTime() +
              (previousGame.timePlayed || 0) * 1000;

            const currentGameStartTime = new Date(game.startDateTime).getTime();

            if (currentGameStartTime - previousGameEndTime <= fatigueWindowMs) {
              // Player is playing within 3 minutes of their last game
              playerGameInARow.set(
                player.playerId,
                (previousGameTeamPlayer.gameInARow || 1) + 1
              );
            } else {
              // Reset the streak
              playerGameInARow.set(player.playerId, 1);
            }
          } else {
            playerGameInARow.set(player.playerId, 1);
          }
        } else {
          // No previous games
          playerGameInARow.set(player.playerId, 1);
        }
      }

      // Prepare player data with current ELOs, games played, and gameInARow
      const homeTeamData = homePlayers.map((tp) => ({
        playerId: tp.playerId,
        elo: playerElos.get(tp.playerId) || 1500,
        goals: tp.goals,
        gamesPlayed: playerGamesPlayed.get(tp.playerId) || 0,
        gameInARow: playerGameInARow.get(tp.playerId) || 1,
      }));

      const awayTeamData = awayPlayers.map((tp) => ({
        playerId: tp.playerId,
        elo: playerElos.get(tp.playerId) || 1500,
        goals: tp.goals,
        gamesPlayed: playerGamesPlayed.get(tp.playerId) || 0,
        gameInARow: playerGameInARow.get(tp.playerId) || 1,
      }));

      // Calculate ELO changes for this game
      const eloChanges = calculateGameElos(homeTeamData, awayTeamData);

      // Calculate average ELO for each team at time of game
      const homeAvgElo = Math.round(
        homeTeamData.reduce((sum, p) => sum + p.elo, 0) / homeTeamData.length
      );
      const awayAvgElo = Math.round(
        awayTeamData.reduce((sum, p) => sum + p.elo, 0) / awayTeamData.length
      );

      // Update player ELOs and TeamPlayer deltaELOs and gameInARow
      for (const [playerId, eloChange] of eloChanges.entries()) {
        // Update player's current ELO
        const newElo = (playerElos.get(playerId) || 1500) + eloChange;
        playerElos.set(playerId, newElo);

        // Increment games played
        const gamesPlayed = (playerGamesPlayed.get(playerId) || 0) + 1;
        playerGamesPlayed.set(playerId, gamesPlayed);

        // Update the TeamPlayer record's deltaELO and gameInARow
        await prisma.teamPlayer.updateMany({
          where: {
            gameId: game.id,
            playerId,
          },
          data: {
            deltaELO: eloChange,
            gameInARow: playerGameInARow.get(playerId) || 1,
          },
        });
      }

      // Update game with average ELOs at time of game
      await prisma.game.update({
        where: { id: game.id },
        data: {
          homeTeamAverageElo: homeAvgElo,
          awayTeamAverageElo: awayAvgElo,
        },
      });
    }

    // Update all players with their final ELOs
    for (const [playerId, elo] of playerElos.entries()) {
      await prisma.player.update({
        where: { id: playerId },
        data: { elo },
      });
    }

    return NextResponse.json({
      success: true,
      message: `Recomputed ELO for ${games.length} games`,
      gamesProcessed: games.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
