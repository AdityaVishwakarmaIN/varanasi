import { describe, expect, it } from 'vitest';
import { createRng } from '@/lib/rng';
import { createInitialGameState } from '@/lib/simulation';
import { absoluteDay } from '@/lib/seasons';
import { getRiverZone } from '@/games/isocity/maps/riverZones';
import {
  applyFestivalForecasts,
  applyFestivalStats,
  getEventArea,
  getEventReadiness,
  getLargestGhatCluster,
  getLiveFestivals,
  getUpcomingManagementEvent,
  runFestivalDay,
} from '@/lib/festivalSim';
import { estimateAreaTraffic, getFestivalCrowdMultipliers, FESTIVALS } from '@/lib/festivals';
import type { GameState } from '@/types/game';

const SIZE = 60;
let version = 1000;

function newVaranasi(): GameState {
  const s = createInitialGameState(SIZE, 'Festivals', createRng(5), 'varanasi');
  s.structureVersion = version++;
  return s;
}

function riverfrontTiles(state: GameState): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (getRiverZone(x, y, SIZE, state.mapId) === 'westRiverfront' && state.grid[y][x].building.type !== 'water') out.push({ x, y });
    }
  }
  return out;
}

function addGhats(state: GameState, n: number): { x: number; y: number }[] {
  const tiles = riverfrontTiles(state).slice(20, 20 + n);
  for (const { x, y } of tiles) state.grid[y][x].building = { ...state.grid[y][x].building, type: 'ghat' };
  state.structureVersion = version++;
  return tiles;
}

/** Full coverage everywhere, so every requirement except access (roads) can pass. */
function fullServices(state: GameState): void {
  const fill = <T,>(v: T) => Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => v));
  state.services = { police: fill(100), fire: fill(100), health: fill(100), education: fill(0), power: fill(true), water: fill(true) };
  state.stats = { ...state.stats, gangaHealth: 80 };
}

function addRoadsInArea(state: GameState): void {
  const area = getEventArea(state, 'dev_deepawali');
  for (let k = 0; k < area.indices.length; k += 3) {
    const i = area.indices[k];
    const t = state.grid[(i / SIZE) | 0][i % SIZE];
    if (t.building.type !== 'ghat') t.building = { ...t.building, type: 'road', population: 0, jobs: 0 };
  }
  state.structureVersion = version++;
}

describe('event areas', () => {
  it('largest ghat cluster', () => {
    const c = getLargestGhatCluster([{ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 6, y: 6 }, { x: 7, y: 7 }], 10)!;
    expect(c.tiles).toHaveLength(3);
    expect(c.center).toEqual({ x: 6, y: 6 });
    expect(getLargestGhatCluster([], 10)).toBeNull();
  });

  it('Dev Deepawali covers the riverfront and land near ghats; Shivratri falls back to the ghats at half scale', () => {
    const s = newVaranasi();
    const riverfront = riverfrontTiles(s).length;
    const bare = getEventArea(s, 'dev_deepawali');
    expect(bare.indices.length).toBe(riverfront);
    expect(getEventArea(s, 'maha_shivratri').center).toBeNull();
    const ghats = addGhats(s, 3);
    const withGhats = getEventArea(s, 'dev_deepawali');
    expect(withGhats.indices.length).toBeGreaterThan(riverfront);
    expect(withGhats.center).toEqual(ghats[1]);
    const shiv = getEventArea(s, 'maha_shivratri');
    expect(shiv.scale).toBe(0.5);
    expect(shiv.center).toEqual(ghats[1]);
  });
});

describe('daily festival step', () => {
  it('announces festivals 30 days ahead once; management events notify, visual ones only go on the strip', () => {
    const s = newVaranasi();
    s.month = 10;
    s.day = 16; // Diwali 11/1 is 15 days away, Dev Deepawali 11/15 is 29 days away
    const today = absoluteDay(s.year, 10, 16);
    const r = runFestivalDay(s, today, 10, 16);
    expect(r.forecasts.map((f) => [f.input.id, f.notify])).toEqual([
      ['festival-diwali', false],
      ['festival-chhath', false],
      ['festival-dev_deepawali', true],
    ]);
    const applied = applyFestivalForecasts({ ...s, forecasts: [], notifications: [] }, r.forecasts);
    expect(applied.forecasts?.map((f) => f.id)).toEqual(['festival-diwali', 'festival-chhath', 'festival-dev_deepawali']);
    expect(applied.notifications.map((n) => n.id)).toEqual([`forecast-festival-dev_deepawali-${today + 29}`]);
    // Next day: nothing new
    const again = runFestivalDay({ ...s, festival: r.festival }, today + 1, 10, 17);
    expect(again.forecasts).toEqual([]);
    expect(again.festival).toBe(r.festival);
  });

  it('only on the Varanasi map', () => {
    const s = createInitialGameState(SIZE, 'Plain', createRng(5));
    expect(runFestivalDay(s, 100, 10, 16).forecasts).toEqual([]);
  });

  it('an unprepared city is overwhelmed: crisis notification with location, unhappy for 30 days, no tourism boost', () => {
    const s = newVaranasi();
    addGhats(s, 3);
    const today = absoluteDay(s.year, 11, 15);
    const r = runFestivalDay(s, today, 11, 15);
    expect(r.festival?.event).toMatchObject({ id: 'dev_deepawali', outcome: 'overwhelmed', tourismMultiplier: 1 });
    expect(r.festival?.mood).toEqual({ delta: -5, untilDay: today + 29 });
    const n = r.notifications[0];
    expect(n.severity).toBe('crisis');
    expect(n.x).toBeDefined();
    expect(n.description).toMatch(/^Crowds overwhelmed the ghats: not enough police/);
    expect(n.description).not.toMatch(/injur|death|died/i);
  });

  it('a prepared city triumphs: tourism × 3 on the day and happiness +5 for 60 days', () => {
    const s = newVaranasi();
    addGhats(s, 3);
    fullServices(s);
    addRoadsInArea(s);
    const readiness = getEventReadiness(s, 'dev_deepawali');
    expect(readiness.checklist.filter((c) => !c.passed).map((c) => c.requirement)).toEqual([]);
    const today = absoluteDay(s.year, 11, 15);
    const r = runFestivalDay(s, today, 11, 15);
    expect(r.festival?.event?.outcome).toBe('triumph');
    expect(r.notifications[0].severity).toBe('info');

    const stats = { ...s.stats, tourismIncome: 100, income: 500, happiness: 50 };
    applyFestivalStats(stats, r.festival, today);
    expect(stats).toMatchObject({ tourismIncome: 300, income: 700, happiness: 55 });
    const later = { ...s.stats, tourismIncome: 100, income: 500, happiness: 50 };
    applyFestivalStats(later, r.festival, today + 10);
    expect(later).toMatchObject({ tourismIncome: 100, happiness: 55 });
    const after = { ...s.stats, happiness: 50 };
    applyFestivalStats(after, r.festival, today + 60);
    expect(after.happiness).toBe(50);
  });

  it('Maha Shivratri without the temple runs at half scale', () => {
    const s = newVaranasi();
    addGhats(s, 3);
    fullServices(s);
    const area = getEventArea(s, 'maha_shivratri');
    for (let k = 0; k < area.indices.length; k += 3) {
      const i = area.indices[k];
      const t = s.grid[(i / SIZE) | 0][i % SIZE];
      if (t.building.type !== 'ghat') t.building = { ...t.building, type: 'road', population: 0, jobs: 0 };
    }
    s.structureVersion = version++;
    const today = absoluteDay(s.year, 2, 26);
    const r = runFestivalDay(s, today, 2, 26);
    expect(r.festival?.event).toMatchObject({ outcome: 'triumph', tourismMultiplier: 2, endDay: today + 1 });
    expect(r.notifications[0].description).toMatch(/Kashi Vishwanath/);
  });

  it('a city without ghats: the event passes quietly', () => {
    const s = newVaranasi();
    const today = absoluteDay(s.year, 2, 26);
    const r = runFestivalDay(s, today, 2, 26);
    expect(r.festival?.event).toBeUndefined();
    expect(r.notifications[0].title).toMatch(/passed quietly/);
  });
});

describe('renderer helpers', () => {
  it('crowd multipliers', () => {
    expect(getFestivalCrowdMultipliers([])).toEqual({ pedestrians: 1, cars: 1 });
    expect(getFestivalCrowdMultipliers([FESTIVALS.dev_deepawali, FESTIVALS.ganga_aarti])).toEqual({ pedestrians: 3, cars: 1.5 });
    expect(getFestivalCrowdMultipliers([FESTIVALS.maha_shivratri], 0.5)).toEqual({ pedestrians: 2, cars: 1.25 });
    expect(getFestivalCrowdMultipliers([FESTIVALS.holi])).toEqual({ pedestrians: 1.5, cars: 1 });
  });

  it('live festivals and the upcoming management event', () => {
    const s = newVaranasi();
    expect(getLiveFestivals({ ...s, month: 3, day: 14 }, 12).active.map((f) => f.id)).toEqual(['holi']);
    expect(getLiveFestivals({ ...s, month: 6, day: 1 }, 19).active.map((f) => f.id)).toEqual(['ganga_aarti']);
    expect(getUpcomingManagementEvent(10, 20)).toEqual({ id: 'dev_deepawali', daysUntil: 25 });
    expect(getUpcomingManagementEvent(11, 15)).toEqual({ id: 'dev_deepawali', daysUntil: 0 });
    expect(getUpcomingManagementEvent(6, 1)).toBeNull();
  });

  it('traffic estimate', () => {
    expect(estimateAreaTraffic(100, 0)).toBe(100);
    expect(estimateAreaTraffic(0, 5)).toBe(0);
    expect(estimateAreaTraffic(60, 2)).toBe(50);
  });
});
