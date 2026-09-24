/**
 * Informal settlements (S3-T9). Pure rules only: when they spawn, where, and how they become proper homes.
 * The caller gathers candidate tiles from the grid (it already loops over it) and applies the results.
 *
 * Handled as a system to solve, never as a joke: settlements appear because housing is short near jobs,
 * and the player fixes them by zoning plus services (formalisation).
 */
import type { Rng } from '@/lib/rng';
import type { RiverZone } from '@/games/isocity/maps/riverZones';

export const INFORMAL_CONFIG = {
  /** Spawn rule is checked once every this many in-game days. */
  checkIntervalDays: 7,
  /** Residential demand must be above this. */
  minResidentialDemand: 40,
  /** Housing is short when empty residential-zoned tiles < population × this. */
  emptyTilesPerPopulation: 0.02,
  /** MAX_SPAWNS_PER_WEEK. */
  maxSpawnsPerWeek: 3,
  /** Candidate must be within this many tiles (Chebyshev) of a commercial or industrial building. */
  maxDistanceToJobs: 6,
  /** Candidate must be within this many tiles (Chebyshev) of a road. */
  maxDistanceToRoad: 2,
  /** Never spawn on a tile the player bulldozed within this many in-game days. */
  bulldozeCooldownDays: 30,
  /** River zones settlements prefer (realistic, and it sets up flood risk in Sprint 4). */
  preferredZones: ['eastFloodplain', 'westRiverfront'] as readonly RiverZone[],
  /** Weight multiplier for a candidate in a preferred zone. */
  preferredZoneWeight: 4,
  /** Extra weight (0..this) for being closer to jobs: +bonus at distance 0, +0 at maxDistanceToJobs. */
  jobProximityBonus: 1,
  /** Days of continuous zoning + road + power + water needed to formalise. */
  formaliseDays: 30,
  /** What a formalised settlement becomes. */
  formalisedBuilding: 'house_small',
  /** Residents are those of this building type. */
  residentsLike: 'house_medium',
  /** Informal settlements pay no tax. */
  paysTax: false,
  /** Crime on the tile × this. */
  crimeMultiplier: 1.5,
  /** Fire chance × this. */
  fireChanceMultiplier: 2,
  /** Health lost on the tile if it has no water. */
  noWaterHealthPenalty: 10,
  /** Happiness gained city-wide when one is formalised (starting value). */
  formaliseHappinessBonus: 1,
  formaliseMessage: 'Families in {area} now have proper homes.',
  displacement: {
    /** City-wide happiness penalty when the player bulldozes a settlement. */
    happinessPenalty: 3,
    durationDays: 60,
    message: 'Families were displaced.',
  },
  tileInfoHint:
    'Zone this tile residential and give it road access, power and water for 30 days to turn it into proper homes.',
} as const;

export interface InformalSpawnCheck {
  /** Residential demand (−100..100 as in Stats.demand.residential). */
  residentialDemand: number;
  /** Simulation population. */
  population: number;
  /** Residential-zoned tiles with no building yet. */
  emptyResidentialTiles: number;
}

/** True when housing is short enough for settlements to appear this week. */
export function shouldSpawnInformal(input: InformalSpawnCheck): boolean {
  const c = INFORMAL_CONFIG;
  return (
    input.residentialDemand > c.minResidentialDemand &&
    input.emptyResidentialTiles < input.population * c.emptyTilesPerPopulation
  );
}

/** A tile the caller is considering for a settlement. */
export interface InformalCandidate {
  x: number;
  y: number;
  /** tile.building.type === 'grass' */
  isGrass: boolean;
  /** tile.zone === 'none' */
  isUnzoned: boolean;
  /** Chebyshev distance to the nearest commercial or industrial building (Infinity if none). */
  distanceToJobs: number;
  /** Chebyshev distance to the nearest road (Infinity if none). */
  distanceToRoad: number;
  /** Days since the player last bulldozed this tile; undefined if never. */
  daysSinceBulldozed?: number;
  /** From getRiverZone ('none' off the Varanasi map). */
  riverZone: RiverZone;
}

/** Every hard rule a candidate must pass. */
export function isInformalCandidate(c: InformalCandidate): boolean {
  const cfg = INFORMAL_CONFIG;
  if (!c.isGrass || !c.isUnzoned) return false;
  if (!(c.distanceToJobs <= cfg.maxDistanceToJobs)) return false;
  if (!(c.distanceToRoad <= cfg.maxDistanceToRoad)) return false;
  if (c.daysSinceBulldozed !== undefined && c.daysSinceBulldozed < cfg.bulldozeCooldownDays) return false;
  return true;
}

/** Selection weight: 0 for invalid tiles, higher for preferred river zones and tiles close to jobs. */
export function scoreInformalCandidate(c: InformalCandidate): number {
  if (!isInformalCandidate(c)) return 0;
  const cfg = INFORMAL_CONFIG;
  const zone = cfg.preferredZones.includes(c.riverZone) ? cfg.preferredZoneWeight : 1;
  const closeness = 1 - Math.max(0, c.distanceToJobs) / cfg.maxDistanceToJobs;
  return zone * (1 + cfg.jobProximityBonus * closeness);
}

/**
 * Picks up to `max` distinct tiles by weighted sampling without replacement (weights from scoreInformalCandidate).
 * Deterministic for a given rng sequence.
 */
export function pickInformalSpawnTiles(
  candidates: readonly InformalCandidate[],
  rng: Rng,
  max: number = INFORMAL_CONFIG.maxSpawnsPerWeek
): InformalCandidate[] {
  const pool: { c: InformalCandidate; w: number }[] = [];
  for (const c of candidates) {
    const w = scoreInformalCandidate(c);
    if (w > 0) pool.push({ c, w });
  }
  const picked: InformalCandidate[] = [];
  const limit = Math.max(0, Math.floor(max));
  while (picked.length < limit && pool.length > 0) {
    let total = 0;
    for (const p of pool) total += p.w;
    let r = rng() * total;
    let i = 0;
    for (; i < pool.length - 1; i++) {
      r -= pool[i].w;
      if (r < 0) break;
    }
    picked.push(pool[i].c);
    pool.splice(i, 1);
  }
  return picked;
}

/** What formalisation needs on the informal tile, checked once per in-game day. */
export interface FormalisationConditions {
  zonedResidential: boolean;
  hasRoadAccess: boolean;
  powered: boolean;
  watered: boolean;
}

export function isFormalisationSatisfied(c: FormalisationConditions): boolean {
  return c.zonedResidential && c.hasRoadAccess && c.powered && c.watered;
}

/**
 * Daily formalisation progress. The count must be continuous: a day without the conditions resets it to 0.
 * `formalise` becomes true on the day the count reaches formaliseDays (the caller then swaps in house_small).
 */
export function advanceFormalisation(daysSatisfied: number, satisfiedToday: boolean): { days: number; formalise: boolean } {
  if (!satisfiedToday) return { days: 0, formalise: false };
  const days = Math.max(0, daysSatisfied) + 1;
  return { days, formalise: days >= INFORMAL_CONFIG.formaliseDays };
}

/** "Families in Lanka now have proper homes." */
export function formatFormalisedMessage(area: string): string {
  return INFORMAL_CONFIG.formaliseMessage.replace('{area}', area);
}
