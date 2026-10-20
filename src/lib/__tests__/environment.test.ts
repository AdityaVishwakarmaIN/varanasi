import { describe, expect, it } from 'vitest';
import { createRng } from '@/lib/rng';
import {
  createInitialGameState,
  getLandValueFromInfluence,
  LAND_VALUE_CONFIG,
  placeBuilding,
  simulateTick,
  stepTilePollution,
} from '@/lib/simulation';
import { calculateCleanAir, calculateEnvironmentScore, calculateHealthScore } from '@/lib/scoring';
import { BUILDING_STATS, type BuildingType } from '@/games/isocity/types/buildings';
import type { GameState } from '@/types/game';

const SIZE = 40;

function newCity(): GameState {
  return createInitialGameState(SIZE, 'Env', createRng(7));
}

/** Clears a square of land to grass (no zone, no pollution) so a test starts from a known neighbourhood. */
function clearArea(state: GameState, x0: number, y0: number, w: number, h: number): GameState {
  const grid = state.grid.map((row, y) =>
    row.map((tile, x) =>
      x >= x0 && x < x0 + w && y >= y0 && y < y0 + h
        ? { ...tile, zone: 'none' as const, pollution: 0, building: { ...tile.building, type: 'grass' as BuildingType } }
        : tile
    )
  );
  return { ...state, grid };
}

function runTicks(state: GameState, n: number): GameState {
  let s = state;
  for (let i = 0; i < n; i++) s = simulateTick(s);
  return s;
}

describe('tile pollution', () => {
  it('settles at about the building stat instead of 20x it', () => {
    let p = 0;
    for (let i = 0; i < 400; i++) p = stepTilePollution(p, 55);
    expect(p).toBeGreaterThan(54);
    expect(p).toBeLessThanOrEqual(55);
    // An old save's 20x value decays back toward the stat
    p = 1100;
    for (let i = 0; i < 200; i++) p = stepTilePollution(p, 55);
    expect(p).toBeLessThan(60);
    // Bulldozed (stat 0): decays to exactly 0
    for (let i = 0; i < 400; i++) p = stepTilePollution(p, 0);
    expect(p).toBe(0);
  });

  it('a factory tile in the simulation stays near its stat, and nearby green lowers it', () => {
    let state = clearArea(newCity(), 10, 10, 14, 14);
    state = placeBuilding(state, 12, 12, 'factory_small', null);
    expect(state.grid[12][12].building.type).toBe('factory_small');
    const stat = BUILDING_STATS.factory_small.pollution;
    const bare = runTicks(state, 150).grid[12][12].pollution;
    expect(bare).toBeGreaterThan(stat * 0.9);
    expect(bare).toBeLessThanOrEqual(stat + 1e-9);

    let green = state;
    for (const [x, y] of [[14, 12], [12, 14], [14, 14]]) green = placeBuilding(green, x, y, 'tree', null);
    const cleaned = runTicks(green, 150).grid[12][12].pollution;
    expect(cleaned).toBeLessThan(bare - 1);
    expect(cleaned).toBeGreaterThan(0);
  });
});

describe('clean air and environment', () => {
  it('clean air stays within 0-100', () => {
    expect(calculateCleanAir(0, 100)).toBe(100);
    expect(calculateCleanAir(1e9, 100)).toBe(0);
    expect(calculateCleanAir(-50, 100)).toBe(100);
    expect(calculateCleanAir(100, 0)).toBe(100);
    expect(calculateHealthScore(0, 1e9, 100)).toBeGreaterThanOrEqual(0);
  });

  it('a map averaging 1 point of pollution per tile costs about 10 points', () => {
    expect(calculateCleanAir(1000, 1000)).toBeCloseTo(90);
    const clean = calculateEnvironmentScore(250, 0, 0, 1000);
    expect(clean - calculateEnvironmentScore(250, 0, 1000, 1000)).toBe(10);
  });
});

describe('land value from nearby buildings', () => {
  it('is the base with no influence, and clamps to the configured band', () => {
    expect(getLandValueFromInfluence(0)).toBe(LAND_VALUE_CONFIG.base);
    expect(getLandValueFromInfluence(1e6)).toBe(LAND_VALUE_CONFIG.base + LAND_VALUE_CONFIG.maxBonus);
    expect(getLandValueFromInfluence(-1e6)).toBe(LAND_VALUE_CONFIG.base + LAND_VALUE_CONFIG.maxPenalty);
  });

  it('parks raise nearby land value, power plants lower it, and far tiles are unaffected', () => {
    const base = clearArea(newCity(), 4, 4, 30, 30);
    const withPark = simulateTick(placeBuilding(base, 10, 10, 'park', null));
    const withPlant = simulateTick(placeBuilding(base, 24, 24, 'power_plant', null));

    expect(withPark.grid[10][10].building.type).toBe('park');
    expect(withPark.grid[11][12].landValue).toBeGreaterThan(LAND_VALUE_CONFIG.base);
    expect(withPark.grid[30][30].landValue).toBe(LAND_VALUE_CONFIG.base);

    expect(withPlant.grid[24][24].building.type).toBe('power_plant');
    expect(withPlant.grid[23][23].landValue).toBeLessThan(LAND_VALUE_CONFIG.base);
    expect(withPlant.grid[10][10].landValue).toBe(LAND_VALUE_CONFIG.base);
  });

  it('stays put on a tick with no building changes', () => {
    const settled = simulateTick(clearArea(newCity(), 4, 4, 30, 30));
    const next = simulateTick(settled);
    for (let y = 4; y < 34; y++) {
      for (let x = 4; x < 34; x++) expect(next.grid[y][x].landValue).toBe(settled.grid[y][x].landValue);
    }
  });
});
