import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRng } from '@/lib/rng';
import {
  FIRE_WIND_STRENGTH,
  SCORCH_TICKS,
  getBurnStageSpread,
  getFireFuelFactor,
  getFireFundingFactor,
  getFirePressure,
  getFireSpreadChance,
} from '@/lib/fireConfig';
import { simulateTick } from '@/lib/simulation';
import { makeFireCity, quietSim, setTile } from './arena-ember/harness';

afterEach(() => vi.restoreAllMocks());

describe('fire model', () => {
  it('fuel: timber burns easier than concrete and civic buildings', () => {
    expect(getFireFuelFactor('informal_housing')).toBeGreaterThan(getFireFuelFactor('house_small'));
    expect(getFireFuelFactor('house_small')).toBeGreaterThan(getFireFuelFactor('office_high'));
    expect(getFireFuelFactor('park')).toBe(1);
    expect(getFireSpreadChance(1, 0, 'clear', 2)).toBeCloseTo(2 * getFireSpreadChance(1, 0, 'clear', 1));
  });

  it('burn stages peak mid-burn and fade at the end', () => {
    expect(getBurnStageSpread(5)).toBeLessThan(getBurnStageSpread(30));
    expect(getBurnStageSpread(50)).toBeGreaterThan(getBurnStageSpread(30));
    expect(getBurnStageSpread(90)).toBeLessThan(getBurnStageSpread(50));
  });

  it('funding scales fire cover from 25% (no money) to 100%', () => {
    expect(getFireFundingFactor(100)).toBe(1);
    expect(getFireFundingFactor(0)).toBeCloseTo(0.25);
    expect(getFireFundingFactor(undefined)).toBe(1);
  });

  it('wind pushes fire downwind: the tile north of a burning tile is pressed harder than the tile south of it', () => {
    quietSim();
    const state = makeFireCity(1);
    const [fx, fy] = [10, 10];
    state.grid[fy][fx].building.onFire = true;
    state.grid[fy][fx].building.fireProgress = 50;
    const wind = FIRE_WIND_STRENGTH.severe_storm;
    const downwind = getFirePressure(state.grid, state.gridSize, fx, fy - 1, wind);
    const upwind = getFirePressure(state.grid, state.gridSize, fx, fy + 1, wind);
    expect(downwind).toBeGreaterThan(upwind);
    expect(upwind).toBeGreaterThan(0);
  });

  it('a burned zoned lot is left scorched, keeps its zone, rebuilds only after it cools, and the player is told', () => {
    quietSim();
    vi.spyOn(Math, 'random').mockImplementation(createRng(9));
    let state = makeFireCity(9);
    // Clear the surroundings so only this lot is involved
    for (let y = 6; y <= 12; y++) for (let x = 7; x <= 13; x++) if (x % 6 !== 0 && y % 6 !== 0) setTile(state.grid[y][x], 'grass', 'residential');
    setTile(state.grid[8][8], 'house_small', 'residential');
    state.grid[8][8].building = { ...state.grid[8][8].building, onFire: true, fireProgress: 99 };
    state = simulateTick(state, 'clear');
    const lot = state.grid[8][8];
    expect(lot.building.type).toBe('grass');
    expect(lot.zone).toBe('residential');
    expect(lot.building.fireProgress).toBe(SCORCH_TICKS);
    expect(state.notifications.some((n) => n.title === 'Lost to fire' && n.x === 8 && n.y === 8)).toBe(true);
    // The scorched lot cools by one per tick and nothing is built on it meanwhile
    for (let i = 0; i < SCORCH_TICKS - 2; i++) {
      state = simulateTick(state, 'clear');
      expect(state.grid[8][8].building.type).toBe('grass');
    }
    expect(state.grid[8][8].building.fireProgress).toBeGreaterThan(0);
  });
});
