/** OHLCV candle from exchange klines */
export interface Candle {
  openTime: number;    // ms timestamp
  closeTime: number;   // ms timestamp
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  quoteVolume: number;
}

/** 24h ticker as returned by exchanges */
export interface Ticker {
  symbol: string;
  lastPrice: number;
  bidPrice: number;
  askPrice: number;
  volume: number;
  quoteVolume: number;
  highPrice: number;
  lowPrice: number;
}

/** ExchangeInfo filter subset used by trading bots */
export interface ExchangeInfo {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  filters: {
    lotSize: { stepSize: string };
    priceFilter: { tickSize: string };
    minNotional: { minNotional: string };
  };
}

export type KlineInterval = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '1w';

/** Minimal contract every exchange client must fulfill */
export interface ExchangeClient {
  getTicker(symbol: string): Promise<Ticker>;
  getCandles(symbol: string, interval: KlineInterval, limit?: number): Promise<Candle[]>;
  getExchangeInfo(symbol: string): Promise<ExchangeInfo>;
}
