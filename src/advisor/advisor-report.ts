export interface PortfolioRecommendation {
  totalCapitalUSDC: number;
  reservedCapitalUSDC: number;
  totalAllocatedUSDC: number;
}

export interface SuggestedRange {
  lower: number;
  upper: number;
  widthPct: number;
}

export interface PairReport {
  symbol: string;
  ok: boolean;
  price?: number;
  score?: number;
  targetWeightPct?: number;
  suggestedRange?: SuggestedRange;
  reasons: string[];
  warnings: string[];
}

export interface AdvisorReport {
  generatedAt: string;
  mode: 'paper' | 'testnet' | 'live';
  network: string;
  universe: string[];
  pairReports: PairReport[];
  portfolioRecommendation: PortfolioRecommendation;
  globalWarnings: string[];
}

/**
 * Build a validated AdvisorReport from raw data.
 * Ensures all required fields are present and well-formed.
 */
export function buildAdvisorReport(raw: AdvisorReport): AdvisorReport {
  // Validate and return — structural identity with guard
  if (!raw.generatedAt) {
    raw.generatedAt = new Date().toISOString();
  }
  if (!Array.isArray(raw.pairReports)) {
    throw new Error('pairReports must be an array');
  }
  if (!raw.portfolioRecommendation) {
    throw new Error('portfolioRecommendation is required');
  }
  return raw;
}

/**
 * Format a PairReport as a table row string (for CLI table output).
 */
export function formatPairTableRow(p: PairReport): string {
  const symbol = p.symbol.padEnd(11);
  const ok = String(p.ok).padEnd(5);
  const price = p.price != null ? String(p.price).padEnd(14) : '-'.padEnd(14);
  const score = p.score != null ? String(p.score).padEnd(6) : '-'.padEnd(6);
  const target = p.targetWeightPct != null ? `${(p.targetWeightPct * 100).toFixed(1)}%` : '-';
  const range = p.suggestedRange
    ? `${p.suggestedRange.lower}–${p.suggestedRange.upper} (${p.suggestedRange.widthPct}%)`
    : '-';
  return `${symbol} ${ok} ${price} ${score} ${target.padEnd(6)} ${range}`;
}

/**
 * Print an AdvisorReport as a formatted table to stdout.
 */
export function printAdvisorTable(report: AdvisorReport): void {
  const header = `auto-balance-bots advisor · mode=${report.mode} · network=${report.network} · pairs=${report.universe.join(',')}`;
  const cols = 'symbol       ok    price           score  target  suggested range';
  console.log(header);
  console.log(cols);
  for (const p of report.pairReports) {
    console.log(formatPairTableRow(p));
    for (const reason of p.reasons) console.log(`  · ${reason}`);
    for (const warning of p.warnings) console.log(`  ! ${warning}`);
  }
  const rec = report.portfolioRecommendation;
  console.log(`\nReserve: $${rec.reservedCapitalUSDC.toFixed(2)} · Allocated: $${rec.totalAllocatedUSDC.toFixed(2)} · Total: $${rec.totalCapitalUSDC.toFixed(2)}`);
  if (report.globalWarnings.length > 0) {
    console.log('\nWarnings:');
    for (const w of report.globalWarnings) console.log(`  ! ${w}`);
  }
}

/**
 * Format an AdvisorReport as Markdown string.
 */
export function formatAdvisorMarkdown(report: AdvisorReport): string {
  const lines: string[] = [];
  lines.push(`# Advisor Report — ${report.generatedAt}`);
  lines.push('');
  lines.push(`**Mode:** ${report.mode} · **Network:** ${report.network}`);
  lines.push(`**Universe:** ${report.universe.join(', ')}`);
  lines.push('');

  if (report.pairReports.length === 0) {
    lines.push('_No pairs analyzed._');
    return lines.join('\n');
  }

  // Table header
  lines.push('| Symbol | OK | Price | Score | Target | Range |');
  lines.push('|--------|----|-------|-------|--------|-------|');
  for (const p of report.pairReports) {
    const price = p.price != null ? `$${p.price.toFixed(2)}` : '-';
    const score = p.score != null ? String(p.score) : '-';
    const target = p.targetWeightPct != null ? `${(p.targetWeightPct * 100).toFixed(1)}%` : '-';
    const range = p.suggestedRange
      ? `${p.suggestedRange.lower}–${p.suggestedRange.upper}`
      : '-';
    lines.push(`| ${p.symbol} | ${p.ok ? '✅' : '❌'} | ${price} | ${score} | ${target} | ${range} |`);

    // Details per pair
    for (const reason of p.reasons) {
      lines.push(`| | | | | | · ${reason} |`);
    }
    for (const warning of p.warnings) {
      lines.push(`| | | | ⚠️ | | ${warning} |`);
    }
  }

  lines.push('');
  const rec = report.portfolioRecommendation;
  lines.push('### Portfolio Recommendation');
  lines.push('');
  lines.push(`- **Reserve:** $${rec.reservedCapitalUSDC.toFixed(2)}`);
  lines.push(`- **Allocated:** $${rec.totalAllocatedUSDC.toFixed(2)}`);
  lines.push(`- **Total Capital:** $${rec.totalCapitalUSDC.toFixed(2)}`);

  if (report.globalWarnings.length > 0) {
    lines.push('');
    lines.push('### Global Warnings');
    for (const w of report.globalWarnings) {
      lines.push(`- ⚠️ ${w}`);
    }
  }

  return lines.join('\n');
}
