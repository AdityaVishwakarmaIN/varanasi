import { describe, expect, it } from 'vitest';
import { createRng } from '@/lib/rng';
import { createInitialGameState, placeBuilding, simulateTick } from '@/lib/simulation';
import { getRiverZone } from '@/games/isocity/maps/riverZones';
import { getPlacementCheck } from '@/lib/placement';
import type { GameState } from '@/types/game';

const SIZE = 60;

function newVaranasi(): GameState {
  return createInitialGameState(SIZE, 'Varanasi', createRng(11), 'varanasi');
}

function findZone(state: GameState, zone: string): { x: number; y: number } {
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (getRiverZone(x, y, SIZE, state.mapId) === zone && state.grid[y][x].building.type !== 'water') return { x, y };
    }
  }
  throw new Error(`no ${zone} tile`);
}

describe('Varanasi simulation wiring (Sprint 2)', () => {
  it('a new Varanasi game has a mapId and starts with Ganga Health ≈ 75 (plus credit for riverside trees)', () => {
    const state = newVaranasi();
    expect(state.mapId).toBe('varanasi');
    expect(state.stats.gangaHealth!).toBeGreaterThanOrEqual(75);
    expect(state.stats.gangaHealth!).toBeLessThanOrEqual(80);
    expect(state.waterBodies.some((b) => b.name === 'Ganga')).toBe(true);
  });

  it('random maps are unchanged: no mapId-driven river stats', () => {
    const state = createInitialGameState(SIZE, 'Random', createRng(11));
    expect(state.mapId).toBe('random');
    expect(state.stats.gangaHealth).toBeUndefined();
    const next = simulateTick(state);
    expect(next.stats.gangaHealth).toBeUndefined();
    expect(next.stats.tourismIncome).toBeUndefined();
  });

  it('ghats can only be placed on the west riverfront, facing the water', () => {
    const state = newVaranasi();
    const front = findZone(state, 'westRiverfront');
    const placed = placeBuilding(state, front.x, front.y, 'ghat', null);
    expect(placed.grid[front.y][front.x].building.type).toBe('ghat');

    const east = findZone(state, 'eastFloodplain');
    expect(placeBuilding(state, east.x, east.y, 'ghat', null)).toBe(state);
    const inland = findZone(state, 'westBank');
    expect(placeBuilding(state, inland.x, inland.y, 'ghat', null)).toBe(state);
    expect(getPlacementCheck(state, 'ghat', east.x, east.y).reason).toBe("Ghats must be on the Ganga's west bank");
  });

  it('Ganga Health drifts toward its target once per in-game day', () => {
    let state = newVaranasi();
    // Pollute the river heavily: a strip of factories-worth of pollution on riverfront tiles.
    state = {
      ...state,
      grid: state.grid.map((row) =>
        row.map((t) =>
          getRiverZone(t.x, t.y, SIZE, 'varanasi') === 'westRiverfront' ? { ...t, pollution: 80 } : t
        )
      ),
    };
    const start = state.stats.gangaHealth!;
    for (let i = 0; i < 31; i++) state = simulateTick(state);
    expect(state.stats.gangaHealthTarget!).toBeLessThan(start);
    expect(state.stats.gangaHealth!).toBeLessThan(start);
    expect(state.stats.gangaHealth!).toBeGreaterThan(state.stats.gangaHealthTarget!);
  });

  it('the STP is a 2×2 building whose upkeep lands on the water budget', () => {
    let state = newVaranasi();
    const inland = findZone(state, 'westBank');
    const before = simulateTick(state).budget.water.cost;
    state = placeBuilding(state, inland.x, inland.y, 'sewage_treatment_plant', null);
    expect(state.grid[inland.y][inland.x].building.type).toBe('sewage_treatment_plant');
    expect(state.grid[inland.y + 1][inland.x + 1].building.type).toBe('empty');
    expect(simulateTick(state).budget.water.cost).toBeGreaterThan(before);
  });
});
