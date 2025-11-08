// Export data from current database to JSON files
// Run with: npx tsx scripts/export-data.ts

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function exportData() {
  console.log('🔄 Exporting data from database...\n');

  try {
    // Export Players
    console.log('📊 Exporting Players...');
    const players = await prisma.player.findMany({
      orderBy: { id: 'asc' }
    });
    console.log(`   Found ${players.length} players`);

    // Export Games
    console.log('📊 Exporting Games...');
    const games = await prisma.game.findMany({
      orderBy: { id: 'asc' }
    });
    console.log(`   Found ${games.length} games`);

    // Export TeamPlayers
    console.log('📊 Exporting TeamPlayers...');
    const teamPlayers = await prisma.teamPlayer.findMany({
      orderBy: { id: 'asc' }
    });
    console.log(`   Found ${teamPlayers.length} team player records`);

    // Export TeamCompositions
    console.log('📊 Exporting TeamCompositions...');
    const teamCompositions = await prisma.teamComposition.findMany({
      orderBy: { id: 'asc' }
    });
    console.log(`   Found ${teamCompositions.length} team compositions`);

    // Export GameMasters
    console.log('📊 Exporting GameMasters...');
    const gameMasters = await prisma.gameMaster.findMany({
      orderBy: { id: 'asc' }
    });
    console.log(`   Found ${gameMasters.length} game masters`);

    // Create export directory
    const exportDir = path.join(process.cwd(), 'db-export');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir);
    }

    // Save to JSON files
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const exportFile = path.join(exportDir, `database-export-${timestamp}.json`);

    const exportData = {
      exportDate: new Date().toISOString(),
      tables: {
        players,
        games,
        teamPlayers,
        teamCompositions,
        gameMasters
      },
      counts: {
        players: players.length,
        games: games.length,
        teamPlayers: teamPlayers.length,
        teamCompositions: teamCompositions.length,
        gameMasters: gameMasters.length
      }
    };

    fs.writeFileSync(exportFile, JSON.stringify(exportData, null, 2));

    console.log('\n✅ Export completed successfully!');
    console.log(`📁 Saved to: ${exportFile}`);
    console.log('\n📊 Summary:');
    console.log(`   Players: ${players.length}`);
    console.log(`   Games: ${games.length}`);
    console.log(`   TeamPlayers: ${teamPlayers.length}`);
    console.log(`   TeamCompositions: ${teamCompositions.length}`);
    console.log(`   GameMasters: ${gameMasters.length}`);

    // Also create SQL insert statements
    const sqlFile = path.join(exportDir, `database-export-${timestamp}.sql`);
    let sql = '-- Database Export\n';
    sql += `-- Generated: ${new Date().toISOString()}\n\n`;

    // Players
    if (players.length > 0) {
      sql += '-- Players\n';
      sql += 'INSERT INTO "Player" ("id", "name", "lastName", "elo") VALUES\n';
      sql += players.map((p, i) =>
        `(${p.id}, '${p.name.replace(/'/g, "''")}', '${p.lastName.replace(/'/g, "''")}', ${p.elo})${i === players.length - 1 ? ';' : ','}`
      ).join('\n');
      sql += '\n\n';
    }

    // Games
    if (games.length > 0) {
      sql += '-- Games\n';
      sql += 'INSERT INTO "Game" ("id", "startDateTime", "timePlayed", "homeTeamAverageElo", "awayTeamAverageElo") VALUES\n';
      sql += games.map((g, i) =>
        `(${g.id}, '${g.startDateTime.toISOString()}', ${g.timePlayed ?? 'NULL'}, ${g.homeTeamAverageElo ?? 'NULL'}, ${g.awayTeamAverageElo ?? 'NULL'})${i === games.length - 1 ? ';' : ','}`
      ).join('\n');
      sql += '\n\n';
    }

    // TeamPlayers
    if (teamPlayers.length > 0) {
      sql += '-- TeamPlayers\n';
      sql += 'INSERT INTO "TeamPlayer" ("id", "side", "playerId", "goals", "deltaELO", "gameInARow", "gameId") VALUES\n';
      sql += teamPlayers.map((tp, i) =>
        `(${tp.id}, '${tp.side}', ${tp.playerId}, ${tp.goals}, ${tp.deltaELO}, ${tp.gameInARow}, ${tp.gameId})${i === teamPlayers.length - 1 ? ';' : ','}`
      ).join('\n');
      sql += '\n\n';
    }

    // Update sequences
    sql += '-- Update sequences\n';
    if (players.length > 0) {
      sql += `SELECT setval('"Player_id_seq"', (SELECT MAX(id) FROM "Player"));\n`;
    }
    if (games.length > 0) {
      sql += `SELECT setval('"Game_id_seq"', (SELECT MAX(id) FROM "Game"));\n`;
    }
    if (teamPlayers.length > 0) {
      sql += `SELECT setval('"TeamPlayer_id_seq"', (SELECT MAX(id) FROM "TeamPlayer"));\n`;
    }

    fs.writeFileSync(sqlFile, sql);
    console.log(`📁 SQL file: ${sqlFile}`);

  } catch (error) {
    console.error('❌ Error exporting data:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

exportData();
