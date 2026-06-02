export interface PairAllocationInput {
  symbol: string;
  score: number;
}

export interface PairAllocation {
  symbol: string;
  targetWeightPct: number;
  targetCapitalUSDC: number;
  currentCapitalUSDC: number;
  deltaUSDC: number;
  action: 'KEEP' | 'ADD_CAPITAL' | 'REDUCE_CAPITAL' | 'PAUSE_CANDIDATE';
  reasons: string[];
  warnings: string[];
}

export interface AllocationResult {
  pairs: PairAllocation[];
  reservedCapitalUSDC: number;
  totalAllocatedUSDC: number;
  totalCapitalUSDC: number;
}

interface InternalState {
  symbol: string;
  score: number;
  currentCapitalUSDC: number;
  targetWeightPct: number;
}

const DEFAULTS = {
  reservePct: 0.25,
  maxPairWeightPct: 0.45,
  minDeviationPct: 0.07,
  maxChangePerCyclePct: 0.15,
};

/**
 * Allocate capital across pairs respecting reserve, max weight, threshold, and max change.
 *
 * Algorithm:
 *  1. Reserve = totalCapital * reservePct (e.g. 25%)
 *  2. Allocatable = totalCapital - reserved
 *  3. Score-proportional allocation → cap at maxPairWeightPct → redistribute surplus
 *  4. Compute target capital, delta, action per pair
 *  5. Cap delta magnitude at maxChangePerCyclePct of total
 */
export function allocateCapital(
  inputs: PairAllocationInput[],
  totalCapitalUSDC: number,
  currentCapitalMap: Record<string, number> = {},
  opts?: {
    reservePct?: number;
    maxPairWeightPct?: number;
    minDeviationPct?: number;
    maxChangePerCyclePct?: number;
  },
): AllocationResult {
  const reservePct = opts?.reservePct ?? DEFAULTS.reservePct;
  const maxPairWeightPct = opts?.maxPairWeightPct ?? DEFAULTS.maxPairWeightPct;
  const minDeviationPct = opts?.minDeviationPct ?? DEFAULTS.minDeviationPct;
  const maxChangePerCyclePct = opts?.maxChangePerCyclePct ?? DEFAULTS.maxChangePerCyclePct;

  const allocatablePct = Math.max(0, 1 - reservePct);
  const totalScore = inputs.reduce((s, p) => s + Math.max(0, p.score), 0);

  // Step 1: build state list with raw weights
  const entries: InternalState[] = inputs.map((p) => ({
    symbol: p.symbol,
    score: Math.max(0, p.score),
    currentCapitalUSDC: currentCapitalMap[p.symbol] ?? 0,
    targetWeightPct: 0,
  }));

  if (totalScore <= 0 || totalCapitalUSDC <= 0) {
    return buildResult(entries, totalCapitalUSDC, reservePct);
  }

  // Step 2: compute raw weights proportionally to score
  let capped: string[] = [];
  let remaining = entries.filter((e) => e.score > 0);
  let surplusWeight = 0;

  // Iterative redistribution: max 10 rounds to avoid infinite loop
  for (let round = 0; round < 10 && remaining.length > 0; round++) {
    const remainingScore = remaining.reduce((s, e) => s + e.score, 0);
    if (remainingScore <= 0) break;

    // Distribute allocatablePct proportionally among remaining
    for (const e of remaining) {
      const rawWeight = allocatablePct * (e.score / remainingScore) + surplusWeight / (remaining.length || 1);
      if (rawWeight > maxPairWeightPct) {
        e.targetWeightPct = maxPairWeightPct;
        capped.push(e.symbol);
      } else {
        e.targetWeightPct = rawWeight;
      }
    }

    // Compute surplus from newly capped
    const newSurplus = remaining
      .filter((e) => e.targetWeightPct > maxPairWeightPct - 0.0001 && e.symbol !== capped[capped.length - 1])
      .reduce((s, e) => s + (e.targetWeightPct - maxPairWeightPct), 0);
    surplusWeight = remaining
      .filter((e) => e.targetWeightPct > maxPairWeightPct - 0.0001)
      .reduce((s, e) => s + (e.targetWeightPct - maxPairWeightPct), 0);

    // Reassign capped entries to max, remove them from next round
    for (const e of remaining) {
      if (e.targetWeightPct > maxPairWeightPct - 0.0001) {
        e.targetWeightPct = maxPairWeightPct;
      }
    }

    remaining = remaining.filter((e) => e.targetWeightPct < maxPairWeightPct - 0.0001);
    if (surplusWeight < 0.0001) break;
  }

  return buildResult(entries, totalCapitalUSDC, reservePct, {
    totalCapitalUSDC,
    maxPairWeightPct,
    minDeviationPct,
    maxChangePerCyclePct,
  });
}

function buildResult(
  entries: InternalState[],
  totalCapitalUSDC: number,
  reservePct: number,
  opts?: {
    totalCapitalUSDC: number;
    maxPairWeightPct: number;
    minDeviationPct: number;
    maxChangePerCyclePct: number;
  },
): AllocationResult {
  const reservedCapitalUSDC = totalCapitalUSDC * reservePct;
  let totalAllocatedUSDC = 0;

  const pairs: PairAllocation[] = entries.map((e) => {
    const targetCapitalUSDC = Math.round(e.targetWeightPct * totalCapitalUSDC * 100) / 100;
    const currentCapitalUSDC = e.currentCapitalUSDC;
    const rawDelta = targetCapitalUSDC - currentCapitalUSDC;

    let deltaUSDC = rawDelta;
    const reasons: string[] = [];
    const warnings: string[] = [];

    // Cap delta magnitude
    if (opts) {
      const maxDelta = opts.maxChangePerCyclePct * opts.totalCapitalUSDC;
      deltaUSDC = Math.max(-maxDelta, Math.min(maxDelta, rawDelta));
    }

    // Action classification
    let action: PairAllocation['action'];
    if (e.score <= 0) {
      action = 'PAUSE_CANDIDATE';
      reasons.push(`score ${e.score} — pausar asignación`);
    } else if (currentCapitalUSDC === 0 && e.targetWeightPct > 0) {
      action = 'ADD_CAPITAL';
      reasons.push(`nueva posición — asignar $${targetCapitalUSDC}`);
    } else {
      const deviationPct = currentCapitalUSDC > 0
        ? Math.abs(deltaUSDC) / currentCapitalUSDC
        : 1;

      if (opts && deviationPct < opts.minDeviationPct) {
        action = 'KEEP';
        reasons.push(`desviación ${(deviationPct * 100).toFixed(1)}% < umbral — mantener`);
      } else if (deltaUSDC > 0) {
        action = 'ADD_CAPITAL';
        reasons.push(`asignar $${deltaUSDC.toFixed(2)} extra (target $${targetCapitalUSDC})`);
      } else if (deltaUSDC < 0) {
        action = 'REDUCE_CAPITAL';
        reasons.push(`retirar $${Math.abs(deltaUSDC).toFixed(2)} (target $${targetCapitalUSDC})`);
      } else {
        action = 'KEEP';
        reasons.push('target alcanzado — mantener');
      }
    }

    // Warnings for capped delta
    if (opts && Math.abs(rawDelta) > Math.abs(deltaUSDC) + 0.01) {
      warnings.push(`delta capado de $${rawDelta.toFixed(2)} a $${deltaUSDC.toFixed(2)} (máx ${(opts.maxChangePerCyclePct * 100)}%)`);
    }

    totalAllocatedUSDC += targetCapitalUSDC;

    return {
      symbol: e.symbol,
      targetWeightPct: Math.round(e.targetWeightPct * 10000) / 10000,
      targetCapitalUSDC,
      currentCapitalUSDC,
      deltaUSDC: Math.round(deltaUSDC * 100) / 100,
      action,
      reasons,
      warnings,
    };
  });

  return {
    pairs,
    reservedCapitalUSDC: Math.round(reservedCapitalUSDC * 100) / 100,
    totalAllocatedUSDC: Math.round(totalAllocatedUSDC * 100) / 100,
    totalCapitalUSDC,
  };
}
