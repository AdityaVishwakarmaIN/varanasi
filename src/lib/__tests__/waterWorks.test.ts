import { describe, expect, it } from 'vitest';
import { createRng } from '@/lib/rng';
import { createInitialGameState, placeBuilding, recalculateDerivedState } from '@/lib/simulation';
import { isWaterWorksPlacementValid } from '@/lib/ganga';
import { getPlacementCheck } from '@/lib/placement';
import { getDistanceToGanga } from '@/games/isocity/maps/riverZones';
import { WATER_CONFIG, calculateWaterWorksCapacity } from '@/lib/utilities';
import type { GameState } from '@/types/game';

const SIZE = 60;
const WORKS = WATER_CONFIG.worksSize;

function newVaranasi(): GameState {
  return createInitialGameState(SIZE, 'Varanasi', createRng(11), 'varanasi');
}

function isFree(state: GameState, x: number, y: number): boolean {
  if (x + WORKS > SIZE || y + WORKS > SIZE) return false;
  for (let dy = 0; dy < WORKS; dy++) {
    for (let dx = 0; dx < WORKS; dx++) {
      const t = state.grid[y + dy][x + dx];
      if (t.building.type !== 'grass' && t.building.type !== 'tree') return false;
      if (t.zone !== 'none') return false;
    }
  }
  return true;
}

/** First free 3×3 site whose nearest tile is `wantNear` (within 3 tiles of the Ganga) or not. */
function findSite(state: GameState, wantNear: boolean): { x: number; y: number } {
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (!isFree(state, x, y)) continue;
      let min = Infinity;
      for (let dy = 0; dy < WORKS; dy++) {
        for (let dx = 0; dx < WORKS; dx++) min = Math.min(min, getDistanceToGanga(x + dx, y + dy, SIZE, state.mapId));
      }
      if (wantNear === (min >= 1 && min <= WATER_CONFIG.worksMaxDistanceToGanga)) return { x, y };
    }
  }
  throw new Error('no site');
}

/** Places a finished, powered works at the first riverside site. */
function withWorks(state: GameState): GameState {
  const site = findSite(state, true);
  const placed = placeBuilding(state, site.x, site.y, 'jal_sansthan_water_works', null);
  const grid = placed.grid.map((row) => row.slice());
  const b = grid[site.y][site.x].building;
  grid[site.y][site.x] = { ...grid[site.y][site.x], building: { ...b, constructionProgress: 100, powered: true } };
  return { ...placed, grid };
}

describe('Jal Sansthan Water Works (S3-T8)', () => {
  it('goes only within 3 tiles of the Ganga, with a clear reason otherwise', () => {
    const state = newVaranasi();
    const near = findSite(state, true);
    const placed = placeBuilding(state, near.x, near.y, 'jal_sansthan_water_works', null);
    expect(placed.grid[near.y][near.x].building.type).toBe('jal_sansthan_water_works');
    expect(getPlacementCheck(state, 'jal_sansthan_water_works', near.x, near.y).ok).toBe(true);

    const far = findSite(state, false);
    expect(placeBuilding(state, far.x, far.y, 'jal_sansthan_water_works', null)).toBe(state);
    expect(getPlacementCheck(state, 'jal_sansthan_water_works', far.x, far.y).reason).toBe(
      'Jal Sansthan Water Works must be within 3 tiles of the Ganga'
    );
  });

  it('cannot be placed on a map without the Ganga', () => {
    expect(isWaterWorksPlacementValid(10, 10, SIZE, 'random')).toBe(false);
  });

  it('a working works adds water supply, and a dirtier Ganga lowers it', () => {
    const base = withWorks(newVaranasi());
    const at = (health: number) =>
      recalculateDerivedState({ ...base, stats: { ...base.stats, gangaHealth: health } }).stats.water!.supply;
    const without = recalculateDerivedState(newVaranasi()).stats.water!.supply;

    expect(at(100) - without).toBeCloseTo(calculateWaterWorksCapacity(100));
    expect(at(20) - without).toBeCloseTo(calculateWaterWorksCapacity(20));
    expect(at(20)).toBeLessThan(at(100));
  });

  it('adds nothing without power, and its upkeep goes on the water budget line', () => {
    const powered = withWorks(newVaranasi());
    const grid = powered.grid.map((row) =>
      row.map((t) =>
        t.building.type === 'jal_sansthan_water_works' ? { ...t, building: { ...t.building, powered: false } } : t
      )
    );
    const unpowered = recalculateDerivedState({ ...powered, grid });
    const none = recalculateDerivedState(newVaranasi());
    expect(unpowered.stats.water!.supply).toBe(none.stats.water!.supply);
    expect(unpowered.budget.water.cost - none.budget.water.cost).toBe(WATER_CONFIG.worksUpkeepMonthly);
  });
});

describe('Jal Sansthan Water Works refusal reasons', () => {
  it('a footprint over the river says it cannot go on water', () => {
    const state = newVaranasi();
    // Find a land tile whose 3×3 footprint reaches into the river
    for (let y = 0; y < SIZE - WORKS; y++) {
      for (let x = 0; x < SIZE - WORKS; x++) {
        if (state.grid[y][x].building.type === 'water') continue;
        if (state.grid[y + 2][x + 2].building.type !== 'water') continue;
        expect(getPlacementCheck(state, 'jal_sansthan_water_works', x, y).reason).toBe("Can't build on water");
        return;
      }
    }
    throw new Error('no riverside site');
  });
});
