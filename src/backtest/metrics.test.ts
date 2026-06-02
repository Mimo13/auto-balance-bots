import { describe, it } from 'node:test';
import assert from 'node:assert';
import { computeMetrics, type BacktestMetrics } from './metrics.js';
import type { EquityPoint, SimulatedTrade } from './grid-simulator.js';

describe('computeMetrics', () => {
  const basicTrades: SimulatedTrade[] = [
    { candleIndex: 0, side: 'buy', price: 100, qty: 1, usdcAmount: 100, feeCost: 0.1, slippageCost: 0.05, gridLevel: 0 },
    { candleIndex: 1, side: 'sell', price: 105, qty: 1, usdcAmount: 105, feeCost: 0.105, slippageCost: 0.0525, gridLevel: 0 },
    { candleIndex: 2, side: 'buy', price: 102, qty: 1, usdcAmount: 102, feeCost: 0.102, slippageCost: 0.051, gridLevel: 1 },
    { candleIndex: 3, side: 'sell', price: 108, qty: 1, usdcAmount: 108, feeCost: 0.108, slippageCost: 0.054, gridLevel: 1 },
  ];

  const basicEquity: EquityPoint[] = [
    { candleIndex: 0, tokenBalance: 1, usdcBalance: 900, totalValue: 1000 },
    { candleIndex: 1, tokenBalance: 0, usdcBalance: 1004.8, totalValue: 1004.8 },
    { candleIndex: 2, tokenBalance: 1, usdcBalance: 902.8, totalValue: 1004.8 },
    { candleIndex: 3, tokenBalance: 0, usdcBalance: 1010.6, totalValue: 1010.6 },
  ];

  it('computes basic metrics with positive PnL', () => {
    const m = computeMetrics(basicTrades, basicEquity, 1000);
    assert.ok(m.pnlUSDC > 0, 'positive PnL expected');
    assert.ok(m.pnlPct > 0, 'positive PnL% expected');
    assert.strictEqual(m.fillCount, 4);
    assert.ok(m.winRate >= 0 && m.winRate <= 1, `winRate ${m.winRate} in 0..1`);
  });

  it('computes profit factor correctly', () => {
    const m = computeMetrics(basicTrades, basicEquity, 1000);
    // All 4 trades are profitable, so profit factor should be > 1
    assert.ok(m.profitFactor > 1, `profitFactor ${m.profitFactor} > 1`);
  });

  it('computes max drawdown >= 0', () => {
    const m = computeMetrics(basicTrades, basicEquity, 1000);
    assert.ok(m.maxDrawdownPct >= 0, `maxDrawdownPct ${m.maxDrawdownPct} >= 0`);
    assert.ok(m.maxDrawdownPct <= 1, `maxDrawdownPct ${m.maxDrawdownPct} <= 1`);
  });

  it('capitalEfficiency is between 0 and 1', () => {
    const m = computeMetrics(basicTrades, basicEquity, 1000);
    assert.ok(m.capitalEfficiency >= 0 && m.capitalEfficiency <= 1,
      `capitalEfficiency ${m.capitalEfficiency} in 0..1`);
  });

  it('handles equity curve that goes down then up (has drawdown)', () => {
    const downThenUp: EquityPoint[] = [
      { candleIndex: 0, tokenBalance: 0, usdcBalance: 1000, totalValue: 1000 },
      { candleIndex: 1, tokenBalance: 0.5, usdcBalance: 500, totalValue: 950 },
      { candleIndex: 2, tokenBalance: 0, usdcBalance: 900, totalValue: 900 },
      { candleIndex: 3, tokenBalance: 0.3, usdcBalance: 700, totalValue: 1100 },
    ];
    const m = computeMetrics([], downThenUp, 1000);
    // Peak was 1000, trough is 900 → DD = 10%
    assert.ok(m.maxDrawdownPct > 0.05, `maxDrawdownPct ${m.maxDrawdownPct} should show drawdown`);
    assert.ok(m.maxDrawdownPct < 0.15, `maxDrawdownPct ${m.maxDrawdownPct} should be reasonable`);
  });

  it('handles empty trades gracefully', () => {
    const m = computeMetrics([], basicEquity, 1000);
    assert.strictEqual(m.fillCount, 0);
    // PnL comes from equity curve: final 1010.6 - initial 1000
    assert.strictEqual(m.pnlUSDC, 10.6);
    assert.strictEqual(m.pnlPct, 0.0106);
    assert.strictEqual(m.profitFactor, 0);
    assert.strictEqual(m.winRate, 0);
  });

  it('handles empty equity curve gracefully', () => {
    const m = computeMetrics([], [], 1000);
    assert.strictEqual(m.pnlUSDC, 0);
    assert.strictEqual(m.pnlPct, 0);
    assert.strictEqual(m.maxDrawdownPct, 0);
  });

  it('timeOutOfRangePct is 0 when not provided', () => {
    const m = computeMetrics(basicTrades, basicEquity, 1000);
    assert.strictEqual(m.timeOutOfRangePct, 0);
  });

  it('accepts timeOutOfRange as a metric option', () => {
    const m = computeMetrics(basicTrades, basicEquity, 1000, { timeOutOfRangePct: 0.15 });
    assert.strictEqual(m.timeOutOfRangePct, 0.15);
  });
});
