export interface RangeInput {
  price: number;
  volatilityPct: number; // decimal, e.g. 0.10 = 10%
}

export interface RangeOptions {
  minWidthPct?: number;
  maxWidthPct?: number;
}

export interface RangeAdvice {
  lower: number;
  upper: number;
  widthPct: number;
  center: number;
  reasons: string[];
  warnings: string[];
}

const DEFAULTS = {
  minWidthPct: 0.04,
  maxWidthPct: 0.22,
};

/**
 * Suggest a grid range centered on current price, sized by volatility.
 *
 * Rules:
 *  - Center = current price
 *  - Width = volatility, clamped to [minWidthPct, maxWidthPct]
 *  - Round to tickSize when provided
 *  - Range always contains center
 */
export function suggestRange(
  input: RangeInput,
  options?: RangeOptions,
  tickSize?: number,
): RangeAdvice {
  const minWidthPct = options?.minWidthPct ?? DEFAULTS.minWidthPct;
  const maxWidthPct = options?.maxWidthPct ?? DEFAULTS.maxWidthPct;
  const { price, volatilityPct } = input;

  const reasons: string[] = [];
  const warnings: string[] = [];

  // Clamp width
  let effectiveWidth = volatilityPct;
  if (volatilityPct < minWidthPct) {
    effectiveWidth = minWidthPct;
    warnings.push(`volatilidad ${(volatilityPct * 100).toFixed(2)}% por debajo del mínimo — usando ancho mínimo ${(minWidthPct * 100).toFixed(0)}%`);
  } else if (volatilityPct > maxWidthPct) {
    effectiveWidth = maxWidthPct;
    warnings.push(`volatilidad ${(volatilityPct * 100).toFixed(2)}% excede el máximo — ancho capado a ${(maxWidthPct * 100).toFixed(0)}%`);
  }

  reasons.push(`centro en $${price}, ancho ${(effectiveWidth * 100).toFixed(2)}% basado en volatilidad`);

  // Compute raw bounds
  const halfWidth = effectiveWidth / 2;
  let lower = price * (1 - halfWidth);
  let upper = price * (1 + halfWidth);

  // Round to tickSize
  if (tickSize && tickSize > 0) {
    const ticks = (n: number, op: 'floor' | 'ceil'): number => {
      const rounded = op === 'floor'
        ? Math.floor(n / tickSize) * tickSize
        : Math.ceil(n / tickSize) * tickSize;
      // Avoid -0
      return Object.is(rounded, -0) ? 0 : Number(rounded.toFixed(10));
    };
    lower = ticks(lower, 'floor');
    upper = ticks(upper, 'ceil');

    // Ensure range still contains price after rounding
    if (lower > price) {
      lower = ticks(price, 'floor');
    }
    if (upper < price) {
      upper = ticks(price, 'ceil');
    }

    reasons.push(`redondeado a tickSize ${tickSize}`);
  }

  // Final width calculation
  const mid = (lower + upper) / 2;
  const finalWidthPct = mid > 0 ? (upper - lower) / mid : 0;

  return {
    lower,
    upper,
    widthPct: Math.round(finalWidthPct * 10000) / 10000,
    center: price,
    reasons,
    warnings,
  };
}
