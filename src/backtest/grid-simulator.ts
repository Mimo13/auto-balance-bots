import type { Candle } from '../exchange/exchange-client.js';

export interface SimulatedTrade {
  candleIndex: number;
  side: 'buy' | 'sell';
  price: number;
  qty: number;
  usdcAmount: number;
  feeCost: number;
  slippageCost: number;
  gridLevel: number;
}

export interface EquityPoint {
  candleIndex: number;
  tokenBalance: number;
  usdcBalance: number;
  totalValue: number;
}

export interface SimulateGridInput {
  candles: Candle[];
  lower: number;
  upper: number;
  numGrids: number;
  capitalUSDC: number;
  feePct?: number;
  slippagePct?: number;
}

export interface SimulateGridResult {
  trades: SimulatedTrade[];
  equityCurve: EquityPoint[];
  finalUSDC: number;
  finalToken: number;
  timeOutOfRange: number; // fraction of candles where price was outside range
}

const DEFAULTS = {
  feePct: 0.001,
  slippagePct: 0.0005,
};

/**
 * Simulate grid trading over OHLCV candles with conservative fill logic.
 *
 * Grid levels are evenly spaced between lower and upper.
 * Processing order per candle: Open → Low → High → Close (O→L→H→C).
 * This is the most conservative order: buys fill on low first, sells on high.
 */
export function simulateGrid(input: SimulateGridInput): SimulateGridResult {
  const { candles, lower, upper, numGrids, capitalUSDC } = input;
  const feePct = input.feePct ?? DEFAULTS.feePct;
  const slippagePct = input.slippagePct ?? DEFAULTS.slippagePct;

  if (numGrids < 2 || capitalUSDC <= 0) {
    return { trades: [], equityCurve: [], finalUSDC: capitalUSDC, finalToken: 0, timeOutOfRange: 0 };
  }
  if (candles.length === 0) {
    return { trades: [], equityCurve: [], finalUSDC: capitalUSDC, finalToken: 0, timeOutOfRange: 0 };
  }

  // Build grid levels
  const spacing = (upper - lower) / (numGrids - 1);
  const levels: number[] = [];
  for (let i = 0; i < numGrids; i++) {
    levels.push(lower + i * spacing);
  }

  // Capital per grid level — divide equally among levels
  const capitalPerLevel = capitalUSDC / numGrids;

  // State
  let usdcBalance = capitalUSDC;
  let tokenBalance = 0;

  // Grid order state: at each level, track if there's a pending buy or sell
  // true = pending buy at this level, false = pending sell
  const pendingBuy: boolean[] = new Array(numGrids).fill(false);

  // Initial orders: levels below first open price → pending buy; above → pending sell
  // We don't place orders at the same level as opening price
  const firstOpen = candles[0].open;
  for (let i = 0; i < numGrids; i++) {
    pendingBuy[i] = levels[i] < firstOpen;
  }

  const trades: SimulatedTrade[] = [];
  const equityCurve: EquityPoint[] = [];
  let outOfRangeCount = 0;

  /**
   * Try to fill a trade at grid level `i`. Direction determined by pendingBuy.
   * Returns the trade if filled, null otherwise.
   */
  function tryFill(candleIdx: number, levelPrice: number, i: number): SimulatedTrade | null {
    if (pendingBuy[i]) {
      // Buy: spend USDC to get token
      const usdcAmount = Math.min(usdcBalance, capitalPerLevel);
      if (usdcAmount <= 0) return null;

      const buyPrice = levelPrice * (1 + slippagePct);
      const qty = usdcAmount / buyPrice;
      const feeCost = usdcAmount * feePct;
      const effectiveCost = usdcAmount + feeCost;

      usdcBalance -= effectiveCost;
      tokenBalance += qty;
      pendingBuy[i] = false; // now pending sell

      return {
        candleIndex: candleIdx,
        side: 'buy',
        price: buyPrice,
        qty,
        usdcAmount,
        feeCost,
        slippageCost: usdcAmount * slippagePct,
        gridLevel: i,
      };
    } else {
      // Sell: sell token for USDC
      if (tokenBalance <= 0) return null;

      // Sell 1/numGrids of tokens (equal proportion)
      const sellQty = tokenBalance / (numGrids - i);
      if (sellQty <= 0) return null;

      const sellPrice = levelPrice * (1 - slippagePct);
      const usdcReceived = sellQty * sellPrice;
      const feeCost = usdcReceived * feePct;
      const effectiveReceived = usdcReceived - feeCost;

      usdcBalance += effectiveReceived;
      tokenBalance -= sellQty;
      pendingBuy[i] = true; // now pending buy

      return {
        candleIndex: candleIdx,
        side: 'sell',
        price: sellPrice,
        qty: sellQty,
        usdcAmount: usdcReceived,
        feeCost,
        slippageCost: usdcReceived * slippagePct,
        gridLevel: i,
      };
    }
  }

  for (let ci = 0; ci < candles.length; ci++) {
    const c = candles[ci];

    // Check if price is outside range
    const isOut = c.high > upper || c.low < lower;
    if (isOut) outOfRangeCount++;

    // Process in O→L→H→C order
    const pricePoints = [c.open, c.low, c.high, c.close];

    for (const pricePoint of pricePoints) {
      for (let i = 0; i < numGrids; i++) {
        const levelPrice = levels[i];

        // Check if this price point crosses the level
        if (pendingBuy[i] && pricePoint <= levelPrice) {
          // Price went down to or below level → buy fills
          const trade = tryFill(ci, levelPrice, i);
          if (trade) trades.push(trade);
        } else if (!pendingBuy[i] && pricePoint >= levelPrice) {
          // Price went up to or above level → sell fills
          const trade = tryFill(ci, levelPrice, i);
          if (trade) trades.push(trade);
        }
      }
    }

    // Equity curve at end of candle
    equityCurve.push({
      candleIndex: ci,
      tokenBalance,
      usdcBalance,
      totalValue: usdcBalance + tokenBalance * c.close,
    });
  }

  return {
    trades,
    equityCurve,
    finalUSDC: usdcBalance,
    finalToken: tokenBalance,
    timeOutOfRange: candles.length > 0 ? outOfRangeCount / candles.length : 0,
  };
}
