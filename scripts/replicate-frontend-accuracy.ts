import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function calculateAccuracy() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`REPLICATING FRONTEND PREDICTION ACCURACY CALCULATION`);
  console.log(`${'='.repeat(60)}\n`);

  // Get all games with timePlayed (same as API)
  const games = await prisma.game.findMany({
    where: {
      timePlayed: { not: null },
    },
    include: {
      teamPlayers: {
        include: { player: true },
      },
    },
    orderBy: { startDateTime: 'asc' },
  });

  console.log(`Total games: ${games.length}`);

  // Build ELO timeline (same as API)
  const playerElos = new Map<number, number>();
  const allPlayers = await prisma.player.findMany();
  for (const player of allPlayers) {
    playerElos.set(player.id, 1500);
  }

  const playerEloAtGameTime = new Map<number, Map<number, number>>();

  for (const game of games) {
    const gameElos = new Map<number, number>();
    for (const tp of game.teamPlayers) {
      gameElos.set(tp.playerId, playerElos.get(tp.playerId) || 1500);
    }
    playerEloAtGameTime.set(game.id, gameElos);

    for (const tp of game.teamPlayers) {
      const currentElo = playerElos.get(tp.playerId) || 1500;
      playerElos.set(tp.playerId, currentElo + tp.deltaELO);
    }
  }

  // Now calculate predictions (same as frontend)
  let correct = 0;
  let total = 0;

  let winPredictions = 0, lossPredictions = 0, tiePredictions = 0;
  let winCorrect = 0, lossCorrect = 0, tieCorrect = 0;
  let actualWins = 0, actualLosses = 0, actualTies = 0;

  for (const game of games) {
    const gameElos = playerEloAtGameTime.get(game.id) || new Map();

    const homePlayers = game.teamPlayers.filter(tp => tp.side === 'HOME');
    const awayPlayers = game.teamPlayers.filter(tp => tp.side === 'AWAY');

    const homeElo = homePlayers.reduce((sum, tp) => sum + (gameElos.get(tp.playerId) || 1500), 0) / homePlayers.length;
    const awayElo = awayPlayers.reduce((sum, tp) => sum + (gameElos.get(tp.playerId) || 1500), 0) / awayPlayers.length;

    // Use stored averages if available
    const team1AverageElo = game.homeTeamAverageElo || homeElo;
    const team2AverageElo = game.awayTeamAverageElo || awayElo;

    // Calculate expected score (frontend logic)
    const eloDiff = team2AverageElo - team1AverageElo;
    const expectedScore = 1 / (1 + Math.pow(10, eloDiff / 400));

    // Frontend prediction logic
    let expectedResult: 'win' | 'loss' | 'tie';
    if (expectedScore >= 0.55) {
      expectedResult = 'win';
      winPredictions++;
    } else if (expectedScore <= 0.45) {
      expectedResult = 'loss';
      lossPredictions++;
    } else {
      expectedResult = 'tie';
      tiePredictions++;
    }

    // Actual result
    const homeGoals = homePlayers.reduce((sum, tp) => sum + tp.goals, 0);
    const awayGoals = awayPlayers.reduce((sum, tp) => sum + tp.goals, 0);

    let actualResult: 'win' | 'loss' | 'tie';
    if (homeGoals > awayGoals) {
      actualResult = 'win';
      actualWins++;
    } else if (awayGoals > homeGoals) {
      actualResult = 'loss';
      actualLosses++;
    } else {
      actualResult = 'tie';
      actualTies++;
    }

    if (expectedResult === actualResult) {
      correct++;
      if (expectedResult === 'win') winCorrect++;
      if (expectedResult === 'loss') lossCorrect++;
      if (expectedResult === 'tie') tieCorrect++;
    }
    total++;
  }

  console.log(`\n=== CURRENT FRONTEND ACCURACY ===`);
  console.log(`Correct: ${correct}/${total} (${(correct / total * 100).toFixed(1)}%)`);

  console.log(`\n=== BREAKDOWN BY PREDICTION TYPE ===`);
  console.log(`Win predictions: ${winPredictions}, correct: ${winCorrect} (${winPredictions > 0 ? (winCorrect / winPredictions * 100).toFixed(1) : 0}%)`);
  console.log(`Loss predictions: ${lossPredictions}, correct: ${lossCorrect} (${lossPredictions > 0 ? (lossCorrect / lossPredictions * 100).toFixed(1) : 0}%)`);
  console.log(`Tie predictions: ${tiePredictions}, correct: ${tieCorrect} (${tiePredictions > 0 ? (tieCorrect / tiePredictions * 100).toFixed(1) : 0}%)`);

  console.log(`\n=== ACTUAL OUTCOMES ===`);
  console.log(`Actual wins: ${actualWins} (${(actualWins / total * 100).toFixed(1)}%)`);
  console.log(`Actual losses: ${actualLosses} (${(actualLosses / total * 100).toFixed(1)}%)`);
  console.log(`Actual ties: ${actualTies} (${(actualTies / total * 100).toFixed(1)}%)`);

  // Calculate what accuracy would be WITHOUT tie zone
  console.log(`\n=== SIMPLIFIED PREDICTION (no tie zone) ===`);
  let simpleCorrect = 0;
  let simpleTotal = 0;

  for (const game of games) {
    const gameElos = playerEloAtGameTime.get(game.id) || new Map();

    const homePlayers = game.teamPlayers.filter(tp => tp.side === 'HOME');
    const awayPlayers = game.teamPlayers.filter(tp => tp.side === 'AWAY');

    const homeElo = homePlayers.reduce((sum, tp) => sum + (gameElos.get(tp.playerId) || 1500), 0) / homePlayers.length;
    const awayElo = awayPlayers.reduce((sum, tp) => sum + (gameElos.get(tp.playerId) || 1500), 0) / awayPlayers.length;

    const team1AverageElo = game.homeTeamAverageElo || homeElo;
    const team2AverageElo = game.awayTeamAverageElo || awayElo;

    const homeGoals = homePlayers.reduce((sum, tp) => sum + tp.goals, 0);
    const awayGoals = awayPlayers.reduce((sum, tp) => sum + tp.goals, 0);

    // Skip draws for simple prediction
    if (homeGoals === awayGoals) continue;

    simpleTotal++;

    // Simple: predict higher ELO wins
    const predicted = team1AverageElo > team2AverageElo ? 'HOME' : 'AWAY';
    const actual = homeGoals > awayGoals ? 'HOME' : 'AWAY';

    if (predicted === actual) simpleCorrect++;
  }

  console.log(`Simple "higher ELO wins" (excluding draws):`);
  console.log(`Correct: ${simpleCorrect}/${simpleTotal} (${(simpleCorrect / simpleTotal * 100).toFixed(1)}%)`);

  // Calculate with improved prediction logic
  console.log(`\n=== IMPROVED PREDICTION (always predict winner, never tie) ===`);
  let improvedCorrect = 0;

  for (const game of games) {
    const gameElos = playerEloAtGameTime.get(game.id) || new Map();

    const homePlayers = game.teamPlayers.filter(tp => tp.side === 'HOME');
    const awayPlayers = game.teamPlayers.filter(tp => tp.side === 'AWAY');

    const homeElo = homePlayers.reduce((sum, tp) => sum + (gameElos.get(tp.playerId) || 1500), 0) / homePlayers.length;
    const awayElo = awayPlayers.reduce((sum, tp) => sum + (gameElos.get(tp.playerId) || 1500), 0) / awayPlayers.length;

    const team1AverageElo = game.homeTeamAverageElo || homeElo;
    const team2AverageElo = game.awayTeamAverageElo || awayElo;

    const homeGoals = homePlayers.reduce((sum, tp) => sum + tp.goals, 0);
    const awayGoals = awayPlayers.reduce((sum, tp) => sum + tp.goals, 0);

    // Predict: higher ELO team wins (never predict tie)
    let predicted: 'win' | 'loss';
    if (team1AverageElo > team2AverageElo) {
      predicted = 'win';
    } else {
      predicted = 'loss';
    }

    // Actual
    let actual: 'win' | 'loss' | 'tie';
    if (homeGoals > awayGoals) {
      actual = 'win';
    } else if (awayGoals > homeGoals) {
      actual = 'loss';
    } else {
      actual = 'tie';
    }

    // For ties, consider it correct if ELO difference is small
    if (actual === 'tie') {
      const eloDiff = Math.abs(team1AverageElo - team2AverageElo);
      if (eloDiff < 30) {
        improvedCorrect++;
      }
    } else if (predicted === actual) {
      improvedCorrect++;
    }
  }

  console.log(`Correct: ${improvedCorrect}/${total} (${(improvedCorrect / total * 100).toFixed(1)}%)`);

  await prisma.$disconnect();
}

calculateAccuracy().catch(console.error);
