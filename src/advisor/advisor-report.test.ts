import { describe, it } from 'node:test';
import assert from 'node:assert';
import { buildAdvisorReport, type AdvisorReport, type PairReport } from './advisor-report.js';

function makeInput(overrides?: Partial<AdvisorReport>): AdvisorReport {
  return {
    generatedAt: '2026-06-02T03:00:00.000Z',
    mode: 'paper' as const,
    network: 'testnet',
    universe: ['BTCUSDC', 'ETHUSDC'],
    pairReports: [
      {
        symbol: 'BTCUSDC',
        ok: true,
        price: 95000,
        score: 85,
        targetWeightPct: 0.45,
        suggestedRange: { lower: 90000, upper: 100000, widthPct: 10.5 },
        reasons: ['vol rango 24h 3.5%', 'quote volume 100000000'],
        warnings: [],
      },
      {
        symbol: 'ETHUSDC',
        ok: true,
        price: 3500,
        score: 60,
        targetWeightPct: 0.30,
        suggestedRange: { lower: 3300, upper: 3700, widthPct: 11.4 },
        reasons: ['vol rango 24h 4.2%', 'quote volume 50000000'],
        warnings: ['spread alto'],
      },
    ],
    portfolioRecommendation: {
      totalCapitalUSDC: 1000,
      reservedCapitalUSDC: 250,
      totalAllocatedUSDC: 750,
    },
    globalWarnings: [],
    ...overrides,
  } as AdvisorReport;
}

describe('buildAdvisorReport', () => {
  it('returns a valid AdvisorReport from well-formed inputs', () => {
    const report = buildAdvisorReport(makeInput());
    assert.ok(report.generatedAt);
    assert.strictEqual(report.mode, 'paper');
    assert.strictEqual(report.network, 'testnet');
    assert.strictEqual(report.universe.length, 2);
    assert.strictEqual(report.pairReports.length, 2);
  });

  it('includes pairReports with all required fields', () => {
    const report = buildAdvisorReport(makeInput());
    const btc = report.pairReports.find((p: PairReport) => p.symbol === 'BTCUSDC')!;
    assert.ok(btc.ok);
    assert.strictEqual(btc.price, 95000);
    assert.strictEqual(btc.score, 85);
    assert.ok(btc.reasons.length > 0);
  });

  it('includes portfolioRecommendation', () => {
    const report = buildAdvisorReport(makeInput());
    assert.strictEqual(report.portfolioRecommendation.totalCapitalUSDC, 1000);
    assert.strictEqual(report.portfolioRecommendation.reservedCapitalUSDC, 250);
    assert.strictEqual(report.portfolioRecommendation.totalAllocatedUSDC, 750);
  });

  it('handles empty universe gracefully', () => {
    const report = buildAdvisorReport(makeInput({ universe: [], pairReports: [] }));
    assert.strictEqual(report.universe.length, 0);
    assert.strictEqual(report.pairReports.length, 0);
  });

  it('includes failing pair reports with ok = false', () => {
    const report = buildAdvisorReport(makeInput({
      pairReports: [
        {
          symbol: 'DEADUSDC',
          ok: false,
          reasons: [],
          warnings: ['API error: invalid symbol'],
        },
      ],
    }));
    const dead = report.pairReports[0];
    assert.strictEqual(dead.ok, false);
    assert.strictEqual(dead.warnings[0], 'API error: invalid symbol');
  });

  it('is JSON-serializable (no circular refs)', () => {
    const report = buildAdvisorReport(makeInput());
    const json = JSON.stringify(report);
    const parsed = JSON.parse(json) as AdvisorReport;
    assert.strictEqual(parsed.mode, 'paper');
    assert.strictEqual(parsed.pairReports.length, 2);
  });

  it('globalWarnings are propagated', () => {
    const report = buildAdvisorReport(makeInput({
      globalWarnings: ['testnet mode — no real orders', 'reserva USDC 25% activa'],
    }));
    assert.ok(report.globalWarnings.some((w) => w.includes('testnet')));
    assert.ok(report.globalWarnings.some((w) => w.includes('reserva')));
  });
});
