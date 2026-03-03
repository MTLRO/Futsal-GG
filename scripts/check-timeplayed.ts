import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const withTimePlayed = await prisma.game.count({ where: { timePlayed: { not: null } } });
  const withoutTimePlayed = await prisma.game.count({ where: { timePlayed: null } });
  console.log('Games with timePlayed:', withTimePlayed);
  console.log('Games without timePlayed:', withoutTimePlayed);

  // Check the exact query used by the API
  const games = await prisma.game.findMany({
    where: {
      timePlayed: {
        not: null,
      },
    },
    select: { id: true },
  });
  console.log('Games returned by API query:', games.length);

  await prisma.$disconnect();
}
check();
