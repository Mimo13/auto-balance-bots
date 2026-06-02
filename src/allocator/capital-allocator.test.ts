import { describe, it } from 'node:test';
import assert from 'node:assert';
import { allocateCapital } from './capital-allocator.js';

interface Input {
  symbol: string;
  score: number;
}

function allocate(
  inputs: Input[],
  totalCapital = 1000,
  currentMap: Record<string, number> = {},
  opts?: {
    reservePct?: number;
    maxPairWeightPct?: number;
    minDeviationPct?: number;
    maxChangePerCyclePct?: number;
  },
) {
  return allocateCapital(inputs, totalCapital, currentMap, opts);
}

describe('allocateCapital', () => {
  it('returns empty array for empty inputs', () => {
    const result = allocate([], 1000);
    assert.strictEqual(result.pairs.length, 0);
    assert.strictEqual(result.totalCapitalUSDC, 1000);
    assert.strictEqual(result.reservedCapitalUSDC, 250);
    assert.strictEqual(result.totalAllocatedUSDC, 0);
  });

  it('distributes allocatable capital proportionally by score', () => {
    const result = allocate([
      { symbol: 'BTCUSDC', score: 80 },
      { symbol: 'ETHUSDC', score: 20 },
    ], 1000, {}, { maxPairWeightPct: 0.99 });

    // Total allocatable = 75% of 1000 = 750
    // BTC share = 80/100 * 750 = 600
    // ETH share = 20/100 * 750 = 150
    const btc = result.pairs.find((p) => p.symbol === 'BTCUSDC')!;
    const eth = result.pairs.find((p) => p.symbol === 'ETHUSDC')!;
    assert.ok(btc.targetCapitalUSDC > eth.targetCapitalUSDC);
    assert.strictEqual(btc.targetCapitalUSDC, 600);
    assert.strictEqual(eth.targetCapitalUSDC, 150);
    assert.strictEqual(result.totalAllocatedUSDC, 750);
  });

  it('capped by maxPairWeightPct', () => {
    const result = allocate([
      { symbol: 'BTCUSDC', score: 95 },
      { symbol: 'ETHUSDC', score: 5 },
    ], 1000, {}, { maxPairWeightPct: 0.45 });

    const btc = result.pairs.find((p) => p.symbol === 'BTCUSDC')!;
    // Without cap: 0.95/1.0 * 750 = 712.5 → but cap is 45% = 450
    assert.strictEqual(btc.targetCapitalUSDC, 450);
    assert.strictEqual(btc.targetWeightPct, 0.45);
  });

  it('zero score gives zero allocation', () => {
    const result = allocate([
      { symbol: 'DEADUSDC', score: 0 },
      { symbol: 'LIVEUSDC', score: 100 },
    ], 1000);

    const dead = result.pairs.find((p) => p.symbol === 'DEADUSDC')!;
    assert.strictEqual(dead.targetCapitalUSDC, 0);
    assert.strictEqual(dead.targetWeightPct, 0);
  });

  it('all targets plus reserve sum to total capital', () => {
    const result = allocate([
      { symbol: 'A', score: 50 },
      { symbol: 'B', score: 30 },
      { symbol: 'C', score: 20 },
    ], 2000);

    const allocated = result.pairs.reduce((s, p) => s + p.targetCapitalUSDC, 0);
    assert.strictEqual(allocated + result.reservedCapitalUSDC, result.totalCapitalUSDC);
  });

  it('action is KEEP when deviation below threshold', () => {
    // Target = 60% of 750 = 450, current = 440 → delta = 10, deviation = 2.2% < 7%
    const result = allocate(
      [{ symbol: 'BTCUSDC', score: 60 }, { symbol: 'ETHUSDC', score: 40 }],
      1000,
      { BTCUSDC: 440, ETHUSDC: 310 },
      { minDeviationPct: 0.07 },
    );

    const btc = result.pairs.find((p) => p.symbol === 'BTCUSDC')!;
    assert.strictEqual(btc.action, 'KEEP');
  });

  it('action is ADD_CAPITAL when below target beyond threshold', () => {
    // Target: BTC = 60% of 750 = 450, current = 100
    const result = allocate(
      [{ symbol: 'BTCUSDC', score: 60 }, { symbol: 'ETHUSDC', score: 40 }],
      1000,
      { BTCUSDC: 100, ETHUSDC: 650 },
      { minDeviationPct: 0.07 },
    );

    const btc = result.pairs.find((p) => p.symbol === 'BTCUSDC')!;
    assert.strictEqual(btc.action, 'ADD_CAPITAL');
  });

  it('action is REDUCE_CAPITAL when above target beyond threshold', () => {
    // Target: ETH = 40% of 750 = 300, current = 600
    const result = allocate(
      [{ symbol: 'BTCUSDC', score: 60 }, { symbol: 'ETHUSDC', score: 40 }],
      1000,
      { BTCUSDC: 100, ETHUSDC: 600 },
      { minDeviationPct: 0.07 },
    );

    const eth = result.pairs.find((p) => p.symbol === 'ETHUSDC')!;
    assert.strictEqual(eth.action, 'REDUCE_CAPITAL');
  });

  it('delta capped by maxChangePerCycle', () => {
    // Target: BTC = 750 (since 95% of 75%=712.5 capped to 45%=450), current = 50
    // Desired delta = 450 - 50 = 400
    // Max change = 15% of 1000 = 150
    const result = allocate(
      [{ symbol: 'BTCUSDC', score: 95 }, { symbol: 'ETHUSDC', score: 5 }],
      1000,
      { BTCUSDC: 50, ETHUSDC: 700 },
      { maxChangePerCyclePct: 0.15 },
    );

    const btc = result.pairs.find((p) => p.symbol === 'BTCUSDC')!;
    // delta should be capped at 150
    assert.strictEqual(btc.deltaUSDC, 150);
  });

  it('handles equal scores with equal weights', () => {
    const result = allocate([
      { symbol: 'A', score: 50 },
      { symbol: 'B', score: 50 },
      { symbol: 'C', score: 50 },
    ], 1200, {}, { maxPairWeightPct: 0.99 });

    const targets = result.pairs.map((p) => p.targetCapitalUSDC);
    assert.ok(targets.every((t) => t === targets[0]), 'all targets equal');
    // Each = 75% of 1200 / 3 = 300
    assert.strictEqual(targets[0], 300);
  });

  it('includes reasons and warnings in output', () => {
    const result = allocate([
      { symbol: 'BTCUSDC', score: 80 },
    ], 1000, { BTCUSDC: 600 });

    const btc = result.pairs.find((p) => p.symbol === 'BTCUSDC')!;
    assert.ok(btc.reasons.length > 0, 'should have reasons');
    assert.ok(Array.isArray(btc.warnings));
  });
});
