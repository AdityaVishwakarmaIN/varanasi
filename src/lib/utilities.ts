/**
 * Power and water capacity, and rolling cuts (S3-T7, S3-T8). Pure functions; every tunable in POWER_CONFIG / WATER_CONFIG.
 *
 * Model (see documentation/game-plan/sprint-3-indian-city-life.md):
 *   supply = Σ working plants of capacity × (1 + levelBonus × (level − 1))
 *   demand = (population × residentWeight + jobs × jobWeight) × seasonMultiplier
 *   ratio  = min(1, supply / demand)
 *
 * When ratio < 1, round((1 − ratio) × n) of the n feeder zones that have demand are cut each in-game hour,
 * chosen by a rotation so every neighbourhood takes its fair turn (see `getCutFeeders`).
 *
 * Feeder zones themselves (16×16 blocks) live in `src/lib/feederZones.ts`; this module only takes feeder
 * indices as inputs, so it has no dependency on how they are computed.
 */

export const POWER_CONFIG = {
  /** Power one level-1 Thermal Power Station supplies. */
  plantCapacity: 5000,
  /** Extra capacity per level above 1 (level 5 = +80%). */
  levelBonus: 0.2,
  /** Demand per resident. */
  residentWeight: 1,
  /** Demand per job. */
  jobWeight: 0.5,
  /** Top-bar power icon turns amber below this supply ratio. */
  amberBelow: 1,
  /** Top-bar power icon turns red below this supply ratio. */
  redBelow: 0.8,
  /** Commercial income from a tile is multiplied by this while the tile is cut. */
  cutCommercialIncomeFactor: 0.5,
  /** Happiness points lost on a tile while it is cut (starting value; the doc only says "happiness −"). */
  cutHappinessPenalty: 5,
  /** Advisor message the first time the ratio drops below 1. */
  advisorMessage:
    'Demand is higher than supply. Neighbourhoods are taking turns without power. Build another power station.',
} as const;

export const WATER_CONFIG = {
  /** Water one level-1 Overhead Water Tank (`water_tower`) supplies. */
  tankCapacity: 1500,
  /** Extra tank capacity per level above 1. Mirrors POWER_CONFIG.levelBonus so upgrades are worth the same (starting value). */
  levelBonus: 0.2,
  /** Jal Sansthan Water Works capacity with a perfectly clean Ganga. */
  worksBaseCapacity: 12000,
  /** Fraction of worksBaseCapacity the works deliver at Ganga Health 0 (dirtier river = costlier treatment). */
  worksMinFactor: 0.6,
  /** The works must be within this many tiles of the Ganga. */
  worksMaxDistanceToGanga: 3,
  /** Jal Sansthan Water Works: size (tiles) and cost (₹). */
  worksSize: 3,
  worksCost: 6000,
  /** Demand per resident. */
  residentWeight: 1,
  amberBelow: 1,
  redBelow: 0.8,
  /** Health lost on a tile without water. */
  noWaterHealthPenalty: 10,
  /** Happiness points lost on a tile while its taps are dry (starting value). */
  cutHappinessPenalty: 5,
  advisorMessage:
    'Taps are running dry in some neighbourhoods. Add water tanks, or build a Jal Sansthan Water Works by the Ganga.',
  /** Red placement reason for the works. */
  worksPlacementReason: 'Jal Sansthan Water Works must be within 3 tiles of the Ganga',
} as const;

/** One power plant or water tank as seen by the capacity model. */
export interface UtilityBuilding {
  level: number;
  /** Built, not abandoned, not on fire, and (for tanks and works) powered. The caller decides. */
  working: boolean;
}

function levelFactor(level: number, bonus: number): number {
  return 1 + bonus * (Math.max(1, level) - 1);
}

/** Total power supply of the given plants. Non-working plants add nothing. */
export function calculatePowerSupply(plants: readonly UtilityBuilding[]): number {
  let total = 0;
  for (const p of plants) {
    if (p.working) total += POWER_CONFIG.plantCapacity * levelFactor(p.level, POWER_CONFIG.levelBonus);
  }
  return total;
}

/**
 * Power demand of the covered city.
 * @param population residents inside power coverage
 * @param jobs jobs inside power coverage
 * @param seasonMultiplier 1.0 until Sprint 4 (1.3 in summer)
 */
export function calculatePowerDemand(population: number, jobs: number, seasonMultiplier = 1): number {
  const base = Math.max(0, population) * POWER_CONFIG.residentWeight + Math.max(0, jobs) * POWER_CONFIG.jobWeight;
  return base * Math.max(0, seasonMultiplier);
}

/** Capacity of one working Jal Sansthan Water Works: 12000 × (0.6 + 0.4 × gangaHealth / 100). Health is clamped to 0–100. */
export function calculateWaterWorksCapacity(gangaHealth: number): number {
  const h = Math.min(100, Math.max(0, Number.isFinite(gangaHealth) ? gangaHealth : 0)) / 100;
  const minF = WATER_CONFIG.worksMinFactor;
  return WATER_CONFIG.worksBaseCapacity * (minF + (1 - minF) * h);
}

/**
 * Total water supply.
 * @param tanks every Overhead Water Tank
 * @param works every Jal Sansthan Water Works (level is ignored; capacity follows Ganga Health)
 * @param gangaHealth 0–100 (only matters when works exist)
 */
export function calculateWaterSupply(
  tanks: readonly UtilityBuilding[],
  works: readonly { working: boolean }[] = [],
  gangaHealth = 100
): number {
  let total = 0;
  for (const t of tanks) {
    if (t.working) total += WATER_CONFIG.tankCapacity * levelFactor(t.level, WATER_CONFIG.levelBonus);
  }
  const worksCapacity = calculateWaterWorksCapacity(gangaHealth);
  for (const w of works) if (w.working) total += worksCapacity;
  return total;
}

/** Water demand: population × residentWeight × seasonMultiplier. */
export function calculateWaterDemand(population: number, seasonMultiplier = 1): number {
  return Math.max(0, population) * WATER_CONFIG.residentWeight * Math.max(0, seasonMultiplier);
}

/** min(1, supply / demand), in [0, 1]. No demand means fully supplied (1). */
export function supplyRatio(supply: number, demand: number): number {
  if (!(demand > 0)) return 1;
  return Math.min(1, Math.max(0, supply / demand));
}

export type SupplyStatus = 'ok' | 'amber' | 'red';

/** Colour of the top-bar power/water icon for a supply ratio. */
export function getSupplyStatus(ratio: number, config: { amberBelow: number; redBelow: number } = POWER_CONFIG): SupplyStatus {
  if (ratio < config.redBelow) return 'red';
  if (ratio < config.amberBelow) return 'amber';
  return 'ok';
}

/** How many of `feedersWithDemand` feeders are cut at this ratio: round((1 − ratio) × n), clamped to [0, n]. */
export function getCutCount(ratio: number, feedersWithDemand: number): number {
  if (!(ratio < 1) || feedersWithDemand <= 0) return 0;
  const r = Math.max(0, ratio);
  return Math.min(feedersWithDemand, Math.max(0, Math.round((1 - r) * feedersWithDemand)));
}

/**
 * A monotonic in-game hour counter (30-day months, 12-month years) to pass to `getCutFeeders`.
 * Passing an absolute counter instead of hour-of-day keeps the rotation fair across midnight.
 */
export function toAbsoluteHour(t: { year: number; month: number; day: number; hour: number }): number {
  return ((t.year * 12 + (t.month - 1)) * 30 + (t.day - 1)) * 24 + t.hour;
}

/**
 * Which feeders are cut this hour.
 *
 * The feeders with demand are sorted and treated as a ring of n slots. Hour h cuts the k = getCutCount(ratio, n)
 * consecutive slots starting at (h × k) mod n, so hour h + 1 continues exactly where hour h stopped.
 * Over any run of H consecutive hours (with the same n and k) the cut windows cover one contiguous stretch of
 * H × k slots around the ring, so every feeder is cut either floor(H·k/n) or ceil(H·k/n) times:
 * the most-cut and least-cut feeders differ by at most 1 hour. This is a round-robin (index + hour rotation).
 *
 * @param ratio supply ratio from `supplyRatio`
 * @param feedersWithDemand feeder indices that have any demand (order and duplicates do not matter)
 * @param hour an in-game hour counter; use `toAbsoluteHour` for fairness across days
 */
export function getCutFeeders(ratio: number, feedersWithDemand: readonly number[], hour: number): Set<number> {
  const sorted = Array.from(new Set(feedersWithDemand)).sort((a, b) => a - b);
  const n = sorted.length;
  const k = getCutCount(ratio, n);
  const cut = new Set<number>();
  if (k === 0) return cut;
  const h = Math.floor(Number.isFinite(hour) ? hour : 0);
  const start = (((h % n) * k) % n + n) % n;
  for (let i = 0; i < k; i++) cut.add(sorted[(start + i) % n]);
  return cut;
}

/**
 * The same cut set as a mask indexed by feeder index (1 = cut), for the per-hour cut array that sits on top of
 * the cached coverage (S3-T7 step 2).
 */
export function getCutMask(ratio: number, feedersWithDemand: readonly number[], hour: number, feederCount: number): Uint8Array {
  const mask = new Uint8Array(Math.max(0, feederCount));
  for (const f of getCutFeeders(ratio, feedersWithDemand, hour)) {
    if (f >= 0 && f < mask.length) mask[f] = 1;
  }
  return mask;
}

/** True when a Jal Sansthan Water Works may go on a site whose nearest tile is `minDistanceToGanga` from the river. */
export function isWaterWorksSiteValid(minDistanceToGanga: number): boolean {
  return minDistanceToGanga >= 1 && minDistanceToGanga <= WATER_CONFIG.worksMaxDistanceToGanga;
}
