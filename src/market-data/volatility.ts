import type { Candle } from '../exchange/exchange-client.js';

export interface VolatilityResult {
  /** Annualized volatility as a percentage (0-200+). sqrt(variance * 365) * 100 */
  annualizedPct: number;
  /** Average daily return std as decimal */
  dailyPct: number;
}

/**
 * Compute realized volatility from log returns of candle closes.
 * Uses only close[i] / close[i-1] — no future data.
 */
export function realizedVolatility(candles: Candle[]): VolatilityResult {
  if (candles.length < 2) {
    return { annualizedPct: 0, dailyPct: 0 };
  }

  const logReturns: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1].close;
    const curr = candles[i].close;
    if (prev > 0 && curr > 0) {
      logReturns.push(Math.log(curr / prev));
    }
  }

  if (logReturns.length === 0) {
    return { annualizedPct: 0, dailyPct: 0 };
  }

  const mean = logReturns.reduce((s, r) => s + r, 0) / logReturns.length;
  const variance = logReturns.reduce((s, r) => s + (r - mean) ** 2, 0) / logReturns.length;
  const dailyStd = Math.sqrt(variance);

  // Annualize assuming the candle interval is roughly daily.
  // For sub-daily candles, caller should adjust.
  const annualizedPct = Number((dailyStd * Math.sqrt(365) * 100).toFixed(2));
  const dailyPct = Number((dailyStd * 100).toFixed(4));

  return { annualizedPct, dailyPct };
}

/**
 * Simplified ATR: average of (high - low) over the candle set.
 * For true ATR with true-range, use a rolling window.
 */
export function simplifiedATR(candles: Candle[]): number {
  if (candles.length === 0) return 0;
  const sum = candles.reduce((s, c) => s + (c.high - c.low), 0);
  return Number((sum / candles.length).toFixed(8));
}

export interface RangeResult {
  high: number;
  low: number;
  /** Width as percentage of the last close */
  widthPct: number;
}

/**
 * Get the high-low range from a set of candles, plus width as % of last close.
 */
export function rangeHighLow(candles: Candle[]): RangeResult {
  if (candles.length === 0) {
    return { high: 0, low: 0, widthPct: 0 };
  }
  let high = -Infinity;
  let low = Infinity;
  for (const c of candles) {
    if (c.high > high) high = c.high;
    if (c.low < low) low = c.low;
  }
  const lastClose = candles[candles.length - 1].close;
  const widthPct = lastClose > 0 ? Number((((high - low) / lastClose) * 100).toFixed(4)) : 0;
  return { high, low, widthPct };
}
