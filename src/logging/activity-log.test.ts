import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, readFileSync, unlinkSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ActivityLogger, type ActivityEntry, type ActivityType, type QueryFilter } from './activity-log.js';

describe('ActivityLogger', () => {
  let tmpDir: string;
  let logPath: string;
  let logger: ActivityLogger;

  before(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'activity-log-test-'));
    logPath = join(tmpDir, 'activity.jsonl');
    logger = new ActivityLogger({ filePath: logPath });
  });

  after(() => {
    logger.close();
    if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
  });

  it('writes a single entry to the JSONL file', () => {
    const entry = logger.log({
      type: 'system',
      message: 'Service started',
      data: { mode: 'paper', version: '0.1.0' },
    });

    assert.ok(entry.id, 'entry should have an id');
    assert.ok(entry.timestamp, 'entry should have a timestamp');
    assert.strictEqual(entry.type, 'system');
    assert.strictEqual(entry.message, 'Service started');
    assert.deepStrictEqual(entry.data, { mode: 'paper', version: '0.1.0' });

    // Verify file content
    const lines = readFileSync(logPath, 'utf-8').trim().split('\n');
    assert.strictEqual(lines.length, 1);
    const parsed = JSON.parse(lines[0]);
    assert.strictEqual(parsed.type, 'system');
    assert.strictEqual(parsed.message, 'Service started');
  });

  it('writes multiple entries in append mode', () => {
    logger.log({ type: 'trade', message: 'BUY SOLUSDC', data: { price: 150, qty: 0.5 } });
    logger.log({ type: 'trade', message: 'SELL SOLUSDC', data: { price: 155, qty: 0.5 } });
    logger.log({ type: 'decision', message: 'Rebalance triggered', data: { reason: 'deviation > 7%' } });

    const lines = readFileSync(logPath, 'utf-8').trim().split('\n');
    assert.strictEqual(lines.length, 4); // 1 from before + 3 new
    const parsed = lines.map(l => JSON.parse(l));
    assert.strictEqual(parsed[1].message, 'BUY SOLUSDC');
    assert.strictEqual(parsed[3].type, 'decision');
  });

  it('getRecent returns last N entries in reverse order', () => {
    const recent = logger.getRecent(2);
    assert.strictEqual(recent.length, 2);
    assert.strictEqual(recent[0].message, 'Rebalance triggered'); // most recent first
    assert.strictEqual(recent[1].message, 'SELL SOLUSDC');
  });

  it('getRecent with count > available returns all', () => {
    const all = logger.getRecent(100);
    assert.strictEqual(all.length, 4);
  });

  it('getRecent with count 0 returns empty array', () => {
    const empty = logger.getRecent(0);
    assert.deepStrictEqual(empty, []);
  });

  it('query filters by type', () => {
    const trades = logger.query({ type: 'trade' });
    assert.strictEqual(trades.length, 2);
    assert.ok(trades.every(e => e.type === 'trade'));
  });

  it('query filters by date range', () => {
    const now = Date.now();
    const results = logger.query({ since: now - 60_000, until: now + 60_000 });
    assert.strictEqual(results.length, 4);
  });

  it('query with since only', () => {
    const now = Date.now();
    const results = logger.query({ since: now - 60_000 });
    assert.strictEqual(results.length, 4);
  });

  it('query with empty filter returns all', () => {
    const all = logger.query({});
    assert.strictEqual(all.length, 4);
  });

  it('query with no matches returns empty array', () => {
    const errs = logger.query({ type: 'error' });
    assert.strictEqual(errs.length, 0);
  });

  it('query filters by message substring', () => {
    const results = logger.query({ messageContains: 'SOL' });
    assert.strictEqual(results.length, 2);
    assert.ok(results.every(e => e.message.includes('SOL')));
  });

  it('starts fresh file when clear is called', () => {
    logger.clear();
    const lines = readFileSync(logPath, 'utf-8').trim();
    assert.strictEqual(lines, '');
    assert.strictEqual(logger.getRecent(10).length, 0);
  });

  it('handles empty or missing file gracefully', () => {
    const fresh = new ActivityLogger({ filePath: join(tmpDir, 'fresh.jsonl') });
    assert.strictEqual(fresh.getRecent(10).length, 0);
    assert.deepStrictEqual(fresh.query({}), []);
    fresh.close();
  });

  it('generates unique incrementing IDs', () => {
    const e1 = logger.log({ type: 'system', message: 'A', data: {} });
    const e2 = logger.log({ type: 'system', message: 'B', data: {} });
    const e3 = logger.log({ type: 'system', message: 'C', data: {} });
    assert.ok(e2.id > e1.id, 'IDs should increment');
    assert.ok(e3.id > e2.id, 'IDs should increment');
  });

  it('writing after reopen preserves entries', () => {
    logger.close();
    const reopened = new ActivityLogger({ filePath: logPath });
    const recent = reopened.getRecent(10);
    assert.ok(recent.length >= 3, `Expected at least 3 entries, got ${recent.length}`);
    reopened.log({ type: 'system', message: 'Reopened', data: {} });
    const lines = readFileSync(logPath, 'utf-8').trim().split('\n');
    const last = JSON.parse(lines[lines.length - 1]);
    assert.strictEqual(last.message, 'Reopened');
    reopened.close();
  });

  it('constructor without filePath uses default', () => {
    const defaultLogger = new ActivityLogger();
    assert.ok(defaultLogger['filePath'], 'should have a default file path');
    defaultLogger.close();
  });

  it('log accepts data as undefined', () => {
    const entry = logger.log({ type: 'error', message: 'Something went wrong' });
    assert.strictEqual(entry.data, undefined);
  });

  it('query with messageContains is case-sensitive', () => {
    const results = logger.query({ messageContains: 'sol' }); // lowercase
    assert.strictEqual(results.length, 0);
  });
});
