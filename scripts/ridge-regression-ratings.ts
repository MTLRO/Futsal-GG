import { PrismaClient } from '@prisma/client';

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
 * Ridge regression solver using normal equations with L2 regularization
 * Solves: (X^T X + λI) β = X^T y
 */
function ridgeRegression(X: number[][], y: number[], lambda: number): number[] {
  const n = X.length;
  const p = X[0].length;

  // Compute X^T X
  const XtX: number[][] = Array(p).fill(0).map(() => Array(p).fill(0));
  for (let i = 0; i < p; i++) {
    for (let j = 0; j < p; j++) {
      let sum = 0;
      for (let k = 0; k < n; k++) {
        sum += X[k][i] * X[k][j];
      }
      XtX[i][j] = sum;
      // Add regularization to diagonal
      if (i === j) {
        XtX[i][j] += lambda;
      }
    }
  }

  // Compute X^T y
  const Xty: number[] = Array(p).fill(0);
  for (let i = 0; i < p; i++) {
    let sum = 0;
    for (let k = 0; k < n; k++) {
      sum += X[k][i] * y[k];
    }
    Xty[i] = sum;
  }

  // Solve linear system using Gaussian elimination
  return solveLinearSystem(XtX, Xty);
}

/**
 * Solves Ax = b using Gaussian elimination with partial pivoting
 */
function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = A.length;
  const Ab: number[][] = A.map((row, i) => [...row, b[i]]);

  // Forward elimination with partial pivoting
  for (let i = 0; i < n; i++) {
    // Find pivot
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(Ab[k][i]) > Math.abs(Ab[maxRow][i])) {
        maxRow = k;
      }
    }

    // Swap rows
    [Ab[i], Ab[maxRow]] = [Ab[maxRow], Ab[i]];

    // Make all rows below this one 0 in current column
    for (let k = i + 1; k < n; k++) {
      const factor = Ab[k][i] / Ab[i][i];
      for (let j = i; j <= n; j++) {
        Ab[k][j] -= factor * Ab[i][j];
      }
    }
  }

  // Back substitution
  const x: number[] = Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = Ab[i][n];
    for (let j = i + 1; j < n; j++) {
      x[i] -= Ab[i][j] * x[j];
    }
    x[i] /= Ab[i][i];
  }

  return x;
}

/**
 * Predict game outcome using player coefficients
 * Returns expected goal difference (positive = home team favored)
 */
function predictGame(
  homePlayerIds: number[],
  awayPlayerIds: number[],
  playerCoefficients: Map<number, number>
): number {
  const homeStrength = homePlayerIds.reduce((sum, id) =>
    sum + (playerCoefficients.get(id) || 0), 0);
  const awayStrength = awayPlayerIds.reduce((sum, id) =>
    sum + (playerCoefficients.get(id) || 0), 0);

  return homeStrength - awayStrength;
}

async function main() {
  console.log('Fetching games from database...');

  // Fetch all games
  const games = await prisma.game.findMany({
    include: {
      teamPlayers: {
        include: {
          player: true,
        },
      },
    },
    orderBy: {
      startDateTime: 'asc',
    },
  });

  console.log(`Found ${games.length} games`);

  // Extract game data
  const gameData: GameData[] = [];
  const playerIdSet = new Set<number>();

  for (const game of games) {
    const homePlayers = game.teamPlayers.filter(tp => tp.side === 'HOME');
    const awayPlayers = game.teamPlayers.filter(tp => tp.side === 'AWAY');

    const homeGoals = homePlayers.reduce((sum, tp) => sum + tp.goals, 0);
    const awayGoals = awayPlayers.reduce((sum, tp) => sum + tp.goals, 0);

    const homePlayerIds = homePlayers.map(tp => tp.playerId);
    const awayPlayerIds = awayPlayers.map(tp => tp.playerId);

    // Add all player IDs to set
    homePlayerIds.forEach(id => playerIdSet.add(id));
    awayPlayerIds.forEach(id => playerIdSet.add(id));

    gameData.push({
      id: game.id,
      homePlayerIds,
      awayPlayerIds,
      homeGoals,
      awayGoals,
      homeWin: homeGoals > awayGoals,
      awayWin: awayGoals > homeGoals,
      isDraw: homeGoals === awayGoals,
    });
  }

  // Create player ID to index mapping
  const playerIds = Array.from(playerIdSet).sort((a, b) => a - b);
  const playerIdToIndex = new Map(playerIds.map((id, idx) => [id, idx]));
  const numPlayers = playerIds.length;

  console.log(`Found ${numPlayers} unique players`);

  // Build design matrix X and target vector y
  // X[i][j] = 1 if player j is on home team, -1 if on away team, 0 otherwise
  // y[i] = goal difference (home - away)
  const X: number[][] = [];
  const yGoalDiff: number[] = [];
  const yWinLoss: number[] = [];

  for (const game of gameData) {
    const row = Array(numPlayers).fill(0);

    // Home team players get +1
    for (const playerId of game.homePlayerIds) {
      const idx = playerIdToIndex.get(playerId)!;
      row[idx] = 1;
    }

    // Away team players get -1
    for (const playerId of game.awayPlayerIds) {
      const idx = playerIdToIndex.get(playerId)!;
      row[idx] = -1;
    }

    X.push(row);
    yGoalDiff.push(game.homeGoals - game.awayGoals);

    // For win/loss prediction: 1 = home win, -1 = away win, 0 = draw
    if (game.homeWin) {
      yWinLoss.push(1);
    } else if (game.awayWin) {
      yWinLoss.push(-1);
    } else {
      yWinLoss.push(0);
    }
  }

  console.log('\n=== Training Ridge Regression Models ===\n');

  // Try different lambda values
  const lambdaValues = [0.001, 0.01, 0.1, 1.0, 10.0, 100.0];

  for (const lambda of lambdaValues) {
    console.log(`\n--- Lambda = ${lambda} ---`);

    // Train model for goal difference prediction
    const coefficientsGoalDiff = ridgeRegression(X, yGoalDiff, lambda);

    // Train model for win/loss prediction
    const coefficientsWinLoss = ridgeRegression(X, yWinLoss, lambda);

    // Create coefficient maps
    const playerCoeffsGoalDiff = new Map(
      playerIds.map((id, idx) => [id, coefficientsGoalDiff[idx]])
    );
    const playerCoeffsWinLoss = new Map(
      playerIds.map((id, idx) => [id, coefficientsWinLoss[idx]])
    );

    // Evaluate predictions
    let correctGoalDiff = 0;
    let correctWinLoss = 0;
    let totalSquaredErrorGoalDiff = 0;
    let totalSquaredErrorWinLoss = 0;

    for (let i = 0; i < gameData.length; i++) {
      const game = gameData[i];

      // Goal difference model
      const predGoalDiff = predictGame(
        game.homePlayerIds,
        game.awayPlayerIds,
        playerCoeffsGoalDiff
      );
      const actualGoalDiff = game.homeGoals - game.awayGoals;
      totalSquaredErrorGoalDiff += Math.pow(predGoalDiff - actualGoalDiff, 2);

      // Win/loss model
      const predWinLoss = predictGame(
        game.homePlayerIds,
        game.awayPlayerIds,
        playerCoeffsWinLoss
      );

      // Check if prediction is correct
      const predictedOutcome = predGoalDiff > 0 ? 'HOME' : predGoalDiff < 0 ? 'AWAY' : 'DRAW';
      const actualOutcome = game.homeWin ? 'HOME' : game.awayWin ? 'AWAY' : 'DRAW';

      if (predictedOutcome === actualOutcome) {
        correctGoalDiff++;
      }

      const predictedOutcomeWL = predWinLoss > 0 ? 'HOME' : predWinLoss < 0 ? 'AWAY' : 'DRAW';
      if (predictedOutcomeWL === actualOutcome) {
        correctWinLoss++;
      }

      totalSquaredErrorWinLoss += Math.pow(predWinLoss - yWinLoss[i], 2);
    }

    const accuracyGoalDiff = (correctGoalDiff / gameData.length) * 100;
    const accuracyWinLoss = (correctWinLoss / gameData.length) * 100;
    const rmseGoalDiff = Math.sqrt(totalSquaredErrorGoalDiff / gameData.length);
    const rmseWinLoss = Math.sqrt(totalSquaredErrorWinLoss / gameData.length);

    console.log(`Goal Diff Model - Accuracy: ${accuracyGoalDiff.toFixed(2)}%, RMSE: ${rmseGoalDiff.toFixed(3)}`);
    console.log(`Win/Loss Model - Accuracy: ${accuracyWinLoss.toFixed(2)}%, RMSE: ${rmseWinLoss.toFixed(3)}`);
  }

  // Use best lambda (typically around 1.0-10.0)
  const bestLambda = 10.0;
  console.log(`\n\n=== Using Lambda = ${bestLambda} for Final Model ===\n`);

  const coefficients = ridgeRegression(X, yGoalDiff, bestLambda);
  const playerCoefficients = new Map(
    playerIds.map((id, idx) => [id, coefficients[idx]])
  );

  // Fetch player names
  const players = await prisma.player.findMany({
    where: {
      id: { in: playerIds },
    },
  });

  const playerNameMap = new Map(players.map(p => [p.id, `${p.name} ${p.lastName}`]));
  const playerEloMap = new Map(players.map(p => [p.id, p.elo]));

  // Sort players by coefficient
  const sortedPlayers = Array.from(playerCoefficients.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([id, coeff]) => ({
      id,
      name: playerNameMap.get(id) || 'Unknown',
      coefficient: coeff,
      elo: playerEloMap.get(id) || 1500,
    }));

  console.log('\n=== Top 20 Players by Ridge Regression Coefficient ===\n');
  console.log('Rank | Name                  | Coefficient | Current ELO | Coeff Rank vs ELO Rank');
  console.log('-----|----------------------|-------------|-------------|----------------------');

  // Also sort by ELO for comparison
  const sortedByElo = [...sortedPlayers].sort((a, b) => b.elo - a.elo);
  const eloRankMap = new Map(sortedByElo.map((p, idx) => [p.id, idx + 1]));

  for (let i = 0; i < Math.min(20, sortedPlayers.length); i++) {
    const player = sortedPlayers[i];
    const eloRank = eloRankMap.get(player.id) || 0;
    const rankDiff = eloRank - (i + 1);
    const diffStr = rankDiff > 0 ? `+${rankDiff}` : rankDiff < 0 ? `${rankDiff}` : '0';

    console.log(
      `${(i + 1).toString().padStart(4)} | ` +
      `${player.name.padEnd(20)} | ` +
      `${player.coefficient.toFixed(4).padStart(11)} | ` +
      `${player.elo.toString().padStart(11)} | ` +
      `${diffStr.padStart(21)}`
    );
  }

  console.log('\n=== Bottom 20 Players by Ridge Regression Coefficient ===\n');
  console.log('Rank | Name                  | Coefficient | Current ELO | Coeff Rank vs ELO Rank');
  console.log('-----|----------------------|-------------|-------------|----------------------');

  const startIdx = Math.max(0, sortedPlayers.length - 20);
  for (let i = startIdx; i < sortedPlayers.length; i++) {
    const player = sortedPlayers[i];
    const eloRank = eloRankMap.get(player.id) || 0;
    const rankDiff = eloRank - (i + 1);
    const diffStr = rankDiff > 0 ? `+${rankDiff}` : rankDiff < 0 ? `${rankDiff}` : '0';

    console.log(
      `${(i + 1).toString().padStart(4)} | ` +
      `${player.name.padEnd(20)} | ` +
      `${player.coefficient.toFixed(4).padStart(11)} | ` +
      `${player.elo.toString().padStart(11)} | ` +
      `${diffStr.padStart(21)}`
    );
  }

  // Calculate correlation between coefficients and ELO
  const coeffValues = sortedPlayers.map(p => p.coefficient);
  const eloValues = sortedPlayers.map(p => p.elo);
  const correlation = calculateCorrelation(coeffValues, eloValues);

  console.log(`\n=== Correlation between Ridge Coefficients and ELO: ${correlation.toFixed(4)} ===\n`);

  // Normalize coefficients to ELO scale (1500 average, similar std dev as ELO)
  const meanCoeff = coeffValues.reduce((a, b) => a + b, 0) / coeffValues.length;
  const stdCoeff = Math.sqrt(
    coeffValues.reduce((sum, val) => sum + Math.pow(val - meanCoeff, 2), 0) / coeffValues.length
  );

  const meanElo = eloValues.reduce((a, b) => a + b, 0) / eloValues.length;
  const stdElo = Math.sqrt(
    eloValues.reduce((sum, val) => sum + Math.pow(val - meanElo, 2), 0) / eloValues.length
  );

  console.log('\n=== Statistics ===');
  console.log(`Coefficients - Mean: ${meanCoeff.toFixed(4)}, Std Dev: ${stdCoeff.toFixed(4)}`);
  console.log(`ELO Ratings  - Mean: ${meanElo.toFixed(1)}, Std Dev: ${stdElo.toFixed(1)}`);

  // Convert coefficients to ELO-like scale
  console.log('\n=== Top 10 Players (Coefficients Normalized to ELO Scale) ===\n');
  console.log('Rank | Name                  | Normalized "ELO" | Current ELO | Difference');
  console.log('-----|----------------------|-----------------|-------------|------------');

  for (let i = 0; i < Math.min(10, sortedPlayers.length); i++) {
    const player = sortedPlayers[i];
    const normalizedElo = 1500 + ((player.coefficient - meanCoeff) / stdCoeff) * stdElo;
    const diff = normalizedElo - player.elo;

    console.log(
      `${(i + 1).toString().padStart(4)} | ` +
      `${player.name.padEnd(20)} | ` +
      `${normalizedElo.toFixed(1).padStart(15)} | ` +
      `${player.elo.toString().padStart(11)} | ` +
      `${diff >= 0 ? '+' : ''}${diff.toFixed(1).padStart(10)}`
    );
  }
}

function calculateCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;

  let numerator = 0;
  let denomX = 0;
  let denomY = 0;

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    numerator += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }

  return numerator / Math.sqrt(denomX * denomY);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
