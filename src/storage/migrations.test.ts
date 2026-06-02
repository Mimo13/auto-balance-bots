import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { DatabaseSync } from 'node:sqlite';
import { runMigrations, getMigrationVersion, type MigrationState } from './migrations.js';

function createMemoryDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA journal_mode=WAL');
  return db;
}

describe('runMigrations', () => {
  it('creates advisor_runs table with required columns', () => {
    const db = createMemoryDb();
    runMigrations(db);

    const cols = db.prepare("SELECT name FROM pragma_table_info('advisor_runs')").all() as { name: string }[];
    const names = cols.map((c) => c.name);
    assert.ok(names.includes('id'));
    assert.ok(names.includes('run_id'));
    assert.ok(names.includes('generated_at'));
    assert.ok(names.includes('mode'));
    assert.ok(names.includes('network'));
    assert.ok(names.includes('pair_count'));
    assert.ok(names.includes('created_at'));
  });

  it('creates pair_snapshots table with required columns', () => {
    const db = createMemoryDb();
    runMigrations(db);

    const cols = db.prepare("SELECT name FROM pragma_table_info('pair_snapshots')").all() as { name: string }[];
    const names = cols.map((c) => c.name);
    assert.ok(names.includes('id'));
    assert.ok(names.includes('run_id'));
    assert.ok(names.includes('symbol'));
    assert.ok(names.includes('ok'));
    assert.ok(names.includes('price'));
    assert.ok(names.includes('score'));
    assert.ok(names.includes('target_weight_pct'));
    assert.ok(names.includes('range_lower'));
    assert.ok(names.includes('range_upper'));
    assert.ok(names.includes('range_width_pct'));
  });

  it('creates recommendations table with required columns', () => {
    const db = createMemoryDb();
    runMigrations(db);

    const cols = db.prepare("SELECT name FROM pragma_table_info('recommendations')").all() as { name: string }[];
    const names = cols.map((c) => c.name);
    assert.ok(names.includes('id'));
    assert.ok(names.includes('run_id'));
    assert.ok(names.includes('symbol'));
    assert.ok(names.includes('action'));
    assert.ok(names.includes('delta_usdc'));
    assert.ok(names.includes('reason'));
  });

  it('is idempotent — second call does not throw', () => {
    const db = createMemoryDb();
    runMigrations(db);
    runMigrations(db); // second call
    // Verify table still exists
    const rows = db.prepare('SELECT COUNT(*) as cnt FROM advisor_runs').all() as { cnt: number }[];
    assert.strictEqual(rows[0].cnt, 0); // empty but exists
  });

  it('stores and retrieves migration version', () => {
    const db = createMemoryDb();
    runMigrations(db);

    const state = getMigrationVersion(db);
    assert.ok(state.version >= 1, `version should be >= 1, got ${state.version}`);
    assert.ok(state.applied_at, 'should have applied_at timestamp');
  });

  it('creates bot_allocations table for future use', () => {
    const db = createMemoryDb();
    runMigrations(db);

    const cols = db.prepare("SELECT name FROM pragma_table_info('bot_allocations')").all() as { name: string }[];
    const names = cols.map((c) => c.name);
    assert.ok(names.includes('id'));
    assert.ok(names.includes('symbol'));
    assert.ok(names.includes('target_weight_pct'));
    assert.ok(names.includes('target_capital_usdc'));
    assert.ok(names.includes('created_at'));
  });

  it('creates activity_log_index table for future use', () => {
    const db = createMemoryDb();
    runMigrations(db);

    const cols = db.prepare("SELECT name FROM pragma_table_info('activity_log_index')").all() as { name: string }[];
    const names = cols.map((c) => c.name);
    assert.ok(names.includes('id'));
    assert.ok(names.includes('event_type'));
    assert.ok(names.includes('symbol'));
    assert.ok(names.includes('created_at'));
  });

  it('round-trips a run record', () => {
    const db = createMemoryDb();
    runMigrations(db);

    const insert = db.prepare(
      "INSERT INTO advisor_runs (run_id, generated_at, mode, network, pair_count) VALUES (?, ?, ?, ?, ?)",
    );
    insert.run('run-test-001', '2026-06-02T03:00:00.000Z', 'paper', 'testnet', 4);

    const rows = db.prepare('SELECT * FROM advisor_runs WHERE run_id = ?').all('run-test-001') as Record<string, unknown>[];
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(rows[0].mode, 'paper');
    assert.strictEqual(rows[0].pair_count, 4);
  });
});
