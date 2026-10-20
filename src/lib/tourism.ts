/**
 * Tourism income from ghats (S2-T9). Pure functions; all numbers in TOURISM_CONFIG.
 *
 * ghatIncome = base × riverFactor × accessFactor × commerceBonus × clusterBonus
 *
 * Ghats share one visitor pool (balance pass): the city's population and landmarks draw a limited number of
 * visitors, so past `visitorPoolCapacity` ghats each extra ghat splits the same crowd. Every ghat also has a
 * monthly upkeep (GHAT_UPKEEP_MONTHLY, charged to the Parks budget line), so spamming ghats stops paying.
 */
import type { Tile } from '@/games/isocity/types/game';

export const TOURISM_CONFIG = {
  /**
   * ₹ per month per ghat before multipliers. S2-T11 balance pass: at 12, a healthy mid-game city
   * (1 lakh people, Ganga 70, 20 ghats in rows) earned ~2% of its income from tourism. 130 puts
   * it at ~18–21% (target 15–25%); see the design-target test in tourism.test.ts.
   */
  ghatBaseIncome: 130,
  /** riverFactor = (gangaHealth / 100) ^ riverExponent: a dirty river drives visitors away fast. */
  riverExponent: 1.5,
  /** A road within this many tiles counts as access. */
  roadAccessRadius: 3,
  /** Multiplier for a ghat with no road nearby. */
  noAccessFactor: 0.25,
  commerceRadius: 4,
  commerceBonusPerTile: 0.08,
  commerceBonusCap: 1.8,
  clusterRadius: 3,
  clusterBonusPerGhat: 0.05,
  clusterBonusCap: 1.5,
  /** Visitor pool: this many ghats are always fully visited... */
  poolBaseGhats: 4,
  /** ...plus one per this many residents (simulation units; 1 lakh displayed = 10,000 here → 25 more)... */
  poolResidentsPerGhat: 400,
  /** ...plus this many per finished landmark (pilgrims come for the temples and stay for the river). */
  poolGhatsPerLandmark: 6,
  /** Past the pool, each ghat earns (pool / ghats) ^ poolExponent of its full income (1 = the same crowd split)... */
  poolExponent: 1,
  /** ...but never less than this share, so a road-side ghat on a healthy river (Ganga ≥ 70) still covers its upkeep. */
  poolMinFactor: 0.4,
} as const;

/** ₹ per month each ghat costs to keep up (Parks budget line). */
export const GHAT_UPKEEP_MONTHLY = 30;

/** City-wide inputs for the shared visitor pool. */
export interface VisitorPoolContext {
  /** Simulation population (not the displayed one). */
  population: number;
  /** Finished landmarks. */
  landmarkCount: number;
}

/** How many ghats the city's visitors can fill. */
export function visitorPoolCapacity(pool: VisitorPoolContext): number {
  const c = TOURISM_CONFIG;
  return c.poolBaseGhats + Math.max(0, pool.population) / c.poolResidentsPerGhat + c.poolGhatsPerLandmark * Math.max(0, pool.landmarkCount);
}

/** Share of its full income each of `ghatCount` ghats earns (1 within the pool, falling past it, floored). */
export function visitorPoolFactor(ghatCount: number, pool: VisitorPoolContext): number {
  const c = TOURISM_CONFIG;
  const capacity = visitorPoolCapacity(pool);
  if (ghatCount <= capacity) return 1;
  return Math.max(c.poolMinFactor, Math.pow(capacity / ghatCount, c.poolExponent));
}

export interface GhatContext {
  gangaHealth: number;
  hasRoadAccess: boolean;
  commercialTilesNearby: number;
  otherGhatsNearby: number;
}

export function riverFactor(gangaHealth: number): number {
  const h = Math.min(100, Math.max(0, gangaHealth)) / 100;
  return Math.pow(h, TOURISM_CONFIG.riverExponent);
}

export function calculateGhatIncome(ctx: GhatContext): number {
  const c = TOURISM_CONFIG;
  const access = ctx.hasRoadAccess ? 1 : c.noAccessFactor;
  const commerce = Math.min(c.commerceBonusCap, 1 + c.commerceBonusPerTile * Math.max(0, ctx.commercialTilesNearby));
  const cluster = Math.min(c.clusterBonusCap, 1 + c.clusterBonusPerGhat * Math.max(0, ctx.otherGhatsNearby));
  return c.ghatBaseIncome * riverFactor(ctx.gangaHealth) * access * commerce * cluster;
}

function isRoad(tile: Tile | undefined): boolean {
  return !!tile && (tile.building.type === 'road' || tile.building.type === 'bridge');
}

/**
 * Builds each ghat's context from the grid (only looks at small squares around ghats) and sums the monthly income.
 * With `pool`, the player's ghats share the visitor pool (see visitorPoolFactor); `extraGhats` (landmark ghat
 * positions, e.g. Dashashwamedh) earn and cluster like ghats but neither count toward nor shrink with the pool.
 */
export function calculateTourismIncome(
  grid: Tile[][],
  gridSize: number,
  ghats: readonly { x: number; y: number }[],
  gangaHealth: number,
  /** Season multiplier (S4-T3): fewer visitors in the monsoon, the peak after it. */
  seasonMultiplier = 1,
  pool?: VisitorPoolContext,
  extraGhats: readonly { x: number; y: number }[] = []
): number {
  const all = extraGhats.length > 0 ? [...ghats, ...extraGhats] : ghats;
  if (all.length === 0) return 0;
  const c = TOURISM_CONFIG;
  const poolFactor = pool ? visitorPoolFactor(ghats.length, pool) : 1;
  let total = 0;
  for (let i = 0; i < all.length; i++) {
    const g = all[i];
    let hasRoadAccess = false;
    let commercialTilesNearby = 0;
    const r = Math.max(c.roadAccessRadius, c.commerceRadius);
    for (let y = Math.max(0, g.y - r); y <= Math.min(gridSize - 1, g.y + r); y++) {
      for (let x = Math.max(0, g.x - r); x <= Math.min(gridSize - 1, g.x + r); x++) {
        const d = Math.max(Math.abs(x - g.x), Math.abs(y - g.y));
        const tile = grid[y][x];
        if (d <= c.roadAccessRadius && isRoad(tile)) hasRoadAccess = true;
        if (d <= c.commerceRadius && tile.zone === 'commercial' && tile.building.population + tile.building.jobs > 0) {
          commercialTilesNearby++;
        }
      }
    }
    let otherGhatsNearby = 0;
    for (const o of all) {
      if (o === g) continue;
      if (Math.max(Math.abs(o.x - g.x), Math.abs(o.y - g.y)) <= c.clusterRadius) otherGhatsNearby++;
    }
    const income = calculateGhatIncome({ gangaHealth, hasRoadAccess, commercialTilesNearby, otherGhatsNearby });
    total += i < ghats.length ? income * poolFactor : income;
  }
  return total * Math.max(0, seasonMultiplier);
}
