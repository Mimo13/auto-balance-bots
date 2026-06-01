import { describe, it } from 'node:test';
import assert from 'node:assert';
import { roundToStepSize, floorToStepSize, assertMinNotional } from './filters.js';

describe('roundToStepSize', () => {
  it('rounds to stepSize=1', () => {
    assert.strictEqual(roundToStepSize(10.7, 1), 11);
    assert.strictEqual(roundToStepSize(10.3, 1), 10);
    assert.strictEqual(roundToStepSize(10.5, 1), 11);
  });

  it('rounds to stepSize=0.1', () => {
    assert.strictEqual(roundToStepSize(10.15, 0.1), 10.2);
    assert.strictEqual(roundToStepSize(10.11, 0.1), 10.1);
    assert.strictEqual(roundToStepSize(10.19, 0.1), 10.2);
  });

  it('rounds to stepSize=0.001', () => {
    assert.strictEqual(roundToStepSize(10.1235, 0.001), 10.124);
    assert.strictEqual(roundToStepSize(10.1234, 0.001), 10.123);
  });

  it('handles zero value', () => {
    assert.strictEqual(roundToStepSize(0, 1), 0);
    assert.strictEqual(roundToStepSize(0, 0.0001), 0);
  });

  it('handles values already aligned', () => {
    assert.strictEqual(roundToStepSize(5.0, 0.5), 5.0);
    assert.strictEqual(roundToStepSize(3.0, 1), 3);
  });
});

describe('floorToStepSize', () => {
  it('floors to stepSize=1', () => {
    assert.strictEqual(floorToStepSize(10.9, 1), 10);
    assert.strictEqual(floorToStepSize(10.1, 1), 10);
  });

  it('floors to stepSize=0.1', () => {
    assert.strictEqual(floorToStepSize(10.19, 0.1), 10.1);
  });

  it('floors to stepSize=0.001', () => {
    assert.strictEqual(floorToStepSize(10.1239, 0.001), 10.123);
  });
});

describe('assertMinNotional', () => {
  it('does not throw when notional >= min', () => {
    assert.doesNotThrow(() => assertMinNotional(1, 10, 5));     // 10 >= 5
    assert.doesNotThrow(() => assertMinNotional(2, 5, 10));     // 10 >= 10
  });

  it('throws when notional < min', () => {
    assert.throws(
      () => assertMinNotional(0.1, 10, 5),
      /min notional.*1\.00.*<.*5/,
    );
  });

  it('handles zero minNotional (disabled)', () => {
    assert.doesNotThrow(() => assertMinNotional(0.001, 0.001, 0));
  });
});
