/**
 * Old-building collapse (Sprint 4, S4-T10). Pure functions; tunables in COLLAPSE_CONFIG.
 *
 * How `building.age` counts (read from `evolveBuilding` / `simulateTick` in simulation.ts):
 *  - `simulateTick` visits every zoned tile once per tick and calls `evolveBuilding`.
 *  - A finished, non-abandoned building that has power and water (or is a starter building) gets `age += 1`
 *    per tick. Buildings under construction or without utilities do not age; abandoned ones age by 0.1.
 *  - A footprint upgrade (`applyBuildingFootprint`) replaces the building and resets `age` to 0; an in-place
 *    level gain keeps the age.
 *  - 30 ticks = 1 day and 360 days = 1 year, so 1 year = 10,800 ticks of age.
 * ⇒ ~8 in-game years = 8 × 10,800 = 86,400 age.
 */
import { CALENDAR, DAYS_PER_YEAR, SEASON_MONTHS, TICKS_PER_YEAR, type Season } from '@/lib/seasons';

export const COLLAPSE_CONFIG = {
  /** In-game years a building must stand (with utilities) before it can collapse. */
  minAgeYears: 8,
  /** `building.age` gained per tick while the building is working (see file header). */
  agePerTick: 1,
  /** Zones whose buildings can collapse. */
  zones: ['residential', 'commercial'] as readonly string[],
  /** Base chance per in-game day for an eligible building. */
  dailyChance: 0.0005,
  /** Multiplier during these seasons. */
  monsoonMultiplier: 3,
  riskySeasons: ['monsoon'] as readonly Season[],
  /** Multiplier if the tile flooded this year. */
  floodedThisYearMultiplier: 2,
  /** Counterplay multiplier: fire-station coverage OR a recent upgrade (applied once, they do not stack). */
  protectionMultiplier: 0.3,
  /** "Recent upgrade" window, in in-game days (2 years). */
  recentUpgradeDays: 2 * DAYS_PER_YEAR,
} as const;

/** `building.age` above which collapse is possible (86,400 with the defaults). */
export const COLLAPSE_MIN_AGE = COLLAPSE_CONFIG.minAgeYears * TICKS_PER_YEAR * COLLAPSE_CONFIG.agePerTick;

export interface CollapseInputs {
  /** The tile's zone ('residential' | 'commercial' | ...). */
  zone: string;
  /** `building.age`. */
  age: number;
  abandoned: boolean;
  /** False while under construction. */
  constructionComplete: boolean;
  season: Season;
  floodedThisYear: boolean;
  /** Inside a fire station's coverage. */
  fireCoverage: boolean;
  /** Days since the building last levelled up (undefined = never / unknown). */
  daysSinceUpgrade?: number;
}

/** Whether a building can collapse at all (zone, age, not abandoned, finished). */
export function isCollapseEligible(inputs: Pick<CollapseInputs, 'zone' | 'age' | 'abandoned' | 'constructionComplete'>): boolean {
  return (
    COLLAPSE_CONFIG.zones.includes(inputs.zone) &&
    !inputs.abandoned &&
    inputs.constructionComplete &&
    inputs.age > COLLAPSE_MIN_AGE
  );
}

/** Chance per in-game day that this building collapses (becomes abandoned, residents removed). */
export function getCollapseChance(inputs: CollapseInputs): number {
  if (!isCollapseEligible(inputs)) return 0;
  const c = COLLAPSE_CONFIG;
  let chance = c.dailyChance;
  if (c.riskySeasons.includes(inputs.season)) chance *= c.monsoonMultiplier;
  if (inputs.floodedThisYear) chance *= c.floodedThisYearMultiplier;
  const recentlyUpgraded = inputs.daysSinceUpgrade !== undefined && inputs.daysSinceUpgrade <= c.recentUpgradeDays;
  if (inputs.fireCoverage || recentlyUpgraded) chance *= c.protectionMultiplier;
  return Math.min(1, chance);
}

/**
 * Tuning aid for the "at most 1 collapse per year in a well-run 1-lakh city" target:
 * expected collapses per year for `eligibleBuildings` old buildings, averaged over the seasons
 * (the risky months get `monsoonMultiplier`), with or without fire coverage, and no floods.
 */
export function estimateCollapsesPerYear(eligibleBuildings: number, fireCoverage: boolean): number {
  const c = COLLAPSE_CONFIG;
  let riskyMonths = 0;
  for (const s of c.riskySeasons) riskyMonths += SEASON_MONTHS[s].length;
  const riskyShare = riskyMonths / CALENDAR.monthsPerYear;
  const seasonAvg = riskyShare * c.monsoonMultiplier + (1 - riskyShare);
  const protection = fireCoverage ? c.protectionMultiplier : 1;
  return eligibleBuildings * c.dailyChance * seasonAvg * protection * DAYS_PER_YEAR;
}
