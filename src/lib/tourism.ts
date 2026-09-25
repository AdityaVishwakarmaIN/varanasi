/**
 * Tourism income from ghats (S2-T9). Pure functions; all numbers in TOURISM_CONFIG.
 *
 * ghatIncome = base × riverFactor × accessFactor × commerceBonus × clusterBonus
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
} as const;

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

/** Builds each ghat's context from the grid (only looks at small squares around ghats) and sums income per tick. */
export function calculateTourismIncome(
  grid: Tile[][],
  gridSize: number,
  ghats: readonly { x: number; y: number }[],
  gangaHealth: number,
  /** Season multiplier (S4-T3): fewer visitors in the monsoon, the peak after it. */
  seasonMultiplier = 1
): number {
  if (ghats.length === 0) return 0;
  const c = TOURISM_CONFIG;
  let total = 0;
  for (const g of ghats) {
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
    for (const o of ghats) {
      if (o === g) continue;
      if (Math.max(Math.abs(o.x - g.x), Math.abs(o.y - g.y)) <= c.clusterRadius) otherGhatsNearby++;
    }
    total += calculateGhatIncome({ gangaHealth, hasRoadAccess, commercialTilesNearby, otherGhatsNearby });
  }
  return total * Math.max(0, seasonMultiplier);
}
