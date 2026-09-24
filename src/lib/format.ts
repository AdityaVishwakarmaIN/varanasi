/**
 * Indian number formatting (S2-T1).
 *
 * The simulation keeps its own population numbers. `POPULATION_DISPLAY_SCALE` only changes what the player sees,
 * so a city of lakhs is shown without simulating every person.
 */
export const POPULATION_DISPLAY_SCALE = 10;

const LAKH = 100_000;
const CRORE = 10_000_000;

/** 1234567 -> "12,34,567" (Indian digit grouping). Rounds to a whole number. */
export function formatIndianNumber(n: number): string {
  if (!Number.isFinite(n)) return '0';
  const rounded = Math.round(n);
  const sign = rounded < 0 ? '-' : '';
  const digits = String(Math.abs(rounded));
  if (digits.length <= 3) return sign + digits;
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${sign}${rest},${last3}`;
}

/** One decimal, without a trailing ".0": 12.34 -> "12.3", 12.0 -> "12". */
function oneDecimal(n: number): string {
  const v = Math.round(n * 10) / 10;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

/** Lakh/crore words for big values, or null when the value is below 1 lakh. 99.96 lakh rounds up to "1 crore". */
function lakhCroreWords(abs: number): string | null {
  if (abs >= CRORE || Math.round((abs / LAKH) * 10) / 10 >= 100) return `${oneDecimal(abs / CRORE)} crore`;
  if (abs >= LAKH) return `${oneDecimal(abs / LAKH)} lakh`;
  return null;
}

/** Lakh/crore words for large values: 1,23,000 -> "1.2 lakh"; 3,40,00,000 -> "3.4 crore". */
export function formatIndianCompact(n: number): string {
  const words = lakhCroreWords(Math.abs(n));
  return words ? `${n < 0 ? '-' : ''}${words}` : formatIndianNumber(n);
}

/** Money. Under 1 lakh: "₹45,300". Under 1 crore: "₹12.3 lakh". Otherwise: "₹3.4 crore". Negative: "-₹5,000". */
export function formatINR(n: number): string {
  if (!Number.isFinite(n)) return '₹0';
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  return `${sign}₹${lakhCroreWords(abs) ?? formatIndianNumber(abs)}`;
}

/** Takes the SIMULATION population, multiplies by POPULATION_DISPLAY_SCALE, then formats with lakh/crore words. */
export function formatPopulation(simPopulation: number): string {
  if (!Number.isFinite(simPopulation)) return '0';
  return formatIndianCompact(Math.round(simPopulation * POPULATION_DISPLAY_SCALE));
}

/** The displayed (scaled) population as a number, for charts and thresholds shown to the player. */
export function toDisplayPopulation(simPopulation: number): number {
  return Math.round(simPopulation * POPULATION_DISPLAY_SCALE);
}
