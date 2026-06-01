import type { Ticker24h } from '../types.js';

type BinanceNetwork = 'testnet' | 'mainnet';

const BASE_URLS: Record<BinanceNetwork, string> = {
  testnet: 'https://testnet.binance.vision',
  mainnet: 'https://api.binance.com',
};

export class BinancePublicClient {
  constructor(private readonly network: BinanceNetwork = 'testnet') {}

  async getTicker24h(symbol: string): Promise<Ticker24h> {
    const url = `${BASE_URLS[this.network]}/api/v3/ticker/24hr?symbol=${encodeURIComponent(symbol)}`;
    const resp = await fetch(url);
    const json = await resp.json() as Record<string, string | number>;
    if (!resp.ok || 'code' in json) {
      throw new Error(`Binance ticker error for ${symbol}: ${JSON.stringify(json)}`);
    }
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
}
