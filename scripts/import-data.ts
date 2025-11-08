// Import data from JSON export file
// Run with: npx tsx scripts/import-data.ts <path-to-json-file>

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

async function importData() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('❌ Error: Please provide path to JSON export file');
    console.log('Usage: npx tsx scripts/import-data.ts <path-to-json-file>');
    process.exit(1);
  }

  const filePath = args[0];

  if (!fs.existsSync(filePath)) {
    console.error(`❌ Error: File not found: ${filePath}`);
    process.exit(1);
  }

  console.log('🔄 Importing data from:', filePath);
  console.log('');

  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    console.log('📊 Data to import:');
    console.log(`   Players: ${data.counts.players}`);
    console.log(`   Games: ${data.counts.games}`);
    console.log(`   TeamPlayers: ${data.counts.teamPlayers}`);
    console.log(`   TeamCompositions: ${data.counts.teamCompositions}`);
    console.log(`   GameMasters: ${data.counts.gameMasters}`);
    console.log('');

    // Confirm before proceeding
    console.log('⚠️  This will import data into the current database.');
    console.log('   Make sure you are connected to the correct database!');
    console.log('');

    // Import in transaction
    await prisma.$transaction(async (tx) => {
      // Import Players
      if (data.tables.players.length > 0) {
        console.log('📥 Importing Players...');
        for (const player of data.tables.players) {
          await tx.player.upsert({
            where: { id: player.id },
            create: player,
            update: {
              name: player.name,
              lastName: player.lastName,
              elo: player.elo
            }
          });
        }
        console.log(`   ✅ Imported ${data.tables.players.length} players`);
      }

      // Import Games
      if (data.tables.games.length > 0) {
        console.log('📥 Importing Games...');
        for (const game of data.tables.games) {
          await tx.game.upsert({
            where: { id: game.id },
            create: {
              id: game.id,
              startDateTime: new Date(game.startDateTime),
              timePlayed: game.timePlayed,
              homeTeamAverageElo: game.homeTeamAverageElo,
              awayTeamAverageElo: game.awayTeamAverageElo
            },
            update: {
              startDateTime: new Date(game.startDateTime),
              timePlayed: game.timePlayed,
              homeTeamAverageElo: game.homeTeamAverageElo,
              awayTeamAverageElo: game.awayTeamAverageElo
            }
          });
        }
        console.log(`   ✅ Imported ${data.tables.games.length} games`);
      }

      // Import TeamPlayers
      if (data.tables.teamPlayers.length > 0) {
        console.log('📥 Importing TeamPlayers...');
        for (const tp of data.tables.teamPlayers) {
          await tx.teamPlayer.upsert({
            where: { id: tp.id },
            create: tp,
            update: {
              side: tp.side,
              playerId: tp.playerId,
              goals: tp.goals,
              deltaELO: tp.deltaELO,
              gameInARow: tp.gameInARow,
              gameId: tp.gameId
            }
          });
        }
        console.log(`   ✅ Imported ${data.tables.teamPlayers.length} team player records`);
      }

      // Import TeamCompositions
      if (data.tables.teamCompositions.length > 0) {
        console.log('📥 Importing TeamCompositions...');
        for (const tc of data.tables.teamCompositions) {
          await tx.teamComposition.upsert({
            where: { id: tc.id },
            create: tc,
            update: {
              team: tc.team,
              playerIds: tc.playerIds
            }
          });
        }
        console.log(`   ✅ Imported ${data.tables.teamCompositions.length} team compositions`);
      }

      // Import GameMasters
      if (data.tables.gameMasters.length > 0) {
        console.log('📥 Importing GameMasters...');
        for (const gm of data.tables.gameMasters) {
          await tx.gameMaster.upsert({
            where: { id: gm.id },
            create: {
              id: gm.id,
              passwordHash: gm.passwordHash,
              createdAt: new Date(gm.createdAt),
              updatedAt: new Date(gm.updatedAt)
            },
            update: {
              passwordHash: gm.passwordHash,
              createdAt: new Date(gm.createdAt),
              updatedAt: new Date(gm.updatedAt)
            }
          });
        }
        console.log(`   ✅ Imported ${data.tables.gameMasters.length} game masters`);
      }
    });

    console.log('');
    console.log('✅ Import completed successfully!');
    console.log('');

    // Verify counts
    const counts = {
      players: await prisma.player.count(),
      games: await prisma.game.count(),
      teamPlayers: await prisma.teamPlayer.count(),
      teamCompositions: await prisma.teamComposition.count(),
      gameMasters: await prisma.gameMaster.count()
    };

    console.log('📊 Current database counts:');
    console.log(`   Players: ${counts.players}`);
    console.log(`   Games: ${counts.games}`);
    console.log(`   TeamPlayers: ${counts.teamPlayers}`);
    console.log(`   TeamCompositions: ${counts.teamCompositions}`);
    console.log(`   GameMasters: ${counts.gameMasters}`);

  } catch (error) {
    console.error('❌ Error importing data:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

importData();
