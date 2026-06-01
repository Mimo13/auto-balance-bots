import { loadConfig } from './config.js';
import { buildSimpleAdvisorReport } from './advisor/simple-advisor.js';

async function main() {
  const command = process.argv[2] ?? 'advisor';
  if (command !== 'advisor') {
    console.error(`Unknown command: ${command}`);
    process.exitCode = 1;
    return;
  }

  const config = loadConfig(process.env);

  // CLI --pairs flag overrides env
  const cliPairs = parseCliPairs(process.argv.slice(3));
  const pairs = cliPairs.length > 0 ? cliPairs : config.advisorPairs;

  const report = await buildSimpleAdvisorReport({
    pairs,
    network: config.binanceEnv,
    reservePct: config.globalUsdcReservePct,
    maxPairWeightPct: config.maxPairWeightPct,
  });

  console.log(`auto-balance-bots advisor · tradingMode=${config.tradingMode} · network=${config.binanceEnv} · pairs=${pairs.join(',')}`);
  console.log('symbol      ok   price          score  target%  suggested range');
  for (const r of report) {
    const range = r.suggestedRange ? `${r.suggestedRange.lower} - ${r.suggestedRange.upper} (${r.suggestedRange.widthPct}%)` : '-';
    console.log(`${r.symbol.padEnd(11)} ${String(r.ok).padEnd(4)} ${String(r.price ?? '-').padEnd(14)} ${String(r.score ?? '-').padEnd(6)} ${String(r.targetWeightPct ?? 0).padEnd(8)} ${range}`);
    for (const reason of r.reasons) console.log(`  · ${reason}`);
    for (const warning of r.warnings) console.log(`  ! ${warning}`);
  }
}

function parseCliPairs(argv: string[]): string[] {
  const idx = argv.indexOf('--pairs');
  if (idx >= 0 && argv[idx + 1]) {
    return argv[idx + 1].split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
  }
  return [];
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
