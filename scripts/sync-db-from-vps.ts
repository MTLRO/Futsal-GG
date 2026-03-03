#!/usr/bin/env tsx
/**
 * VPS Database Sync Script
 * This script copies the PostgreSQL database from your VPS to your local machine
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as readline from 'readline';

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  VPS_HOST: '38.102.86.90',
  VPS_USER: 'futsal',
  VPS_DB_NAME: 'futsalgg',
  VPS_DB_USER: 'futsalgg',
  DOCKER_CONTAINER: 'futsal-gg-db',

  LOCAL_DB_NAME: 'futsalgg',
  LOCAL_DB_USER: 'futsalgg',
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function log(message: string) {
  console.log(message);
}

function logHeader(message: string) {
  console.log('\n==========================================');
  console.log(message);
  console.log('==========================================\n');
}

function generateDumpFileName(): string {
  const now = new Date();
  const timestamp = now
    .toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .split('Z')[0];
  return `db_backup_${timestamp}.sql`;
}

function askQuestion(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

// ============================================
// MAIN SCRIPT
// ============================================

async function main() {
  logHeader('VPS Database Sync Script');

  const dumpFile = generateDumpFileName();

  try {
    // Step 1: Create database dump on VPS
    log(`Step 1: Creating database dump on VPS (Docker container: ${CONFIG.DOCKER_CONTAINER})...`);

    const sshCommand = `ssh ${CONFIG.VPS_USER}@${CONFIG.VPS_HOST} "docker exec ${CONFIG.DOCKER_CONTAINER} pg_dump -U ${CONFIG.VPS_DB_USER} -d ${CONFIG.VPS_DB_NAME} --clean --if-exists"`;

    const dumpData = execSync(sshCommand, {
      encoding: 'utf-8',
      maxBuffer: 50 * 1024 * 1024 // 50MB buffer
    });

    fs.writeFileSync(dumpFile, dumpData);
    log(`Successfully created: ${dumpFile}\n`);

    // Step 2: Import dump to local database
    log('Step 2: Importing dump to local database...');
    log('WARNING: This will DROP and recreate tables in your local database.');

    const confirm = await askQuestion('Continue? (y/n): ');

    if (confirm !== 'y') {
      log(`\nImport cancelled. Dump file saved at: ${dumpFile}`);
      process.exit(0);
    }

    execSync(`psql -U ${CONFIG.LOCAL_DB_USER} -d ${CONFIG.LOCAL_DB_NAME} < ${dumpFile}`, {
      stdio: 'inherit',
    });

    log('\nSuccessfully imported database!\n');

    // Step 3: Clean up dump file
    const deleteDump = await askQuestion('Delete dump file? (y/n): ');

    if (deleteDump === 'y') {
      fs.unlinkSync(dumpFile);
      log('Dump file deleted');
    } else {
      log(`Dump file saved at: ${dumpFile}`);
    }

    logHeader('Sync completed successfully!');

  } catch (error) {
    console.error('\nError occurred:', error instanceof Error ? error.message : error);

    if (fs.existsSync(dumpFile)) {
      log(`\nDump file saved at: ${dumpFile}`);
    }

    process.exit(1);
  }
}

// Run the script
main();
