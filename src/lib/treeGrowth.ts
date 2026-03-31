// Tree auto-growth mechanics with weather-based probabilities

import type { CloudWeatherMode } from '@/components/game/types';
import type { Building, BuildingType, Tile } from '@/types/game';

// Tree growth probability per tick by weather mode
export const TREE_GROWTH_CONFIG: Record<CloudWeatherMode, number> = {
  clear: 0,        // No tree growth in clear weather
  light_clouds: 0.00002,  // 0.002% chance per tick
  storm: 0.00008,     // 0.008% chance per tick
  severe_storm: 0.0004,   // 0.04% chance per tick
};

/**
 * Attempts to grow a tree on a grass tile based on weather probability.
 * @param tile - The tile to potentially grow a tree on (must be grass type)
 * @param growthChance - Pre-calculated probability for current weather (0 = skip)
 * @returns true if a tree was grown, false otherwise
 */
export function tryGrowTree(tile: Tile, growthChance: number): boolean {
  // Only grow on grass tiles
  if (tile.building.type !== 'grass') {
    return false;
  }

  // No growth when chance is 0 (skip Math.random() call)
  if (growthChance <= 0) {
    return false;
  }

  // Attempt growth based on probability
  if (Math.random() < growthChance) {
    tile.building = createTreeBuilding();
    return true;
  }

  return false;
}

/**
 * Creates a tree building instance.
 * Matches the Building interface structure from simulation.ts
 */
function createTreeBuilding(): Building {
  return {
    type: 'tree',
    level: 0,
    population: 0,
    jobs: 0,
    powered: true,
    watered: true,
    onFire: false,
    fireProgress: 0,
    age: 0,
    constructionProgress: 100,
    abandoned: false,
  };
}
