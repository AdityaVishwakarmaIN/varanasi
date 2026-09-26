import { afterEach, describe, expect, it, vi } from 'vitest';
import { BUILDING_STATS } from '@/games/isocity/types/buildings';
import { MIXED_USE_CONFIG, formatMixedUseInfo, getMixedUseResidents, isMixedUse, setMixedUseEnabled } from '@/lib/mixedUse';
import { createRng } from '@/lib/rng';
import { generateRandomAdvancedCity, simulateTick } from '@/lib/simulation';
import type { GameState } from '@/types/game';

describe('mixed-use commercial', () => {
  it('only small shops, medium shops and low offices at level 2+', () => {
    expect(isMixedUse('shop_small', 1)).toBe(false);
    expect(isMixedUse('shop_small', 2)).toBe(true);
    expect(isMixedUse('office_low', 5)).toBe(true);
    expect(isMixedUse('office_high', 5)).toBe(false);
    expect(isMixedUse('mall', 5)).toBe(false);
    expect(isMixedUse('house_small', 5)).toBe(false);
  });

  it('residents = floor(maxJobs × 0.4 × level × efficiency × 0.8), like jobs', () => {
    const maxJobs = BUILDING_STATS.shop_medium.maxJobs; // 28
    expect(getMixedUseResidents('shop_medium', 1, maxJobs)).toBe(0);
    expect(getMixedUseResidents('shop_medium', 2, maxJobs)).toBe(Math.floor(28 * 0.4 * 2 * 0.8));
    expect(getMixedUseResidents('shop_medium', 3, maxJobs)).toBe(Math.floor(28 * 0.4 * 3 * 0.8));
    expect(getMixedUseResidents('shop_medium', 3, maxJobs, 0.5)).toBe(Math.floor(28 * 0.4 * 3 * 0.5 * 0.8));
    expect(getMixedUseResidents('shop_medium', 3, maxJobs, 0)).toBe(0);
  });

  it('residents are resident-ratio times the jobs formula', () => {
    const maxJobs = BUILDING_STATS.office_low.maxJobs;
    const level = 4;
    const jobs = maxJobs * level * 0.8;
    expect(getMixedUseResidents('office_low', level, maxJobs)).toBe(Math.floor(jobs * MIXED_USE_CONFIG.residentRatio));
  });

  it('formats the tile-info line', () => {
    expect(formatMixedUseInfo(45, 18)).toBe('Shops: 45 jobs · Homes above: 18 residents');
  });
});

describe('mixed-use in simulateTick (S3-T6)', () => {
  /** A seeded city with a dense bazaar street: a row of level-3 medium shops on commercial land. */
  function bazaarCity(): GameState {
    const state = generateRandomAdvancedCity(40, 'Test', createRng(77));
    for (let x = 5; x < 25; x++) {
      const tile = state.grid[20][x];
      tile.zone = 'commercial';
      tile.building = { ...tile.building, type: 'shop_medium', level: 3, population: 0, jobs: 0, abandoned: false, onFire: false, fireProgress: 0, constructionProgress: 100 };
    }
    return state;
  }

  function tick(state: GameState): GameState {
    const spy = vi.spyOn(Math, 'random').mockImplementation(createRng(5));
    try {
      return simulateTick(state, 'clear');
    } finally {
      spy.mockRestore();
    }
  }

  afterEach(() => setMixedUseEnabled(true));

  it('a dense bazaar street of level-2+ shops raises population', () => {
    setMixedUseEnabled(false);
    const off = tick(bazaarCity());
    setMixedUseEnabled(true);
    const on = tick(bazaarCity());

    let residents = 0;
    for (let x = 5; x < 25; x++) {
      const b = on.grid[20][x].building;
      if (!isMixedUse(b.type, b.level)) continue;
      const eff = (b.powered ? 0.5 : 0) + (b.watered ? 0.5 : 0);
      expect(b.population).toBe(getMixedUseResidents(b.type, b.level, BUILDING_STATS[b.type].maxJobs, eff));
      expect(off.grid[20][x].building.population).toBe(0);
      residents += b.population;
    }
    expect(residents).toBeGreaterThan(0);
    expect(on.stats.population).toBeGreaterThan(off.stats.population);
  });
});
