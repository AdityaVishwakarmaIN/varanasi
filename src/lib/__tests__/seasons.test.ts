import { describe, expect, it } from 'vitest';
import { createRng } from '@/lib/rng';
import {
  absoluteDay,
  advanceWeather,
  fromAbsoluteDay,
  getGangaRecoveryMultiplier,
  getSeason,
  getSeasonColor,
  getUpcomingMonths,
  getVehicleSpeedMultiplier,
  isFogActive,
  pickWeather,
  rollWeatherDuration,
  SEASON_CONFIG,
  SEASON_WEATHER,
  SEASONS,
  SIM_WEATHERS,
  type Season,
  type SimWeather,
} from '@/lib/seasons';

describe('getSeason', () => {
  const expected: Record<number, Season> = {
    1: 'winter',
    2: 'winter',
    3: 'summer',
    4: 'summer',
    5: 'summer',
    6: 'summer',
    7: 'monsoon',
    8: 'monsoon',
    9: 'monsoon',
    10: 'postMonsoon',
    11: 'postMonsoon',
    12: 'winter',
  };
  for (let m = 1; m <= 12; m++) {
    it(`month ${m} is ${expected[m]}`, () => expect(getSeason(m)).toBe(expected[m]));
  }
  it('wraps out-of-range months', () => {
    expect(getSeason(13)).toBe('winter');
    expect(getSeason(0)).toBe('winter');
    expect(getSeason(19)).toBe('monsoon');
  });
});

describe('SEASON_CONFIG', () => {
  it('holds the S4-T3 starting values', () => {
    expect(SEASON_CONFIG.summer.powerDemand).toBe(1.3);
    expect(SEASON_CONFIG.summer.waterDemand).toBe(1.25);
    expect(SEASON_CONFIG.monsoon.tourism).toBe(0.5);
    expect(SEASON_CONFIG.postMonsoon.tourism).toBe(1.4);
    expect(SEASON_CONFIG.monsoon.treeGrowth).toBe(2);
    expect(SEASON_CONFIG.monsoon.vehicleSpeed).toBe(0.85);
    expect(SEASON_CONFIG.winter.powerDemand).toBe(1.05);
    expect(SEASON_CONFIG.monsoon.gangaRecovery).toBe(2);
  });

  it('Ganga recovers 2x faster in monsoon only when rising and not in flood', () => {
    expect(getGangaRecoveryMultiplier('monsoon', 0, 40, 60)).toBe(2);
    expect(getGangaRecoveryMultiplier('monsoon', 1, 40, 60)).toBe(1);
    expect(getGangaRecoveryMultiplier('monsoon', 0, 60, 40)).toBe(1);
    expect(getGangaRecoveryMultiplier('summer', 0, 40, 60)).toBe(1);
  });

  it('fog slows vehicles only in the morning', () => {
    expect(isFogActive('fog', 5)).toBe(true);
    expect(isFogActive('fog', 12)).toBe(false);
    expect(isFogActive('clear', 5)).toBe(false);
    expect(getVehicleSpeedMultiplier('winter', 'fog', 3)).toBeCloseTo(0.6);
    expect(getVehicleSpeedMultiplier('winter', 'fog', 15)).toBe(1);
    expect(getVehicleSpeedMultiplier('monsoon', 'storm', 3)).toBe(0.85);
  });
});

describe('SEASON_WEATHER', () => {
  it('each row sums to 1', () => {
    for (const s of SEASONS) {
      const sum = SIM_WEATHERS.reduce((a, w) => a + SEASON_WEATHER[s][w], 0);
      expect(sum).toBeCloseTo(1, 10);
    }
  });

  it('seeded picks match the table over 10k draws', () => {
    for (const season of SEASONS) {
      const rng = createRng(1234);
      const counts = Object.fromEntries(SIM_WEATHERS.map((w) => [w, 0])) as Record<SimWeather, number>;
      const N = 10000;
      for (let i = 0; i < N; i++) counts[pickWeather(season, rng)]++;
      for (const w of SIM_WEATHERS) {
        expect(Math.abs(counts[w] / N - SEASON_WEATHER[season][w])).toBeLessThan(0.02);
        if (SEASON_WEATHER[season][w] === 0) expect(counts[w]).toBe(0);
      }
    }
  });

  it('July is mostly stormy, April often hazy, January often foggy', () => {
    const rng = createRng(7);
    const count = (month: number, w: SimWeather) => {
      let n = 0;
      for (let i = 0; i < 1000; i++) if (pickWeather(getSeason(month), rng) === w) n++;
      return n;
    };
    expect(count(7, 'storm') + count(7, 'severe_storm')).toBeGreaterThan(500);
    expect(count(4, 'heat_haze')).toBeGreaterThan(200);
    expect(count(1, 'fog')).toBeGreaterThan(250);
  });

  it('is deterministic for a seed', () => {
    const a = createRng(99);
    const b = createRng(99);
    for (let i = 0; i < 50; i++) expect(pickWeather('monsoon', a)).toBe(pickWeather('monsoon', b));
  });
});

describe('weather duration and advance', () => {
  it('rollWeatherDuration is 2-5 days and hits every value', () => {
    const rng = createRng(3);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const d = rollWeatherDuration(rng);
      expect(d).toBeGreaterThanOrEqual(2);
      expect(d).toBeLessThanOrEqual(5);
      expect(Number.isInteger(d)).toBe(true);
      seen.add(d);
    }
    expect([...seen].sort()).toEqual([2, 3, 4, 5]);
    expect(rollWeatherDuration(() => 0)).toBe(2);
    expect(rollWeatherDuration(() => 0.999999)).toBe(5);
  });

  it('picks immediately for old saves, keeps weather until the day, then re-picks', () => {
    const rng = createRng(5);
    const first = advanceWeather({}, 100, 'monsoon', rng);
    expect(first.changed).toBe(true);
    expect(first.weatherUntilDay).toBeGreaterThanOrEqual(102);
    expect(first.weatherUntilDay).toBeLessThanOrEqual(105);
    const same = advanceWeather(first, first.weatherUntilDay - 1, 'monsoon', rng);
    expect(same).toEqual({ ...first, changed: false });
    const next = advanceWeather(first, first.weatherUntilDay, 'monsoon', rng);
    expect(next.weatherUntilDay).toBeGreaterThan(first.weatherUntilDay);
  });

  it('forced weather overrides without moving the schedule', () => {
    const r = advanceWeather({ weather: 'clear', weatherUntilDay: 50 }, 45, 'summer', createRng(1), 'heat_haze');
    expect(r).toEqual({ weather: 'heat_haze', weatherUntilDay: 50, changed: true });
  });
});

describe('calendar helpers', () => {
  it('absoluteDay counts 30-day months from 1 Jan 2024', () => {
    expect(absoluteDay(2024, 1, 1)).toBe(0);
    expect(absoluteDay(2024, 1, 30)).toBe(29);
    expect(absoluteDay(2024, 2, 1)).toBe(30);
    expect(absoluteDay(2025, 1, 1)).toBe(360);
    expect(fromAbsoluteDay(absoluteDay(2026, 7, 15))).toEqual({ year: 2026, month: 7, day: 15 });
    for (let d = 0; d < 800; d += 17) {
      const { year, month, day } = fromAbsoluteDay(d);
      expect(absoluteDay(year, month, day)).toBe(d);
    }
  });

  it('getUpcomingMonths wraps the year and carries seasons', () => {
    const months = getUpcomingMonths(11, 2026, 3);
    expect(months.map((m) => [m.month, m.year, m.season])).toEqual([
      [11, 2026, 'postMonsoon'],
      [12, 2026, 'winter'],
      [1, 2027, 'winter'],
    ]);
    expect(months[0].startDay).toBe(absoluteDay(2026, 11, 1));
    expect(months[2].endDay).toBe(absoluteDay(2027, 2, 1));
  });

  it('every season has a colour', () => {
    for (const s of SEASONS) expect(getSeasonColor(s)).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
