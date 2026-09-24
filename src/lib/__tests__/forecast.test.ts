import { describe, expect, it } from 'vitest';
import { addForecast, FORECAST_CONFIG, getForecastsInWindow, pruneForecasts, type Forecast } from '@/lib/forecast';

const f = (id: string, day: number, kind: Forecast['kind'] = 'other'): Forecast => ({ id, title: id, description: '', day, kind });

describe('addForecast', () => {
  it('keeps the list sorted by day', () => {
    let list: Forecast[] = [];
    list = addForecast(list, f('b', 30), 0);
    list = addForecast(list, f('a', 10), 0);
    list = addForecast(list, f('c', 20), 0);
    expect(list.map((x) => x.id)).toEqual(['a', 'c', 'b']);
  });

  it('replaces an entry with the same id', () => {
    let list = addForecast([], f('monsoon-2026', 30, 'monsoon'), 0);
    list = addForecast(list, { ...f('monsoon-2026', 35, 'monsoon'), title: 'updated' }, 0);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ day: 35, title: 'updated' });
  });

  it('drops past forecasts and ignores ones already in the past', () => {
    const list = addForecast([f('old', 5), f('today', 10)], f('new', 20), 10);
    expect(list.map((x) => x.id)).toEqual(['today', 'new']);
    expect(addForecast([], f('past', 3), 10)).toEqual([]);
  });

  it('does not mutate the input and caps the list', () => {
    const input = [f('a', 1)];
    addForecast(input, f('b', 2), 0);
    expect(input).toHaveLength(1);
    let list: Forecast[] = [];
    for (let i = 0; i < FORECAST_CONFIG.maxForecasts + 5; i++) list = addForecast(list, f(`x${i}`, 100 - i), 0);
    expect(list).toHaveLength(FORECAST_CONFIG.maxForecasts);
    expect(list[0].day).toBe(100 - (FORECAST_CONFIG.maxForecasts + 4));
  });
});

describe('getForecastsInWindow / pruneForecasts', () => {
  const list = [f('a', 10), f('b', 40), f('c', 99), f('d', 100)];
  it('returns [from, from + days)', () => {
    expect(getForecastsInWindow(list, 10, 90).map((x) => x.id)).toEqual(['a', 'b', 'c']);
    expect(getForecastsInWindow(list, 11, 90).map((x) => x.id)).toEqual(['b', 'c', 'd']);
  });
  it('prunes days before today', () => {
    expect(pruneForecasts(list, 40).map((x) => x.id)).toEqual(['b', 'c', 'd']);
    expect(pruneForecasts(list, 0)).toBe(list);
  });
});
