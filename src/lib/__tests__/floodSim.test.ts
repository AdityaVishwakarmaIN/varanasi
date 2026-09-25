import { describe, expect, it } from 'vitest';
import { createRng } from '@/lib/rng';
import { createInitialGameState, placeBuilding, simulateTick } from '@/lib/simulation';
import { absoluteDay, CALENDAR } from '@/lib/seasons';
import { FLOOD_CONFIG } from '@/lib/floods';
import {
  applyFloodToServices,
  countBuildingsIn,
  getCityFloodMask,
  getCitySiltMask,
  getFloodHappinessModifier,
  runFloodDay,
  type FloodStateFields,
} from '@/lib/floodSim';
import { getRiverZone } from '@/games/isocity/maps/riverZones';
import type { GameState } from '@/types/game';

const SIZE = 60;

function newVaranasi(): GameState {
  return createInitialGameState(SIZE, 'Floods', createRng(11), 'varanasi');
}

function countOnes(mask: Uint8Array | null): number {
  if (!mask) return 0;
  let n = 0;
  for (let i = 0; i < mask.length; i++) n += mask[i];
  return n;
}

/** First land tile in a river zone. */
function findZone(state: GameState, zone: string): { x: number; y: number } {
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (getRiverZone(x, y, SIZE, state.mapId) === zone && state.grid[y][x].building.type !== 'water') return { x, y };
    }
  }
  throw new Error(`no ${zone} tile`);
}

/** A Varanasi city with a small house on every flooded-at-level-1 land tile. */
function cityWithFloodplainHomes(): GameState {
  const state = newVaranasi();
  const mask = getCityFloodMask({ ...state, riverLevel: 1 })!;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    const tile = state.grid[(i / SIZE) | 0][i % SIZE];
    if (tile.building.type === 'water') continue;
    tile.building = { ...tile.building, type: 'house_small', population: 10 };
    tile.zone = 'residential';
  }
  return state;
}

describe('flood masks for a city (S4-T5)', () => {
  it('nothing floods on random maps or while the river is low', () => {
    const random = createInitialGameState(SIZE, 'Random', createRng(11));
    expect(getCityFloodMask({ ...random, riverLevel: 3 })).toBeNull();
    expect(getCityFloodMask({ ...newVaranasi(), riverLevel: 0 })).toBeNull();
  });

  it('more land floods as the river rises', () => {
    const state = newVaranasi();
    const counts = [1, 2, 3].map((riverLevel) => countOnes(getCityFloodMask({ ...state, riverLevel })));
    expect(counts[0]).toBeGreaterThan(0);
    expect(counts[1]).toBeGreaterThan(counts[0]);
    expect(counts[2]).toBeGreaterThan(counts[1]);
  });

  it('the west riverfront (ghats) floods at level 2 but not at level 1', () => {
    const state = newVaranasi();
    const front = findZone(state, 'westRiverfront');
    const i = front.y * SIZE + front.x;
    expect(getCityFloodMask({ ...state, riverLevel: 1 })![i]).toBe(0);
    expect(getCityFloodMask({ ...state, riverLevel: 2 })![i]).toBe(1);
  });

  it('flooded tiles lose power and water; other rows are shared', () => {
    const state = newVaranasi();
    const size = state.gridSize;
    const base = {
      ...state.services,
      power: state.services.power.map((row) => row.map(() => true)),
      water: state.services.water.map((row) => row.map(() => true)),
    };
    const mask = getCityFloodMask({ ...state, riverLevel: 1 })!;
    const out = applyFloodToServices(base, mask, size);
    expect(applyFloodToServices(base, null, size)).toBe(base);
    for (let i = 0; i < mask.length; i++) {
      const x = i % size;
      const y = (i / size) | 0;
      expect(out.power[y][x]).toBe(!mask[i]);
      expect(out.water[y][x]).toBe(!mask[i]);
    }
    const dryRow = out.power.findIndex((row, y) => row.every((_, x) => !mask[y * size + x]));
    expect(out.power[dryRow]).toBe(base.power[dryRow]);
  });

  it('happiness falls with the share of residents flooded', () => {
    expect(getFloodHappinessModifier(0)).toBeCloseTo(0);
    expect(getFloodHappinessModifier(0.5)).toBeLessThan(0);
    expect(getFloodHappinessModifier(1)).toBeLessThan(getFloodHappinessModifier(0.5));
  });
});

describe('a monsoon season, day by day (S4-T5)', () => {
  /** Runs runFloodDay for every day from 1 June to 30 September. */
  function runSeason(state: GameState, rng: () => number) {
    let fields: FloodStateFields = {};
    const log: { month: number; day: number; result: ReturnType<typeof runFloodDay> }[] = [];
    for (let month = 6; month <= 9; month++) {
      for (let day = 1; day <= CALENDAR.daysPerMonth; day++) {
        const result = runFloodDay({ ...state, ...fields }, month, day, absoluteDay(2025, month, day), rng);
        fields = result.fields;
        log.push({ month, day, result });
      }
    }
    return { fields, log };
  }

  it('a heavy monsoon is forecast on 1 June, floods homes from July and recedes by 30 September', () => {
    const state = cityWithFloodplainHomes();
    const { fields, log } = runSeason(state, () => 0.99); // 0.99: heavy monsoon, and no damage rolls succeed

    const june1 = log[0].result;
    expect(june1.fields.monsoonStrength).toBe('heavy');
    expect(june1.forecast).toMatchObject({ id: 'monsoon', overlay: 'flood', daysAhead: FLOOD_CONFIG.forecastDaysAhead });

    const july1 = log.find((e) => e.month === 7 && e.day === 1)!.result;
    expect(july1.notifications[0]).toMatchObject({ severity: 'warning', overlay: 'flood' });
    expect(july1.notifications[0].x).toBeDefined();

    const crises = log.flatMap((e) => e.result.notifications.filter((n) => n.severity === 'crisis'));
    expect(crises.length).toBe(FLOOD_CONFIG.peakLevel.heavy); // one per new level: 1, 2, 3
    expect(crises.every((n) => n.x !== undefined && n.overlay === 'flood')).toBe(true);

    expect(Math.max(...log.map((e) => e.result.fields.riverLevel ?? 0))).toBe(3);
    expect(fields.riverLevel).toBe(0);
    const receded = log.flatMap((e) => e.result.notifications.filter((n) => n.title === 'The floodwaters have gone down'));
    expect(receded).toHaveLength(1);
    expect(log.every((e) => e.result.damaged.length === 0)).toBe(true);
  });

  it('flooded buildings are ruined when the damage roll hits', () => {
    const state = cityWithFloodplainHomes();
    // Mid-August is the peak of the season
    const peak = runFloodDay(
      { ...state, monsoonStrength: 'weak', riverLevel: 1, floodNotifiedLevel: 1 },
      8,
      15,
      absoluteDay(2025, 8, 15),
      () => 0
    );
    expect(peak.fields.riverLevel).toBe(1);
    const homes = countBuildingsIn(state.grid, SIZE, getCityFloodMask({ ...state, riverLevel: 1 })!).count;
    expect(peak.damaged.length).toBe(homes);
    expect(homes).toBeGreaterThan(0);
  });

  it('receding water leaves silt for a few days', () => {
    const state = newVaranasi();
    const fell = runFloodDay({ ...state, monsoonStrength: 'heavy', riverLevel: 3, floodNotifiedLevel: 3 }, 9, 20, 500, () => 0.99);
    expect(fell.fields.riverLevel).toBeLessThan(3);
    expect(fell.fields.siltLevel).toBe(3);
    const after = { ...state, ...fell.fields };
    const silt = getCitySiltMask(after, 500);
    expect(countOnes(silt)).toBeGreaterThan(0);
    expect(getCitySiltMask(after, 500 + FLOOD_CONFIG.siltDays + 1)).toBeNull();
  });

  it('other maps have no monsoon floods', () => {
    const random = createInitialGameState(SIZE, 'Random', createRng(11));
    const r = runFloodDay(random, 6, 1, absoluteDay(2025, 6, 1), () => 0.99);
    expect(r.forecast).toBeUndefined();
    expect(r.fields.monsoonStrength).toBeUndefined();
  });
});

describe('floods in simulateTick (S4-T5)', () => {
  it('a new flood crisis pauses the city and puts the monsoon on the calendar', () => {
    // 30 June, last tick of the day: the next tick is 1 July, when the river starts rising
    const june = { ...cityWithFloodplainHomes(), month: 6, day: 1, tick: CALENDAR.ticksPerDay - 1, speed: 1 as const };
    const forecast = simulateTick({ ...june, day: 30, month: 5 }, undefined, () => 0.99);
    expect(forecast.monsoonStrength).toBe('heavy');
    expect(forecast.forecasts?.some((f) => f.id === 'monsoon')).toBe(true);

    let s: GameState = { ...forecast, month: 6, day: 30, tick: CALENDAR.ticksPerDay - 1, speed: 1 };
    for (let i = 0; i < CALENDAR.ticksPerDay * 20 && (s.riverLevel ?? 0) === 0; i++) s = simulateTick(s, undefined, () => 0.99);
    expect(s.riverLevel).toBe(1);
    expect(s.notifications.some((n) => n.severity === 'crisis' && n.overlay === 'flood')).toBe(true);
    expect(s.speed).toBe(0);
  });

  it('flooded ghats earn no tourism', () => {
    const state = newVaranasi();
    const front = findZone(state, 'westRiverfront');
    let city = placeBuilding(state, front.x, front.y, 'ghat', null);
    const ghat = city.grid[front.y][front.x].building;
    city.grid[front.y][front.x].building = { ...ghat, constructionProgress: 100 };
    city = { ...city, tick: 5 };
    const dry = simulateTick({ ...city, riverLevel: 0 });
    const wet = simulateTick({ ...city, riverLevel: 2, monsoonStrength: 'normal' });
    expect(dry.stats.tourismIncome!).toBeGreaterThan(0);
    expect(wet.stats.tourismIncome).toBe(0);
  });
});
