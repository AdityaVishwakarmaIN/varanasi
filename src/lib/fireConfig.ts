import type { CloudWeatherMode } from '@/components/game/types';
import type { Building, BuildingType, Tile } from '@/games/isocity/types';

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
  spreadChancePerAdjacentFire: 0.005,
  maxCoverageSpreadReduction: 0.95,
  randomIgnitionChance: 0.00003,
} as const;

export const FIRE_RESPONSE_CONFIG = {
  fireTruckSpeed: 0.8,
  /** Per-station cap on simultaneously active fire trucks */
  maxTrucksPerStation: 5,
} as const;

export const FIRE_WEATHER_MULTIPLIERS: Record<CloudWeatherMode, number> = {
  clear: 1,
  light_clouds: 2,
  storm: 5,
  severe_storm: 12,
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
  return !FIRE_IMMUNE_BUILDING_TYPES.has(type);
}


export function getFireSpreadChance(
  adjacentFireCount: number,
  fireCoverage: number,
  cloudWeatherMode: CloudWeatherMode = 'clear'
): number {
  if (adjacentFireCount <= 0) return 0;

  const coverageReduction = fireCoverage / 100;
  const baseSpreadChance =
    FIRE_SIMULATION_CONFIG.spreadChancePerAdjacentFire * adjacentFireCount;
  const weatherMultiplier = FIRE_WEATHER_MULTIPLIERS[cloudWeatherMode];
  const spreadChance =
    baseSpreadChance *
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
  let adjacentFireCount = 0;

  for (const [dx, dy] of FIRE_ADJACENT_OFFSETS) {
    const nx = x + dx;
    const ny = y + dy;

    if (nx < 0 || nx >= gridSize || ny < 0 || ny >= gridSize) continue;
    if (grid[ny][nx].building.onFire) {
      adjacentFireCount++;
    }
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
