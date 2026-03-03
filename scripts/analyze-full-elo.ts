import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function analyzeFullHistory() {
  console.log(`\n=== FULL HISTORICAL ANALYSIS ===\n`);

  // Get all completed games
  const games = await prisma.game.findMany({
    where: {
      endDateTime: { not: null },
    },
    include: {
      teamPlayers: {
        include: {
          player: true,
        },
      },
    },
    orderBy: { startDateTime: 'asc' },
  });

  console.log(`Total completed games: ${games.length}`);

  // Calculate each player's true performance
  const playerStats: Map<number, {
    name: string;
    currentElo: number;
    gkElo: number;
    gamesPlayed: number;
    wins: number;
    losses: number;
    draws: number;
    goalsScored: number;
    goalsAgainst: number;
    gkGames: number;
    gkGoalsAgainst: number;
  }> = new Map();

  // Initialize player stats from database
  const players = await prisma.player.findMany();
  for (const p of players) {
    playerStats.set(p.id, {
      name: `${p.name} ${p.lastName}`,
      currentElo: p.elo,
      gkElo: p.gkElo,
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      goalsScored: 0,
      goalsAgainst: 0,
      gkGames: 0,
      gkGoalsAgainst: 0,
    });
  }

  // Process each game
  for (const game of games) {
    const homePlayers = game.teamPlayers.filter(tp => tp.side === 'HOME');
    const awayPlayers = game.teamPlayers.filter(tp => tp.side === 'AWAY');

    const homeGoals = homePlayers.reduce((sum, tp) => sum + tp.goals, 0);
    const awayGoals = awayPlayers.reduce((sum, tp) => sum + tp.goals, 0);

    // Update stats for all players
    for (const tp of game.teamPlayers) {
      const stats = playerStats.get(tp.playerId);
      if (!stats) continue;

      stats.gamesPlayed++;
      stats.goalsScored += tp.goals;

      const isHome = tp.side === 'HOME';
      const myGoals = isHome ? homeGoals : awayGoals;
      const oppGoals = isHome ? awayGoals : homeGoals;

      stats.goalsAgainst += oppGoals;

      if (tp.goalkeeper) {
        stats.gkGames++;
        stats.gkGoalsAgainst += oppGoals;
      }

      if (myGoals > oppGoals) {
        stats.wins++;
      } else if (myGoals < oppGoals) {
        stats.losses++;
      } else {
        stats.draws++;
      }
    }
  }

  // Calculate "true skill" based on actual performance
  const playersWithGames = Array.from(playerStats.values())
    .filter(p => p.gamesPlayed >= 5)
    .map(p => {
      const winRate = p.wins / p.gamesPlayed;
      const goalsPerGame = p.goalsScored / p.gamesPlayed;
      const goalDiffPerGame = (p.goalsScored - p.goalsAgainst / 5) / p.gamesPlayed; // divide by 5 for team share

      // Calculate a "true skill" score (simple formula)
      // Win rate is most important, goals scored as secondary
      const trueSkill = 1500 + (winRate - 0.5) * 600 + goalsPerGame * 50;

      return {
        ...p,
        winRate,
        goalsPerGame,
        goalDiffPerGame,
        trueSkill,
        eloDiff: p.currentElo - trueSkill,
      };
    });

  // Sort by current ELO
  playersWithGames.sort((a, b) => b.currentElo - a.currentElo);

  console.log(`\n=== CURRENT ELO vs TRUE PERFORMANCE ===`);
  console.log(`(Players with 5+ games)\n`);
  console.log(`${'Name'.padEnd(25)} | ${'ELO'.padStart(5)} | ${'Win%'.padStart(5)} | ${'TrueSkill'.padStart(9)} | ${'Diff'.padStart(6)} | W-L-D`);
  console.log('-'.repeat(80));

  for (const p of playersWithGames) {
    const wld = `${p.wins}-${p.losses}-${p.draws}`;
    console.log(
      `${p.name.padEnd(25)} | ${p.currentElo.toString().padStart(5)} | ${(p.winRate * 100).toFixed(0).padStart(4)}% | ${p.trueSkill.toFixed(0).padStart(9)} | ${(p.eloDiff >= 0 ? '+' : '') + p.eloDiff.toFixed(0).padStart(5)} | ${wld}`
    );
  }

  // Calculate correlation
  const n = playersWithGames.length;
  let sumXY = 0, sumX = 0, sumY = 0, sumX2 = 0, sumY2 = 0;
  for (const p of playersWithGames) {
    sumXY += p.currentElo * p.winRate;
    sumX += p.currentElo;
    sumY += p.winRate;
    sumX2 += p.currentElo * p.currentElo;
    sumY2 += p.winRate * p.winRate;
  }
  const correlation = (n * sumXY - sumX * sumY) /
    Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

  console.log(`\n=== ELO-WIN RATE CORRELATION: ${correlation.toFixed(3)} ===`);
  console.log(`(Should be positive and close to 1.0 for good ELO system)`);

  // Analyze what factors ACTUALLY predict wins
  console.log(`\n=== FEATURE IMPORTANCE ANALYSIS ===`);

  // For each game, track what features predict the winner
  const gameFeatures: {
    homeEloSum: number;
    awayEloSum: number;
    homeWinRateSum: number;
    awayWinRateSum: number;
    homeGoalsHistorySum: number;
    awayGoalsHistorySum: number;
    winner: 'HOME' | 'AWAY' | 'DRAW';
  }[] = [];

  for (const game of games) {
    const homePlayers = game.teamPlayers.filter(tp => tp.side === 'HOME');
    const awayPlayers = game.teamPlayers.filter(tp => tp.side === 'AWAY');

    const homeGoals = homePlayers.reduce((sum, tp) => sum + tp.goals, 0);
    const awayGoals = awayPlayers.reduce((sum, tp) => sum + tp.goals, 0);

    // Skip if we don't have enough data
    if (homePlayers.length !== 5 || awayPlayers.length !== 5) continue;

    const homeStats = homePlayers.map(tp => playerStats.get(tp.playerId)!);
    const awayStats = awayPlayers.map(tp => playerStats.get(tp.playerId)!);

    gameFeatures.push({
      homeEloSum: homeStats.reduce((sum, p) => sum + p.currentElo, 0),
      awayEloSum: awayStats.reduce((sum, p) => sum + p.currentElo, 0),
      homeWinRateSum: homeStats.reduce((sum, p) => sum + (p.gamesPlayed > 0 ? p.wins / p.gamesPlayed : 0.5), 0),
      awayWinRateSum: awayStats.reduce((sum, p) => sum + (p.gamesPlayed > 0 ? p.wins / p.gamesPlayed : 0.5), 0),
      homeGoalsHistorySum: homeStats.reduce((sum, p) => sum + (p.gamesPlayed > 0 ? p.goalsScored / p.gamesPlayed : 0), 0),
      awayGoalsHistorySum: awayStats.reduce((sum, p) => sum + (p.gamesPlayed > 0 ? p.goalsScored / p.gamesPlayed : 0), 0),
      winner: homeGoals > awayGoals ? 'HOME' : awayGoals > homeGoals ? 'AWAY' : 'DRAW',
    });
  }

  console.log(`Games with complete data: ${gameFeatures.length}`);

  // Test different prediction methods
  const predictors = [
    {
      name: 'Current ELO (higher wins)',
      predict: (g: typeof gameFeatures[0]) => g.homeEloSum > g.awayEloSum ? 'HOME' : 'AWAY',
    },
    {
      name: 'Actual Win Rate (higher wins)',
      predict: (g: typeof gameFeatures[0]) => g.homeWinRateSum > g.awayWinRateSum ? 'HOME' : 'AWAY',
    },
    {
      name: 'Goals Per Game (higher wins)',
      predict: (g: typeof gameFeatures[0]) => g.homeGoalsHistorySum > g.awayGoalsHistorySum ? 'HOME' : 'AWAY',
    },
    {
      name: 'Random (baseline)',
      predict: () => Math.random() > 0.5 ? 'HOME' : 'AWAY',
    },
  ];

  const nonDrawGames = gameFeatures.filter(g => g.winner !== 'DRAW');
  console.log(`Non-draw games: ${nonDrawGames.length}`);

  for (const predictor of predictors) {
    let correct = 0;
    for (const game of nonDrawGames) {
      if (predictor.predict(game) === game.winner) correct++;
    }
    console.log(`  ${predictor.name}: ${correct}/${nonDrawGames.length} (${(correct / nonDrawGames.length * 100).toFixed(1)}%)`);
  }

  // Show the most overrated and underrated players
  console.log(`\n=== MOST OVERRATED PLAYERS (High ELO, Low Win%) ===`);
  const sortedByOverrated = [...playersWithGames].sort((a, b) => b.eloDiff - a.eloDiff);
  for (const p of sortedByOverrated.slice(0, 5)) {
    console.log(`  ${p.name}: ELO ${p.currentElo}, Win% ${(p.winRate * 100).toFixed(0)}%, W-L-D: ${p.wins}-${p.losses}-${p.draws}`);
  }

  console.log(`\n=== MOST UNDERRATED PLAYERS (Low ELO, High Win%) ===`);
  for (const p of sortedByOverrated.slice(-5).reverse()) {
    console.log(`  ${p.name}: ELO ${p.currentElo}, Win% ${(p.winRate * 100).toFixed(0)}%, W-L-D: ${p.wins}-${p.losses}-${p.draws}`);
  }

  // Analyze goalkeeper performance
  console.log(`\n=== GOALKEEPER ANALYSIS ===`);
  const goalkeepers = playersWithGames.filter(p => p.gkGames >= 3);
  goalkeepers.sort((a, b) => (a.gkGoalsAgainst / a.gkGames) - (b.gkGoalsAgainst / b.gkGames));

  console.log(`Top goalkeepers (min 3 games as GK):`);
  for (const gk of goalkeepers.slice(0, 5)) {
    const goalsAgainstPerGame = gk.gkGoalsAgainst / gk.gkGames;
    console.log(`  ${gk.name}: ${goalsAgainstPerGame.toFixed(2)} goals against/game (${gk.gkGames} GK games), GK ELO: ${gk.gkElo}`);
  }

  // Check distribution of game results
  console.log(`\n=== GAME RESULTS DISTRIBUTION ===`);
  let homeWins = 0, awayWins = 0, draws = 0;
  for (const game of games) {
    const homePlayers = game.teamPlayers.filter(tp => tp.side === 'HOME');
    const awayPlayers = game.teamPlayers.filter(tp => tp.side === 'AWAY');
    const homeGoals = homePlayers.reduce((sum, tp) => sum + tp.goals, 0);
    const awayGoals = awayPlayers.reduce((sum, tp) => sum + tp.goals, 0);

    if (homeGoals > awayGoals) homeWins++;
    else if (awayGoals > homeGoals) awayWins++;
    else draws++;
  }
  console.log(`  HOME wins: ${homeWins} (${(homeWins / games.length * 100).toFixed(1)}%)`);
  console.log(`  AWAY wins: ${awayWins} (${(awayWins / games.length * 100).toFixed(1)}%)`);
  console.log(`  Draws: ${draws} (${(draws / games.length * 100).toFixed(1)}%)`);

  await prisma.$disconnect();
}

analyzeFullHistory().catch(console.error);
