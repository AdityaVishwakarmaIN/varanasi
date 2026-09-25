import { createRng } from '@/lib/rng';
import { createInitialGameState } from '@/lib/simulation';
import type { GameState, Tile } from '@/types/game';

export const SIZE = 32;

/** An empty 32×32 city (four 16×16 feeder blocks) with full utilities and calm stats. */
export function emptyCity(): GameState {
  const state = createInitialGameState(SIZE, 'Feedback', createRng(7));
  for (const row of state.grid) for (const t of row) {
    t.zone = 'none';
    t.building = { ...t.building, type: 'grass', population: 0, jobs: 0, onFire: false, abandoned: false, powered: false, watered: false };
    t.traffic = 0;
  }
  state.mapId = undefined;
  state.disastersEnabled = true;
  state.outbreaks = [];
  state.forecasts = [];
  state.riverLevel = 0;
  state.heatwave = undefined;
  state.notifications = [];
  state.taxRate = 9;
  const util = { supply: 100, demand: 50, ratio: 1, feeders: [] as number[], cut: [] as number[] };
  state.stats = {
    ...state.stats,
    population: 0, jobs: 0, money: 10000, income: 100, expenses: 50,
    happiness: 60, health: 60, education: 60, safety: 60, environment: 60,
    power: { ...util }, water: { ...util, feeders: [], cut: [] },
  };
  return state;
}

/** A developed, powered, watered house at (x, y). */
export function house(state: GameState, x: number, y: number, extra: Partial<Tile['building']> = {}): Tile {
  const t = state.grid[y][x];
  t.zone = 'residential';
  t.building = { ...t.building, type: 'house_small', population: 10, constructionProgress: 100, powered: true, watered: true, ...extra };
  return t;
}

export function road(state: GameState, x: number, y: number): void {
  state.grid[y][x].building = { ...state.grid[y][x].building, type: 'road' };
}
