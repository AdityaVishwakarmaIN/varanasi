import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRng } from '@/lib/rng';
import { bulldozeTile, createInitialGameState, placeBuilding, simulateTick } from '@/lib/simulation';

function city() {
  vi.mocked(Math.random).mockImplementation(createRng(7));
  let state = createInitialGameState(20, 'Road test', createRng(7), 'random');
  for (const row of state.grid) for (const t of row) {
    t.zone = 'none';
    t.building = { ...t.building, type: 'grass', population: 0, jobs: 0, onFire: false, constructionProgress: 100 };
  }
  state = placeBuilding(state, 0, 0, 'power_plant', null);
  state = placeBuilding(state, 0, 3, 'water_tower', null);
  state = placeBuilding(state, 5, 4, 'road', null);
  state = placeBuilding(state, 5, 5, 'house_medium', null);
  state.grid[0][0].building.constructionProgress = 100;
  state.grid[3][0].building.constructionProgress = 100;
  const t = state.grid[5][5];
  t.zone = 'residential';
  t.building = { ...t.building, age: 1000, level: 1, constructionProgress: 100 };
  state.disastersEnabled = false;
  state.stats.demand = { residential: 0, commercial: 0, industrial: 0 };
  state.tick = 1;
  vi.mocked(Math.random).mockReturnValue(0.99);
  return state;
}

beforeEach(() => vi.spyOn(Math, 'random').mockImplementation(createRng(7)));
afterEach(() => vi.restoreAllMocks());

describe('developed road access', () => {
  it('reduces output after road removal and restores it when reconnected without mutating the input', () => {
    const state = city();
    const connected = simulateTick(state);
    const cut = bulldozeTile(connected, 5, 4);
    const disconnected = simulateTick(cut);
    expect(disconnected.grid[5][5].building.population).toBeGreaterThan(0);
    expect(disconnected.grid[5][5].building.population).toBeLessThan(connected.grid[5][5].building.population);
    expect(cut.grid[5][5].building.population).toBe(connected.grid[5][5].building.population);
    const restored = simulateTick(placeBuilding(disconnected, 5, 4, 'road', null));
    expect(restored.grid[5][5].building.population).toBe(connected.grid[5][5].building.population);
  });

  it('stops construction and level-ups without a road', () => {
    const cut = bulldozeTile(city(), 5, 4);
    cut.tick = 0;
    cut.grid[5][5].building.constructionProgress = 40;
    const stalled = simulateTick(cut);
    expect(stalled.grid[5][5].building.constructionProgress).toBe(40);
    stalled.grid[5][5].building.constructionProgress = 100;
    stalled.tick = 0;
    expect(simulateTick(stalled).grid[5][5].building.level).toBe(1);
  });

  it('allows abandonment only after a prolonged disconnection and records real level-up dates', () => {
    const cut = bulldozeTile(city(), 5, 4);
    cut.tick = 0;
    cut.grid[5][5].building.unservedDays = 30;
    vi.mocked(Math.random).mockReturnValue(0);
    expect(simulateTick(cut).grid[5][5].building.abandoned).toBe(true);
    vi.mocked(Math.random).mockReturnValue(0.99);
    const state = city();
    state.tick = 0;
    const upgraded = simulateTick(state);
    expect(upgraded.grid[5][5].building.level).toBe(2);
    expect(upgraded.grid[5][5].building.lastUpgradeDay).toBeDefined();
    expect(state.grid[5][5].building.lastUpgradeDay).toBeUndefined();
  });
});
