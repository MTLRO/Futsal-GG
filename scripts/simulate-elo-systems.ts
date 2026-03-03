import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface GameData {
  id: number;
  homePlayers: { id: number; goals: number; isGK: boolean }[];
  awayPlayers: { id: number; goals: number; isGK: boolean }[];
  homeGoals: number;
  awayGoals: number;
  winner: 'HOME' | 'AWAY' | 'DRAW';
}

interface EloConfig {
  name: string;
  baseK: number;
  movEnabled: boolean;
  movScaling: number;
  goalBonusEnabled: boolean;
  goalBonusWeight: number;  // 0 = no bonus, 1 = full bonus like current
  eloDiffDivisor: number;
  newcomerBoost: boolean;
}

async function simulate() {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`ELO SYSTEM SIMULATION & OPTIMIZATION`);
  console.log(`${'='.repeat(70)}\n`);

  // Load all games
  const games = await prisma.game.findMany({
    include: {
      teamPlayers: true,
    },
    orderBy: { startDateTime: 'asc' },
  });

  const gameData: GameData[] = games
    .filter(g => g.teamPlayers.length === 10)
    .map(g => {
      const homePlayers = g.teamPlayers.filter(tp => tp.side === 'HOME');
      const awayPlayers = g.teamPlayers.filter(tp => tp.side === 'AWAY');
      const homeGoals = homePlayers.reduce((sum, tp) => sum + tp.goals, 0);
      const awayGoals = awayPlayers.reduce((sum, tp) => sum + tp.goals, 0);

      return {
        id: g.id,
        homePlayers: homePlayers.map(tp => ({ id: tp.playerId, goals: tp.goals, isGK: tp.goalkeeper })),
        awayPlayers: awayPlayers.map(tp => ({ id: tp.playerId, goals: tp.goals, isGK: tp.goalkeeper })),
        homeGoals,
        awayGoals,
        winner: homeGoals > awayGoals ? 'HOME' : awayGoals > homeGoals ? 'AWAY' : 'DRAW',
      };
    });

  console.log(`Total games to simulate: ${gameData.length}`);
  const nonDrawGames = gameData.filter(g => g.winner !== 'DRAW');
  console.log(`Non-draw games: ${nonDrawGames.length}\n`);

  // Define different configurations to test
  const configs: EloConfig[] = [
    // Current system approximation
    {
      name: 'Current (complex)',
      baseK: 64,
      movEnabled: true,
      movScaling: 0.25,
      goalBonusEnabled: true,
      goalBonusWeight: 1.0,
      eloDiffDivisor: 400,
      newcomerBoost: true,
    },
    // Pure team ELO (no individual bonuses)
    {
      name: 'Pure Team ELO',
      baseK: 64,
      movEnabled: false,
      movScaling: 0,
      goalBonusEnabled: false,
      goalBonusWeight: 0,
      eloDiffDivisor: 400,
      newcomerBoost: false,
    },
    // Higher K for faster convergence
    {
      name: 'High K (100)',
      baseK: 100,
      movEnabled: false,
      movScaling: 0,
      goalBonusEnabled: false,
      goalBonusWeight: 0,
      eloDiffDivisor: 400,
      newcomerBoost: false,
    },
    // Very high K
    {
      name: 'Very High K (150)',
      baseK: 150,
      movEnabled: false,
      movScaling: 0,
      goalBonusEnabled: false,
      goalBonusWeight: 0,
      eloDiffDivisor: 400,
      newcomerBoost: false,
    },
    // Team ELO with MOV
    {
      name: 'Team + MOV',
      baseK: 80,
      movEnabled: true,
      movScaling: 0.15,
      goalBonusEnabled: false,
      goalBonusWeight: 0,
      eloDiffDivisor: 400,
      newcomerBoost: false,
    },
    // Lower divisor (ELO diff matters more)
    {
      name: 'Lower Divisor (300)',
      baseK: 80,
      movEnabled: false,
      movScaling: 0,
      goalBonusEnabled: false,
      goalBonusWeight: 0,
      eloDiffDivisor: 300,
      newcomerBoost: false,
    },
    // Higher divisor (ELO diff matters less)
    {
      name: 'Higher Divisor (500)',
      baseK: 80,
      movEnabled: false,
      movScaling: 0,
      goalBonusEnabled: false,
      goalBonusWeight: 0,
      eloDiffDivisor: 500,
      newcomerBoost: false,
    },
    // Small goal bonus
    {
      name: 'Small Goal Bonus',
      baseK: 80,
      movEnabled: false,
      movScaling: 0,
      goalBonusEnabled: true,
      goalBonusWeight: 0.3,
      eloDiffDivisor: 400,
      newcomerBoost: false,
    },
    // Optimized combo 1
    {
      name: 'Optimized 1 (K=100, MOV=0.1)',
      baseK: 100,
      movEnabled: true,
      movScaling: 0.1,
      goalBonusEnabled: false,
      goalBonusWeight: 0,
      eloDiffDivisor: 400,
      newcomerBoost: false,
    },
    // Optimized combo 2
    {
      name: 'Optimized 2 (K=120, Div=350)',
      baseK: 120,
      movEnabled: true,
      movScaling: 0.1,
      goalBonusEnabled: false,
      goalBonusWeight: 0,
      eloDiffDivisor: 350,
      newcomerBoost: false,
    },
  ];

  // Run simulations
  const results: { config: EloConfig; accuracy: number; correlation: number }[] = [];

  for (const config of configs) {
    const result = runSimulation(gameData, config);
    results.push({ config, ...result });
  }

  // Sort by accuracy
  results.sort((a, b) => b.accuracy - a.accuracy);

  console.log(`${'='.repeat(70)}`);
  console.log(`RESULTS (sorted by prediction accuracy)`);
  console.log(`${'='.repeat(70)}\n`);

  console.log(`${'Config Name'.padEnd(30)} | ${'Accuracy'.padStart(8)} | ${'Correlation'.padStart(11)}`);
  console.log('-'.repeat(55));

  for (const r of results) {
    console.log(
      `${r.config.name.padEnd(30)} | ${(r.accuracy * 100).toFixed(1).padStart(7)}% | ${r.correlation.toFixed(3).padStart(11)}`
    );
  }

  // Grid search for optimal parameters
  console.log(`\n${'='.repeat(70)}`);
  console.log(`GRID SEARCH FOR OPTIMAL PARAMETERS`);
  console.log(`${'='.repeat(70)}\n`);

  const kValues = [60, 80, 100, 120, 140];
  const divValues = [300, 350, 400, 450];
  const movValues = [0, 0.1, 0.15, 0.2];

  let bestResult = { accuracy: 0, correlation: 0, k: 0, div: 0, mov: 0 };

  for (const k of kValues) {
    for (const div of divValues) {
      for (const mov of movValues) {
        const config: EloConfig = {
          name: `K=${k}, Div=${div}, MOV=${mov}`,
          baseK: k,
          movEnabled: mov > 0,
          movScaling: mov,
          goalBonusEnabled: false,
          goalBonusWeight: 0,
          eloDiffDivisor: div,
          newcomerBoost: false,
        };

        const result = runSimulation(gameData, config);

        if (result.accuracy > bestResult.accuracy) {
          bestResult = { accuracy: result.accuracy, correlation: result.correlation, k, div, mov };
        }
      }
    }
  }

  console.log(`Best parameters found:`);
  console.log(`  K-factor: ${bestResult.k}`);
  console.log(`  ELO divisor: ${bestResult.div}`);
  console.log(`  MOV scaling: ${bestResult.mov}`);
  console.log(`  Prediction accuracy: ${(bestResult.accuracy * 100).toFixed(1)}%`);
  console.log(`  ELO-WinRate correlation: ${bestResult.correlation.toFixed(3)}`);

  // Compare with win rate predictor
  console.log(`\n${'='.repeat(70)}`);
  console.log(`COMPARISON WITH WIN RATE PREDICTOR`);
  console.log(`${'='.repeat(70)}\n`);

  const winRateResult = runWinRateSimulation(gameData);
  console.log(`Historical Win Rate prediction: ${(winRateResult * 100).toFixed(1)}%`);
  console.log(`Best ELO prediction: ${(bestResult.accuracy * 100).toFixed(1)}%`);
  console.log(`Improvement needed: ${((winRateResult - bestResult.accuracy) * 100).toFixed(1)}%`);

  // Hybrid system test
  console.log(`\n${'='.repeat(70)}`);
  console.log(`HYBRID SYSTEMS (ELO + WIN RATE)`);
  console.log(`${'='.repeat(70)}\n`);

  const hybridWeights = [0.3, 0.5, 0.7];
  for (const weight of hybridWeights) {
    const hybridResult = runHybridSimulation(gameData, weight);
    console.log(`Hybrid (${(weight * 100).toFixed(0)}% ELO, ${((1 - weight) * 100).toFixed(0)}% WinRate): ${(hybridResult * 100).toFixed(1)}%`);
  }

  await prisma.$disconnect();
}

function runSimulation(games: GameData[], config: EloConfig): { accuracy: number; correlation: number } {
  // Initialize player ELOs
  const playerElos = new Map<number, { elo: number; gamesPlayed: number; wins: number }>();

  // Initialize all players
  const allPlayerIds = new Set<number>();
  for (const game of games) {
    game.homePlayers.forEach(p => allPlayerIds.add(p.id));
    game.awayPlayers.forEach(p => allPlayerIds.add(p.id));
  }
  for (const id of allPlayerIds) {
    playerElos.set(id, { elo: 1500, gamesPlayed: 0, wins: 0 });
  }

  let correctPredictions = 0;
  let totalPredictions = 0;

  // Process each game in order
  for (const game of games) {
    // Calculate team ELOs
    const homeElo = game.homePlayers.reduce((sum, p) => sum + (playerElos.get(p.id)?.elo ?? 1500), 0) / 5;
    const awayElo = game.awayPlayers.reduce((sum, p) => sum + (playerElos.get(p.id)?.elo ?? 1500), 0) / 5;

    // Skip draws for prediction accuracy
    if (game.winner !== 'DRAW') {
      const predicted = homeElo > awayElo ? 'HOME' : 'AWAY';
      if (predicted === game.winner) correctPredictions++;
      totalPredictions++;
    }

    // Calculate expected score
    const eloDiff = awayElo - homeElo;
    const expectedHome = 1 / (1 + Math.pow(10, eloDiff / config.eloDiffDivisor));
    const expectedAway = 1 - expectedHome;

    // Actual scores
    const actualHome = game.winner === 'HOME' ? 1 : game.winner === 'DRAW' ? 0.5 : 0;
    const actualAway = 1 - actualHome;

    // MOV multiplier
    let movMultiplier = 1;
    if (config.movEnabled && game.winner !== 'DRAW') {
      const goalDiff = Math.abs(game.homeGoals - game.awayGoals);
      movMultiplier = 1 + Math.log(1 + goalDiff) * config.movScaling;
    }

    // Update ELOs for all players
    const homeChange = config.baseK * (actualHome - expectedHome) * movMultiplier;
    const awayChange = config.baseK * (actualAway - expectedAway) * movMultiplier;

    // Update home players
    for (const player of game.homePlayers) {
      const data = playerElos.get(player.id)!;
      let change = homeChange;

      if (config.goalBonusEnabled && player.goals > 0) {
        change *= 1 + (0.15 * Math.min(player.goals, 3) * config.goalBonusWeight);
      }

      data.elo += change;
      data.gamesPlayed++;
      if (game.winner === 'HOME') data.wins++;
    }

    // Update away players
    for (const player of game.awayPlayers) {
      const data = playerElos.get(player.id)!;
      let change = awayChange;

      if (config.goalBonusEnabled && player.goals > 0) {
        change *= 1 + (0.15 * Math.min(player.goals, 3) * config.goalBonusWeight);
      }

      data.elo += change;
      data.gamesPlayed++;
      if (game.winner === 'AWAY') data.wins++;
    }
  }

  // Calculate ELO-WinRate correlation
  const playersWithGames = Array.from(playerElos.entries())
    .filter(([_, data]) => data.gamesPlayed >= 5)
    .map(([id, data]) => ({
      elo: data.elo,
      winRate: data.wins / data.gamesPlayed,
    }));

  const n = playersWithGames.length;
  if (n < 2) return { accuracy: correctPredictions / totalPredictions, correlation: 0 };

  let sumXY = 0, sumX = 0, sumY = 0, sumX2 = 0, sumY2 = 0;
  for (const p of playersWithGames) {
    sumXY += p.elo * p.winRate;
    sumX += p.elo;
    sumY += p.winRate;
    sumX2 += p.elo * p.elo;
    sumY2 += p.winRate * p.winRate;
  }

  const denom = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  const correlation = denom > 0 ? (n * sumXY - sumX * sumY) / denom : 0;

  return {
    accuracy: correctPredictions / totalPredictions,
    correlation,
  };
}

function runWinRateSimulation(games: GameData[]): number {
  const playerWins = new Map<number, { wins: number; games: number }>();

  // Initialize
  const allPlayerIds = new Set<number>();
  for (const game of games) {
    game.homePlayers.forEach(p => allPlayerIds.add(p.id));
    game.awayPlayers.forEach(p => allPlayerIds.add(p.id));
  }
  for (const id of allPlayerIds) {
    playerWins.set(id, { wins: 0, games: 0 });
  }

  let correct = 0;
  let total = 0;

  for (const game of games) {
    if (game.winner === 'DRAW') continue;

    // Predict based on cumulative win rates
    const homeWinRateSum = game.homePlayers.reduce((sum, p) => {
      const data = playerWins.get(p.id)!;
      return sum + (data.games > 0 ? data.wins / data.games : 0.5);
    }, 0);

    const awayWinRateSum = game.awayPlayers.reduce((sum, p) => {
      const data = playerWins.get(p.id)!;
      return sum + (data.games > 0 ? data.wins / data.games : 0.5);
    }, 0);

    const predicted = homeWinRateSum > awayWinRateSum ? 'HOME' : 'AWAY';
    if (predicted === game.winner) correct++;
    total++;

    // Update stats
    for (const player of game.homePlayers) {
      const data = playerWins.get(player.id)!;
      data.games++;
      if (game.winner === 'HOME') data.wins++;
    }
    for (const player of game.awayPlayers) {
      const data = playerWins.get(player.id)!;
      data.games++;
      if (game.winner === 'AWAY') data.wins++;
    }
  }

  return correct / total;
}

function runHybridSimulation(games: GameData[], eloWeight: number): number {
  const playerElos = new Map<number, number>();
  const playerWins = new Map<number, { wins: number; games: number }>();

  // Initialize
  const allPlayerIds = new Set<number>();
  for (const game of games) {
    game.homePlayers.forEach(p => allPlayerIds.add(p.id));
    game.awayPlayers.forEach(p => allPlayerIds.add(p.id));
  }
  for (const id of allPlayerIds) {
    playerElos.set(id, 1500);
    playerWins.set(id, { wins: 0, games: 0 });
  }

  let correct = 0;
  let total = 0;

  const K = 100; // Use optimized K

  for (const game of games) {
    if (game.winner === 'DRAW') continue;

    // Calculate ELO prediction
    const homeElo = game.homePlayers.reduce((sum, p) => sum + (playerElos.get(p.id) ?? 1500), 0) / 5;
    const awayElo = game.awayPlayers.reduce((sum, p) => sum + (playerElos.get(p.id) ?? 1500), 0) / 5;
    const eloScore = homeElo / (homeElo + awayElo);

    // Calculate win rate prediction
    const homeWinRateSum = game.homePlayers.reduce((sum, p) => {
      const data = playerWins.get(p.id)!;
      return sum + (data.games > 0 ? data.wins / data.games : 0.5);
    }, 0);
    const awayWinRateSum = game.awayPlayers.reduce((sum, p) => {
      const data = playerWins.get(p.id)!;
      return sum + (data.games > 0 ? data.wins / data.games : 0.5);
    }, 0);
    const winRateScore = homeWinRateSum / (homeWinRateSum + awayWinRateSum + 0.0001);

    // Hybrid prediction
    const hybridScore = eloWeight * eloScore + (1 - eloWeight) * winRateScore;
    const predicted = hybridScore > 0.5 ? 'HOME' : 'AWAY';
    if (predicted === game.winner) correct++;
    total++;

    // Update ELOs
    const eloDiff = awayElo - homeElo;
    const expectedHome = 1 / (1 + Math.pow(10, eloDiff / 400));
    const actualHome = game.winner === 'HOME' ? 1 : 0;
    const homeChange = K * (actualHome - expectedHome);

    for (const player of game.homePlayers) {
      playerElos.set(player.id, (playerElos.get(player.id) ?? 1500) + homeChange);
      const data = playerWins.get(player.id)!;
      data.games++;
      if (game.winner === 'HOME') data.wins++;
    }
    for (const player of game.awayPlayers) {
      playerElos.set(player.id, (playerElos.get(player.id) ?? 1500) - homeChange);
      const data = playerWins.get(player.id)!;
      data.games++;
      if (game.winner === 'AWAY') data.wins++;
    }
  }

  return correct / total;
}

simulate().catch(console.error);
