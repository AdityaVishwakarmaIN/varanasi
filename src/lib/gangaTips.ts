/**
 * Pure conditions for the Ganga contextual tips (S2-T11). The tip hook gathers the numbers; these decide.
 */
import { POPULATION_DISPLAY_SCALE } from '@/lib/format';
import type { GangaTrend } from '@/lib/scoring';

export const GANGA_TIPS_CONFIG = {
  /** `build_first_ghat`: shown once the DISPLAYED population exceeds this and no ghat exists. */
  firstGhatDisplayPopulation: 5000,
  /** `ganga_falling`: shown after the trend has pointed down for this many in-game days in a row. */
  fallingTrendDays: 10,
  /** `needs_stp`: shown when untreated sewage is more than this share of the river's net load. */
  sewageShareOfNetLoad: 0.5,
  /** A jump of more than this many days between observations (a loaded save) restarts the falling count. */
  maxObservedDayGap: 30,
} as const;

/** Days since the start of year 0 (the calendar has 12 months of 30 days). */
export function gameDayIndex(year: number, month: number, day: number): number {
  return (year * 12 + (month - 1)) * 30 + (day - 1);
}

export function needsFirstGhat(simPopulation: number, ghatCount: number): boolean {
  return ghatCount === 0 && simPopulation * POPULATION_DISPLAY_SCALE > GANGA_TIPS_CONFIG.firstGhatDisplayPopulation;
}

/**
 * Consecutive in-game days the Ganga trend has pointed down.
 * @param daysElapsed in-game days since the previous observation (several can pass between renders at high speed).
 */
export function nextGangaFallingDays(previousDays: number, trend: GangaTrend, daysElapsed: number): number {
  if (trend !== 'down') return 0;
  if (daysElapsed === 0) return previousDays;
  if (daysElapsed < 0 || daysElapsed > GANGA_TIPS_CONFIG.maxObservedDayGap) return 0;
  return previousDays + daysElapsed;
}

export function isGangaFallingLongEnough(fallingDays: number): boolean {
  return fallingDays >= GANGA_TIPS_CONFIG.fallingTrendDays;
}

export function isSewageDominant(sewageLoad: number, netLoad: number): boolean {
  return netLoad > 0 && sewageLoad > netLoad * GANGA_TIPS_CONFIG.sewageShareOfNetLoad;
}
