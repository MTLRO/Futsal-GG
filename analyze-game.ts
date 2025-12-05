import { prisma } from './src/lib/prisma';

async function analyzeGame() {
  const games = await prisma.game.findMany({
    orderBy: { startDateTime: 'asc' },
    take: 10,
    include: {
      teamPlayers: {
        include: {
          player: true,
        },
      },
    },
  });

  for (const game of games) {
    const homeGoals = game.teamPlayers
      .filter(tp => tp.side === 'HOME')
      .reduce((sum, tp) => sum + tp.goals, 0);
    const awayGoals = game.teamPlayers
      .filter(tp => tp.side === 'AWAY')
      .reduce((sum, tp) => sum + tp.goals, 0);

    console.log(`\n=== Game ${game.id}: ${homeGoals}-${awayGoals} ===`);

    console.log('HOME Team:');
    game.teamPlayers.filter(tp => tp.side === 'HOME').forEach(tp => {
      console.log(`  ${tp.player.name}: ${tp.goals} goals, deltaELO: ${tp.deltaELO}, fatigueX: ${tp.fatigueX}`);
    });

    console.log('AWAY Team:');
    game.teamPlayers.filter(tp => tp.side === 'AWAY').forEach(tp => {
      console.log(`  ${tp.player.name}: ${tp.goals} goals, deltaELO: ${tp.deltaELO}, fatigueX: ${tp.fatigueX}`);
    });
  }

  await prisma.$disconnect();
}

analyzeGame();
