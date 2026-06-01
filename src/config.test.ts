import { describe, it } from 'node:test';
import assert from 'node:assert';
import { loadConfig } from './config.js';

describe('loadConfig', () => {
  // ── Safety invariant #1 ──
  it('throws if TRADING_MODE=live but LIVE_ENABLED is not "true"', () => {
    assert.throws(
      () => loadConfig({ TRADING_MODE: 'live' }),
      /LIVE_ENABLED=true/,
    );
    assert.throws(
      () => loadConfig({ TRADING_MODE: 'live', LIVE_ENABLED: 'false' }),
      /LIVE_ENABLED=true/,
    );
  });

  it('allows live mode when LIVE_ENABLED=true', () => {
    const cfg = loadConfig({ TRADING_MODE: 'live', LIVE_ENABLED: 'true' });
    assert.strictEqual(cfg.tradingMode, 'live');
  });

  // ── Defaults ──
  it('defaults to paper mode on testnet', () => {
    const cfg = loadConfig({});
    assert.strictEqual(cfg.tradingMode, 'paper');
    assert.strictEqual(cfg.binanceEnv, 'testnet');
    assert.strictEqual(cfg.liveEnabled, false);
  });

  it('defaults to mainnet when BINANCE_ENV=mainnet', () => {
    const cfg = loadConfig({ BINANCE_ENV: 'mainnet' });
    assert.strictEqual(cfg.binanceEnv, 'mainnet');
  });

  // ── Pair parsing ──
  it('parses ADVISOR_PAIRS into uppercase array', () => {
    const cfg = loadConfig({ ADVISOR_PAIRS: 'btcusdc,ethusdc' });
    assert.deepStrictEqual(cfg.advisorPairs, ['BTCUSDC', 'ETHUSDC']);
  });

  it('uses default pairs when ADVISOR_PAIRS is missing', () => {
    const cfg = loadConfig({});
    assert.ok(cfg.advisorPairs.includes('SOLUSDC'));
    assert.ok(cfg.advisorPairs.includes('BTCUSDC'));
  });

  // ── Percentage parsing ──
  it('parses percentage env vars as numbers 0..1', () => {
    const cfg = loadConfig({
      GLOBAL_USDC_RESERVE_PCT: '0.20',
      MAX_PAIR_WEIGHT_PCT: '0.40',
    });
    assert.strictEqual(cfg.globalUsdcReservePct, 0.20);
    assert.strictEqual(cfg.maxPairWeightPct, 0.40);
  });

  it('throws on out-of-range percentages', () => {
    assert.throws(
      () => loadConfig({ GLOBAL_USDC_RESERVE_PCT: '1.5' }),
      /GLOBAL_USDC_RESERVE_PCT must be 0..1/,
    );
    assert.throws(
      () => loadConfig({ GLOBAL_USDC_RESERVE_PCT: '-0.1' }),
      /GLOBAL_USDC_RESERVE_PCT must be 0..1/,
    );
  });

  // ── Threshold defaults ──
  it('provides safe defaults for risk thresholds', () => {
    const cfg = loadConfig({});
    assert.strictEqual(cfg.minDeviationPct, 0.07);
    assert.strictEqual(cfg.maxChangePerCyclePct, 0.15);
    assert.strictEqual(cfg.riskMaxDrawdownPct, 0.30);
  });

  // ── Edge cases ──
  it('handles empty ADVISOR_PAIRS', () => {
    const cfg = loadConfig({ ADVISOR_PAIRS: '' });
    assert.deepStrictEqual(cfg.advisorPairs, []);
  });

  it('throws on invalid TRADING_MODE', () => {
    assert.throws(
      () => loadConfig({ TRADING_MODE: 'production' }),
      /Invalid TRADING_MODE/,
    );
  });
});
