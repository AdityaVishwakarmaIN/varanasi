import { describe, expect, it } from 'vitest';
import { createRng } from '@/lib/rng';
import { createInitialGameState, placeBuilding, recalculateDerivedState } from '@/lib/simulation';
import { getRiverZone } from '@/games/isocity/maps/riverZones';
import { stepGangaHealth } from '@/lib/scoring';
import { calculateTourismIncome } from '@/lib/tourism';
import { SEASON_CONFIG, getSeason, getVehicleSpeedMultiplier } from '@/lib/seasons';
import type { GameState } from '@/types/game';

const SIZE = 60;

function varanasiWithGhat(): GameState {
  const state = createInitialGameState(SIZE, 'Varanasi', createRng(11), 'varanasi');
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (getRiverZone(x, y, SIZE, state.mapId) !== 'westRiverfront' || state.grid[y][x].building.type === 'water') continue;
      const placed = placeBuilding(state, x, y, 'ghat', null);
      if (placed !== state) {
        placed.grid[y][x].building.constructionProgress = 100;
        return placed;
      }
    }
  }
  throw new Error('no ghat spot');
}

describe('seasonal effects (S4-T3)', () => {
  it('tourism income scales with the season multiplier', () => {
    const grid = createInitialGameState(20, 'T', createRng(1)).grid;
    const ghats = [{ x: 5, y: 5 }];
    const base = calculateTourismIncome(grid, 20, ghats, 80);
    expect(base).toBeGreaterThan(0);
    expect(calculateTourismIncome(grid, 20, ghats, 80, 0.5)).toBeCloseTo(base * 0.5);
  });

  it('the tourism line drops in the monsoon and peaks after it', () => {
    const city = varanasiWithGhat();
    const tourismIn = (month: number) => recalculateDerivedState({ ...city, month }).stats.tourismIncome ?? 0;
    const july = tourismIn(7);
    const october = tourismIn(10);
    const january = tourismIn(1);
    expect(october).toBeGreaterThan(0);
    expect(july).toBeLessThan(january);
    expect(october).toBeGreaterThan(january);
  });

  it('the Ganga recovers faster with a larger approach multiplier, and never overshoots', () => {
    const normal = stepGangaHealth(50, 80);
    const monsoon = stepGangaHealth(50, 80, SEASON_CONFIG.monsoon.gangaRecovery);
    expect(monsoon - 50).toBeCloseTo((normal - 50) * 2);
    expect(stepGangaHealth(50, 80, 1000)).toBe(80);
  });

  it('vehicles slow down in the monsoon and in winter fog mornings only', () => {
    expect(getVehicleSpeedMultiplier(getSeason(7), 'storm', 12)).toBeCloseTo(0.85);
    expect(getVehicleSpeedMultiplier(getSeason(4), 'clear', 12)).toBe(1);
    expect(getVehicleSpeedMultiplier(getSeason(1), 'fog', 8)).toBeLessThan(1);
    expect(getVehicleSpeedMultiplier(getSeason(1), 'fog', 14)).toBe(1);
  });

  it('power and water demand follow the season table', () => {
    expect(SEASON_CONFIG[getSeason(5)].powerDemand).toBeGreaterThan(SEASON_CONFIG[getSeason(10)].powerDemand);
    expect(SEASON_CONFIG[getSeason(5)].waterDemand).toBeGreaterThan(SEASON_CONFIG[getSeason(8)].waterDemand);
  });
});
