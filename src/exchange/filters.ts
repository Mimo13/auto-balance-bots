/**
 * Round a quantity to the nearest valid stepSize multiple.
 * Prevents Binance -1013 errors due to invalid lot sizes.
 */
export function roundToStepSize(value: number, stepSize: number): number {
  if (stepSize <= 0) return value;
  const precision = Math.max(0, Math.ceil(-Math.log10(stepSize)));
  const steps = Math.round(value / stepSize);
  return Number((steps * stepSize).toFixed(precision));
}

/**
 * Floor a quantity down to a stepSize multiple (conservative rounding).
 */
export function floorToStepSize(value: number, stepSize: number): number {
  if (stepSize <= 0) return value;
  const precision = Math.max(0, Math.ceil(-Math.log10(stepSize)));
  const steps = Math.floor(value / stepSize);
  return Number((steps * stepSize).toFixed(precision));
}

/**
 * Throw if qty * price is below minNotional.
 * Binance rejects orders below min notional value.
 */
export function assertMinNotional(qty: number, price: number, minNotional: number): void {
  const notional = qty * price;
  if (minNotional > 0 && notional < minNotional) {
    throw new Error(
      `min notional: ${notional.toFixed(2)} < ${minNotional} (qty=${qty} price=${price})`,
    );
  }
}
