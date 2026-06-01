import { describe, it } from 'node:test';
import assert from 'node:assert';
import type { ExchangeClient, Ticker, Candle, ExchangeInfo, KlineInterval } from './exchange-client.js';

/**
 * Mock client that implements ExchangeClient — validates the contract compiles.
 */
class MockExchangeClient implements ExchangeClient {
  async getTicker(_symbol: string): Promise<Ticker> {
    return { symbol: 'BTCUSDC', lastPrice: 70000, bidPrice: 69999, askPrice: 70001, volume: 1000, quoteVolume: 70000000, highPrice: 71000, lowPrice: 69000 };
  }
  async getCandles(_symbol: string, _interval: KlineInterval, _limit?: number): Promise<Candle[]> {
    return [{ openTime: 1000, closeTime: 60000, open: 70000, high: 70100, low: 69900, close: 70050, volume: 500, quoteVolume: 35000000 }];
  }
  async getExchangeInfo(_symbol: string): Promise<ExchangeInfo> {
    return { symbol: 'BTCUSDC', baseAsset: 'BTC', quoteAsset: 'USDC', filters: { lotSize: { stepSize: '0.00001' }, priceFilter: { tickSize: '0.01' }, minNotional: { minNotional: '10' } } };
  }
}

describe('ExchangeClient interface', () => {
  const client = new MockExchangeClient();

  it('getTicker returns Ticker shape', async () => {
    const t = await client.getTicker('BTCUSDC');
    assert.strictEqual(typeof t.lastPrice, 'number');
    assert.strictEqual(typeof t.symbol, 'string');
    assert.ok(t.lastPrice > 0);
  });

  it('getCandles returns Candle[]', async () => {
    const candles = await client.getCandles('BTCUSDC', '1h', 10);
    assert.ok(Array.isArray(candles));
    assert.ok(candles.length > 0);
    assert.strictEqual(typeof candles[0].open, 'number');
    assert.strictEqual(typeof candles[0].close, 'number');
  });

  it('getExchangeInfo returns ExchangeInfo with filters', async () => {
    const info = await client.getExchangeInfo('BTCUSDC');
    assert.strictEqual(info.baseAsset, 'BTC');
    assert.strictEqual(info.quoteAsset, 'USDC');
    assert.ok(info.filters.lotSize);
    assert.ok(info.filters.priceFilter);
    assert.ok(info.filters.minNotional);
  });
});
