import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { calculateGameElos, ChemistryData } from "@/lib/elo-calculator";

/**
 * Helper function to generate all unique pairs from an array of player IDs
 * Returns pairs where player1Id < player2Id (for consistent ordering)
 */
function generatePlayerPairs(playerIds: number[]): Array<[number, number]> {
  const pairs: Array<[number, number]> = [];
  for (let i = 0; i < playerIds.length; i++) {
    for (let j = i + 1; j < playerIds.length; j++) {
      const [p1, p2] = [playerIds[i], playerIds[j]].sort((a, b) => a - b);
      pairs.push([p1, p2]);
    }
  }
  return pairs;
}

/**
 * Helper function to generate a unique key for a player pair
 * Always orders IDs consistently (smaller ID first)
 */
function getPlayerPairKey(player1Id: number, player2Id: number): string {
  const [p1, p2] = [player1Id, player2Id].sort((a, b) => a - b);
  return `${p1}-${p2}`;
}

/**
 * Helper function to get chemistry data for a player with their teammates
 * Uses the in-memory player link tracking to get historical chemistry
 */
function getChemistryDataForPlayer(
  playerId: number,
  teammateIds: number[],
  playerLinks: Map<string, { wins: number; losses: number; draws: number }>
): ChemistryData[] {
  return teammateIds.map((teammateId) => {
    const key = getPlayerPairKey(playerId, teammateId);
    const linkData = playerLinks.get(key) || { wins: 0, losses: 0, draws: 0 };
    return {
      playerId: teammateId,
      wins: linkData.wins,
      losses: linkData.losses,
      draws: linkData.draws,
    };
  });
}

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
 * 5. Update PlayerLinks for player pair statistics
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

    // Reset all players to 1500 ELO (both regular and GK) and clear all fatigue
    await prisma.player.updateMany({
      data: { elo: 1500, gkElo: 1500 },
    });

    // Reset all TeamPlayer fatigue to 0 for clean recomputation
    await prisma.teamPlayer.updateMany({
      data: { fatigueX: 0 },
    });

    // Clear all PlayerLinks for clean recomputation
    await prisma.playerLink.deleteMany({});

    // Track current ELO for each player during recomputation
    const playerElos = new Map<number, number>();
    const playerGkElos = new Map<number, number>();
    // Track games played for each player
    const playerGamesPlayed = new Map<number, number>();
    // Track fatigueX for each player
    const playerFatigueX = new Map<number, number>();
    // Track player link chemistry data (wins/losses/draws for each player pair)
    const playerLinks = new Map<string, { wins: number; losses: number; draws: number }>();

    // Initialize all players with 1500 ELO (both regular and GK), 0 games, and 0 fatigue
    const allPlayers = await prisma.player.findMany();
    for (const player of allPlayers) {
      playerElos.set(player.id, 1500);
      playerGkElos.set(player.id, 1500);
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

      // Prepare player data with current ELOs, games played, fatigueX, and chemistry
      const homePlayerIds = homePlayers.map((tp) => tp.playerId);
      const awayPlayerIds = awayPlayers.map((tp) => tp.playerId);

      const homeTeamData = homePlayers.map((tp) => {
        // Get teammate IDs (all home players except this one)
        const teammateIds = homePlayerIds.filter((id) => id !== tp.playerId);
        // Get chemistry data with teammates
        const teammatesChemistry = getChemistryDataForPlayer(tp.playerId, teammateIds, playerLinks);

        // Use position-specific ELO: gkElo if goalkeeper, else regular elo
        const currentElo = tp.goalkeeper
          ? (playerGkElos.get(tp.playerId) || 1500)
          : (playerElos.get(tp.playerId) || 1500);

        return {
          playerId: tp.playerId,
          elo: currentElo,
          goals: tp.goals,
          gamesPlayed: playerGamesPlayed.get(tp.playerId) || 0,
          fatigueX: playerNewFatigueX.get(tp.playerId) || 0,
          teammatesChemistry,
        };
      });

      const awayTeamData = awayPlayers.map((tp) => {
        // Get teammate IDs (all away players except this one)
        const teammateIds = awayPlayerIds.filter((id) => id !== tp.playerId);
        // Get chemistry data with teammates
        const teammatesChemistry = getChemistryDataForPlayer(tp.playerId, teammateIds, playerLinks);

        // Use position-specific ELO: gkElo if goalkeeper, else regular elo
        const currentElo = tp.goalkeeper
          ? (playerGkElos.get(tp.playerId) || 1500)
          : (playerElos.get(tp.playerId) || 1500);

        return {
          playerId: tp.playerId,
          elo: currentElo,
          goals: tp.goals,
          gamesPlayed: playerGamesPlayed.get(tp.playerId) || 0,
          fatigueX: playerNewFatigueX.get(tp.playerId) || 0,
          teammatesChemistry,
        };
      });

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
        // Determine if this player was a goalkeeper in this game
        const teamPlayer = [...homePlayers, ...awayPlayers].find(tp => tp.playerId === playerId);
        const wasGoalkeeper = teamPlayer?.goalkeeper || false;

        // Update the appropriate ELO rating
        if (wasGoalkeeper) {
          const newGkElo = (playerGkElos.get(playerId) || 1500) + eloChange;
          playerGkElos.set(playerId, newGkElo);
        } else {
          const newElo = (playerElos.get(playerId) || 1500) + eloChange;
          playerElos.set(playerId, newElo);
        }

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

      // Update PlayerLinks for player pairs on each team
      // Determine game result based on goals scored
      const homeGoals = homePlayers.reduce((sum, tp) => sum + tp.goals, 0);
      const awayGoals = awayPlayers.reduce((sum, tp) => sum + tp.goals, 0);

      // Generate all pairs for home team and update their stats
      const homePairs = generatePlayerPairs(homePlayerIds);

      for (const [player1Id, player2Id] of homePairs) {
        const pairKey = getPlayerPairKey(player1Id, player2Id);
        const existingLink = playerLinks.get(pairKey) || { wins: 0, losses: 0, draws: 0 };

        // Update in-memory tracking
        if (homeGoals > awayGoals) {
          existingLink.wins++;
        } else if (homeGoals < awayGoals) {
          existingLink.losses++;
        } else {
          existingLink.draws++;
        }
        playerLinks.set(pairKey, existingLink);

        // Determine the result for the home team
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

      // Generate all pairs for away team and update their stats
      const awayPairs = generatePlayerPairs(awayPlayerIds);

      for (const [player1Id, player2Id] of awayPairs) {
        const pairKey = getPlayerPairKey(player1Id, player2Id);
        const existingLink = playerLinks.get(pairKey) || { wins: 0, losses: 0, draws: 0 };

        // Update in-memory tracking
        if (awayGoals > homeGoals) {
          existingLink.wins++;
        } else if (awayGoals < homeGoals) {
          existingLink.losses++;
        } else {
          existingLink.draws++;
        }
        playerLinks.set(pairKey, existingLink);

        // Determine the result for the away team
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
    }

    // Update all players with their final ELOs (both regular and GK)
    for (const [playerId, elo] of playerElos.entries()) {
      await prisma.player.update({
        where: { id: playerId },
        data: {
          elo,
          gkElo: playerGkElos.get(playerId) || 1500,
        },
      });
    }

    // Count total player links created
    const totalLinks = await prisma.playerLink.count();

    return NextResponse.json({
      success: true,
      message: `Recomputed ELO for ${games.length} games and tracked ${totalLinks} player pair links`,
      gamesProcessed: games.length,
      playerLinksTracked: totalLinks,
    });
  } catch (error) {
    console.error("ELO Compute Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message, details: error instanceof Error ? error.stack : "" }, { status: 500 });
  }
}
