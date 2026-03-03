import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { calculateRidgeRatings, type GameData } from "@/lib/ridge-calculator";

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
 * POST /api/elo/compute
 *
 * Recomputes player ratings using ridge regression on all game history.
 * This recalculates all player ratings from scratch using batch ridge regression.
 *
 * Process:
 * 1. Convert all games to GameData format for ridge regression
 * 2. For each game chronologically:
 *    a. Compute ridge coefficients using all games BEFORE this game
 *    b. Compute ridge coefficients using all games UP TO AND INCLUDING this game
 *    c. Delta = difference in coefficients (rating change from this game)
 * 3. Update player ratings with final ridge coefficients
 * 4. Update PlayerLinks for player pair chemistry statistics
 *
 * Note: Fatigue and chemistry are still tracked in the database but NOT used
 * in ridge regression calculations (as per user requirements).
 */
export async function POST() {
  try {
    console.log("Starting ridge regression recomputation...");

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

    console.log(`Processing ${games.length} games...`);

    // Convert games to GameData format for ridge regression
    const gameDataList: GameData[] = games.map(game => {
      const homePlayers = game.teamPlayers.filter(tp => tp.side === "HOME");
      const awayPlayers = game.teamPlayers.filter(tp => tp.side === "AWAY");

      return {
        id: game.id,
        homePlayerIds: homePlayers.map(tp => tp.playerId),
        awayPlayerIds: awayPlayers.map(tp => tp.playerId),
        homeGoals: homePlayers.reduce((sum, tp) => sum + tp.goals, 0),
        awayGoals: awayPlayers.reduce((sum, tp) => sum + tp.goals, 0),
        homeGoalkeeperIds: homePlayers.filter(tp => tp.goalkeeper).map(tp => tp.playerId),
        awayGoalkeeperIds: awayPlayers.filter(tp => tp.goalkeeper).map(tp => tp.playerId),
      };
    });

    // Reset all players to 1500 ratings initially
    await prisma.player.updateMany({
      data: { elo: 1500, gkElo: 1500 },
    });

    // Clear all PlayerLinks for clean recomputation
    await prisma.playerLink.deleteMany({});

    console.log("Computing ridge regression deltas for each game...");

    // Process each game to compute deltas
    for (let i = 0; i < games.length; i++) {
      const currentGame = games[i];

      // Compute ratings using games BEFORE this game
      const gamesBeforeThis = gameDataList.slice(0, i);
      const ratingsBefore = gamesBeforeThis.length > 0
        ? calculateRidgeRatings(gamesBeforeThis)
        : new Map(); // Empty = everyone at 1500

      // Compute ratings using games UP TO AND INCLUDING this game
      const gamesIncludingThis = gameDataList.slice(0, i + 1);
      const ratingsAfter = calculateRidgeRatings(gamesIncludingThis);

      // Calculate deltas and team averages for this game
      const homePlayers = currentGame.teamPlayers.filter(tp => tp.side === "HOME");
      const awayPlayers = currentGame.teamPlayers.filter(tp => tp.side === "AWAY");

      let homeEloSum = 0;
      let awayEloSum = 0;

      // Update each player's delta
      for (const tp of [...homePlayers, ...awayPlayers]) {
        const ratingData = ratingsAfter.get(tp.playerId);

        // Determine which rating to use based on goalkeeper status
        const isGoalkeeper = tp.goalkeeper;
        const afterRating = ratingData
          ? (isGoalkeeper ? ratingData.gkElo : ratingData.elo)
          : 1500;

        const beforeRatingData = ratingsBefore.get(tp.playerId);
        const beforeRating = beforeRatingData
          ? (isGoalkeeper ? beforeRatingData.gkElo : beforeRatingData.elo)
          : 1500;

        const delta = afterRating - beforeRating;

        // Update TeamPlayer with delta
        await prisma.teamPlayer.updateMany({
          where: {
            gameId: currentGame.id,
            playerId: tp.playerId,
          },
          data: {
            deltaELO: delta,
          },
        });

        // Accumulate for team averages (use the rating BEFORE this game)
        if (tp.side === "HOME") {
          homeEloSum += beforeRating;
        } else {
          awayEloSum += beforeRating;
        }
      }

      // Calculate team averages
      const homeAvgElo = homePlayers.length > 0
        ? Math.round(homeEloSum / homePlayers.length)
        : 1500;
      const awayAvgElo = awayPlayers.length > 0
        ? Math.round(awayEloSum / awayPlayers.length)
        : 1500;

      // Update game with team averages
      await prisma.game.update({
        where: { id: currentGame.id },
        data: {
          homeTeamAverageElo: homeAvgElo,
          awayTeamAverageElo: awayAvgElo,
        },
      });

      // Update PlayerLinks for chemistry tracking
      const homeGoals = homePlayers.reduce((sum, tp) => sum + tp.goals, 0);
      const awayGoals = awayPlayers.reduce((sum, tp) => sum + tp.goals, 0);

      // Process home team pairs
      const homePairs = generatePlayerPairs(homePlayers.map(tp => tp.playerId));
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

      // Process away team pairs
      const awayPairs = generatePlayerPairs(awayPlayers.map(tp => tp.playerId));
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

      // Log progress every 10 games
      if ((i + 1) % 10 === 0) {
        console.log(`Processed ${i + 1}/${games.length} games...`);
      }
    }

    console.log("Computing final ratings for all players...");

    // Compute final ratings using ALL games
    const finalRatings = calculateRidgeRatings(gameDataList);

    // Update all players with their final ratings
    for (const [playerId, rating] of finalRatings.entries()) {
      await prisma.player.update({
        where: { id: playerId },
        data: {
          elo: rating.elo,
          gkElo: rating.gkElo,
        },
      });
    }

    // Count total player links created
    const totalLinks = await prisma.playerLink.count();

    console.log("Ridge regression recomputation complete!");

    return NextResponse.json({
      success: true,
      message: `Recomputed ratings using ridge regression for ${games.length} games and tracked ${totalLinks} player pair links`,
      gamesProcessed: games.length,
      playerLinksTracked: totalLinks,
      playersUpdated: finalRatings.size,
    });
  } catch (error) {
    console.error("Ridge Regression Compute Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: message, details: error instanceof Error ? error.stack : "" },
      { status: 500 }
    );
  }
}
