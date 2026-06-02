import { loadConfig } from './config.js';
import { BinancePublicClient } from './exchange/binance-public-client.js';
import type { Ticker } from './exchange/exchange-client.js';
import { scorePair } from './allocator/pair-scorer.js';
import { suggestRange } from './grid/range-advisor.js';
import { allocateCapital } from './allocator/capital-allocator.js';
import {
  buildAdvisorReport,
  printAdvisorTable,
  formatAdvisorMarkdown,
  type AdvisorReport,
  type PairReport,
} from './advisor/advisor-report.js';

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.command !== 'advisor') {
    console.error(`Unknown command: ${args.command}`);
    process.exitCode = 1;
    return;
  }

  const config = loadConfig(process.env);
  const pairs = args.pairs.length > 0 ? args.pairs : config.advisorPairs;
  const format = args.format ?? 'table';
  const totalCapital = args.capital ?? 1000;

  const client = new BinancePublicClient(config.binanceEnv);
  const pairReports: PairReport[] = [];
  const globalWarnings: string[] = [
    `${config.tradingMode} mode — no real orders`,
    `reserve ${(config.globalUsdcReservePct * 100)}%, max pair ${(config.maxPairWeightPct * 100)}%`,
  ];

  // Phase 1: Fetch and score all pairs
  const tickers: { symbol: string; ticker: Ticker }[] = [];

  for (const symbol of pairs) {
    try {
      const ticker = await client.getTicker(symbol);
      tickers.push({ symbol, ticker });
      const scored = scorePair(ticker);
      const range = suggestRange(
        { price: ticker.lastPrice, volatilityPct: scored.widthPct },
        { minWidthPct: 0.04, maxWidthPct: 0.22 },
      );

      pairReports.push({
        symbol,
        ok: true,
        price: ticker.lastPrice,
        score: scored.score,
        suggestedRange: {
          lower: range.lower,
          upper: range.upper,
          widthPct: Number((range.widthPct * 100).toFixed(2)),
        },
        reasons: [...scored.reasons, ...range.reasons],
        warnings: [...scored.warnings, ...range.warnings],
      });
    } catch (err) {
      pairReports.push({
        symbol,
        ok: false,
        reasons: [],
        warnings: [(err as Error).message],
      });
      globalWarnings.push(`Error fetching ${symbol}: ${(err as Error).message}`);
    }
  }

  // Phase 2: Capital allocation
  const scoredInputs = tickers
    .filter((t) => {
      const existing = pairReports.find((p) => p.symbol === t.symbol);
      return existing?.ok;
    })
    .map((t) => ({
      symbol: t.symbol,
      score: pairReports.find((p) => p.symbol === t.symbol)?.score ?? 0,
    }));

  const allocation = allocateCapital(scoredInputs, totalCapital, {}, {
    reservePct: config.globalUsdcReservePct,
    maxPairWeightPct: config.maxPairWeightPct,
    minDeviationPct: config.minDeviationPct,
    maxChangePerCyclePct: config.maxChangePerCyclePct,
  });

  // Merge allocation results back into pair reports
  for (const alloc of allocation.pairs) {
    const report = pairReports.find((p) => p.symbol === alloc.symbol);
    if (report) {
      report.targetWeightPct = alloc.targetWeightPct;
    }
  }

  // Phase 3: Build final report
  const report = buildAdvisorReport({
    generatedAt: new Date().toISOString(),
    mode: config.tradingMode,
    network: config.binanceEnv,
    universe: pairs,
    pairReports,
    portfolioRecommendation: {
      totalCapitalUSDC: allocation.totalCapitalUSDC,
      reservedCapitalUSDC: allocation.reservedCapitalUSDC,
      totalAllocatedUSDC: allocation.totalAllocatedUSDC,
    },
    globalWarnings,
  });

  // Phase 4: Output in requested format
  if (format === 'json') {
    console.log(JSON.stringify(report, null, 2));
  } else if (format === 'md' || format === 'markdown') {
    console.log(formatAdvisorMarkdown(report));
  } else {
    printAdvisorTable(report);
  }
}

interface CliArgs {
  command: string;
  pairs: string[];
  format?: 'table' | 'json' | 'md' | 'markdown';
  capital?: number;
}

function parseArgs(argv: string[]): CliArgs {
  const command = argv[0] ?? 'advisor';
  const rest = argv.slice(1);

  let pairs: string[] = [];
  let format: 'table' | 'json' | 'md' | 'markdown' | undefined;
  let capital: number | undefined;

  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--pairs' && rest[i + 1]) {
      pairs = rest[i + 1].split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
      i++;
    } else if (rest[i] === '--format' && rest[i + 1]) {
      const f = rest[i + 1].toLowerCase();
      if (f === 'table' || f === 'json' || f === 'md' || f === 'markdown') {
        format = f;
      } else {
        console.error(`Unknown format: ${f}. Use table, json, or md.`);
        process.exitCode = 1;
      }
      i++;
    } else if (rest[i] === '--capital' && rest[i + 1]) {
      capital = Number(rest[i + 1]);
      i++;
    }
  }

  return { command, pairs, format, capital };
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
