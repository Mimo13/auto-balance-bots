import { DatabaseSync } from 'node:sqlite';

export interface MigrationState {
  version: number;
  applied_at: string;
}

const CURRENT_VERSION = 1;

/**
 * Run all pending migrations idempotently.
 * Creates all required tables if they don't exist.
 */
export function runMigrations(db: DatabaseSync): void {
  // Migration tracking table
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // advisor_runs — record of each advisor execution
  db.exec(`
    CREATE TABLE IF NOT EXISTS advisor_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT UNIQUE NOT NULL,
      generated_at TEXT NOT NULL,
      mode TEXT NOT NULL,
      network TEXT NOT NULL,
      pair_count INTEGER NOT NULL DEFAULT 0,
      capital_total REAL NOT NULL DEFAULT 0,
      capital_reserved REAL NOT NULL DEFAULT 0,
      capital_allocated REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // pair_snapshots — per-pair data from advisor runs
  db.exec(`
    CREATE TABLE IF NOT EXISTS pair_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      symbol TEXT NOT NULL,
      ok INTEGER NOT NULL DEFAULT 0,
      price REAL,
      score REAL,
      target_weight_pct REAL,
      range_lower REAL,
      range_upper REAL,
      range_width_pct REAL,
      reasons TEXT DEFAULT '[]',
      warnings TEXT DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (run_id) REFERENCES advisor_runs(run_id)
    )
  `);

  // recommendations — actions derived from allocation
  db.exec(`
    CREATE TABLE IF NOT EXISTS recommendations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      symbol TEXT NOT NULL,
      action TEXT NOT NULL,
      current_capital_usdc REAL NOT NULL DEFAULT 0,
      target_capital_usdc REAL NOT NULL DEFAULT 0,
      delta_usdc REAL NOT NULL DEFAULT 0,
      reason TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (run_id) REFERENCES advisor_runs(run_id)
    )
  `);

  // bot_allocations — future: persisted bot capital targets
  db.exec(`
    CREATE TABLE IF NOT EXISTS bot_allocations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      target_weight_pct REAL NOT NULL,
      target_capital_usdc REAL NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // activity_log_index — future: indexes for JSONL activity logs
  db.exec(`
    CREATE TABLE IF NOT EXISTS activity_log_index (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      symbol TEXT,
      file_path TEXT,
      line_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Record current migration version if not yet recorded
  const existing = db.prepare('SELECT version FROM _migrations WHERE version = ?').get(CURRENT_VERSION);
  if (!existing) {
    db.prepare('INSERT INTO _migrations (version) VALUES (?)').run(CURRENT_VERSION);
  }
}

/**
 * Get current migration version from the database.
 */
export function getMigrationVersion(db: DatabaseSync): MigrationState {
  // Ensure migrations have run
  runMigrations(db);

  const row = db.prepare(
    'SELECT version, applied_at FROM _migrations ORDER BY version DESC LIMIT 1',
  ).get() as MigrationState | undefined;

  return row ?? { version: 0, applied_at: '' };
}
