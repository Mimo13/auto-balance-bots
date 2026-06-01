import { describe, it } from 'node:test';
import assert from 'node:assert';
import { BinancePublicClient } from './binance-public-client.js';

const SYMBOL = 'BTCUSDC';

describe('BinancePublicClient (testnet)', () => {
  const client = new BinancePublicClient('testnet');

  it('getTicker returns valid Ticker shape', async () => {
    const t = await client.getTicker(SYMBOL);
    assert.strictEqual(t.symbol, SYMBOL);
    assert.ok(typeof t.lastPrice === 'number' && t.lastPrice > 0, 'lastPrice positive');
    assert.ok(typeof t.bidPrice === 'number', 'bidPrice number');
    assert.ok(typeof t.askPrice === 'number', 'askPrice number');
    assert.ok(typeof t.volume === 'number' && t.volume > 0, 'volume positive');
    assert.ok(typeof t.quoteVolume === 'number' && t.quoteVolume > 0, 'quoteVolume positive');
  });

  it('getCandles returns Candle[] with OHLCV', async () => {
    const candles = await client.getCandles(SYMBOL, '1h', 5);
    assert.ok(Array.isArray(candles), 'returns array');
    assert.ok(candles.length > 0, 'at least one candle');
    const c = candles[0];
    assert.ok(typeof c.open === 'number' && c.open > 0, 'open');
    assert.ok(typeof c.high === 'number' && c.high >= c.open, 'high >= open');
    assert.ok(typeof c.low === 'number' && c.low <= c.open, 'low <= open');
    assert.ok(typeof c.close === 'number', 'close');
    assert.ok(typeof c.volume === 'number' && c.volume > 0, 'volume');
    assert.ok(c.openTime < c.closeTime, 'time ordering');
    assert.ok(candles.length <= 5, 'respects limit');
  });

  it('getExchangeInfo returns ExchangeInfo with filters', async () => {
    const info = await client.getExchangeInfo(SYMBOL);
    assert.strictEqual(info.symbol, SYMBOL);
    assert.ok(typeof info.baseAsset === 'string' && info.baseAsset.length > 0, 'baseAsset');
    assert.ok(typeof info.quoteAsset === 'string' && info.quoteAsset.length > 0, 'quoteAsset');
    assert.ok(info.filters.lotSize, 'lotSize filter');
    assert.ok(typeof info.filters.lotSize.stepSize === 'string', 'stepSize string');
    assert.ok(info.filters.priceFilter, 'priceFilter');
    assert.ok(typeof info.filters.priceFilter.tickSize === 'string', 'tickSize string');
    assert.ok(info.filters.minNotional, 'minNotional');
    assert.ok(typeof info.filters.minNotional.minNotional === 'string', 'minNotional string');
  });

  it('throws on invalid symbol', async () => {
    await assert.rejects(
      () => client.getTicker('INVALIDPAIR123'),
      /Binance.*error|ticker error/,
    );
  });
});
