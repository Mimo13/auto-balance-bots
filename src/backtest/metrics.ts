import type { EquityPoint, SimulatedTrade } from './grid-simulator.js';

export interface BacktestMetricsOptions {
  timeOutOfRangePct?: number;
}

export interface BacktestMetrics {
  pnlUSDC: number;
  pnlPct: number;
  maxDrawdownPct: number;
  profitFactor: number;
  fillCount: number;
  winRate: number;
  capitalEfficiency: number;
  timeOutOfRangePct: number;
}

/**
 * Compute backtest metrics from trades and equity curve.
 *
 * - pnl = final total value - initial capital
 * - max drawdown = largest peak-to-trough decline in equity curve
 * - profit factor = gross profit / gross loss (from individual filled orders)
 * - win rate = profitable round-trips / total round-trips
 * - capital efficiency = total traded volume / (candles × initial capital)
 */
export function computeMetrics(
  trades: SimulatedTrade[],
  equityCurve: EquityPoint[],
  initialCapital: number,
  options?: BacktestMetricsOptions,
): BacktestMetrics {
  // PnL from equity curve
  const lastEq = equityCurve.length > 0 ? equityCurve[equityCurve.length - 1] : null;
  const finalValue = lastEq ? lastEq.totalValue : initialCapital;
  const pnlUSDC = finalValue - initialCapital;
  const pnlPct = initialCapital > 0 ? pnlUSDC / initialCapital : 0;

  // Max drawdown from equity curve
  let maxDrawdownPct = 0;
  let peak = initialCapital;
  for (const eq of equityCurve) {
    if (eq.totalValue > peak) peak = eq.totalValue;
    const dd = peak > 0 ? (peak - eq.totalValue) / peak : 0;
    if (dd > maxDrawdownPct) maxDrawdownPct = dd;
  }

  // Profit factor from round-trip trades
  // Group trades by grid level, then pair buy→sell chronologically
  const levelTrades = new Map<number, { buys: SimulatedTrade[]; sells: SimulatedTrade[] }>();
  for (const t of trades) {
    if (!levelTrades.has(t.gridLevel)) {
      levelTrades.set(t.gridLevel, { buys: [], sells: [] });
    }
    const group = levelTrades.get(t.gridLevel)!;
    if (t.side === 'buy') group.buys.push(t);
    else group.sells.push(t);
  }

  let grossProfit = 0;
  let grossLoss = 0;
  let winningRounds = 0;
  let totalRounds = 0;

  for (const [, group] of levelTrades) {
    const minLen = Math.min(group.buys.length, group.sells.length);
    for (let i = 0; i < minLen; i++) {
      const buy = group.buys[i];
      const sell = group.sells[i];
      const roundPnl = (sell.usdcAmount - sell.feeCost) - (buy.usdcAmount + buy.feeCost);
      if (roundPnl > 0) {
        grossProfit += roundPnl;
        winningRounds++;
      } else {
        grossLoss += Math.abs(roundPnl);
      }
      totalRounds++;
    }
  }

  // For unpaired trades, add their net PnL
  for (const [, group] of levelTrades) {
    if (group.buys.length > group.sells.length) {
      // Extra buys — no close yet
      const extra = group.buys.slice(group.sells.length);
      for (const buy of extra) {
        grossLoss += buy.usdcAmount + buy.feeCost;
      }
    } else if (group.sells.length > group.buys.length) {
      // Extra sells — no corresponding buy
      const extra = group.sells.slice(group.buys.length);
      for (const sell of extra) {
        grossProfit += sell.usdcAmount - sell.feeCost;
      }
    }
  }

  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? Infinity : 0);
  const winRate = totalRounds > 0 ? winningRounds / totalRounds : 0;

  // Fill count = total trades
  const fillCount = trades.length;

  // Capital efficiency: average trade volume per candle per unit of capital
  const totalTradeVolume = trades.reduce((s, t) => s + t.usdcAmount, 0);
  const numCandles = equityCurve.length;
  const capitalEfficiency = (initialCapital > 0 && numCandles > 0)
    ? Math.min(1, totalTradeVolume / (numCandles * initialCapital))
    : 0;

  return {
    pnlUSDC: Math.round(pnlUSDC * 100) / 100,
    pnlPct: Math.round(pnlPct * 10000) / 10000,
    maxDrawdownPct: Math.round(maxDrawdownPct * 10000) / 10000,
    profitFactor: profitFactor === Infinity ? Infinity : Math.round(profitFactor * 100) / 100,
    fillCount,
    winRate: Math.round(winRate * 10000) / 10000,
    capitalEfficiency: Math.round(capitalEfficiency * 10000) / 10000,
    timeOutOfRangePct: options?.timeOutOfRangePct ?? 0,
  };
}
