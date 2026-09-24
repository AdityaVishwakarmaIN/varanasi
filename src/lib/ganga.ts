/**
 * Gathers Ganga Health inputs from the grid (S2-T7). Pure: grid in, numbers out.
 *
 * Only the cached catchment (tiles within `catchmentRadius` of the Ganga) is visited,
 * never the whole map.
 */
import type { BuildingType } from '@/games/isocity/types/buildings';
import type { Tile } from '@/games/isocity/types/game';
import { getGangaCatchment, getRiverZone, getRiverZoneArrays } from '@/games/isocity/maps/riverZones';
import type { MapId } from '@/games/isocity/maps/varanasi';
import { SCORING_CONFIG, type GangaLoadInput } from '@/lib/scoring';

const GANGA = SCORING_CONFIG.ganga;

/** Tiles that count as riverside greenery. */
export const GANGA_GREEN_TYPES: ReadonlySet<BuildingType> = new Set<BuildingType>([
  'tree',
  'park',
  'park_large',
  'community_garden',
  'pond_park',
  'greenhouse_garden',
]);

/** River-zone codes from riverZones (westRiverfront = 2, eastFloodplain = 4). */
const RIVERSIDE_ZONE_CODES = new Set([2, 4]);

export interface GangaInputs extends GangaLoadInput {
  /** All sewage-producing population in the catchment (treated + untreated). */
  catchmentPopulation: number;
  treatedPopulation: number;
}

/** A Sewage Treatment Plant treats sewage only when built, powered and not abandoned. */
export function isWorkingStp(tile: Tile): boolean {
  const b = tile.building;
  return b.type === 'sewage_treatment_plant' && b.powered && !b.abandoned && b.constructionProgress >= 100;
}

function producesSewage(tile: Tile): boolean {
  return (tile.zone === 'residential' || tile.zone === 'commercial') && tile.building.population > 0;
}

/**
 * @param stps origin tiles of every Sewage Treatment Plant (the caller collects these while it
 *   already loops over the grid, so this function never scans the whole map).
 */
export function gatherGangaInputs(grid: Tile[][], gridSize: number, stps: readonly { x: number; y: number }[]): GangaInputs {
  const catchment = getGangaCatchment(gridSize, GANGA.catchmentRadius);
  const { zone } = getRiverZoneArrays(gridSize);
  let catchmentPollution = 0;
  let riversideGreenTiles = 0;
  let catchmentPopulation = 0;

  // Remaining untreated population per catchment entry.
  const remaining = new Float64Array(catchment.length);
  for (let i = 0; i < catchment.length; i++) {
    const idx = catchment[i];
    const x = idx % gridSize;
    const y = (idx / gridSize) | 0;
    const tile = grid[y]?.[x];
    if (!tile || tile.building.type === 'water') continue;
    catchmentPollution += tile.pollution;
    if (GANGA_GREEN_TYPES.has(tile.building.type) && RIVERSIDE_ZONE_CODES.has(zone[idx])) riversideGreenTiles++;
    if (producesSewage(tile)) {
      remaining[i] = tile.building.population;
      catchmentPopulation += tile.building.population;
    }
  }

  let treatedPopulation = 0;
  const r2 = GANGA.stpRadius * GANGA.stpRadius;
  for (const stp of stps) {
    const tile = grid[stp.y]?.[stp.x];
    if (!tile || !isWorkingStp(tile)) continue;
    let capacity = GANGA.stpCapacity;
    for (let i = 0; i < catchment.length && capacity > 0; i++) {
      if (remaining[i] <= 0) continue;
      const idx = catchment[i];
      const dx = (idx % gridSize) - stp.x;
      const dy = ((idx / gridSize) | 0) - stp.y;
      if (dx * dx + dy * dy > r2) continue;
      const treated = Math.min(remaining[i], capacity);
      remaining[i] -= treated;
      capacity -= treated;
      treatedPopulation += treated;
    }
  }

  return {
    catchmentPollution,
    untreatedPopulation: catchmentPopulation - treatedPopulation,
    riversideGreenTiles,
    catchmentPopulation,
    treatedPopulation,
  };
}

/** Riverfront building numbers that are not scores (S2-T5 / S2-T6). */
export const RIVERFRONT_CONFIG = {
  /** Monthly upkeep of each Sewage Treatment Plant, charged to the water budget line. */
  stpUpkeepMonthly: 60,
} as const;

/**
 * Ghat placement rule (S2-T5): only on the Ganga's west riverfront, with water on an edge the sprite can face.
 * Sprites can face grid +x (default) or +y (flipped, mirrored). Returns null when a ghat can't go here.
 */
export function getGhatPlacement(
  grid: Tile[][],
  x: number,
  y: number,
  gridSize: number,
  mapId: MapId | undefined
): { flipped: boolean } | null {
  if (getRiverZone(x, y, gridSize, mapId) !== 'westRiverfront') return null;
  const isWater = (tx: number, ty: number) => grid[ty]?.[tx]?.building.type === 'water';
  const waterEast = isWater(x + 1, y);
  const waterSouth = isWater(x, y + 1);
  if (!waterEast && !waterSouth && !isWater(x - 1, y) && !isWater(x, y - 1)) return null;
  return { flipped: !waterEast && waterSouth };
}

/** Per-tile effect on the Ganga, for the Ganga overlay and tile info (S2-T8). */
export const GANGA_TILE_EFFECT = { neutral: 0, hurts: 1, cleans: 2 } as const;

export interface GangaTileEffects {
  /** Per tile (index y * gridSize + x): one of GANGA_TILE_EFFECT. Only catchment land tiles are non-neutral. */
  effect: Uint8Array;
  /** Per tile: population whose sewage is treated by an STP. */
  treated: Float32Array;
}

/**
 * Which catchment tiles hurt the river (pollution or untreated sewage) and which clean it
 * (riverside greenery, or homes whose sewage is fully treated). Same rules as gatherGangaInputs.
 */
export function computeGangaTileEffects(
  grid: Tile[][],
  gridSize: number,
  stps: readonly { x: number; y: number }[]
): GangaTileEffects {
  const catchment = getGangaCatchment(gridSize, GANGA.catchmentRadius);
  const { zone } = getRiverZoneArrays(gridSize);
  const effect = new Uint8Array(gridSize * gridSize);
  const treatedOut = new Float32Array(gridSize * gridSize);
  const remaining = new Float64Array(catchment.length);
  for (let i = 0; i < catchment.length; i++) {
    const idx = catchment[i];
    const tile = grid[(idx / gridSize) | 0]?.[idx % gridSize];
    if (tile && tile.building.type !== 'water' && producesSewage(tile)) remaining[i] = tile.building.population;
  }
  const r2 = GANGA.stpRadius * GANGA.stpRadius;
  for (const stp of stps) {
    const tile = grid[stp.y]?.[stp.x];
    if (!tile || !isWorkingStp(tile)) continue;
    let capacity = GANGA.stpCapacity;
    for (let i = 0; i < catchment.length && capacity > 0; i++) {
      if (remaining[i] <= 0) continue;
      const idx = catchment[i];
      const dx = (idx % gridSize) - stp.x;
      const dy = ((idx / gridSize) | 0) - stp.y;
      if (dx * dx + dy * dy > r2) continue;
      const treated = Math.min(remaining[i], capacity);
      remaining[i] -= treated;
      capacity -= treated;
      treatedOut[idx] += treated;
    }
  }
  for (let i = 0; i < catchment.length; i++) {
    const idx = catchment[i];
    const tile = grid[(idx / gridSize) | 0]?.[idx % gridSize];
    if (!tile || tile.building.type === 'water') continue;
    if (tile.pollution > 0 || remaining[i] > 0) effect[idx] = GANGA_TILE_EFFECT.hurts;
    else if (treatedOut[idx] > 0 || (GANGA_GREEN_TYPES.has(tile.building.type) && RIVERSIDE_ZONE_CODES.has(zone[idx]))) {
      effect[idx] = GANGA_TILE_EFFECT.cleans;
    }
  }
  return { effect, treated: treatedOut };
}

/** River colour for Ganga Health: 0 = brown, 50 = murky green, 100 = clean blue. */
export function getGangaRiverColor(gangaHealth: number, alpha = 0.55): string {
  const stops = [
    { h: 0, c: [0x6b, 0x4f, 0x2a] },
    { h: 50, c: [0x5f, 0x7f, 0x5a] },
    { h: 100, c: [0x3a, 0x7b, 0xd5] },
  ];
  const h = Math.min(100, Math.max(0, gangaHealth));
  const [a, b] = h <= 50 ? [stops[0], stops[1]] : [stops[1], stops[2]];
  const t = (h - a.h) / (b.h - a.h);
  const mix = a.c.map((v, i) => Math.round(v + (b.c[i] - v) * t));
  return `rgba(${mix[0]}, ${mix[1]}, ${mix[2]}, ${alpha})`;
}
