import { DatabaseSync } from 'node:sqlite';
import { runMigrations } from './migrations.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../..');

/**
 * Get the default database path.
 * Uses data/auto_balance.db relative to project root.
 */
export function getDefaultDbPath(): string {
  const dataDir = path.join(PROJECT_ROOT, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return path.join(dataDir, 'auto_balance.db');
}

/**
 * Open a new database connection and run migrations.
 *
 * @param dbPath - path to SQLite file (default: data/auto_balance.db)
 * @returns DatabaseSync instance ready for use
 */
export function openDatabase(dbPath?: string): DatabaseSync {
  const resolvedPath = dbPath ?? getDefaultDbPath();
  const db = new DatabaseSync(resolvedPath);
  db.exec('PRAGMA journal_mode=WAL');
  db.exec('PRAGMA foreign_keys=ON');
  runMigrations(db);
  return db;
}

/**
 * Open an in-memory database (for testing).
 */
export function openMemoryDatabase(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA journal_mode=WAL');
  db.exec('PRAGMA foreign_keys=ON');
  runMigrations(db);
  return db;
}
