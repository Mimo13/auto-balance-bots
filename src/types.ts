export type TradingMode = 'paper' | 'testnet' | 'live';

export interface Ticker24h {
  symbol: string;
  lastPrice: number;
  bidPrice: number;
  askPrice: number;
  volume: number;
  quoteVolume: number;
  highPrice: number;
  lowPrice: number;
}

export interface AdvisorPairReport {
  symbol: string;
  ok: boolean;
  price?: number;
  score?: number;
  targetWeightPct?: number;
  suggestedRange?: { lower: number; upper: number; widthPct: number };
  reasons: string[];
  warnings: string[];
}
