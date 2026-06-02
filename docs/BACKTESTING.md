# Backtesting — auto-balance-bots

## Grid Simulator

`src/backtest/grid-simulator.ts` — simulates grid trading over OHLCV candles.

### Input Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `candles` | — | Array of OHLCV candles (Binance klines format) |
| `lower` | — | Grid lower price bound |
| `upper` | — | Grid upper price bound |
| `numGrids` | — | Number of evenly-spaced grid levels (≥ 2) |
| `capitalUSDC` | — | Initial USDC capital |
| `feePct` | 0.001 (0.1%) | Trading fee per order |
| `slippagePct` | 0.0005 (0.05%) | Slippage per order |

### Conservative Candle Processing Order

To avoid lookahead bias, each candle is processed in O→L→H→C order:

1. **Open** — check grid level crossings at the opening price
2. **Low** — check buy fills (price dipping down to level)
3. **High** — check sell fills (price rising up to level)
4. **Close** — final check for any remaining level crosses

This order is **conservative** because:
- Buys fill on the low (worst price for sells, best for buys)
- Sells fill on the high (worst price for buys, best for sells)
- This means we don't assume both buy and sell fill at the same level simultaneously

### Grid Model

- `numGrids` evenly-spaced levels between `lower` and `upper`
- Capital is divided equally: `capitalUSDC / numGrids` per level
- Each level starts either as a pending buy (if level < opening price) or pending sell (if level > opening price)
- When a buy fills, the level switches to pending sell (and vice versa)
- Fees and slippage are applied per trade

### Output

| Field | Description |
|-------|-------------|
| `trades` | Array of `SimulatedTrade` (side, price, qty, fees, slippage, gridLevel) |
| `equityCurve` | Portfolio value at each candle (tokenBalance, usdcBalance, totalValue) |
| `finalUSDC` | Remaining USDC at end of simulation |
| `finalToken` | Remaining token at end of simulation |
| `timeOutOfRange` | Fraction of candles where price was outside the grid range |

### Known Limitations

- No rebalancing — grid levels are fixed once set
- No dynamic range adjustment
- All grid levels use equal capital allocation
- Does not model order queue position or partial fills within a level
