import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const allGames = await prisma.game.count();
  const gamesWithEnd = await prisma.game.count({ where: { endDateTime: { not: null } } });
  const gamesWithoutEnd = await prisma.game.count({ where: { endDateTime: null } });

  console.log('Total games:', allGames);
  console.log('With endDateTime:', gamesWithEnd);
  console.log('Without endDateTime:', gamesWithoutEnd);

  // Sample games
  const samples = await prisma.game.findMany({
    take: 5,
    orderBy: { startDateTime: 'desc' },
    select: {
      id: true,
      startDateTime: true,
      endDateTime: true,
      timePlayed: true,
      homeTeamAverageElo: true,
      awayTeamAverageElo: true,
    }
  });
  console.log('\nRecent games:');
  console.log(JSON.stringify(samples, null, 2));

  // Check how many games have 10 players (full teams)
  const gamesWithPlayers = await prisma.game.findMany({
    include: {
      teamPlayers: true
    }
  });

  const gamesWithFull = gamesWithPlayers.filter(g => g.teamPlayers.length === 10);
  console.log('\nGames with exactly 10 players:', gamesWithFull.length);

  // Check team players count
  const tpCount = await prisma.teamPlayer.count();
  console.log('\nTotal team player entries:', tpCount);

  // Check deltaELO distribution
  const deltaElos = await prisma.teamPlayer.findMany({
    select: { deltaELO: true }
  });
  const nonZero = deltaElos.filter(d => d.deltaELO !== 0).length;
  console.log('TeamPlayers with non-zero deltaELO:', nonZero);

  // Check player game counts
  const playersWithGameCount = await prisma.player.findMany({
    include: {
      _count: {
        select: { teamPlayers: true }
      }
    }
  });

  const topPlayer = playersWithGameCount.sort((a, b) => b._count.teamPlayers - a._count.teamPlayers)[0];
  console.log('\nPlayer with most games:', topPlayer.name, topPlayer.lastName, 'with', topPlayer._count.teamPlayers, 'games');

  await prisma.$disconnect();
}
check().catch(console.error);
