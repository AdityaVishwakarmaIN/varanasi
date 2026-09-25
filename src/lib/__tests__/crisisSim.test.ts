import { describe, expect, it } from 'vitest';
import { createRng } from '@/lib/rng';
import { createInitialGameState } from '@/lib/simulation';
import { HEATWAVE_CONFIG } from '@/lib/heatwave';
import { COLLAPSE_MIN_AGE } from '@/lib/collapse';
import { startOutbreak } from '@/lib/disease';
import {
  getDiseaseHealthPenalty,
  getHeatwaveCityHit,
  getOutbreakMask,
  runCollapseDay,
  runHeatwaveDay,
} from '@/lib/crisisSim';
import type { GameState } from '@/types/game';

const SIZE = 20;

function grid(value: boolean | number, size = SIZE) {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => value));
}

/** A small city with one residential house (population 10) at (5,5). */
function cityWithHouse(): GameState {
  const state = createInitialGameState(SIZE, 'Crises', createRng(3));
  for (const row of state.grid) for (const t of row) {
    t.zone = 'none';
    t.building = { ...t.building, type: 'grass', population: 0, jobs: 0 };
  }
  const t = state.grid[5][5];
  t.zone = 'residential';
  t.building = { ...t.building, type: 'house_small', population: 10, constructionProgress: 100 };
  return state;
}

describe('runHeatwaveDay', () => {
  it('forecasts on a weekly summer roll and announces the first hot day', () => {
    const today = 7 * 100;
    const scheduled = runHeatwaveDay(undefined, today, 'summer', () => 0);
    expect(scheduled.heatwave?.startDay).toBe(today + HEATWAVE_CONFIG.leadDays);
    expect(scheduled.forecast?.id).toBe('heatwave');
    expect(scheduled.notifications).toHaveLength(0);

    const start = runHeatwaveDay(scheduled.heatwave, scheduled.heatwave!.startDay, 'summer', () => 0);
    expect(start.notifications[0]?.severity).toBe('crisis');
  });

  it('never rolls outside summer or on non-check days', () => {
    expect(runHeatwaveDay(undefined, 700, 'winter', () => 0).heatwave).toBeUndefined();
    expect(runHeatwaveDay(undefined, 701, 'summer', () => 0).heatwave).toBeUndefined();
  });
});

describe('getHeatwaveCityHit', () => {
  const heatwave = { startDay: 10, endDay: 15 };

  it('hurts homes without power or water, and shade halves the hit', () => {
    const state = cityWithHouse();
    const services = { power: grid(false), water: grid(true), health: grid(0) };
    const bare = getHeatwaveCityHit(state.grid, SIZE, services, heatwave, 12, 1001);
    expect(bare.health).toBe(HEATWAVE_CONFIG.healthHit);

    state.grid[5][7].building = { ...state.grid[5][7].building, type: 'tree' };
    const shaded = getHeatwaveCityHit(state.grid, SIZE, services, heatwave, 12, 1002);
    expect(shaded.health).toBe(HEATWAVE_CONFIG.healthHit * HEATWAVE_CONFIG.shadeFactor);
  });

  it('does nothing to powered and watered homes or outside the heatwave', () => {
    const state = cityWithHouse();
    const ok = { power: grid(true), water: grid(true), health: grid(0) };
    expect(getHeatwaveCityHit(state.grid, SIZE, ok, heatwave, 12, 1003).health).toBe(0);
    const bad = { power: grid(false), water: grid(false), health: grid(0) };
    expect(getHeatwaveCityHit(state.grid, SIZE, bad, heatwave, 20, 1003).health).toBe(0);
  });
});

describe('outbreak mask and health penalty', () => {
  it('covers the infected block and weights the penalty by residents inside it', () => {
    const state = cityWithHouse();
    expect(getOutbreakMask(undefined, SIZE)).toBeNull();
    const mask = getOutbreakMask([startOutbreak(0, 0)], SIZE)!;
    expect(mask[0]).toBe(1);
    const inside = mask[5 * SIZE + 5] === 1;
    const penalty = getDiseaseHealthPenalty(state.grid, SIZE, mask, 10);
    expect(penalty > 0).toBe(inside);
  });
});

describe('runCollapseDay', () => {
  it('collapses only old buildings, with a crisis notice at the tile', () => {
    const state = cityWithHouse();
    const fire = { fire: grid(0) };
    expect(runCollapseDay(state.grid, SIZE, fire, 'monsoon', null, () => 0).collapsed).toHaveLength(0);

    state.grid[5][5].building.age = COLLAPSE_MIN_AGE + 1;
    const result = runCollapseDay(state.grid, SIZE, fire, 'monsoon', null, () => 0);
    expect(result.collapsed).toEqual([{ x: 5, y: 5 }]);
    expect(result.notifications[0]).toMatchObject({ severity: 'crisis', x: 5, y: 5 });
  });
});
