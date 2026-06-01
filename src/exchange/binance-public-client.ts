import type { Ticker, Candle, ExchangeInfo, KlineInterval } from './exchange-client.js';
import type { ExchangeClient } from './exchange-client.js';

type BinanceNetwork = 'testnet' | 'mainnet';

const BASE_URLS: Record<BinanceNetwork, string> = {
  testnet: 'https://testnet.binance.vision',
  mainnet: 'https://api.binance.com',
};

export class BinancePublicClient implements ExchangeClient {
  constructor(private readonly network: BinanceNetwork = 'testnet') {}

  private baseUrl(): string {
    return BASE_URLS[this.network];
  }

  private async fetchJson(path: string): Promise<Record<string, unknown>> {
    const url = `${this.baseUrl()}${path}`;
    const resp = await fetch(url);
    const json = await resp.json() as Record<string, unknown>;
    if (!resp.ok || json.code !== undefined) {
      throw new Error(`Binance error ${path}: ${JSON.stringify(json)}`);
    }
    return json;
  }

  async getTicker(symbol: string): Promise<Ticker> {
    const json = await this.fetchJson(`/api/v3/ticker/24hr?symbol=${encodeURIComponent(symbol)}`);
    return {
      symbol: String(json.symbol),
      lastPrice: Number(json.lastPrice),
      bidPrice: Number(json.bidPrice),
      askPrice: Number(json.askPrice),
      volume: Number(json.volume),
      quoteVolume: Number(json.quoteVolume),
      highPrice: Number(json.highPrice),
      lowPrice: Number(json.lowPrice),
    };
  }

  async getCandles(symbol: string, interval: KlineInterval, limit?: number): Promise<Candle[]> {
    const params = new URLSearchParams({ symbol, interval });
    if (limit !== undefined) params.set('limit', String(limit));
    const json = await this.fetchJson(`/api/v3/klines?${params.toString()}`);
    const klines = json as unknown as Array<Array<string | number>>;
    if (!Array.isArray(klines)) throw new Error(`Binance klines: unexpected response for ${symbol}`);
    return klines.map((k) => ({
      openTime: Number(k[0]),
      closeTime: Number(k[6]),
      open: Number(k[1]),
      high: Number(k[2]),
      low: Number(k[3]),
      close: Number(k[4]),
      volume: Number(k[5]),
      quoteVolume: Number(k[7]),
    }));
  }

  async getExchangeInfo(symbol: string): Promise<ExchangeInfo> {
    const json = await this.fetchJson(`/api/v3/exchangeInfo?symbol=${encodeURIComponent(symbol)}`);
    const symbols = json.symbols as Array<Record<string, unknown>> | undefined;
    if (!symbols || symbols.length === 0) {
      throw new Error(`Binance exchangeInfo: symbol ${symbol} not found`);
    }
    const s = symbols[0];
    const filters = (s.filters as Array<Record<string, unknown>>) ?? [];
    const lotSize = filters.find((f) => f.filterType === 'LOT_SIZE') as Record<string, string> | undefined;
    const priceFilter = filters.find((f) => f.filterType === 'PRICE_FILTER') as Record<string, string> | undefined;
    const minNotional = filters.find((f) => f.filterType === 'MIN_NOTIONAL' || f.filterType === 'NOTIONAL') as Record<string, string> | undefined;
    return {
      symbol: String(s.symbol),
      baseAsset: String(s.baseAsset),
      quoteAsset: String(s.quoteAsset),
      filters: {
        lotSize: { stepSize: lotSize?.stepSize ?? '0.00000001' },
        priceFilter: { tickSize: priceFilter?.tickSize ?? '0.01' },
        minNotional: { minNotional: minNotional?.minNotional ?? '5' },
      },
    };
  }

  /** @deprecated use getTicker instead */
  async getTicker24h(symbol: string): Promise<Ticker> {
    return this.getTicker(symbol);
  }
}
