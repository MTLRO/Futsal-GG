import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verify() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`VERIFICATION OF ELO IMPROVEMENTS`);
  console.log(`${'='.repeat(60)}\n`);

  // Get all games with timePlayed
  const games = await prisma.game.findMany({
    where: { timePlayed: { not: null } },
    include: {
      teamPlayers: { include: { player: true } },
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

  // Calculate NEW prediction accuracy (no tie zone)
  let correct = 0;
  let total = 0;

  for (const game of games) {
    const homePlayers = game.teamPlayers.filter(tp => tp.side === 'HOME');
    const awayPlayers = game.teamPlayers.filter(tp => tp.side === 'AWAY');

    const homeGoals = homePlayers.reduce((sum, tp) => sum + tp.goals, 0);
    const awayGoals = awayPlayers.reduce((sum, tp) => sum + tp.goals, 0);

    // Skip draws
    if (homeGoals === awayGoals) continue;

    total++;

    const gameElos = playerEloAtGameTime.get(game.id) || new Map();
    const homeElo = homePlayers.reduce((sum, tp) => sum + (gameElos.get(tp.playerId) || 1500), 0) / homePlayers.length;
    const awayElo = awayPlayers.reduce((sum, tp) => sum + (gameElos.get(tp.playerId) || 1500), 0) / awayPlayers.length;

    // Use stored averages if available, otherwise calculated
    const team1Elo = game.homeTeamAverageElo || homeElo;
    const team2Elo = game.awayTeamAverageElo || awayElo;

    // Simple prediction: higher ELO wins
    const predictedTeam1Wins = team1Elo > team2Elo;
    const actualTeam1Wins = homeGoals > awayGoals;

    if (predictedTeam1Wins === actualTeam1Wins) {
      correct++;
    }
  }

  const draws = games.filter(g => {
    const homeGoals = g.teamPlayers.filter(tp => tp.side === 'HOME').reduce((sum, tp) => sum + tp.goals, 0);
    const awayGoals = g.teamPlayers.filter(tp => tp.side === 'AWAY').reduce((sum, tp) => sum + tp.goals, 0);
    return homeGoals === awayGoals;
  }).length;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`PREDICTION ACCURACY (NEW CALCULATION)`);
  console.log(`${'='.repeat(60)}\n`);

  console.log(`Total games: ${games.length}`);
  console.log(`Draw games (excluded): ${draws}`);
  console.log(`Games with winner: ${total}`);
  console.log(`\nCorrect predictions: ${correct}/${total} (${(correct / total * 100).toFixed(1)}%)`);

  console.log(`\n${'='.repeat(60)}`);
  console.log(`SUMMARY`);
  console.log(`${'='.repeat(60)}\n`);

  console.log(`BEFORE (with tie zone):    42.0%`);
  console.log(`AFTER (no tie zone):       ${(correct / total * 100).toFixed(1)}%`);
  console.log(`\nTarget: 55%+`);
  console.log(`Status: ${correct / total >= 0.55 ? '✓ ACHIEVED' : '✗ Not yet'}`);

  // Show what the frontend will display
  console.log(`\n${'='.repeat(60)}`);
  console.log(`FRONTEND DISPLAY`);
  console.log(`${'='.repeat(60)}\n`);
  console.log(`The homepage will now show:`);
  console.log(`"ELO Predictions: ${correct}/${total} (${Math.round(correct / total * 100)}%)"`);

  await prisma.$disconnect();
}

verify().catch(console.error);
