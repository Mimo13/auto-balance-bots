import { buildSimpleAdvisorReport } from './advisor/simple-advisor.js';

function parsePairs(argv: string[]): string[] {
  const idx = argv.indexOf('--pairs');
  if (idx >= 0 && argv[idx + 1]) return argv[idx + 1].split(',').map((s) => s.trim()).filter(Boolean);
  return (process.env.ADVISOR_PAIRS ?? 'SOLUSDC,BTCUSDC,ETHUSDC,XLMUSDC').split(',').map((s) => s.trim()).filter(Boolean);
}

async function main() {
  const command = process.argv[2] ?? 'advisor';
  if (command !== 'advisor') {
    console.error(`Unknown command: ${command}`);
    process.exitCode = 1;
    return;
  }
  const network = process.env.BINANCE_ENV === 'mainnet' ? 'mainnet' : 'testnet';
  const pairs = parsePairs(process.argv.slice(3));
  const report = await buildSimpleAdvisorReport({
    pairs,
    network,
    reservePct: Number(process.env.GLOBAL_USDC_RESERVE_PCT ?? 0.25),
    maxPairWeightPct: Number(process.env.MAX_PAIR_WEIGHT_PCT ?? 0.45),
  });

  console.log(`auto-balance-bots advisor · network=${network} · pairs=${pairs.join(',')}`);
  console.log('symbol      ok   price          score  target%  suggested range');
  for (const r of report) {
    const range = r.suggestedRange ? `${r.suggestedRange.lower} - ${r.suggestedRange.upper} (${r.suggestedRange.widthPct}%)` : '-';
    console.log(`${r.symbol.padEnd(11)} ${String(r.ok).padEnd(4)} ${String(r.price ?? '-').padEnd(14)} ${String(r.score ?? '-').padEnd(6)} ${String(r.targetWeightPct ?? 0).padEnd(8)} ${range}`);
    for (const reason of r.reasons) console.log(`  · ${reason}`);
    for (const warning of r.warnings) console.log(`  ! ${warning}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
