import { describe, it } from 'node:test';
import assert from 'node:assert';
import { suggestRange, type RangeAdvice } from './range-advisor.js';

describe('suggestRange', () => {
  it('centers range on current price', () => {
    const r = suggestRange({ price: 100, volatilityPct: 0.10 });
    const mid = (r.lower + r.upper) / 2;
    // Should be close to 100 (rounding may shift slightly)
    assert.ok(Math.abs(mid - 100) < 0.01, `center ${mid} should be ~100`);
  });

  it('width matches volatility when within bounds', () => {
    // volatility 10% → width should be ~10%
    const r = suggestRange({ price: 100, volatilityPct: 0.10 });
    const actualWidth = (r.upper - r.lower) / ((r.upper + r.lower) / 2);
    assert.ok(Math.abs(actualWidth - 0.10) < 0.005, `width ${actualWidth} should be ~0.10`);
  });

  it('uses minWidthPct when volatility is too low', () => {
    const r = suggestRange({ price: 100, volatilityPct: 0.005 }, { minWidthPct: 0.04 });
    const actualWidth = (r.upper - r.lower) / ((r.upper + r.lower) / 2);
    assert.ok(actualWidth >= 0.04, `width ${actualWidth} should be >= min 0.04`);
  });

  it('caps at maxWidthPct when volatility is too high', () => {
    const r = suggestRange({ price: 100, volatilityPct: 0.50 }, { maxWidthPct: 0.22 });
    const actualWidth = (r.upper - r.lower) / ((r.upper + r.lower) / 2);
    assert.ok(actualWidth <= 0.2201, `width ${actualWidth} should be <= max 0.22`);
  });

  it('rounds to tickSize when provided', () => {
    // tickSize = 0.01 → prices should be multiples of 0.01
    const r = suggestRange({ price: 100, volatilityPct: 0.10 }, undefined, 0.01);
    assert.strictEqual(r.lower * 100 % 1, 0, `lower ${r.lower} should be multiple of 0.01`);
    assert.strictEqual(r.upper * 100 % 1, 0, `upper ${r.upper} should be multiple of 0.01`);
  });

  it('rounds to tickSize with larger step', () => {
    // tickSize = 1 → prices should be integers
    const r = suggestRange({ price: 100, volatilityPct: 0.10 }, undefined, 1);
    assert.strictEqual(r.lower % 1, 0, `lower ${r.lower} should be integer`);
    assert.strictEqual(r.upper % 1, 0, `upper ${r.upper} should be integer`);
  });

  it('includes center in output', () => {
    const r = suggestRange({ price: 50000, volatilityPct: 0.08 });
    assert.strictEqual(r.center, 50000);
  });

  it('includes reasons and warnings in output', () => {
    const r = suggestRange({ price: 100, volatilityPct: 0.10 });
    assert.ok(r.reasons.length > 0, 'should have reasons');
    assert.ok(Array.isArray(r.warnings));
  });

  it('warns when volatility exceeds maxWidth', () => {
    const r = suggestRange({ price: 100, volatilityPct: 0.30 }, { maxWidthPct: 0.15 });
    assert.ok(r.warnings.some((w: string) => w.includes('capado') || w.includes('maxWidth')), `should cap warn: ${r.warnings}`);
  });

  it('defaults minWidthPct to 0.04 and maxWidthPct to 0.22', () => {
    const r = suggestRange({ price: 100, volatilityPct: 0.001 }); // very low vol
    const actualWidth = (r.upper - r.lower) / ((r.upper + r.lower) / 2);
    assert.ok(actualWidth >= 0.039, `width ${actualWidth} should use default min`);
  });

  it('range always contains price after rounding down', () => {
    // Edge case: tickSize rounding could push lower above price
    const r = suggestRange({ price: 0.0001, volatilityPct: 0.10 }, undefined, 0.00001);
    assert.ok(r.lower <= r.center, `lower ${r.lower} ≤ center ${r.center}`);
    assert.ok(r.upper >= r.center, `upper ${r.upper} ≥ center ${r.center}`);
  });
});
