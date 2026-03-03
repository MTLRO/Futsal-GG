import { PrismaClient } from '@prisma/client';
import { ridgeRegression } from '../src/lib/ridge-calculator/MatrixOperations';

const prisma = new PrismaClient();

interface GameData {
  id: number;
  homePlayerIds: number[];
  awayPlayerIds: number[];
  homeGoals: number;
  awayGoals: number;
  homeWin: boolean;
  awayWin: boolean;
  isDraw: boolean;
}

/**
 * Test with win/loss as target (instead of goal difference)
 */
function testWinLossTarget(games: GameData[], lambda: number, kFolds: number = 5) {
  const foldSize = Math.floor(games.length / kFolds);
  let totalCorrect = 0;
  let totalGames = 0;

  for (let fold = 0; fold < kFolds; fold++) {
    const testStart = fold * foldSize;
    const testEnd = fold === kFolds - 1 ? games.length : (fold + 1) * foldSize;

    const trainGames = [...games.slice(0, testStart), ...games.slice(testEnd)];
    const testGames = games.slice(testStart, testEnd);

    if (trainGames.length === 0 || testGames.length === 0) continue;

    // Build design matrix
    const playerIdSet = new Set<number>();
    trainGames.forEach(g => {
      g.homePlayerIds.forEach(id => playerIdSet.add(id));
      g.awayPlayerIds.forEach(id => playerIdSet.add(id));
    });

    const playerIds = Array.from(playerIdSet).sort((a, b) => a - b);
    const playerIdToIndex = new Map(playerIds.map((id, idx) => [id, idx]));

    const X: number[][] = [];
    const y: number[] = [];

    for (const game of trainGames) {
      const row = Array(playerIds.length).fill(0);
      game.homePlayerIds.forEach(id => {
        const idx = playerIdToIndex.get(id);
        if (idx !== undefined) row[idx] = 1;
      });
      game.awayPlayerIds.forEach(id => {
        const idx = playerIdToIndex.get(id);
        if (idx !== undefined) row[idx] = -1;
      });
      X.push(row);

      // Target: +1 for home win, -1 for away win, 0 for draw
      if (game.homeWin) y.push(1);
      else if (game.awayWin) y.push(-1);
      else y.push(0);
    }

    const coefficients = ridgeRegression(X, y, lambda);
    const playerCoefficients = new Map(playerIds.map((id, idx) => [id, coefficients[idx]]));

    // Test
    let foldCorrect = 0;
    for (const game of testGames) {
      let homeStrength = 0;
      let awayStrength = 0;

      game.homePlayerIds.forEach(id => {
        homeStrength += playerCoefficients.get(id) || 0;
      });
      game.awayPlayerIds.forEach(id => {
        awayStrength += playerCoefficients.get(id) || 0;
      });

      const prediction = homeStrength - awayStrength;
      const predictedOutcome = prediction > 0 ? 'HOME' : prediction < 0 ? 'AWAY' : 'DRAW';
      const actualOutcome = game.homeWin ? 'HOME' : game.awayWin ? 'AWAY' : 'DRAW';

      if (predictedOutcome === actualOutcome) {
        foldCorrect++;
      }
    }

    totalCorrect += foldCorrect;
    totalGames += testGames.length;
  }

  const accuracy = totalGames > 0 ? (totalCorrect / totalGames) * 100 : 0;
  return { accuracy, details: `${totalCorrect}/${totalGames} correct` };
}

/**
 * Simple model: just use average win rate per player (baseline)
 */
function testWinRateBaseline(games: GameData[], kFolds: number = 5) {
  const foldSize = Math.floor(games.length / kFolds);
  let totalCorrect = 0;
  let totalGames = 0;

  for (let fold = 0; fold < kFolds; fold++) {
    const testStart = fold * foldSize;
    const testEnd = fold === kFolds - 1 ? games.length : (fold + 1) * foldSize;

    const trainGames = [...games.slice(0, testStart), ...games.slice(testEnd)];
    const testGames = games.slice(testStart, testEnd);

    if (trainGames.length === 0 || testGames.length === 0) continue;

    // Calculate win rate for each player
    const playerStats = new Map<number, { wins: number; total: number }>();

    trainGames.forEach(game => {
      game.homePlayerIds.forEach(id => {
        const stats = playerStats.get(id) || { wins: 0, total: 0 };
        stats.total++;
        if (game.homeWin) stats.wins++;
        playerStats.set(id, stats);
      });
      game.awayPlayerIds.forEach(id => {
        const stats = playerStats.get(id) || { wins: 0, total: 0 };
        stats.total++;
        if (game.awayWin) stats.wins++;
        playerStats.set(id, stats);
      });
    });

    const playerWinRates = new Map<number, number>();
    for (const [id, stats] of playerStats) {
      playerWinRates.set(id, stats.total > 0 ? stats.wins / stats.total : 0.5);
    }

    // Test
    let foldCorrect = 0;
    for (const game of testGames) {
      let homeWinProb = 0;
      let awayWinProb = 0;

      game.homePlayerIds.forEach(id => {
        homeWinProb += playerWinRates.get(id) || 0.5;
      });
      game.awayPlayerIds.forEach(id => {
        awayWinProb += playerWinRates.get(id) || 0.5;
      });

      const prediction = homeWinProb - awayWinProb;
      const predictedOutcome = prediction > 0 ? 'HOME' : prediction < 0 ? 'AWAY' : 'DRAW';
      const actualOutcome = game.homeWin ? 'HOME' : game.awayWin ? 'AWAY' : 'DRAW';

      if (predictedOutcome === actualOutcome) {
        foldCorrect++;
      }
    }

    totalCorrect += foldCorrect;
    totalGames += testGames.length;
  }

  const accuracy = totalGames > 0 ? (totalCorrect / totalGames) * 100 : 0;
  return { accuracy, details: `${totalCorrect}/${totalGames} correct` };
}

/**
 * Test with team size normalization (divide by number of players)
 */
function testWithTeamSizeNorm(games: GameData[], lambda: number, kFolds: number = 5) {
  const foldSize = Math.floor(games.length / kFolds);
  let totalCorrect = 0;
  let totalGames = 0;

  for (let fold = 0; fold < kFolds; fold++) {
    const testStart = fold * foldSize;
    const testEnd = fold === kFolds - 1 ? games.length : (fold + 1) * foldSize;

    const trainGames = [...games.slice(0, testStart), ...games.slice(testEnd)];
    const testGames = games.slice(testStart, testEnd);

    if (trainGames.length === 0 || testGames.length === 0) continue;

    const playerIdSet = new Set<number>();
    trainGames.forEach(g => {
      g.homePlayerIds.forEach(id => playerIdSet.add(id));
      g.awayPlayerIds.forEach(id => playerIdSet.add(id));
    });

    const playerIds = Array.from(playerIdSet).sort((a, b) => a - b);
    const playerIdToIndex = new Map(playerIds.map((id, idx) => [id, idx]));

    const X: number[][] = [];
    const y: number[] = [];

    for (const game of trainGames) {
      const row = Array(playerIds.length).fill(0);
      const homeSize = game.homePlayerIds.length;
      const awaySize = game.awayPlayerIds.length;

      game.homePlayerIds.forEach(id => {
        const idx = playerIdToIndex.get(id);
        if (idx !== undefined) row[idx] = 1 / homeSize; // Normalize by team size
      });
      game.awayPlayerIds.forEach(id => {
        const idx = playerIdToIndex.get(id);
        if (idx !== undefined) row[idx] = -1 / awaySize; // Normalize by team size
      });
      X.push(row);
      y.push(game.homeGoals - game.awayGoals);
    }

    const coefficients = ridgeRegression(X, y, lambda);
    const playerCoefficients = new Map(playerIds.map((id, idx) => [id, coefficients[idx]]));

    let foldCorrect = 0;
    for (const game of testGames) {
      let homeStrength = 0;
      let awayStrength = 0;

      const homeSize = game.homePlayerIds.length;
      const awaySize = game.awayPlayerIds.length;

      game.homePlayerIds.forEach(id => {
        homeStrength += (playerCoefficients.get(id) || 0) / homeSize;
      });
      game.awayPlayerIds.forEach(id => {
        awayStrength += (playerCoefficients.get(id) || 0) / awaySize;
      });

      const prediction = homeStrength - awayStrength;
      const predictedOutcome = prediction > 0 ? 'HOME' : prediction < 0 ? 'AWAY' : 'DRAW';
      const actualOutcome = game.homeWin ? 'HOME' : game.awayWin ? 'AWAY' : 'DRAW';

      if (predictedOutcome === actualOutcome) {
        foldCorrect++;
      }
    }

    totalCorrect += foldCorrect;
    totalGames += testGames.length;
  }

  const accuracy = totalGames > 0 ? (totalCorrect / totalGames) * 100 : 0;
  return { accuracy, details: `${totalCorrect}/${totalGames} correct` };
}

async function main() {
  console.log('=== Testing Alternative Ridge Regression Models ===\n');

  const gamesData = await prisma.game.findMany({
    orderBy: { startDateTime: 'asc' },
    include: {
      teamPlayers: {
        include: {
          player: true,
        },
      },
    },
  });

  console.log(`Loaded ${gamesData.length} games\n`);

  const games: GameData[] = gamesData.map(game => {
    const homePlayers = game.teamPlayers.filter(tp => tp.side === 'HOME');
    const awayPlayers = game.teamPlayers.filter(tp => tp.side === 'AWAY');
    const homeGoals = homePlayers.reduce((sum, tp) => sum + tp.goals, 0);
    const awayGoals = awayPlayers.reduce((sum, tp) => sum + tp.goals, 0);

    return {
      id: game.id,
      homePlayerIds: homePlayers.map(tp => tp.playerId),
      awayPlayerIds: awayPlayers.map(tp => tp.playerId),
      homeGoals,
      awayGoals,
      homeWin: homeGoals > awayGoals,
      awayWin: awayGoals > homeGoals,
      isDraw: homeGoals === awayGoals,
    };
  });

  console.log('1. BASELINE: Simple win rate model\n');
  const baselineResult = testWinRateBaseline(games, 5);
  console.log(`Win rate baseline: ${baselineResult.accuracy.toFixed(2)}% (${baselineResult.details})\n`);

  console.log('2. WIN/LOSS TARGET (instead of goal difference)\n');
  const lambdas = [0.1, 1.0, 10.0, 100.0];
  let bestWLLambda = 1.0;
  let bestWLAccuracy = 0;

  for (const lambda of lambdas) {
    const result = testWinLossTarget(games, lambda, 5);
    console.log(`Lambda ${lambda}: ${result.accuracy.toFixed(2)}% (${result.details})`);
    if (result.accuracy > bestWLAccuracy) {
      bestWLAccuracy = result.accuracy;
      bestWLLambda = lambda;
    }
  }
  console.log(`\n✓ Best win/loss model: lambda=${bestWLLambda}, accuracy=${bestWLAccuracy.toFixed(2)}%\n`);

  console.log('3. TEAM SIZE NORMALIZATION\n');
  let bestNormLambda = 1.0;
  let bestNormAccuracy = 0;

  for (const lambda of lambdas) {
    const result = testWithTeamSizeNorm(games, lambda, 5);
    console.log(`Lambda ${lambda}: ${result.accuracy.toFixed(2)}% (${result.details})`);
    if (result.accuracy > bestNormAccuracy) {
      bestNormAccuracy = result.accuracy;
      bestNormLambda = lambda;
    }
  }
  console.log(`\n✓ Best normalized model: lambda=${bestNormLambda}, accuracy=${bestNormAccuracy.toFixed(2)}%\n`);

  console.log('=== RESULTS SUMMARY ===\n');
  console.log(`Current model (goal diff, lambda=1.0): ~57% (training accuracy)`);
  console.log(`True cross-validated accuracy: ~48%\n`);
  console.log(`Alternative models:`);
  console.log(`1. Win rate baseline: ${baselineResult.accuracy.toFixed(2)}%`);
  console.log(`2. Win/loss target: ${bestWLAccuracy.toFixed(2)}%`);
  console.log(`3. Team size normalized: ${bestNormAccuracy.toFixed(2)}%`);

  const bestOverall = Math.max(baselineResult.accuracy, bestWLAccuracy, bestNormAccuracy);
  console.log(`\n✓ Best model: ${bestOverall.toFixed(2)}% accuracy`);

  if (bestOverall < 55) {
    console.log(`\n⚠️  WARNING: All models show <55% cross-validated accuracy.`);
    console.log(`   This suggests the dataset (88 games, 29 players) is too small`);
    console.log(`   for reliable statistical modeling. Consider:`);
    console.log(`   - Collecting more game data (target: 200+ games)`);
    console.log(`   - Using simpler metrics (win rate, ELO)`);
    console.log(`   - Combining multiple models (ensemble)`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
