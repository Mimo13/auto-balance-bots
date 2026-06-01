import type { Ticker } from '../exchange/exchange-client.js';

export interface PairScore {
  score: number;       // 0-100
  reasons: string[];
  warnings: string[];
  /** Useful volatility width as decimal for range suggestion */
  widthPct: number;
}

/**
 * Score a trading pair for grid-bot suitability.
 *
 * Factors (all positive contributions unless penalized):
 *  1. Volume (log-scaled, max 40 pts)
 *  2. Volatility / day-range (max 45 pts)
 *  3. Spread penalty (max -30 pts)
 *
 * Returns a score 0–100 with human-readable reasons and warnings.
 */
export function scorePair(ticker: Ticker): PairScore {
  const mid = ticker.lastPrice > 0
    ? ticker.lastPrice
    : (ticker.highPrice + ticker.lowPrice) / 2;

  const dayRangePct = mid > 0
    ? (ticker.highPrice - ticker.lowPrice) / mid
    : 0;

  const spreadPct = ticker.lastPrice > 0
    ? Math.max(0, (ticker.askPrice - ticker.bidPrice) / ticker.lastPrice)
    : 1;

  // Volume score: log10(quoteVolume) * 6, capped at 40
  const volumeScore = Math.min(40, Math.log10(Math.max(1, ticker.quoteVolume)) * 6);

  // Volatility score: day range * 600, capped at 45
  const volatilityScore = Math.min(45, dayRangePct * 600);

  // Spread penalty: spread * 5000, capped at 30
  const spreadPenalty = Math.min(30, spreadPct * 5000);

  const score = Math.max(0, Math.min(100,
    Math.round((volumeScore + volatilityScore - spreadPenalty) * 100) / 100
  ));

  const reasons: string[] = [
    `vol rango 24h ${(dayRangePct * 100).toFixed(2)}%`,
    `quote volume ${ticker.quoteVolume.toFixed(0)}`,
    `spread ${(spreadPct * 100).toFixed(3)}%`,
  ];

  const warnings: string[] = [];
  if (dayRangePct < 0.005) {
    warnings.push('volatilidad muy baja para grid (< 0.5%)');
  } else if (dayRangePct < 0.01) {
    warnings.push('volatilidad baja para grid (< 1%)');
  }
  if (spreadPct > 0.002) {
    warnings.push(`spread alto (${(spreadPct * 100).toFixed(2)}%): revisar liquidez/fees`);
  }
  if (ticker.quoteVolume < 1000) {
    warnings.push('volumen muy bajo: posible liquidez insuficiente');
  }

  // Suggested range width based on day volatility (4%-22%)
  const widthPct = Math.max(0.04, Math.min(0.22, dayRangePct * 1.8));

  return { score, reasons, warnings, widthPct };
}
