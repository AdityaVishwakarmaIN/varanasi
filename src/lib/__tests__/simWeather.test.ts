import { describe, expect, it } from 'vitest';
import { createRng } from '@/lib/rng';
import { createInitialGameState, simulateTick } from '@/lib/simulation';
import { absoluteDay, CALENDAR, WEATHER_CONFIG } from '@/lib/seasons';
import type { GameState } from '@/types/game';

const SIZE = 30;

function newCity(month: number): GameState {
  const state = createInitialGameState(SIZE, 'Weather', createRng(3));
  return { ...state, month, day: 1, tick: 0 };
}

/** Ticks until the end of the current in-game day. */
function tickOneDay(state: GameState, rng: () => number): GameState {
  let s = state;
  for (let i = 0; i < CALENDAR.ticksPerDay; i++) s = simulateTick(s, undefined, rng);
  return s;
}

describe('weather owned by the simulation (S4-T2)', () => {
  it('an old save without weather gets a pick on the first tick, scheduled 2–5 days ahead', () => {
    const state = newCity(7);
    delete state.weather;
    delete state.weatherUntilDay;
    const next = simulateTick(state, undefined, createRng(1));
    expect(next.weather).toBeDefined();
    const today = absoluteDay(next.year, next.month, next.day);
    expect(next.weatherUntilDay! - today).toBeGreaterThanOrEqual(WEATHER_CONFIG.minDurationDays);
    expect(next.weatherUntilDay! - today).toBeLessThanOrEqual(WEATHER_CONFIG.maxDurationDays);
  });

  it('keeps the weather until weatherUntilDay, then re-rolls', () => {
    const rng = createRng(5);
    let s = simulateTick(newCity(1), undefined, rng);
    const first = { weather: s.weather, until: s.weatherUntilDay! };
    // Within the spell nothing changes
    while (absoluteDay(s.year, s.month, s.day) < first.until - 1) {
      s = tickOneDay(s, rng);
      expect(s.weather).toBe(first.weather);
      expect(s.weatherUntilDay).toBe(first.until);
    }
    s = tickOneDay(s, rng);
    expect(s.weatherUntilDay).toBeGreaterThan(first.until);
  });

  it('follows the season: July is mostly stormy, January has fog and never storms', () => {
    const count = (month: number) => {
      const counts: Record<string, number> = {};
      const base = newCity(month);
      for (let seed = 0; seed < 200; seed++) {
        const w = simulateTick(base, undefined, createRng(seed)).weather!;
        counts[w] = (counts[w] ?? 0) + 1;
      }
      return counts;
    };
    const july = count(7);
    expect((july.storm ?? 0) + (july.severe_storm ?? 0)).toBeGreaterThan(100);
    const jan = count(1);
    expect(jan.fog ?? 0).toBeGreaterThan(30);
    expect(jan.storm ?? 0).toBe(0);
    const april = count(4);
    expect(april.heat_haze ?? 0).toBeGreaterThan(30);
  });

  it('forced weather (tests, benchmarks) is used without touching the stored schedule', () => {
    const s = simulateTick(newCity(7), undefined, createRng(2));
    const next = simulateTick({ ...s, tick: CALENDAR.ticksPerDay - 1 }, 'clear', createRng(9));
    expect(next.weather).toBe(s.weather);
    expect(next.weatherUntilDay).toBe(s.weatherUntilDay);
  });

  it('survives a save/load round trip', () => {
    const s = simulateTick(newCity(12), undefined, createRng(4));
    const loaded = JSON.parse(JSON.stringify(s)) as GameState;
    expect(loaded.weather).toBe(s.weather);
    expect(loaded.weatherUntilDay).toBe(s.weatherUntilDay);
  });
});
