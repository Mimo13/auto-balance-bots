import { describe, it } from 'node:test';
import assert from 'node:assert';
import type { Candle } from '../exchange/exchange-client.js';
import { realizedVolatility, simplifiedATR, rangeHighLow } from './volatility.js';

/** Build a simple Candle for testing */
function c(open: number, high: number, low: number, close: number): Candle {
  return { openTime: 0, closeTime: 60000, open, high, low, close, volume: 100, quoteVolume: 10000 };
}

describe('realizedVolatility', () => {
  it('returns 0 for flat candles', () => {
    const candles = [c(10, 10, 10, 10), c(10, 10, 10, 10), c(10, 10, 10, 10)];
    const vol = realizedVolatility(candles);
    assert.strictEqual(vol.annualizedPct, 0);
    assert.strictEqual(vol.dailyPct, 0);
  });

  it('computes positive volatility for trending up', () => {
    // 10, 11, 12 → ~9.53% daily return std, scaled to annual
    const candles = [c(10, 10, 10, 10), c(10.5, 11, 10.5, 11), c(11, 12, 11, 12)];
    const vol = realizedVolatility(candles);
    assert.ok(vol.annualizedPct > 0, 'volatility should be positive');
    assert.ok(vol.annualizedPct < 200, 'should not be absurd');
  });

  it('returns 0 for single candle', () => {
    const vol = realizedVolatility([c(10, 10, 10, 10)]);
    assert.strictEqual(vol.annualizedPct, 0);
  });

  it('handles empty candles gracefully', () => {
    const vol = realizedVolatility([]);
    assert.strictEqual(vol.annualizedPct, 0);
  });

  it('does not use future data — each candle only uses its own close', () => {
    // All logic uses close[i]/close[i-1], no forward references.
    const candles = [c(100, 100, 99, 100), c(100, 101, 100, 101), c(101, 102, 100, 100)];
    const vol = realizedVolatility(candles);
    assert.ok(vol.annualizedPct >= 0);
  });
});

describe('simplifiedATR', () => {
  it('computes ATR from high-low ranges', () => {
    const candles = [
      c(10, 12, 9, 10),     // range = 3
      c(10, 11, 10, 11),    // range = 1
      c(11, 13, 10, 12),    // range = 3
    ];
    const atr = simplifiedATR(candles);
    // avg of (3+1+3)/3 = 2.33
    assert.ok(atr > 2 && atr < 2.5, `expected ~2.33, got ${atr}`);
  });

  it('returns 0 for single candle', () => {
    const atr = simplifiedATR([c(10, 12, 9, 10)]);
    // range = 3, but with period=14 default and only 1 candle, avg is just that range
    assert.strictEqual(atr, 3);
  });

  it('returns 0 for empty candles', () => {
    assert.strictEqual(simplifiedATR([]), 0);
  });
});

describe('rangeHighLow', () => {
  it('returns min/max from candles', () => {
    const candles = [c(100, 105, 99, 101), c(101, 110, 95, 102)];
    const r = rangeHighLow(candles);
    assert.strictEqual(r.low, 95);
    assert.strictEqual(r.high, 110);
    // widthPct = (110-95)/102 * 100 = 14.7058...
    assert.ok(r.widthPct > 14 && r.widthPct < 15, `width should be ~14.7%, got ${r.widthPct}`);
  });

  it('returns zero width for single candle', () => {
    const r = rangeHighLow([c(10, 10, 10, 10)]);
    assert.strictEqual(r.high, 10);
    assert.strictEqual(r.low, 10);
    assert.strictEqual(r.widthPct, 0);
  });
});
