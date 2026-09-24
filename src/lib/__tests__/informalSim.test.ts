import { describe, expect, it } from 'vitest';
import { createRng } from '@/lib/rng';
import { bulldozeTile, createInitialGameState, recalculateDerivedState } from '@/lib/simulation';
import { INFORMAL_CONFIG } from '@/lib/informal';
import {
  EMPTY_INFORMAL_STATE,
  INFORMAL_RESIDENTS,
  createInformalBuilding,
  getAbsoluteDay,
  getInformalHappinessModifier,
  runInformalDay,
  type InformalDayInput,
} from '@/lib/informalSim';
import type { GameState, InformalState, Tile } from '@/types/game';

const SIZE = 20;
const TODAY = 400;

/** A flat, empty city: every tile grass and unzoned. */
function emptyCity(): GameState {
  const state = createInitialGameState(SIZE, 'Test', createRng(3), 'random');
  const grass = state.grid.flat().find((t) => t.building.type === 'grass')!.building;
  const grid = state.grid.map((row) =>
    row.map((t): Tile => ({ ...t, zone: 'none', building: { ...grass } }))
  );
  return { ...state, grid };
}

/** A road along row 5 and one shop at (8, 6): jobs and roads for settlements to gather near. */
function cityWithRoadAndJobs(): GameState {
  const state = emptyCity();
  for (let x = 0; x < SIZE; x++) state.grid[5][x].building = { ...state.grid[5][x].building, type: 'road' };
  state.grid[6][8] = { ...state.grid[6][8], zone: 'commercial', building: { ...state.grid[6][8].building, type: 'shop_small' } };
  return state;
}

function settlementIndices(grid: Tile[][]): number[] {
  const out: number[] = [];
  grid.forEach((row, y) => row.forEach((t, x) => t.building.type === 'informal_housing' && out.push(y * SIZE + x)));
  return out;
}

function day(state: GameState, overrides: Partial<InformalDayInput> = {}) {
  return runInformalDay({
    grid: state.grid,
    size: SIZE,
    mapId: state.mapId,
    informal: state.informal,
    today: TODAY,
    weekly: true,
    residentialDemand: 80,
    population: 5000,
    settlements: settlementIndices(state.grid),
    hasRoadAccess: () => true,
    writable: (x, y) => state.grid[y][x],
    ...overrides,
  });
}

describe('informal settlements: spawning (S3-T9)', () => {
  it('appear on free grass near jobs and roads when housing is short', () => {
    const state = cityWithRoadAndJobs();
    const result = day(state);
    const spawned = settlementIndices(state.grid);
    expect(result.changed).toBe(INFORMAL_CONFIG.maxSpawnsPerWeek);
    expect(spawned).toHaveLength(INFORMAL_CONFIG.maxSpawnsPerWeek);
    for (const idx of spawned) {
      const x = idx % SIZE;
      const y = Math.floor(idx / SIZE);
      expect(Math.abs(y - 5)).toBeLessThanOrEqual(INFORMAL_CONFIG.maxDistanceToRoad);
      expect(Math.max(Math.abs(x - 8), Math.abs(y - 6))).toBeLessThanOrEqual(INFORMAL_CONFIG.maxDistanceToJobs);
      expect(state.grid[y][x].zone).toBe('none');
      expect(state.grid[y][x].building.population).toBe(INFORMAL_RESIDENTS);
    }
  });

  it('do not appear when demand is low, housing is available, or it is not the weekly check', () => {
    for (const overrides of [
      { residentialDemand: INFORMAL_CONFIG.minResidentialDemand },
      { population: 0 },
      { weekly: false },
    ]) {
      const state = cityWithRoadAndJobs();
      expect(day(state, overrides).changed).toBe(0);
      expect(settlementIndices(state.grid)).toEqual([]);
    }
  });

  it('do not appear without jobs or roads nearby', () => {
    const state = emptyCity();
    expect(day(state).changed).toBe(0);
  });

  it('do not return to a recently bulldozed tile, and old records are pruned', () => {
    const state = cityWithRoadAndJobs();
    const bulldozedDay: Record<string, number> = {};
    for (let i = 0; i < SIZE * SIZE; i++) bulldozedDay[String(i)] = TODAY - 5;
    state.informal = { ...EMPTY_INFORMAL_STATE, bulldozedDay };
    const recent = day(state);
    expect(recent.changed).toBe(0);
    expect(Object.keys(recent.informal.bulldozedDay)).toHaveLength(SIZE * SIZE);

    const later = day(state, { today: TODAY - 5 + INFORMAL_CONFIG.bulldozeCooldownDays });
    expect(later.informal.bulldozedDay).toEqual({});
    expect(later.changed).toBe(INFORMAL_CONFIG.maxSpawnsPerWeek);
  });
});

describe('informal settlements: formalisation (S3-T9)', () => {
  /** One settlement at (4, 6), zoned residential and fully serviced. */
  function servicedSettlement(): GameState {
    const state = cityWithRoadAndJobs();
    const t = state.grid[6][4];
    state.grid[6][4] = { ...t, zone: 'residential', building: { ...createInformalBuilding(t.building), powered: true, watered: true } };
    return state;
  }

  function runDays(state: GameState, days: number, overrides: Partial<InformalDayInput> = {}) {
    let last = day(state, { weekly: false, ...overrides });
    state.informal = last.informal;
    for (let d = 1; d < days; d++) {
      last = day(state, { weekly: false, today: TODAY + d, ...overrides });
      state.informal = last.informal;
    }
    return last;
  }

  it('become proper homes after 30 days of zoning, road, power and water', () => {
    const state = servicedSettlement();
    const almost = runDays(state, INFORMAL_CONFIG.formaliseDays - 1);
    expect(state.grid[6][4].building.type).toBe('informal_housing');
    expect(almost.informal.formaliseDays[String(6 * SIZE + 4)]).toBe(INFORMAL_CONFIG.formaliseDays - 1);

    const done = day(state, { weekly: false, today: TODAY + INFORMAL_CONFIG.formaliseDays - 1 });
    expect(state.grid[6][4].building.type).toBe(INFORMAL_CONFIG.formalisedBuilding);
    expect(done.changed).toBe(1);
    expect(done.notifications.map((n) => n.title)).toEqual(['Proper homes']);
    expect(done.informal.formaliseDays).toEqual({});
    expect(getInformalHappinessModifier(done.informal, TODAY + 30)).toBe(INFORMAL_CONFIG.formaliseHappinessBonus);
  });

  it('a day without water restarts the count', () => {
    const state = servicedSettlement();
    runDays(state, 10);
    state.grid[6][4].building.watered = false;
    const dry = day(state, { weekly: false, today: TODAY + 10 });
    expect(dry.informal.formaliseDays).toEqual({});
  });

  it('never formalise while unzoned or without road access', () => {
    const unzoned = servicedSettlement();
    unzoned.grid[6][4].zone = 'none';
    runDays(unzoned, 40);
    expect(unzoned.grid[6][4].building.type).toBe('informal_housing');

    const noRoad = servicedSettlement();
    runDays(noRoad, 40, { hasRoadAccess: () => false });
    expect(noRoad.grid[6][4].building.type).toBe('informal_housing');
  });
});

describe('informal settlements in the city (S3-T9)', () => {
  function cityWithSettlement(): GameState {
    const state = cityWithRoadAndJobs();
    state.grid[6][4] = { ...state.grid[6][4], building: createInformalBuilding(state.grid[6][4].building) };
    return state;
  }

  it('bulldozing one displaces families: a notification and a 60-day happiness penalty', () => {
    const state = cityWithSettlement();
    const after = bulldozeTile(state, 4, 6);
    const today = getAbsoluteDay(state);
    expect(after.grid[6][4].building.type).toBe('grass');
    expect(after.notifications[0].title).toBe('Families displaced');
    expect(after.informal!.bulldozedDay[String(6 * SIZE + 4)]).toBe(today);
    expect(getInformalHappinessModifier(after.informal, today)).toBe(-INFORMAL_CONFIG.displacement.happinessPenalty);
    expect(getInformalHappinessModifier(after.informal, today + INFORMAL_CONFIG.displacement.durationDays)).toBe(0);
  });

  it('bulldozing anything else only records the cooldown', () => {
    const state = cityWithRoadAndJobs();
    const after = bulldozeTile(state, 8, 6);
    expect(after.notifications).toBe(state.notifications);
    expect(after.informal!.displacedUntilDay).toBeUndefined();
    expect(after.informal!.bulldozedDay[String(6 * SIZE + 8)]).toBe(getAbsoluteDay(state));
  });

  it('settlements pay no tax', () => {
    const without = recalculateDerivedState(cityWithRoadAndJobs());
    const withSettlement = recalculateDerivedState(cityWithSettlement());
    expect(withSettlement.stats.population).toBeGreaterThan(without.stats.population);
    expect(withSettlement.stats.taxIncome).toBe(without.stats.taxIncome);
  });

  it('the empty state has no modifier', () => {
    const none: InformalState | undefined = undefined;
    expect(getInformalHappinessModifier(none, TODAY)).toBe(0);
    expect(getInformalHappinessModifier(EMPTY_INFORMAL_STATE, TODAY)).toBe(0);
  });
});
