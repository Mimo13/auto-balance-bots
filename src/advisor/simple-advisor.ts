import { BinancePublicClient } from '../exchange/binance-public-client.js';
import type { AdvisorPairReport, Ticker24h } from '../types.js';

export interface AdvisorOptions {
  pairs: string[];
  network: 'testnet' | 'mainnet';
  reservePct: number;
  maxPairWeightPct: number;
}

function scoreTicker(t: Ticker24h): { score: number; reasons: string[]; warnings: string[]; widthPct: number } {
  const mid = t.lastPrice || (t.highPrice + t.lowPrice) / 2;
  const dayRangePct = mid > 0 ? (t.highPrice - t.lowPrice) / mid : 0;
  const spreadPct = t.lastPrice > 0 ? Math.max(0, (t.askPrice - t.bidPrice) / t.lastPrice) : 1;
  const volumeScore = Math.min(40, Math.log10(Math.max(1, t.quoteVolume)) * 6);
  const volatilityScore = Math.min(45, dayRangePct * 600);
  const spreadPenalty = Math.min(30, spreadPct * 5000);
  const score = Math.max(0, Math.round((volumeScore + volatilityScore - spreadPenalty) * 100) / 100);
  const reasons = [
    `rango 24h ${(dayRangePct * 100).toFixed(2)}%`,
    `quote volume ${t.quoteVolume.toFixed(0)}`,
    `spread ${(spreadPct * 100).toFixed(3)}%`,
  ];
  const warnings: string[] = [];
  if (dayRangePct < 0.01) warnings.push('volatilidad baja para grid');
  if (spreadPct > 0.002) warnings.push('spread alto: revisar liquidez/fees');
  const widthPct = Math.max(0.04, Math.min(0.22, dayRangePct * 1.8));
  return { score, reasons, warnings, widthPct };
}

export async function buildSimpleAdvisorReport(options: AdvisorOptions): Promise<AdvisorPairReport[]> {
  const client = new BinancePublicClient(options.network);
  const rawReports: AdvisorPairReport[] = [];
  for (const symbol of options.pairs) {
    try {
      const ticker = await client.getTicker24h(symbol);
      const scored = scoreTicker(ticker);
      const half = scored.widthPct / 2;
      rawReports.push({
        symbol,
        ok: true,
        price: ticker.lastPrice,
        score: scored.score,
        suggestedRange: {
          lower: Number((ticker.lastPrice * (1 - half)).toFixed(6)),
          upper: Number((ticker.lastPrice * (1 + half)).toFixed(6)),
          widthPct: Number((scored.widthPct * 100).toFixed(2)),
        },
        reasons: scored.reasons,
        warnings: scored.warnings,
      });
    } catch (err) {
      rawReports.push({
        symbol,
        ok: false,
        reasons: [],
        warnings: [(err as Error).message],
      });
    }
  }

  const totalScore = rawReports.reduce((sum, r) => sum + (r.score ?? 0), 0);
  const allocatablePct = Math.max(0, 1 - options.reservePct);
  for (const report of rawReports) {
    if (!report.ok || !report.score || totalScore <= 0) {
      report.targetWeightPct = 0;
      continue;
    }
    const rawWeight = allocatablePct * (report.score / totalScore);
    report.targetWeightPct = Number((Math.min(options.maxPairWeightPct, rawWeight) * 100).toFixed(2));
  }
  return rawReports;
}
