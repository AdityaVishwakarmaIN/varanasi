/** Tax rate limits (percent). SimCity-like: a rate above TAX_RATE_MAX is never accepted, not even from old saves. */
export const TAX_RATE_MIN = 0;
export const TAX_RATE_MAX = 20;
/** The UI shows a warning colour above this rate. */
export const TAX_RATE_WARN_ABOVE = 12;

export function clampTaxRate(rate: number): number {
  if (!Number.isFinite(rate)) return 9;
  return Math.min(TAX_RATE_MAX, Math.max(TAX_RATE_MIN, Math.round(rate)));
}

/** Clamp the lagging effective rate, which is fractional: limits only, no rounding. */
export function clampEffectiveTaxRate(rate: number): number {
  if (!Number.isFinite(rate)) return 9;
  return Math.min(TAX_RATE_MAX, Math.max(TAX_RATE_MIN, rate));
}
