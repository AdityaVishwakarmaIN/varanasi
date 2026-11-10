import { describe, expect, it, vi } from 'vitest';
import type { BuildingType, Tile } from '@/types/game';
import {
  findAirports,
  findBays,
  findHeliports,
  findMarinasAndPiers,
  findOceanConnectedMarinas,
  findOceanSpawnPoints,
} from '../gridFinders';
import { countRailTiles } from '../railSystem';
import {
  countRailTilesCached,
  findAirportsCached,
  findBaysCached,
  findHeliportsCached,
  findMarinasAndPiersCached,
  findOceanConnectedMarinasCached,
  findOceanSpawnPointsCached,
  getCachedGridScan,
  getGridStructureVersion,
} from '../gridScanCache';
import { createNewGameState } from '@/lib/newGame';
import { simulateTick } from '@/lib/simulation';

const SIZE = 24;

function tile(x: number, y: number, type: BuildingType): Tile {
  return {
    x,
    y,
    zone: 'none',
    landValue: 0,
    pollution: 0,
    crime: 0,
    traffic: 0,
    hasSubway: false,
    building: {
      type,
      level: 0,
      population: 0,
      jobs: 0,
      powered: false,
      watered: false,
      onFire: false,
      fireProgress: 0,
      age: 0,
      constructionProgress: 100,
      abandoned: false,
    },
  } as Tile;
}

/**
 * A small map with something for every finder: a lake touching the west edge with a marina and a pier,
 * an inland pond, an airport, heliports, rail, a road with a rail overlay and a rail bridge.
 */
function makeGrid(): Tile[][] {
  const grid: Tile[][] = [];
  for (let y = 0; y < SIZE; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < SIZE; x++) {
      const lake = x < 6 && y >= 4 && y < 12; // 48 tiles, touches the west edge
      const pond = x >= 16 && x < 20 && y >= 16 && y < 20; // 16 tiles, inland
      row.push(tile(x, y, lake || pond ? 'water' : 'grass'));
    }
    grid.push(row);
  }
  const put = (x: number, y: number, type: BuildingType) => {
    grid[y][x] = tile(x, y, type);
  };
  put(6, 6, 'marina_docks_small');
  put(6, 10, 'pier_large');
  put(10, 0, 'airport');
  put(12, 14, 'hospital');
  put(14, 14, 'police_station');
  put(1, 1, 'mall'); // (1*31 + 1*17) % 100 = 48: a dense mall, no heliport
  put(3, 1, 'mall'); // (3*31 + 1*17) % 100 = 10: also dense
  put(9, 3, 'mall'); // (9*31 + 3*17) % 100 = 30
  put(2, 20, 'mall'); // (2*31 + 20*17) % 100 = 2
  put(22, 2, 'mall'); // (22*31 + 2*17) % 100 = 16
  put(10, 10, 'mall'); // (10*31 + 10*17) % 100 = 80: has a heliport
  for (let x = 8; x < 14; x++) put(x, 20, 'rail');
  grid[21][8] = { ...tile(8, 21, 'road'), hasRailOverlay: true };
  grid[21][9] = tile(9, 21, 'bridge');
  grid[21][9].building.bridgeTrackType = 'rail';
  return grid;
}

/** A new grid object with every row and tile copied (what a simulation tick that changed nothing gives). */
function copyGrid(grid: Tile[][], change?: (t: Tile) => void): Tile[][] {
  return grid.map((row) =>
    row.map((t) => {
      const c = { ...t, building: { ...t.building } };
      change?.(c);
      return c;
    })
  );
}

function expectSameAsUncached(grid: Tile[][]) {
  expect(findAirportsCached(grid, SIZE)).toEqual(findAirports(grid, SIZE));
  expect(findHeliportsCached(grid, SIZE)).toEqual(findHeliports(grid, SIZE));
  expect(findMarinasAndPiersCached(grid, SIZE)).toEqual(findMarinasAndPiers(grid, SIZE));
  expect(findOceanConnectedMarinasCached(grid, SIZE)).toEqual(findOceanConnectedMarinas(grid, SIZE));
  expect(findOceanSpawnPointsCached(grid, SIZE)).toEqual(findOceanSpawnPoints(grid, SIZE));
  expect(findBaysCached(grid, SIZE)).toEqual(findBays(grid, SIZE));
  expect(findBaysCached(grid, SIZE, 20)).toEqual(findBays(grid, SIZE, 20));
  expect(countRailTilesCached(grid, SIZE)).toBe(countRailTiles(grid, SIZE));
}

describe('gridScanCache', () => {
  it('gives the same results as the uncached finders', () => {
    const grid = makeGrid();
    expectSameAsUncached(grid);
    // The fixture really exercises every finder
    expect(findAirports(grid, SIZE)).toHaveLength(1);
    expect(findHeliports(grid, SIZE).map((h) => h.type)).toEqual(['airport', 'mall', 'hospital', 'police']);
    expect(findMarinasAndPiers(grid, SIZE)).toHaveLength(2);
    expect(findOceanConnectedMarinas(grid, SIZE)).toEqual([{ x: 6, y: 6, type: 'marina' }]);
    expect(findBays(grid, SIZE).map((b) => b.size)).toEqual([48, 16]);
    expect(findBays(grid, SIZE, 20).map((b) => b.size)).toEqual([48]);
    expect(countRailTiles(grid, SIZE)).toBe(8);
  });

  it('does not recompute when asked again for the same grid', () => {
    const grid = makeGrid();
    const compute = vi.fn(() => ({ n: 1 }));
    const first = getCachedGridScan(grid, SIZE, 'test:same-grid', compute);
    expect(getCachedGridScan(grid, SIZE, 'test:same-grid', compute)).toBe(first);
    expect(compute).toHaveBeenCalledTimes(1);
    expect(findBaysCached(grid, SIZE)).toBe(findBaysCached(grid, SIZE));
    expect(findOceanConnectedMarinasCached(grid, SIZE)).toBe(findOceanConnectedMarinasCached(grid, SIZE));
  });

  it('does not recompute for a new grid object when only non-structural fields changed', () => {
    const grid = makeGrid();
    const compute = vi.fn(() => ({ n: 1 }));
    const bays = findBaysCached(grid, SIZE);
    const heliports = findHeliportsCached(grid, SIZE);
    const first = getCachedGridScan(grid, SIZE, 'test:unrelated', compute);
    const version = getGridStructureVersion(grid, SIZE);

    const next = copyGrid(grid, (t) => {
      t.pollution = 50;
      t.landValue = 80;
      t.building.population = 12;
      t.building.powered = true;
      t.building.onFire = t.x === 12 && t.y === 14;
      t.building.level = 3;
      t.building.constructionProgress = 40;
    });
    expect(getGridStructureVersion(next, SIZE)).toBe(version);
    expect(getCachedGridScan(next, SIZE, 'test:unrelated', compute)).toBe(first);
    expect(compute).toHaveBeenCalledTimes(1);
    expect(findBaysCached(next, SIZE)).toBe(bays);
    expect(findHeliportsCached(next, SIZE)).toBe(heliports);
  });

  it('recomputes on the next grid after a relevant tile changed', () => {
    const grid = makeGrid();
    const airports = findAirportsCached(grid, SIZE);
    const bays = findBaysCached(grid, SIZE);
    const docks = findMarinasAndPiersCached(grid, SIZE);
    const rail = countRailTilesCached(grid, SIZE);

    // Build a second airport
    const withAirport = copyGrid(grid);
    withAirport[0][16] = tile(16, 0, 'airport');
    expect(findAirportsCached(withAirport, SIZE)).not.toBe(airports);
    expect(findAirportsCached(withAirport, SIZE)).toHaveLength(2);
    expectSameAsUncached(withAirport);

    // Fill in part of the lake (landfill): the bay shrinks
    const filled = copyGrid(withAirport);
    filled[4][0] = tile(0, 4, 'grass');
    expect(findBaysCached(filled, SIZE)[0].size).toBe(47);
    expect(findBaysCached(filled, SIZE)).not.toBe(bays);
    expectSameAsUncached(filled);

    // Bulldoze the pier
    const bulldozed = copyGrid(filled);
    bulldozed[10][6] = tile(6, 10, 'grass');
    expect(findMarinasAndPiersCached(bulldozed, SIZE)).toHaveLength(1);
    expect(findMarinasAndPiersCached(bulldozed, SIZE)).not.toBe(docks);

    // A rail overlay on a road counts as rail (a field outside building.type)
    const overlay = copyGrid(bulldozed);
    overlay[22][8] = { ...tile(8, 22, 'road'), hasRailOverlay: true };
    expect(countRailTilesCached(overlay, SIZE)).toBe(rail + 1);
    expectSameAsUncached(overlay);
  });

  it('keeps answering correctly when two grids with different structures alternate', () => {
    const a = makeGrid();
    const b = copyGrid(a);
    b[0][16] = tile(16, 0, 'airport');
    for (let i = 0; i < 3; i++) {
      expect(findAirportsCached(a, SIZE)).toHaveLength(1);
      expect(findAirportsCached(b, SIZE)).toHaveLength(2);
    }
    expect(getGridStructureVersion(a, SIZE)).not.toBe(getGridStructureVersion(b, SIZE));
  });

  it('starts over when the grid size changes', () => {
    const grid = makeGrid();
    const smaller = grid.slice(0, 12).map((row) => row.slice(0, 12));
    expect(findBaysCached(smaller, 12)).toEqual(findBays(smaller, 12));
    expect(findAirportsCached(smaller, 12)).toEqual(findAirports(smaller, 12));
    expect(findBaysCached(grid, SIZE)).toEqual(findBays(grid, SIZE));
  });

  it('returns frozen results', () => {
    const grid = makeGrid();
    const bays = findBaysCached(grid, SIZE);
    expect(Object.isFrozen(bays)).toBe(true);
    expect(Object.isFrozen(bays[0])).toBe(true);
    expect(Object.isFrozen(bays[0].waterTiles)).toBe(true);
    expect(() => (bays as unknown as unknown[]).push(1)).toThrow();
  });

  it('keeps the same results across simulation ticks of the Varanasi map while nothing is built', () => {
    let state = createNewGameState(undefined, false);
    const size = state.gridSize;
    state = simulateTick(state, 'clear');
    const bays = findBaysCached(state.grid, size);
    const ocean = findOceanConnectedMarinasCached(state.grid, size);
    const version = getGridStructureVersion(state.grid, size);
    expect(bays.length).toBeGreaterThan(0);
    for (let i = 0; i < 5; i++) {
      const prev = state.grid;
      state = simulateTick(state, 'clear');
      expect(state.grid).not.toBe(prev); // the simulation hands over a new grid object every tick
      expect(getGridStructureVersion(state.grid, size)).toBe(version);
      expect(findBaysCached(state.grid, size)).toBe(bays);
      expect(findOceanConnectedMarinasCached(state.grid, size)).toBe(ocean);
    }
    expect(findBaysCached(state.grid, size)).toEqual(findBays(state.grid, size));
  });
});
