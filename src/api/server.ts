import http from 'node:http';
import { loadConfig } from '../config.js';
import type { AdvisorReport } from '../advisor/advisor-report.js';
import {
  buildAdvisorReport,
  formatAdvisorMarkdown,
  type PairReport,
} from '../advisor/advisor-report.js';
import { BinancePublicClient } from '../exchange/binance-public-client.js';
import type { Ticker } from '../exchange/exchange-client.js';
import { scorePair } from '../allocator/pair-scorer.js';
import { suggestRange } from '../grid/range-advisor.js';
import { allocateCapital } from '../allocator/capital-allocator.js';

const PACKAGE_VERSION = '0.1.0';

export function startApi(port: number = 0): Promise<http.Server> {
  return new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      // CORS headers for local dev
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      try {
        const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
        const path = url.pathname;

        if (req.method === 'GET' && path === '/health') {
          await handleHealth(res);
        } else if (req.method === 'GET' && path === '/api/advisor/report') {
          await handleReport(res);
        } else if (req.method === 'POST' && path === '/api/advisor/preview') {
          await handlePreview(req, res);
        } else {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Not found' }));
        }
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: err instanceof Error ? err.message : String(err),
        }));
      }
    });

    server.listen(port, () => resolve(server));
  });
}

async function handleHealth(res: http.ServerResponse): Promise<void> {
  const config = loadConfig(process.env);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    status: 'ok',
    mode: config.tradingMode,
    network: config.binanceEnv,
    version: PACKAGE_VERSION,
  }));
}

async function handleReport(res: http.ServerResponse): Promise<void> {
  const report = await buildFullReport(undefined, undefined);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(report, null, 2));
}

async function handlePreview(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
  }

  let params: { pairs?: string | string[]; capital?: number };
  try {
    params = JSON.parse(body);
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid JSON body' }));
    return;
  }

  const pairsStr = Array.isArray(params.pairs) ? params.pairs.join(',') : params.pairs;
  const report = await buildFullReport(pairsStr, params.capital);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(report, null, 2));
}

async function buildFullReport(
  pairsOverride?: string,
  capitalOverride?: number,
): Promise<AdvisorReport> {
  const config = loadConfig(process.env);
  const pairs = pairsOverride
    ? pairsOverride.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean)
    : config.advisorPairs;
  const totalCapital = capitalOverride ?? 1000;

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

  return buildAdvisorReport({
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
}
