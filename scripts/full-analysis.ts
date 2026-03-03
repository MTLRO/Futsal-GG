import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fullAnalysis() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`COMPREHENSIVE ELO ANALYSIS`);
  console.log(`${'='.repeat(60)}\n`);

  // Get ALL games with 10 players (completed games)
  const games = await prisma.game.findMany({
    include: {
      teamPlayers: {
        include: {
          player: true,
        },
      },
    },
    orderBy: { startDateTime: 'asc' },
  });

  const completedGames = games.filter(g => g.teamPlayers.length === 10);
  console.log(`Total games: ${games.length}`);
  console.log(`Completed games (10 players): ${completedGames.length}\n`);

  // Track player stats
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
    deltaEloSum: number;
  }> = new Map();

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
      deltaEloSum: 0,
    });
  }

  // For prediction analysis - simulate historical predictions
  const predictions: {
    gameId: number;
    homeEloSum: number;
    awayEloSum: number;
    actualWinner: 'HOME' | 'AWAY' | 'DRAW';
    homeGoals: number;
    awayGoals: number;
  }[] = [];

  // Process each game
  for (const game of completedGames) {
    const homePlayers = game.teamPlayers.filter(tp => tp.side === 'HOME');
    const awayPlayers = game.teamPlayers.filter(tp => tp.side === 'AWAY');

    const homeGoals = homePlayers.reduce((sum, tp) => sum + tp.goals, 0);
    const awayGoals = awayPlayers.reduce((sum, tp) => sum + tp.goals, 0);

    // Calculate average ELO for each team (use stored or calculate from deltaELO)
    // We can infer pre-game ELO from current ELO minus cumulative deltaELO
    const homeEloSum = game.homeTeamAverageElo ? game.homeTeamAverageElo * 5 :
      homePlayers.reduce((sum, tp) => sum + tp.player.elo, 0);
    const awayEloSum = game.awayTeamAverageElo ? game.awayTeamAverageElo * 5 :
      awayPlayers.reduce((sum, tp) => sum + tp.player.elo, 0);

    const actualWinner = homeGoals > awayGoals ? 'HOME' :
      awayGoals > homeGoals ? 'AWAY' : 'DRAW';

    predictions.push({
      gameId: game.id,
      homeEloSum,
      awayEloSum,
      actualWinner,
      homeGoals,
      awayGoals,
    });

    // Update player stats
    for (const tp of game.teamPlayers) {
      const stats = playerStats.get(tp.playerId);
      if (!stats) continue;

      stats.gamesPlayed++;
      stats.goalsScored += tp.goals;
      stats.deltaEloSum += tp.deltaELO;

      const isHome = tp.side === 'HOME';
      const myGoals = isHome ? homeGoals : awayGoals;
      const oppGoals = isHome ? awayGoals : homeGoals;
      stats.goalsAgainst += oppGoals;

      if (tp.goalkeeper) {
        stats.gkGames++;
        stats.gkGoalsAgainst += oppGoals;
      }

      if (myGoals > oppGoals) stats.wins++;
      else if (myGoals < oppGoals) stats.losses++;
      else stats.draws++;
    }
  }

  // Prediction accuracy analysis
  console.log(`${'='.repeat(60)}`);
  console.log(`PREDICTION ACCURACY`);
  console.log(`${'='.repeat(60)}\n`);

  const nonDrawGames = predictions.filter(p => p.actualWinner !== 'DRAW');
  const drawGames = predictions.filter(p => p.actualWinner === 'DRAW');

  console.log(`Games with winner: ${nonDrawGames.length}`);
  console.log(`Draw games: ${drawGames.length} (${(drawGames.length / predictions.length * 100).toFixed(1)}%)\n`);

  // Simple ELO prediction (higher ELO wins)
  let eloCorrect = 0;
  for (const game of nonDrawGames) {
    const predictedWinner = game.homeEloSum > game.awayEloSum ? 'HOME' : 'AWAY';
    if (predictedWinner === game.actualWinner) eloCorrect++;
  }
  console.log(`Current ELO prediction: ${eloCorrect}/${nonDrawGames.length} (${(eloCorrect / nonDrawGames.length * 100).toFixed(1)}%)`);

  // Home/Away bias
  const homeWins = nonDrawGames.filter(g => g.actualWinner === 'HOME').length;
  const awayWins = nonDrawGames.filter(g => g.actualWinner === 'AWAY').length;
  console.log(`\nHome wins: ${homeWins} (${(homeWins / nonDrawGames.length * 100).toFixed(1)}%)`);
  console.log(`Away wins: ${awayWins} (${(awayWins / nonDrawGames.length * 100).toFixed(1)}%)`);

  // Score distribution
  console.log(`\n${'='.repeat(60)}`);
  console.log(`SCORE PATTERNS`);
  console.log(`${'='.repeat(60)}\n`);

  const scoreDiffs = predictions.map(p => Math.abs(p.homeGoals - p.awayGoals));
  const totalGoals = predictions.map(p => p.homeGoals + p.awayGoals);

  console.log(`Average goal difference: ${(scoreDiffs.reduce((a, b) => a + b, 0) / scoreDiffs.length).toFixed(2)}`);
  console.log(`Average total goals/game: ${(totalGoals.reduce((a, b) => a + b, 0) / totalGoals.length).toFixed(2)}`);

  const diffCounts: { [key: number]: number } = {};
  for (const diff of scoreDiffs) {
    diffCounts[diff] = (diffCounts[diff] || 0) + 1;
  }
  console.log(`\nGoal difference distribution:`);
  for (const diff of Object.keys(diffCounts).map(Number).sort((a, b) => a - b)) {
    const pct = (diffCounts[diff] / predictions.length * 100).toFixed(1);
    console.log(`  ${diff} goals: ${diffCounts[diff]} games (${pct}%)`);
  }

  // Player performance vs ELO
  console.log(`\n${'='.repeat(60)}`);
  console.log(`PLAYER ELO vs ACTUAL PERFORMANCE`);
  console.log(`${'='.repeat(60)}\n`);

  const playersWithGames = Array.from(playerStats.values())
    .filter(p => p.gamesPlayed >= 5)
    .map(p => {
      const winRate = p.wins / p.gamesPlayed;
      const goalsPerGame = p.goalsScored / p.gamesPlayed;
      return { ...p, winRate, goalsPerGame };
    });

  // Calculate ELO-WinRate correlation
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

  console.log(`ELO-WinRate Correlation: ${correlation.toFixed(3)}`);
  console.log(`(Ideal: close to +1.0, current is ${correlation > 0 ? 'positive but weak' : 'NEGATIVE - ELO is inverted!'})\n`);

  // Show players sorted by win rate
  playersWithGames.sort((a, b) => b.winRate - a.winRate);

  console.log(`${'Name'.padEnd(22)} | ${'ELO'.padStart(5)} | ${'W-L-D'.padStart(9)} | ${'Win%'.padStart(5)} | ${'GPG'.padStart(4)}`);
  console.log('-'.repeat(60));
  for (const p of playersWithGames.slice(0, 15)) {
    console.log(
      `${p.name.slice(0, 22).padEnd(22)} | ${p.currentElo.toString().padStart(5)} | ${`${p.wins}-${p.losses}-${p.draws}`.padStart(9)} | ${(p.winRate * 100).toFixed(0).padStart(4)}% | ${p.goalsPerGame.toFixed(2).padStart(4)}`
    );
  }

  // ELO change analysis
  console.log(`\n${'='.repeat(60)}`);
  console.log(`ELO CHANGE ANALYSIS`);
  console.log(`${'='.repeat(60)}\n`);

  const teamPlayerData = await prisma.teamPlayer.findMany({
    include: { player: true, game: { include: { teamPlayers: true } } }
  });

  // Analyze ELO changes
  const eloChanges = teamPlayerData.map(tp => ({
    deltaELO: tp.deltaELO,
    goals: tp.goals,
    isWin: (() => {
      const myTeamGoals = tp.game.teamPlayers
        .filter(gtp => gtp.side === tp.side)
        .reduce((sum, gtp) => sum + gtp.goals, 0);
      const oppTeamGoals = tp.game.teamPlayers
        .filter(gtp => gtp.side !== tp.side)
        .reduce((sum, gtp) => sum + gtp.goals, 0);
      return myTeamGoals > oppTeamGoals;
    })(),
    isLoss: (() => {
      const myTeamGoals = tp.game.teamPlayers
        .filter(gtp => gtp.side === tp.side)
        .reduce((sum, gtp) => sum + gtp.goals, 0);
      const oppTeamGoals = tp.game.teamPlayers
        .filter(gtp => gtp.side !== tp.side)
        .reduce((sum, gtp) => sum + gtp.goals, 0);
      return myTeamGoals < oppTeamGoals;
    })(),
  }));

  const winChanges = eloChanges.filter(e => e.isWin).map(e => e.deltaELO);
  const lossChanges = eloChanges.filter(e => e.isLoss).map(e => e.deltaELO);
  const drawChanges = eloChanges.filter(e => !e.isWin && !e.isLoss).map(e => e.deltaELO);

  console.log(`Average ELO change on WIN: +${(winChanges.reduce((a, b) => a + b, 0) / winChanges.length).toFixed(1)}`);
  console.log(`Average ELO change on LOSS: ${(lossChanges.reduce((a, b) => a + b, 0) / lossChanges.length).toFixed(1)}`);
  console.log(`Average ELO change on DRAW: ${(drawChanges.reduce((a, b) => a + b, 0) / drawChanges.length).toFixed(1)}`);

  // Check if goal scorers get more ELO
  const scorersWin = winChanges.filter((_, i) => eloChanges.filter(e => e.isWin)[i].goals > 0);
  const nonScorersWin = winChanges.filter((_, i) => eloChanges.filter(e => e.isWin)[i].goals === 0);

  if (scorersWin.length > 0 && nonScorersWin.length > 0) {
    console.log(`\nAverage ELO gain for goal scorers on WIN: +${(scorersWin.reduce((a, b) => a + b, 0) / scorersWin.length).toFixed(1)}`);
    console.log(`Average ELO gain for non-scorers on WIN: +${(nonScorersWin.reduce((a, b) => a + b, 0) / nonScorersWin.length).toFixed(1)}`);
  }

  // Upset analysis by ELO difference
  console.log(`\n${'='.repeat(60)}`);
  console.log(`UPSET ANALYSIS BY ELO DIFFERENCE`);
  console.log(`${'='.repeat(60)}\n`);

  const eloDiffBuckets = [
    { min: 0, max: 100, label: '0-100' },
    { min: 100, max: 200, label: '100-200' },
    { min: 200, max: 300, label: '200-300' },
    { min: 300, max: 500, label: '300-500' },
    { min: 500, max: 1000, label: '500+' },
  ];

  for (const bucket of eloDiffBuckets) {
    const bucketGames = nonDrawGames.filter(g => {
      const diff = Math.abs(g.homeEloSum - g.awayEloSum);
      return diff >= bucket.min && diff < bucket.max;
    });

    if (bucketGames.length === 0) continue;

    let favoriteWins = 0;
    for (const game of bucketGames) {
      const favorite = game.homeEloSum > game.awayEloSum ? 'HOME' : 'AWAY';
      if (game.actualWinner === favorite) favoriteWins++;
    }

    const pct = (favoriteWins / bucketGames.length * 100).toFixed(1);
    console.log(`ELO diff ${bucket.label}: ${bucketGames.length} games, favorite wins ${favoriteWins} (${pct}%)`);
  }

  // What actually predicts wins?
  console.log(`\n${'='.repeat(60)}`);
  console.log(`ALTERNATIVE PREDICTION METHODS`);
  console.log(`${'='.repeat(60)}\n`);

  // Build player win rates map
  const playerWinRates = new Map<number, number>();
  for (const [id, stats] of playerStats) {
    if (stats.gamesPlayed > 0) {
      playerWinRates.set(id, stats.wins / stats.gamesPlayed);
    }
  }

  // Test: predict by sum of historical win rates
  let winRateCorrect = 0;
  for (const game of nonDrawGames) {
    const fullGame = completedGames.find(g => g.id === game.gameId)!;
    const homePlayers = fullGame.teamPlayers.filter(tp => tp.side === 'HOME');
    const awayPlayers = fullGame.teamPlayers.filter(tp => tp.side === 'AWAY');

    const homeWinRateSum = homePlayers.reduce((sum, tp) => sum + (playerWinRates.get(tp.playerId) ?? 0.5), 0);
    const awayWinRateSum = awayPlayers.reduce((sum, tp) => sum + (playerWinRates.get(tp.playerId) ?? 0.5), 0);

    const predicted = homeWinRateSum > awayWinRateSum ? 'HOME' : 'AWAY';
    if (predicted === game.actualWinner) winRateCorrect++;
  }
  console.log(`Historical Win Rate prediction: ${winRateCorrect}/${nonDrawGames.length} (${(winRateCorrect / nonDrawGames.length * 100).toFixed(1)}%)`);

  // Test: predict by sum of goals per game
  let goalsCorrect = 0;
  for (const game of nonDrawGames) {
    const fullGame = completedGames.find(g => g.id === game.gameId)!;
    const homePlayers = fullGame.teamPlayers.filter(tp => tp.side === 'HOME');
    const awayPlayers = fullGame.teamPlayers.filter(tp => tp.side === 'AWAY');

    const homeGoalsSum = homePlayers.reduce((sum, tp) => {
      const stats = playerStats.get(tp.playerId);
      return sum + (stats && stats.gamesPlayed > 0 ? stats.goalsScored / stats.gamesPlayed : 0);
    }, 0);
    const awayGoalsSum = awayPlayers.reduce((sum, tp) => {
      const stats = playerStats.get(tp.playerId);
      return sum + (stats && stats.gamesPlayed > 0 ? stats.goalsScored / stats.gamesPlayed : 0);
    }, 0);

    const predicted = homeGoalsSum > awayGoalsSum ? 'HOME' : 'AWAY';
    if (predicted === game.actualWinner) goalsCorrect++;
  }
  console.log(`Goals Per Game prediction: ${goalsCorrect}/${nonDrawGames.length} (${(goalsCorrect / nonDrawGames.length * 100).toFixed(1)}%)`);

  // Random baseline
  let randomSum = 0;
  for (let i = 0; i < 1000; i++) {
    let correct = 0;
    for (const _ of nonDrawGames) {
      if (Math.random() > 0.5) correct++;
    }
    randomSum += correct;
  }
  const randomAvg = randomSum / 1000;
  console.log(`Random baseline (1000 trials): ${randomAvg.toFixed(1)}/${nonDrawGames.length} (${(randomAvg / nonDrawGames.length * 100).toFixed(1)}%)`);

  // Always predict away (since away wins more often in the data)
  console.log(`\nAlways predict AWAY: ${awayWins}/${nonDrawGames.length} (${(awayWins / nonDrawGames.length * 100).toFixed(1)}%)`);
  console.log(`Always predict HOME: ${homeWins}/${nonDrawGames.length} (${(homeWins / nonDrawGames.length * 100).toFixed(1)}%)`);

  await prisma.$disconnect();
}

fullAnalysis().catch(console.error);
