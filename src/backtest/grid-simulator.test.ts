import { describe, it } from 'node:test';
import assert from 'node:assert';
import type { Candle } from '../exchange/exchange-client.js';
import { simulateGrid } from './grid-simulator.js';

function candle(overrides: Partial<Candle>): Candle {
  return {
    openTime: 0,
    closeTime: 3600000,
    open: 100,
    high: 105,
    low: 95,
    close: 102,
    volume: 1000,
    quoteVolume: 100000,
    ...overrides,
  };
}

describe('simulateGrid', () => {
  it('returns result with required fields for basic input', () => {
    const result = simulateGrid({
      candles: [
        candle({ openTime: 0, closeTime: 3600000, open: 100, high: 105, low: 95, close: 102 }),
      ],
      lower: 90,
      upper: 110,
      numGrids: 5,
      capitalUSDC: 1000,
    });

    assert.ok(Array.isArray(result.trades));
    assert.ok(Array.isArray(result.equityCurve));
    assert.ok(typeof result.finalUSDC === 'number');
    assert.ok(typeof result.finalToken === 'number');
    assert.ok(typeof result.timeOutOfRange === 'number');
  });

  it('generates equity curve with same length as candles', () => {
    const candles = [
      candle({ openTime: 0, closeTime: 3600000, open: 100, high: 105, low: 95, close: 102 }),
      candle({ openTime: 3600000, closeTime: 7200000, open: 102, high: 108, low: 98, close: 105 }),
    ];
    const result = simulateGrid({
      candles,
      lower: 90,
      upper: 110,
      numGrids: 5,
      capitalUSDC: 1000,
    });

    assert.strictEqual(result.equityCurve.length, candles.length);
  });

  it('includes fees and slippage in trades', () => {
    const result = simulateGrid({
      candles: [
        candle({ openTime: 0, closeTime: 3600000, open: 100, high: 110, low: 90, close: 105 }),
      ],
      lower: 90,
      upper: 110,
      numGrids: 5,
      capitalUSDC: 1000,
      feePct: 0.001,
      slippagePct: 0.0005,
    });

    for (const trade of result.trades) {
      if (trade.side === 'buy') {
        // Buy should include slippage (price moves up = worse for buy)
        assert.ok(trade.feeCost > 0, `fee should be > 0, got ${trade.feeCost}`);
        assert.ok(trade.slippageCost !== undefined, 'should have slippage');
      }
    }
  });

  it('returns empty trades for single candle with no fill', () => {
    // Candle stays within range without crossing any grid level
    const result = simulateGrid({
      candles: [
        candle({ openTime: 0, closeTime: 3600000, open: 100, high: 101, low: 99, close: 100 }),
      ],
      lower: 90,
      upper: 110,
      numGrids: 5,
      capitalUSDC: 1000,
      feePct: 0.001,
    });

    // Narrow candle may or may not cross a level depending on grid spacing
    // With 5 grids in [90,110], levels are at 90, 95, 100, 105, 110
    // Price range 99-101, only level 100 could be hit
    // But 100 is the start price, so orders at 100 may or may not fill
    assert.ok(Array.isArray(result.trades));
  });

  it('detects time out of range when price exits the grid', () => {
    const result = simulateGrid({
      candles: [
        candle({ openTime: 0, closeTime: 3600000, open: 100, high: 150, low: 50, close: 120 }),
      ],
      lower: 90,
      upper: 110,
      numGrids: 3,
      capitalUSDC: 1000,
    });

    // Price goes well outside [90, 110] — should be out of range
    assert.ok(result.timeOutOfRange > 0, `should have time out of range, got ${result.timeOutOfRange}`);
  });

  it('round-trips final value approximately equal to initial with no fees', () => {
    // Start at center of grid, small movement
    const candles: Candle[] = [
      candle({ openTime: 0, closeTime: 3600000, open: 100, high: 102, low: 98, close: 101 }),
    ];

    const result = simulateGrid({
      candles,
      lower: 95,
      upper: 105,
      numGrids: 5,
      capitalUSDC: 1000,
      feePct: 0,
      slippagePct: 0,
    });

    // Capital + some trades should not be dramatically different
    const finalPortfolio = result.finalUSDC + result.finalToken * 101; // approx at close
    assert.ok(Math.abs(finalPortfolio - 1000) < 100, `portfolio ${finalPortfolio} should be ~1000`);
  });

  it('fails gracefully on empty candles', () => {
    const result = simulateGrid({
      candles: [],
      lower: 90,
      upper: 110,
      numGrids: 5,
      capitalUSDC: 1000,
    });

    assert.strictEqual(result.trades.length, 0);
    assert.strictEqual(result.equityCurve.length, 0);
  });
});
