/**
 * Gathers Ganga Health inputs from the grid (S2-T7). Pure: grid in, numbers out.
 *
 * Only the cached catchment (tiles within `catchmentRadius` of the Ganga) is visited,
 * never the whole map.
 */
import type { BuildingType } from '@/games/isocity/types/buildings';
import type { Tile } from '@/games/isocity/types/game';
import { getGangaCatchment, getRiverZoneArrays } from '@/games/isocity/maps/riverZones';
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
