import type { CloudWeatherMode } from '@/components/game/types';
import type { Building, BuildingType, Tile } from '@/games/isocity/types';
import { isLandmarkType } from '@/lib/landmarks';

export type FirePosition = {
  x: number;
  y: number;
};

export const DEFAULT_FIRE_STATE: Pick<Building, 'onFire' | 'fireProgress'> = {
  onFire: false,
  fireProgress: 0,
};

export const FIRE_SIMULATION_CONFIG = {
  fireProgressPerTick: 1,
  destructionThreshold: 100,
  spreadChancePerAdjacentFire: 0.0135,
  maxCoverageSpreadReduction: 0.95,
  randomIgnitionChance: 0.00003,
} as const;

/** How long a burned lot stays scorched (ticks, 30 per day) before the zone can build on it again. */
export const SCORCH_TICKS = 60;
/** Simultaneous fires that count as a blaze out of control (a crisis notification). */
export const FIRE_BLAZE_THRESHOLD = 8;

/**
 * Fuel by building type: how easily a building catches fire from a burning neighbour (1 = baseline).
 * Timber and informal housing burn fast; concrete towers and civic buildings resist.
 */
const FIRE_FUEL: Partial<Record<BuildingType, number>> = {
  informal_housing: 2,
  house_small: 1.4,
  house_medium: 1.3,
  shop_small: 1.2,
  animal_pens_farm: 1.3,
  factory_small: 1.4,
  warehouse: 1.5,
  apartment_low: 0.9,
  apartment_high: 0.6,
  office_low: 0.8,
  office_high: 0.5,
  mall: 0.7,
  hospital: 0.4,
  school: 0.5,
  university: 0.5,
  police_station: 0.4,
  fire_station: 0.3,
};

export function getFireFuelFactor(type: BuildingType): number {
  return FIRE_FUEL[type] ?? 1;
}

/** Fire coverage scales with budget funding: an under-funded brigade covers less ground (100% funding = 1). */
export function getFireFundingFactor(funding: number | undefined): number {
  if (funding === undefined) return 1;
  return 0.25 + 0.75 * Math.max(0, Math.min(100, funding)) / 100;
}

/** Stage of a burn by progress: ignition smoulders, growth and peak throw sparks, burnout fades. */
export function getBurnStageSpread(fireProgress: number): number {
  if (fireProgress < 15) return 0.3;
  if (fireProgress < 40) return 1;
  if (fireProgress < 75) return 1.6;
  return 0.5;
}

export function getBurnStageName(fireProgress: number): string {
  if (fireProgress < 15) return 'igniting';
  if (fireProgress < 40) return 'growing';
  if (fireProgress < 75) return 'at its peak';
  return 'burning out';
}

/** Wind pushes fire downwind. Grid-space unit vector of the visible wind (see windRenderer). */
export const FIRE_WIND_DIRECTION = { x: 0.255, y: -0.967 } as const;
export const FIRE_WIND_STRENGTH: Record<CloudWeatherMode, number> = {
  clear: 0.25,
  light_clouds: 0.3,
  storm: 0.6,
  severe_storm: 0.9,
  fog: 0.05,
  heat_haze: 0.2,
};

/**
 * Weighted fire pressure on a tile: each burning orthogonal neighbour counts by its burn stage and by
 * whether the wind blows from it toward this tile. Allocation-free; it runs for tiles next to fire.
 */
export function getFirePressure(
  grid: Tile[][],
  gridSize: number,
  x: number,
  y: number,
  windStrength: number
): number {
  const k = 2 * windStrength;
  const wx = FIRE_WIND_DIRECTION.x * k;
  const wy = FIRE_WIND_DIRECTION.y * k;
  let sum = 0;
  if (y >= 0 && y < gridSize) {
    const row = grid[y];
    if (x - 1 >= 0 && x - 1 < gridSize && row[x - 1].building.onFire) {
      sum += Math.max(0.2, 1 + wx) * getBurnStageSpread(row[x - 1].building.fireProgress);
    }
    if (x + 1 >= 0 && x + 1 < gridSize && row[x + 1].building.onFire) {
      sum += Math.max(0.2, 1 - wx) * getBurnStageSpread(row[x + 1].building.fireProgress);
    }
  }
  if (x >= 0 && x < gridSize) {
    // A fire to the north (y - 1) spreads south: direction (0, +1)
    if (y - 1 >= 0 && y - 1 < gridSize && grid[y - 1][x].building.onFire) {
      sum += Math.max(0.2, 1 + wy) * getBurnStageSpread(grid[y - 1][x].building.fireProgress);
    }
    if (y + 1 >= 0 && y + 1 < gridSize && grid[y + 1][x].building.onFire) {
      sum += Math.max(0.2, 1 - wy) * getBurnStageSpread(grid[y + 1][x].building.fireProgress);
    }
  }
  return sum;
}

export const FIRE_RESPONSE_CONFIG = {
  fireTruckSpeed: 0.8,
  /** Per-station cap on simultaneously active fire trucks */
  maxTrucksPerStation: 5,
} as const;

export const FIRE_WEATHER_MULTIPLIERS: Record<CloudWeatherMode, number> = {
  clear: 1,
  light_clouds: 2,
  storm: 2.2,
  severe_storm: 3.5,
  /** Damp winter air (S4-T2). */
  fog: 0.8,
  /** Hot, dry summer air: fires start and spread more easily (S4-T2). */
  heat_haze: 1.5,
};

export const FIRE_ADJACENT_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

const FIRE_IMMUNE_BUILDING_TYPES = new Set<BuildingType>([
  'grass',
  'water',
  'road',
  'tree',
  'empty',
  'bridge',
  'rail',
]);

export function createDefaultFireState(): Pick<Building, 'onFire' | 'fireProgress'> {
  return { ...DEFAULT_FIRE_STATE };
}

export function resetBuildingFireState(building: Pick<Building, 'onFire' | 'fireProgress'>): void {
  building.onFire = DEFAULT_FIRE_STATE.onFire;
  building.fireProgress = DEFAULT_FIRE_STATE.fireProgress;
}

export function igniteBuilding(building: Pick<Building, 'onFire' | 'fireProgress'>): void {
  building.onFire = true;
  building.fireProgress = 0;
}

export function isBuildingFireEligible(type: BuildingType): boolean {
  // Landmarks never catch fire (S5-T1)
  return !FIRE_IMMUNE_BUILDING_TYPES.has(type) && !isLandmarkType(type);
}


export function getFireSpreadChance(
  adjacentFireCount: number,
  fireCoverage: number,
  cloudWeatherMode: CloudWeatherMode = 'clear',
  fuelFactor = 1
): number {
  if (adjacentFireCount <= 0) return 0;

  const coverageReduction = fireCoverage / 100;
  const baseSpreadChance =
    FIRE_SIMULATION_CONFIG.spreadChancePerAdjacentFire * adjacentFireCount;
  const weatherMultiplier = FIRE_WEATHER_MULTIPLIERS[cloudWeatherMode];
  const spreadChance =
    baseSpreadChance *
    fuelFactor *
    weatherMultiplier *
    (1 - coverageReduction * FIRE_SIMULATION_CONFIG.maxCoverageSpreadReduction);

  return Math.max(0, Math.min(1, spreadChance));
}

export function getRandomFireIgnitionChance(
  type: BuildingType,
  cloudWeatherMode: CloudWeatherMode = 'clear'
): number {
  if (!isBuildingFireEligible(type)) return 0;

  const ignitionChance =
    FIRE_SIMULATION_CONFIG.randomIgnitionChance *
    FIRE_WEATHER_MULTIPLIERS[cloudWeatherMode];

  return Math.max(0, Math.min(1, ignitionChance));
}

export function hasFireDestroyedBuilding(fireProgress: number): boolean {
  return fireProgress >= FIRE_SIMULATION_CONFIG.destructionThreshold;
}

export function countAdjacentBurningTiles(
  grid: Tile[][],
  gridSize: number,
  x: number,
  y: number
): number {
  // Same neighbours as FIRE_ADJACENT_OFFSETS, written out: this runs for most tiles on every tick.
  // Rows are only read when y is inside the grid, matching the bounds check of the offset loop.
  let adjacentFireCount = 0;
  if (y >= 0 && y < gridSize) {
    const row = grid[y];
    if (x - 1 >= 0 && x - 1 < gridSize && row[x - 1].building.onFire) adjacentFireCount++;
    if (x + 1 >= 0 && x + 1 < gridSize && row[x + 1].building.onFire) adjacentFireCount++;
  }
  if (x >= 0 && x < gridSize) {
    if (y - 1 >= 0 && y - 1 < gridSize && grid[y - 1][x].building.onFire) adjacentFireCount++;
    if (y + 1 >= 0 && y + 1 < gridSize && grid[y + 1][x].building.onFire) adjacentFireCount++;
  }

  return adjacentFireCount;
}

export function getFireIncidentKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function findNearestFireStation(
  fire: FirePosition,
  stations: FirePosition[]
): FirePosition | null {
  let nearestStation: FirePosition | null = null;
  let nearestDistance = Infinity;

  for (const station of stations) {
    const distance = Math.abs(station.x - fire.x) + Math.abs(station.y - fire.y);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestStation = station;
    }
  }

  return nearestStation;
}
