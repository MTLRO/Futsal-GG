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

    // Reset all players to 1500 ELO and clear all fatigue
    await prisma.player.updateMany({
      data: { elo: 1500 },
    });

    // Reset all TeamPlayer fatigue to 0 for clean recomputation
    await prisma.teamPlayer.updateMany({
      data: { fatigueX: 0 },
    });

    // Track current ELO for each player during recomputation
    const playerElos = new Map<number, number>();
    // Track games played for each player
    const playerGamesPlayed = new Map<number, number>();
    // Track fatigueX for each player
    const playerFatigueX = new Map<number, number>();

    // Initialize all players with 1500 ELO, 0 games, and 0 fatigue
    const allPlayers = await prisma.player.findMany();
    for (const player of allPlayers) {
      playerElos.set(player.id, 1500);
      playerGamesPlayed.set(player.id, 0);
      playerFatigueX.set(player.id, 0);
    }

    // Process each game in chronological order
    for (const game of games) {
      // Group players by side
      const homePlayers = game.teamPlayers.filter((tp) => tp.side === "HOME");
      const awayPlayers = game.teamPlayers.filter((tp) => tp.side === "AWAY");

      // Calculate fatigueX for each player based on game duration and time since last game
      const playerNewFatigueX = new Map<number, number>();

      for (const player of [...homePlayers, ...awayPlayers]) {
        // Find this player's most recent previous game
        let previousGameTeamPlayer = null;
        let previousGame = null;

        for (let i = games.length - 1; i >= 0; i--) {
          const g = games[i];
          if (g.startDateTime >= game.startDateTime) continue; // Skip current game and later games

          const tp = g.teamPlayers.find((tp) => tp.playerId === player.playerId);
          if (tp) {
            previousGameTeamPlayer = tp;
            previousGame = g;
            break;
          }
        }

        if (previousGame && previousGameTeamPlayer) {
          const previousGameEndTime =
            new Date(previousGame.startDateTime).getTime() +
            (previousGame.timePlayed || 0) * 1000;

          const currentGameStartTime = new Date(game.startDateTime).getTime();

          // Calculate minutes since last game ended
          const minutesSincePreviousGame = Math.floor(
            (currentGameStartTime - previousGameEndTime) / (60 * 1000)
          );

          // Get the previous game's fatigue and duration
          const previousGameDurationMinutes = Math.round((previousGame.timePlayed || 0) / 60);
          const previousFatigueBefore = previousGameTeamPlayer.fatigueX || 0;
          const previousFatigueAfter = previousFatigueBefore + previousGameDurationMinutes;

          // Decay fatigue by 1 per minute since last game, minimum 0
          const newFatigueX = Math.max(
            0,
            previousFatigueAfter - minutesSincePreviousGame
          );

          playerNewFatigueX.set(player.playerId, newFatigueX);
        } else {
          // No previous games - first game, player is fresh
          playerNewFatigueX.set(player.playerId, 0);
        }
      }

      // Prepare player data with current ELOs, games played, and fatigueX
      const homeTeamData = homePlayers.map((tp) => ({
        playerId: tp.playerId,
        elo: playerElos.get(tp.playerId) || 1500,
        goals: tp.goals,
        gamesPlayed: playerGamesPlayed.get(tp.playerId) || 0,
        fatigueX: playerNewFatigueX.get(tp.playerId) || 0,
      }));

      const awayTeamData = awayPlayers.map((tp) => ({
        playerId: tp.playerId,
        elo: playerElos.get(tp.playerId) || 1500,
        goals: tp.goals,
        gamesPlayed: playerGamesPlayed.get(tp.playerId) || 0,
        fatigueX: playerNewFatigueX.get(tp.playerId) || 0,
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

      // Update player ELOs and TeamPlayer deltaELOs and fatigueX
      for (const [playerId, eloChange] of eloChanges.entries()) {
        // Update player's current ELO
        const newElo = (playerElos.get(playerId) || 1500) + eloChange;
        playerElos.set(playerId, newElo);

        // Increment games played
        const gamesPlayed = (playerGamesPlayed.get(playerId) || 0) + 1;
        playerGamesPlayed.set(playerId, gamesPlayed);

        // Update accumulated fatigue for next game calculation
        // This is the fatigue AFTER this game (before decay for the next game)
        const gameDurationMinutes = Math.round((game.timePlayed || 0) / 60);
        const fatigueAfterThisGame = (playerNewFatigueX.get(playerId) || 0) + gameDurationMinutes;
        playerFatigueX.set(playerId, fatigueAfterThisGame);

        // Update the TeamPlayer record's deltaELO and fatigueX
        const fatigueForThisGame = playerNewFatigueX.get(playerId) || 0;
        await prisma.teamPlayer.updateMany({
          where: {
            gameId: game.id,
            playerId,
          },
          data: {
            deltaELO: eloChange,
            fatigueX: fatigueForThisGame,
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
    console.error("ELO Compute Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message, details: error instanceof Error ? error.stack : "" }, { status: 500 });
  }
}
