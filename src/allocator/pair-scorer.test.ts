import { describe, it } from 'node:test';
import assert from 'node:assert';
import type { Ticker } from '../exchange/exchange-client.js';
import { scorePair } from './pair-scorer.js';

function ticker(overrides: Partial<Ticker> = {}): Ticker {
  return {
    symbol: 'BTCUSDC',
    lastPrice: 70000,
    bidPrice: 69999,
    askPrice: 70001,
    volume: 1000,
    quoteVolume: 70000000,
    highPrice: 71000,
    lowPrice: 69000,
    ...overrides,
  };
}

describe('scorePair', () => {
  it('returns score 0-100 with reasons', () => {
    const result = scorePair(ticker());
    assert.ok(result.score >= 0 && result.score <= 100, `score ${result.score} out of range`);
    assert.ok(result.reasons.length > 0, 'should have reasons');
  });

  it('higher volume gives higher score', () => {
    const lowVol = scorePair(ticker({ quoteVolume: 1000 }));
    const highVol = scorePair(ticker({ quoteVolume: 100000000 }));
    assert.ok(highVol.score >= lowVol.score, 'high volume should not score lower');
  });

  it('penalizes very wide spreads', () => {
    const tight = scorePair(ticker({ bidPrice: 69999, askPrice: 70001 })); // spread 0.0028%
    const wide = scorePair(ticker({ bidPrice: 60000, askPrice: 70000 }));  // spread ~14%
    assert.ok(tight.score > wide.score, `tight=${tight.score} should beat wide=${wide.score}`);
    assert.ok(wide.warnings.length > 0, 'wide spread should warn');
  });

  it('warns on low volatility', () => {
    const flat = scorePair(ticker({ highPrice: 70010, lowPrice: 69990 }));
    assert.ok(flat.warnings.some((w) => w.includes('volatilidad')), 'should warn about low volatility');
  });

  it('includes human-readable reasons', () => {
    const result = scorePair(ticker());
    const joined = result.reasons.join(' ');
    assert.ok(joined.includes('vol') || joined.includes('rango') || joined.includes('spread') || joined.includes('volume'),
      `reasons should mention key factors: ${joined}`);
  });

  it('handles zero volume gracefully', () => {
    const result = scorePair(ticker({ volume: 0, quoteVolume: 0, highPrice: 70000, lowPrice: 70000 }));
    assert.ok(result.score >= 0);
    assert.ok(result.warnings.length > 0 || result.score === 0);
  });
});
