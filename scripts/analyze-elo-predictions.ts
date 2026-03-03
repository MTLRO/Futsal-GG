import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface GameAnalysis {
  gameId: number;
  homeElo: number;
  awayElo: number;
  homeGoals: number;
  awayGoals: number;
  predictedWinner: 'HOME' | 'AWAY' | 'DRAW';
  actualWinner: 'HOME' | 'AWAY' | 'DRAW';
  correct: boolean;
  expectedWinProb: number;
}

async function analyzeGames() {
  // Get all completed games with their team players
  const games = await prisma.game.findMany({
    where: {
      endDateTime: { not: null },
      homeTeamAverageElo: { not: null },
      awayTeamAverageElo: { not: null },
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

  console.log(`\n=== ELO PREDICTION ANALYSIS ===`);
  console.log(`Total completed games with ELO data: ${games.length}`);

  const analyses: GameAnalysis[] = [];

  // Score distribution analysis
  const scoreDiffs: number[] = [];
  const homeGoalsDistribution: number[] = [];
  const awayGoalsDistribution: number[] = [];
  const totalGoalsPerGame: number[] = [];

  for (const game of games) {
    const homePlayers = game.teamPlayers.filter(tp => tp.side === 'HOME');
    const awayPlayers = game.teamPlayers.filter(tp => tp.side === 'AWAY');

    const homeGoals = homePlayers.reduce((sum, tp) => sum + tp.goals, 0);
    const awayGoals = awayPlayers.reduce((sum, tp) => sum + tp.goals, 0);

    const homeElo = game.homeTeamAverageElo!;
    const awayElo = game.awayTeamAverageElo!;

    // Calculate expected win probability using standard ELO formula
    const eloDiff = awayElo - homeElo;
    const expectedHomeWin = 1 / (1 + Math.pow(10, eloDiff / 400));

    // Determine predicted winner (threshold at 0.5)
    let predictedWinner: 'HOME' | 'AWAY' | 'DRAW';
    if (expectedHomeWin > 0.55) {
      predictedWinner = 'HOME';
    } else if (expectedHomeWin < 0.45) {
      predictedWinner = 'AWAY';
    } else {
      predictedWinner = 'DRAW';
    }

    // Determine actual winner
    let actualWinner: 'HOME' | 'AWAY' | 'DRAW';
    if (homeGoals > awayGoals) {
      actualWinner = 'HOME';
    } else if (awayGoals > homeGoals) {
      actualWinner = 'AWAY';
    } else {
      actualWinner = 'DRAW';
    }

    const correct = predictedWinner === actualWinner;

    analyses.push({
      gameId: game.id,
      homeElo,
      awayElo,
      homeGoals,
      awayGoals,
      predictedWinner,
      actualWinner,
      correct,
      expectedWinProb: expectedHomeWin,
    });

    scoreDiffs.push(Math.abs(homeGoals - awayGoals));
    homeGoalsDistribution.push(homeGoals);
    awayGoalsDistribution.push(awayGoals);
    totalGoalsPerGame.push(homeGoals + awayGoals);
  }

  // Calculate prediction accuracy
  const correctPredictions = analyses.filter(a => a.correct).length;
  const accuracy = (correctPredictions / analyses.length * 100).toFixed(1);

  console.log(`\n=== PREDICTION ACCURACY ===`);
  console.log(`Correct predictions: ${correctPredictions}/${analyses.length} (${accuracy}%)`);

  // Break down by prediction type
  const homePredictions = analyses.filter(a => a.predictedWinner === 'HOME');
  const awayPredictions = analyses.filter(a => a.predictedWinner === 'AWAY');
  const drawPredictions = analyses.filter(a => a.predictedWinner === 'DRAW');

  console.log(`\nBreakdown by prediction:`);
  console.log(`  HOME predicted: ${homePredictions.length} games, ${homePredictions.filter(a => a.correct).length} correct (${(homePredictions.filter(a => a.correct).length / homePredictions.length * 100 || 0).toFixed(1)}%)`);
  console.log(`  AWAY predicted: ${awayPredictions.length} games, ${awayPredictions.filter(a => a.correct).length} correct (${(awayPredictions.filter(a => a.correct).length / awayPredictions.length * 100 || 0).toFixed(1)}%)`);
  console.log(`  DRAW predicted: ${drawPredictions.length} games, ${drawPredictions.filter(a => a.correct).length} correct (${(drawPredictions.filter(a => a.correct).length / drawPredictions.length * 100 || 0).toFixed(1)}%)`);

  // Actual outcomes
  const actualHome = analyses.filter(a => a.actualWinner === 'HOME').length;
  const actualAway = analyses.filter(a => a.actualWinner === 'AWAY').length;
  const actualDraw = analyses.filter(a => a.actualWinner === 'DRAW').length;

  console.log(`\n=== ACTUAL OUTCOMES ===`);
  console.log(`  HOME wins: ${actualHome} (${(actualHome / analyses.length * 100).toFixed(1)}%)`);
  console.log(`  AWAY wins: ${actualAway} (${(actualAway / analyses.length * 100).toFixed(1)}%)`);
  console.log(`  DRAWS: ${actualDraw} (${(actualDraw / analyses.length * 100).toFixed(1)}%)`);

  // Score distribution
  console.log(`\n=== SCORE DISTRIBUTION ===`);
  const avgScoreDiff = scoreDiffs.reduce((a, b) => a + b, 0) / scoreDiffs.length;
  const avgGoals = totalGoalsPerGame.reduce((a, b) => a + b, 0) / totalGoalsPerGame.length;
  console.log(`  Average goal difference: ${avgScoreDiff.toFixed(2)}`);
  console.log(`  Average total goals per game: ${avgGoals.toFixed(2)}`);

  // Count games by goal difference
  const diffCounts: { [key: number]: number } = {};
  for (const diff of scoreDiffs) {
    diffCounts[diff] = (diffCounts[diff] || 0) + 1;
  }
  console.log(`  Goal difference distribution:`);
  for (const diff of Object.keys(diffCounts).map(Number).sort((a, b) => a - b)) {
    console.log(`    ${diff} goals: ${diffCounts[diff]} games (${(diffCounts[diff] / analyses.length * 100).toFixed(1)}%)`);
  }

  // ELO spread analysis
  console.log(`\n=== ELO SPREAD ANALYSIS ===`);
  const eloDiffs = analyses.map(a => Math.abs(a.homeElo - a.awayElo));
  const avgEloDiff = eloDiffs.reduce((a, b) => a + b, 0) / eloDiffs.length;
  console.log(`  Average ELO difference between teams: ${avgEloDiff.toFixed(0)}`);
  console.log(`  Min ELO difference: ${Math.min(...eloDiffs)}`);
  console.log(`  Max ELO difference: ${Math.max(...eloDiffs)}`);

  // Analyze predictions by ELO difference buckets
  console.log(`\n=== PREDICTION BY ELO DIFFERENCE ===`);
  const buckets = [
    { min: 0, max: 50, label: '0-50' },
    { min: 50, max: 100, label: '50-100' },
    { min: 100, max: 150, label: '100-150' },
    { min: 150, max: 200, label: '150-200' },
    { min: 200, max: 300, label: '200-300' },
    { min: 300, max: 1000, label: '300+' },
  ];

  for (const bucket of buckets) {
    const bucketGames = analyses.filter(a => {
      const diff = Math.abs(a.homeElo - a.awayElo);
      return diff >= bucket.min && diff < bucket.max;
    });
    if (bucketGames.length > 0) {
      const bucketCorrect = bucketGames.filter(a => a.correct).length;
      console.log(`  ELO diff ${bucket.label}: ${bucketGames.length} games, ${bucketCorrect} correct (${(bucketCorrect / bucketGames.length * 100).toFixed(1)}%)`);
    }
  }

  // Analyze upset frequency (favorite losing)
  console.log(`\n=== UPSET ANALYSIS ===`);
  const favoriteGames = analyses.filter(a => Math.abs(a.homeElo - a.awayElo) >= 50);
  const upsets = favoriteGames.filter(a => {
    const favorite = a.homeElo > a.awayElo ? 'HOME' : 'AWAY';
    return a.actualWinner !== 'DRAW' && a.actualWinner !== favorite;
  });
  console.log(`  Games with clear favorite (50+ ELO diff): ${favoriteGames.length}`);
  console.log(`  Upsets (underdog wins): ${upsets.length} (${(upsets.length / favoriteGames.length * 100).toFixed(1)}%)`);

  // Player analysis
  console.log(`\n=== PLAYER ELO DISTRIBUTION ===`);
  const players = await prisma.player.findMany({
    include: {
      teamPlayers: true,
    },
  });

  const playerStats = players.map(p => ({
    name: `${p.name} ${p.lastName}`,
    elo: p.elo,
    gkElo: p.gkElo,
    gamesPlayed: p.teamPlayers.length,
    avgGoals: p.teamPlayers.length > 0
      ? p.teamPlayers.reduce((sum, tp) => sum + tp.goals, 0) / p.teamPlayers.length
      : 0,
  })).filter(p => p.gamesPlayed >= 5);

  playerStats.sort((a, b) => b.elo - a.elo);

  console.log(`  Players with 5+ games: ${playerStats.length}`);
  console.log(`  ELO range: ${Math.min(...playerStats.map(p => p.elo))} - ${Math.max(...playerStats.map(p => p.elo))}`);
  console.log(`  Average ELO: ${(playerStats.reduce((sum, p) => sum + p.elo, 0) / playerStats.length).toFixed(0)}`);

  console.log(`\n  Top 10 players by ELO:`);
  for (const p of playerStats.slice(0, 10)) {
    console.log(`    ${p.name}: ${p.elo} ELO, ${p.gamesPlayed} games, ${p.avgGoals.toFixed(2)} avg goals`);
  }

  console.log(`\n  Bottom 10 players by ELO:`);
  for (const p of playerStats.slice(-10).reverse()) {
    console.log(`    ${p.name}: ${p.elo} ELO, ${p.gamesPlayed} games, ${p.avgGoals.toFixed(2)} avg goals`);
  }

  // Analyze win rates
  console.log(`\n=== WIN RATES BY ELO TIER ===`);
  const playerWinRates = await Promise.all(players.filter(p => p.teamPlayers.length >= 5).map(async p => {
    const gamesWithResults = await prisma.teamPlayer.findMany({
      where: { playerId: p.id },
      include: {
        game: {
          include: {
            teamPlayers: true,
          },
        },
      },
    });

    let wins = 0, losses = 0, draws = 0;
    for (const tp of gamesWithResults) {
      const game = tp.game;
      if (!game.endDateTime) continue;

      const myTeamGoals = game.teamPlayers
        .filter(gtp => gtp.side === tp.side)
        .reduce((sum, gtp) => sum + gtp.goals, 0);
      const oppTeamGoals = game.teamPlayers
        .filter(gtp => gtp.side !== tp.side)
        .reduce((sum, gtp) => sum + gtp.goals, 0);

      if (myTeamGoals > oppTeamGoals) wins++;
      else if (myTeamGoals < oppTeamGoals) losses++;
      else draws++;
    }

    const totalGames = wins + losses + draws;
    return {
      name: `${p.name} ${p.lastName}`,
      elo: p.elo,
      wins,
      losses,
      draws,
      winRate: totalGames > 0 ? wins / totalGames : 0,
    };
  }));

  // Sort by ELO and show correlation with win rate
  playerWinRates.sort((a, b) => b.elo - a.elo);

  console.log(`\n  ELO vs Win Rate correlation:`);
  const top25 = playerWinRates.slice(0, Math.floor(playerWinRates.length * 0.25));
  const bottom25 = playerWinRates.slice(-Math.floor(playerWinRates.length * 0.25));

  const topAvgWinRate = top25.reduce((sum, p) => sum + p.winRate, 0) / top25.length;
  const bottomAvgWinRate = bottom25.reduce((sum, p) => sum + p.winRate, 0) / bottom25.length;

  console.log(`    Top 25% ELO players avg win rate: ${(topAvgWinRate * 100).toFixed(1)}%`);
  console.log(`    Bottom 25% ELO players avg win rate: ${(bottomAvgWinRate * 100).toFixed(1)}%`);

  // Check if higher ELO correlates with higher win rate
  let positiveCorrelations = 0;
  for (let i = 0; i < playerWinRates.length - 1; i++) {
    if (playerWinRates[i].elo > playerWinRates[i + 1].elo &&
        playerWinRates[i].winRate > playerWinRates[i + 1].winRate) {
      positiveCorrelations++;
    }
  }
  console.log(`    Positive rank correlation: ${(positiveCorrelations / (playerWinRates.length - 1) * 100).toFixed(1)}%`);

  // Individual goal scoring patterns
  console.log(`\n=== GOAL SCORING PATTERNS ===`);
  const allTeamPlayers = await prisma.teamPlayer.findMany({
    where: {
      game: {
        endDateTime: { not: null },
      },
    },
  });

  const goalCounts: { [key: number]: number } = {};
  for (const tp of allTeamPlayers) {
    goalCounts[tp.goals] = (goalCounts[tp.goals] || 0) + 1;
  }

  console.log(`  Goals per player per game:`);
  for (const goals of Object.keys(goalCounts).map(Number).sort((a, b) => a - b)) {
    console.log(`    ${goals} goals: ${goalCounts[goals]} times (${(goalCounts[goals] / allTeamPlayers.length * 100).toFixed(1)}%)`);
  }

  // More detailed: better analysis with simple prediction
  console.log(`\n=== SIMPLE PREDICTION ANALYSIS ===`);

  // Just predict higher ELO team wins
  let simpleCorrect = 0;
  for (const a of analyses) {
    if (a.actualWinner === 'DRAW') continue;
    const predictedByElo = a.homeElo > a.awayElo ? 'HOME' : 'AWAY';
    if (predictedByElo === a.actualWinner) simpleCorrect++;
  }
  const nonDrawGames = analyses.filter(a => a.actualWinner !== 'DRAW').length;
  console.log(`  Simple "higher ELO wins" prediction (excluding draws):`);
  console.log(`  ${simpleCorrect}/${nonDrawGames} correct (${(simpleCorrect / nonDrawGames * 100).toFixed(1)}%)`);

  // Calculate expected prediction rate if ELO perfectly calibrated
  console.log(`\n=== THEORETICAL ANALYSIS ===`);
  let expectedCorrect = 0;
  for (const a of analyses) {
    const prob = a.homeElo > a.awayElo ? a.expectedWinProb : 1 - a.expectedWinProb;
    expectedCorrect += prob;
  }
  console.log(`  If ELO is perfectly calibrated, expected correct predictions: ${expectedCorrect.toFixed(1)}/${analyses.length}`);
  console.log(`  This would give ${(expectedCorrect / analyses.length * 100).toFixed(1)}% accuracy`);

  await prisma.$disconnect();
}

analyzeGames().catch(console.error);
