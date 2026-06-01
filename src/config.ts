export type TradingMode = 'paper' | 'testnet' | 'live';
export type BinanceNetwork = 'testnet' | 'mainnet';

export interface AppConfig {
  tradingMode: TradingMode;
  binanceEnv: BinanceNetwork;
  liveEnabled: boolean;
  advisorPairs: string[];
  globalUsdcReservePct: number;   // 0..1
  maxPairWeightPct: number;        // 0..1
  minDeviationPct: number;         // 0..1 — threshold to trigger rebalance
  maxChangePerCyclePct: number;    // 0..1 — cap on single-cycle moves
  riskMaxDrawdownPct: number;      // 0..1 — kill-switch threshold
}

const DEFAULTS: AppConfig = {
  tradingMode: 'paper',
  binanceEnv: 'testnet',
  liveEnabled: false,
  advisorPairs: ['SOLUSDC', 'BTCUSDC', 'ETHUSDC', 'XLMUSDC'],
  globalUsdcReservePct: 0.25,
  maxPairWeightPct: 0.45,
  minDeviationPct: 0.07,
  maxChangePerCyclePct: 0.15,
  riskMaxDrawdownPct: 0.30,
};

function parseMode(raw: string | undefined, liveEnabled: boolean): TradingMode {
  if (!raw) return DEFAULTS.tradingMode;
  const mode = raw.toLowerCase() as TradingMode;
  if (mode === 'live' && !liveEnabled) {
    throw new Error(
      'TRADING_MODE=live requires LIVE_ENABLED=true. Refusing to start in live mode.'
    );
  }
  if (mode !== 'paper' && mode !== 'testnet' && mode !== 'live') {
    throw new Error(`Invalid TRADING_MODE: ${raw}. Use paper, testnet, or live.`);
  }
  return mode;
}

function parsePct(raw: string | undefined, fallback: number, label: string): number {
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 1) {
    throw new Error(`${label} must be 0..1, got: ${raw}`);
  }
  return n;
}

function parsePairs(raw: string | undefined): string[] {
  if (raw === undefined) return DEFAULTS.advisorPairs;
  return raw.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
}

/**
 * Load configuration from an env-like object (testable).
 * Pass `process.env` in production.
 */
export function loadConfig(env: Record<string, string | undefined> = {}): AppConfig {
  const liveEnabled = env.LIVE_ENABLED === 'true';
  const tradingMode = parseMode(env.TRADING_MODE, liveEnabled);
  const binanceEnv = (env.BINANCE_ENV === 'mainnet' ? 'mainnet' : 'testnet') as BinanceNetwork;

  return {
    tradingMode,
    binanceEnv,
    liveEnabled,
    advisorPairs: parsePairs(env.ADVISOR_PAIRS),
    globalUsdcReservePct: parsePct(env.GLOBAL_USDC_RESERVE_PCT, DEFAULTS.globalUsdcReservePct, 'GLOBAL_USDC_RESERVE_PCT'),
    maxPairWeightPct: parsePct(env.MAX_PAIR_WEIGHT_PCT, DEFAULTS.maxPairWeightPct, 'MAX_PAIR_WEIGHT_PCT'),
    minDeviationPct: parsePct(env.MIN_DEVIATION_PCT, DEFAULTS.minDeviationPct, 'MIN_DEVIATION_PCT'),
    maxChangePerCyclePct: parsePct(env.MAX_CHANGE_PER_CYCLE_PCT, DEFAULTS.maxChangePerCyclePct, 'MAX_CHANGE_PER_CYCLE_PCT'),
    riskMaxDrawdownPct: parsePct(env.RISK_MAX_DRAWDOWN_PCT, DEFAULTS.riskMaxDrawdownPct, 'RISK_MAX_DRAWDOWN_PCT'),
  };
}
