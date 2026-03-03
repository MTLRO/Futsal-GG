import { PrismaClient } from '@prisma/client';
import { ridgeRegression, solveLinearSystem } from '../src/lib/ridge-calculator/MatrixOperations';

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
 * Cross-validation: split data into k folds and test prediction accuracy
 */
function crossValidate(
  games: GameData[],
  lambda: number,
  kFolds: number = 5
): { accuracy: number; details: string } {
  const foldSize = Math.floor(games.length / kFolds);
  let totalCorrect = 0;
  let totalGames = 0;

  for (let fold = 0; fold < kFolds; fold++) {
    // Split into train and test
    const testStart = fold * foldSize;
    const testEnd = fold === kFolds - 1 ? games.length : (fold + 1) * foldSize;

    const trainGames = [...games.slice(0, testStart), ...games.slice(testEnd)];
    const testGames = games.slice(testStart, testEnd);

    if (trainGames.length === 0 || testGames.length === 0) continue;

    // Build design matrix from training data
    const playerIdSet = new Set<number>();
    trainGames.forEach(g => {
      g.homePlayerIds.forEach(id => playerIdSet.add(id));
      g.awayPlayerIds.forEach(id => playerIdSet.add(id));
    });

    const playerIds = Array.from(playerIdSet).sort((a, b) => a - b);
    const playerIdToIndex = new Map(playerIds.map((id, idx) => [id, idx]));

    // Build X and y for training
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
      y.push(game.homeGoals - game.awayGoals);
    }

    // Train model
    const coefficients = ridgeRegression(X, y, lambda);
    const playerCoefficients = new Map(playerIds.map((id, idx) => [id, coefficients[idx]]));

    // Test on held-out data
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
  return {
    accuracy,
    details: `${totalCorrect}/${totalGames} correct predictions`,
  };
}

/**
 * Test model with home advantage feature
 */
function testWithHomeAdvantage(
  games: GameData[],
  lambda: number,
  homeAdvantageWeight: number,
  kFolds: number = 5
): { accuracy: number; details: string } {
  const foldSize = Math.floor(games.length / kFolds);
  let totalCorrect = 0;
  let totalGames = 0;

  for (let fold = 0; fold < kFolds; fold++) {
    const testStart = fold * foldSize;
    const testEnd = fold === kFolds - 1 ? games.length : (fold + 1) * foldSize;

    const trainGames = [...games.slice(0, testStart), ...games.slice(testEnd)];
    const testGames = games.slice(testStart, testEnd);

    if (trainGames.length === 0 || testGames.length === 0) continue;

    // Build design matrix with home advantage column
    const playerIdSet = new Set<number>();
    trainGames.forEach(g => {
      g.homePlayerIds.forEach(id => playerIdSet.add(id));
      g.awayPlayerIds.forEach(id => playerIdSet.add(id));
    });

    const playerIds = Array.from(playerIdSet).sort((a, b) => a - b);
    const playerIdToIndex = new Map(playerIds.map((id, idx) => [id, idx]));

    // Design matrix: [player1, player2, ..., playerN, homeAdvantage]
    const X: number[][] = [];
    const y: number[] = [];

    for (const game of trainGames) {
      const row = Array(playerIds.length + 1).fill(0);
      game.homePlayerIds.forEach(id => {
        const idx = playerIdToIndex.get(id);
        if (idx !== undefined) row[idx] = 1;
      });
      game.awayPlayerIds.forEach(id => {
        const idx = playerIdToIndex.get(id);
        if (idx !== undefined) row[idx] = -1;
      });
      row[playerIds.length] = homeAdvantageWeight; // Home advantage feature
      X.push(row);
      y.push(game.homeGoals - game.awayGoals);
    }

    // Train model
    const coefficients = ridgeRegression(X, y, lambda);
    const playerCoefficients = new Map(playerIds.map((id, idx) => [id, coefficients[idx]]));
    const homeAdvantagCoeff = coefficients[playerIds.length];

    // Test
    let foldCorrect = 0;
    for (const game of testGames) {
      let homeStrength = homeAdvantagCoeff * homeAdvantageWeight;
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
  return {
    accuracy,
    details: `${totalCorrect}/${totalGames} correct with home advantage`,
  };
}

/**
 * Temporal weighting: weight recent games more heavily
 */
function testWithTemporalWeighting(
  games: GameData[],
  lambda: number,
  decayRate: number = 0.95
): { accuracy: number; details: string } {
  // Build design matrix with temporal weights
  const playerIdSet = new Set<number>();
  games.forEach(g => {
    g.homePlayerIds.forEach(id => playerIdSet.add(id));
    g.awayPlayerIds.forEach(id => playerIdSet.add(id));
  });

  const playerIds = Array.from(playerIdSet).sort((a, b) => a - b);
  const playerIdToIndex = new Map(playerIds.map((id, idx) => [id, idx]));

  const X: number[][] = [];
  const y: number[] = [];
  const weights: number[] = [];

  // Assign higher weights to recent games
  games.forEach((game, idx) => {
    const row = Array(playerIds.length).fill(0);
    game.homePlayerIds.forEach(id => {
      const pIdx = playerIdToIndex.get(id);
      if (pIdx !== undefined) row[pIdx] = 1;
    });
    game.awayPlayerIds.forEach(id => {
      const pIdx = playerIdToIndex.get(id);
      if (pIdx !== undefined) row[pIdx] = -1;
    });

    // Weight: more recent games get higher weight
    const weight = Math.pow(decayRate, games.length - idx - 1);

    X.push(row);
    y.push(game.homeGoals - game.awayGoals);
    weights.push(weight);
  });

  // Apply weights to X and y (weighted ridge regression)
  const Xw = X.map((row, i) => row.map(val => val * Math.sqrt(weights[i])));
  const yw = y.map((val, i) => val * Math.sqrt(weights[i]));

  const coefficients = ridgeRegression(Xw, yw, lambda);
  const playerCoefficients = new Map(playerIds.map((id, idx) => [id, coefficients[idx]]));

  // Test on all games
  let correct = 0;
  for (const game of games) {
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
      correct++;
    }
  }

  const accuracy = (correct / games.length) * 100;
  return {
    accuracy,
    details: `${correct}/${games.length} correct with temporal weighting (decay=${decayRate})`,
  };
}

async function main() {
  console.log('=== Ridge Regression Optimization Analysis ===\n');

  // Fetch all games
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

  // Convert to GameData format
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

  // 1. Test different lambda values with cross-validation
  console.log('1. TESTING DIFFERENT LAMBDA VALUES (5-fold cross-validation)\n');
  const lambdaValues = [0.001, 0.01, 0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 50.0, 100.0];

  let bestLambda = 1.0;
  let bestAccuracy = 0;

  for (const lambda of lambdaValues) {
    const result = crossValidate(games, lambda, 5);
    console.log(`Lambda = ${lambda.toString().padStart(6)}: ${result.accuracy.toFixed(2)}% (${result.details})`);

    if (result.accuracy > bestAccuracy) {
      bestAccuracy = result.accuracy;
      bestLambda = lambda;
    }
  }

  console.log(`\n✓ Best lambda: ${bestLambda} with ${bestAccuracy.toFixed(2)}% accuracy\n`);

  // 2. Test with home advantage
  console.log('2. TESTING HOME ADVANTAGE FEATURE\n');
  const homeAdvantageWeights = [0, 0.25, 0.5, 0.75, 1.0, 1.5, 2.0];

  let bestHomeAdvantage = 0;
  let bestHomeAccuracy = 0;

  for (const weight of homeAdvantageWeights) {
    const result = testWithHomeAdvantage(games, bestLambda, weight, 5);
    console.log(`Home advantage weight = ${weight}: ${result.accuracy.toFixed(2)}% (${result.details})`);

    if (result.accuracy > bestHomeAccuracy) {
      bestHomeAccuracy = result.accuracy;
      bestHomeAdvantage = weight;
    }
  }

  console.log(`\n✓ Best home advantage: ${bestHomeAdvantage} with ${bestHomeAccuracy.toFixed(2)}% accuracy\n`);

  // 3. Test temporal weighting
  console.log('3. TESTING TEMPORAL WEIGHTING (recent games weighted more)\n');
  const decayRates = [0.90, 0.93, 0.95, 0.97, 0.99, 1.0];

  let bestDecayRate = 1.0;
  let bestTemporalAccuracy = 0;

  for (const decay of decayRates) {
    const result = testWithTemporalWeighting(games, bestLambda, decay);
    console.log(`Decay rate = ${decay}: ${result.accuracy.toFixed(2)}% (${result.details})`);

    if (result.accuracy > bestTemporalAccuracy) {
      bestTemporalAccuracy = result.accuracy;
      bestDecayRate = decay;
    }
  }

  console.log(`\n✓ Best decay rate: ${bestDecayRate} with ${bestTemporalAccuracy.toFixed(2)}% accuracy\n`);

  // 4. Summary and recommendations
  console.log('=== SUMMARY AND RECOMMENDATIONS ===\n');
  console.log(`Current model (lambda=1.0): ~57% accuracy`);
  console.log(`\nImprovements found:`);
  console.log(`1. Optimal lambda: ${bestLambda} → ${bestAccuracy.toFixed(2)}% accuracy (+${(bestAccuracy - 57).toFixed(2)}%)`);
  console.log(`2. With home advantage: ${bestHomeAdvantage} → ${bestHomeAccuracy.toFixed(2)}% accuracy (+${(bestHomeAccuracy - 57).toFixed(2)}%)`);
  console.log(`3. With temporal weighting: ${bestDecayRate} → ${bestTemporalAccuracy.toFixed(2)}% accuracy (+${(bestTemporalAccuracy - 57).toFixed(2)}%)`);

  console.log(`\n=== RECOMMENDED CONFIGURATION ===`);
  console.log(`Lambda: ${bestLambda}`);
  console.log(`Home advantage weight: ${bestHomeAdvantage}`);
  console.log(`Temporal decay rate: ${bestDecayRate}`);
  console.log(`\nExpected accuracy: ${Math.max(bestAccuracy, bestHomeAccuracy, bestTemporalAccuracy).toFixed(2)}%`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
