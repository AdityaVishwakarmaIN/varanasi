import { describe, expect, it } from 'vitest';
import { createRng } from '@/lib/rng';
import { createInitialGameState, placeBuilding } from '@/lib/simulation';
import { getPlacementCheck, getToolBuilding, PLACEMENT_REASONS } from '@/lib/placement';
import { BuildingType, GameState } from '@/types/game';

const SIZE = 30;

/** A flat all-grass map with plenty of money, so each test controls the tiles it cares about. */
function flatState(): GameState {
  const state = createInitialGameState(SIZE, 'Test', createRng(7));
  const template = state.grid[0][0].building;
  for (const row of state.grid) {
    for (const tile of row) {
      tile.building = { ...template, type: 'grass' };
      tile.zone = 'none';
      tile.hasSubway = false;
    }
  }
  state.stats = { ...state.stats, money: 1_000_000 };
  return state;
}

function setType(state: GameState, x: number, y: number, type: BuildingType) {
  state.grid[y][x].building = { ...state.grid[y][x].building, type };
}

describe('getPlacementCheck', () => {
  it('allows a building on free grass and reports its cost', () => {
    const state = flatState();
    const check = getPlacementCheck(state, 'police_station', 5, 5);
    expect(check.ok).toBe(true);
    expect(check.cost).toBe(500);
    expect(check.reason).toBeUndefined();
  });

  it('agrees with placeBuilding for every tile of a mixed map', () => {
    const state = createInitialGameState(SIZE, 'Mixed', createRng(3));
    state.stats = { ...state.stats, money: 1_000_000 };
    for (let y = 0; y < SIZE; y += 3) {
      for (let x = 0; x < SIZE; x += 3) {
        const tile = state.grid[y][x];
        if (tile.building.type === 'hospital') continue; // same-building no-op handled separately
        const expected = placeBuilding(state, x, y, 'hospital', null) !== state;
        expect(getPlacementCheck(state, 'hospital', x, y).ok).toBe(expected);
      }
    }
  });

  it('blocks water with a reason, and hints bridges for roads', () => {
    const state = flatState();
    setType(state, 3, 3, 'water');
    expect(getPlacementCheck(state, 'police_station', 3, 3)).toMatchObject({ ok: false, reason: PLACEMENT_REASONS.water });
    expect(getPlacementCheck(state, 'road', 3, 3)).toMatchObject({ ok: false, reason: PLACEMENT_REASONS.bridgeHint });
  });

  it('blocks when there is not enough money', () => {
    const state = flatState();
    state.stats = { ...state.stats, money: 100 };
    expect(getPlacementCheck(state, 'power_plant', 5, 5)).toMatchObject({ ok: false, reason: PLACEMENT_REASONS.notEnoughMoney });
    expect(getPlacementCheck(state, 'road', 5, 5).ok).toBe(true);
  });

  it('blocks multi-tile buildings over occupied tiles or past the map edge', () => {
    const state = flatState();
    setType(state, 6, 5, 'road');
    expect(getPlacementCheck(state, 'hospital', 5, 5)).toMatchObject({ ok: false, reason: PLACEMENT_REASONS.blocked });
    expect(getPlacementCheck(state, 'hospital', SIZE - 1, 5)).toMatchObject({ ok: false, reason: PLACEMENT_REASONS.outOfBounds });
  });

  it('requires water next to waterfront buildings', () => {
    const state = flatState();
    expect(getPlacementCheck(state, 'pier_large', 10, 10)).toMatchObject({ ok: false, reason: PLACEMENT_REASONS.needsWater });
    setType(state, 11, 10, 'water');
    expect(getPlacementCheck(state, 'pier_large', 10, 10).ok).toBe(true);
  });

  it('reports no-ops (already built / already zoned / nothing to bulldoze)', () => {
    const state = flatState();
    setType(state, 2, 2, 'road');
    state.grid[4][4].zone = 'residential';
    expect(getPlacementCheck(state, 'road', 2, 2)).toMatchObject({ ok: false, reason: PLACEMENT_REASONS.alreadyBuilt });
    expect(getPlacementCheck(state, 'zone_residential', 4, 4)).toMatchObject({ ok: false, reason: PLACEMENT_REASONS.alreadyZoned });
    expect(getPlacementCheck(state, 'bulldoze', 8, 8)).toMatchObject({ ok: false, reason: PLACEMENT_REASONS.nothingToRemove });
    expect(getPlacementCheck(state, 'bulldoze', 2, 2).ok).toBe(true);
  });

  it('warns (without blocking) when a zone has no road access', () => {
    const state = flatState();
    const far = getPlacementCheck(state, 'zone_residential', 15, 15);
    expect(far).toMatchObject({ ok: true, warning: PLACEMENT_REASONS.needsRoad });
    setType(state, 15, 16, 'road');
    const near = getPlacementCheck(state, 'zone_residential', 15, 15);
    expect(near.ok).toBe(true);
    expect(near.warning).toBeUndefined();
  });

  it('does not mutate the state', () => {
    const state = flatState();
    const before = JSON.stringify(state.grid[5][5]);
    getPlacementCheck(state, 'zone_commercial', 5, 5);
    getPlacementCheck(state, 'hospital', 5, 5);
    expect(JSON.stringify(state.grid[5][5])).toBe(before);
  });

  it('maps tools to buildings like GameContext does', () => {
    expect(getToolBuilding('road')).toBe('road');
    expect(getToolBuilding('hospital')).toBe('hospital');
    expect(getToolBuilding('zone_residential')).toBeNull();
    expect(getToolBuilding('bulldoze')).toBeNull();
    expect(getToolBuilding('subway')).toBeNull();
  });
});
