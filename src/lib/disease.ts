/**
 * Disease outbreaks (Sprint 4, S4-T9). Pure functions; tunables in DISEASE_CONFIG.
 *
 * Checked once per in-game week per feeder zone (see `feederZones.ts`):
 *   risk = base × densityFactor × waterFactor × riverFactor × floodFactor × seasonFactor
 * An outbreak lasts at least `minDurationDays`, costs the block 1% population per week, and ends either
 * `cureDelayDays` after hospital and water coverage are good enough, or on its own after `selfResolveDays`
 * with an extra population loss.
 *
 * All days are absolute days (see `absoluteDay` in seasons.ts).
 */
import type { Rng } from '@/lib/rng';
import type { Season } from '@/lib/seasons';

export const DISEASE_CONFIG = {
  /** Weekly outbreak chance before multipliers. */
  baseRisk: 0.01,
  /** densityFactor = 1 + blockPopulation / densityPopulation. */
  densityPopulation: 2000,
  /** riverFactor applies when Ganga Health is below this (blocks with catchment tiles only). */
  riverHealthThreshold: 50,
  riverFactor: 1.5,
  /** floodFactor applies when the block had flooded tiles within this many days. */
  recentFloodDays: 20,
  floodFactor: 2,
  /** seasonFactor for these seasons. */
  seasonFactor: 2,
  riskySeasons: ['monsoon', 'postMonsoon'] as readonly Season[],
  /** Risk is a probability, so it is capped here. */
  maxRisk: 1,
  /** An outbreak lasts at least this many days. */
  minDurationDays: 14,
  /** Cure conditions (both percentages 0–100, averaged over the block). */
  cureHospitalCoverage: 60,
  cureWaterCoverage: 80,
  /** Days the cure conditions must hold before the outbreak ends. */
  cureDelayDays: 14,
  /** The outbreak burns out by itself after this many days. */
  selfResolveDays: 60,
  /** Fraction of the block's population lost every 7 days of outbreak. */
  weeklyPopulationLoss: 0.01,
  lossIntervalDays: 7,
  /** Extra one-time population loss when the outbreak burns out on its own. */
  selfResolveExtraLoss: 0.05,
  /** Health rating penalty for tiles in an infected block. */
  healthPenalty: 25,
} as const;

/** What the risk formula needs for one feeder block. */
export interface DiseaseRiskInputs {
  /** Simulation population living in the block. */
  population: number;
  /** Residential tiles in the block, and how many of them have no water. */
  residentialTiles: number;
  residentialTilesWithoutWater: number;
  /** Current Ganga Health (undefined on non-Varanasi maps → no river factor). */
  gangaHealth: number | undefined;
  /** Whether the block contains Ganga catchment tiles. */
  hasCatchmentTiles: boolean;
  /** Whether the block had flooded tiles in the last `recentFloodDays` days (see `wasFloodedRecently`). */
  floodedRecently: boolean;
  season: Season;
}

/** The named multipliers in the risk formula. */
export type DiseaseRiskFactor = 'density' | 'water' | 'river' | 'flood' | 'season';

/** Each multiplier of the risk formula for a block. */
export function getDiseaseRiskFactors(inputs: DiseaseRiskInputs): Record<DiseaseRiskFactor, number> {
  const c = DISEASE_CONFIG;
  const unwateredShare =
    inputs.residentialTiles > 0
      ? Math.min(1, Math.max(0, inputs.residentialTilesWithoutWater / inputs.residentialTiles))
      : 0;
  return {
    density: 1 + Math.max(0, inputs.population) / c.densityPopulation,
    water: 1 + unwateredShare,
    river:
      inputs.hasCatchmentTiles && inputs.gangaHealth !== undefined && inputs.gangaHealth < c.riverHealthThreshold
        ? c.riverFactor
        : 1,
    flood: inputs.floodedRecently ? c.floodFactor : 1,
    season: c.riskySeasons.includes(inputs.season) ? c.seasonFactor : 1,
  };
}

/** Weekly outbreak probability for a block: base × all factors, capped at `maxRisk`. */
export function calculateDiseaseRisk(inputs: DiseaseRiskInputs): number {
  const f = getDiseaseRiskFactors(inputs);
  const risk = DISEASE_CONFIG.baseRisk * f.density * f.water * f.river * f.flood * f.season;
  return Math.min(DISEASE_CONFIG.maxRisk, risk);
}

/** Tie-break order: player-fixable causes first. */
const FACTOR_PRIORITY: readonly DiseaseRiskFactor[] = ['flood', 'water', 'river', 'density', 'season'];

/** The factor that multiplies risk the most, for the advisor explanation. Ties go to the more fixable cause. */
export function getTopRiskFactor(inputs: DiseaseRiskInputs): DiseaseRiskFactor {
  const f = getDiseaseRiskFactors(inputs);
  let best: DiseaseRiskFactor = FACTOR_PRIORITY[0];
  for (const k of FACTOR_PRIORITY) if (f[k] > f[best]) best = k;
  return best;
}

/** Short cause phrases for the advisor line ("<cause> in <area>"). Wrap in `msg()` in UI code. */
export const DISEASE_FACTOR_LABELS: Record<DiseaseRiskFactor, string> = {
  flood: 'Dirty water and flooding',
  water: 'No clean water supply',
  river: 'A polluted Ganga',
  density: 'Overcrowding',
  season: 'Monsoon-season infections',
};

/** True when a block flooded within the last `recentFloodDays` days. */
export function wasFloodedRecently(lastFloodDay: number | undefined, today: number): boolean {
  return lastFloodDay !== undefined && today - lastFloodDay <= DISEASE_CONFIG.recentFloodDays;
}

/** Weekly roll: does this block get an outbreak? Uses one `rng()` draw. */
export function rollOutbreak(risk: number, rng: Rng): boolean {
  return rng() < risk;
}

/** One infected feeder block. Store as `outbreaks?: OutbreakState[]` on GameState. */
export interface OutbreakState {
  /** Feeder block index (see `getFeederIndex`). */
  feeder: number;
  startDay: number;
  /** Last day the weekly population loss was charged. */
  lastLossDay: number;
  /** First day of the current unbroken run of good hospital + water coverage. */
  cureConditionsSinceDay?: number;
}

/** Creates a new outbreak in a block. */
export function startOutbreak(feeder: number, today: number): OutbreakState {
  return { feeder, startDay: today, lastLossDay: today };
}

/** Block coverage used to decide whether an outbreak is being cured. Both 0–100. */
export interface OutbreakStepInput {
  today: number;
  /** Average hospital coverage over the block's tiles. */
  hospitalCoverage: number;
  /** Share of the block's tiles (or residents) with water, as a percentage. */
  waterCoverage: number;
}

export interface OutbreakStepResult {
  /** The outbreak to keep, or null when it ended. */
  outbreak: OutbreakState | null;
  /** Fraction of the block's population to remove now (0 most days). */
  populationLossFraction: number;
  /** How it ended this step, if it did. */
  ended: 'cured' | 'selfResolved' | null;
}

/**
 * Advances an outbreak to `today`. Safe to call daily or weekly: population loss is charged once per full
 * 7 days since `lastLossDay`. The cure clock resets whenever coverage drops below the thresholds.
 */
export function advanceOutbreak(outbreak: OutbreakState, input: OutbreakStepInput): OutbreakStepResult {
  const c = DISEASE_CONFIG;
  const { today } = input;
  const weeks = Math.max(0, Math.floor((today - outbreak.lastLossDay) / c.lossIntervalDays));
  let keep = Math.pow(1 - c.weeklyPopulationLoss, weeks);
  const lastLossDay = outbreak.lastLossDay + weeks * c.lossIntervalDays;

  const conditionsMet = input.hospitalCoverage >= c.cureHospitalCoverage && input.waterCoverage >= c.cureWaterCoverage;
  const cureSince = conditionsMet ? (outbreak.cureConditionsSinceDay ?? today) : undefined;
  const age = today - outbreak.startDay;

  if (cureSince !== undefined && today - cureSince >= c.cureDelayDays && age >= c.minDurationDays) {
    return { outbreak: null, populationLossFraction: 1 - keep, ended: 'cured' };
  }
  if (age >= c.selfResolveDays) {
    keep *= 1 - c.selfResolveExtraLoss;
    return { outbreak: null, populationLossFraction: 1 - keep, ended: 'selfResolved' };
  }
  return {
    outbreak: { ...outbreak, lastLossDay, cureConditionsSinceDay: cureSince },
    populationLossFraction: 1 - keep,
    ended: null,
  };
}
