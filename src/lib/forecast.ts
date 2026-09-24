/**
 * Calendar forecasts (Sprint 4, S4-T4): upcoming threats and events shown on the calendar strip.
 * Pure list helpers; the caller also sends a `warning` notification when it adds one.
 *
 * Store as `forecasts?: Forecast[]` on GameState. Days are absolute days (see `absoluteDay` in seasons.ts).
 */

export const FORECAST_CONFIG = {
  /** Oldest entries (by day) beyond this count are dropped. */
  maxForecasts: 20,
} as const;

/** What a forecast is about (drives its calendar-strip icon). */
export type ForecastKind = 'monsoon' | 'flood' | 'heatwave' | 'disease' | 'festival' | 'other';

export interface Forecast {
  /** Stable id: adding a forecast with the same id replaces the old one (e.g. `monsoon-2026`). */
  id: string;
  title: string;
  description: string;
  /** Absolute day the forecast event happens. */
  day: number;
  kind: ForecastKind;
}

function byDay(a: Forecast, b: Forecast): number {
  return a.day - b.day || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/** Removes forecasts whose day is before `today`. Returns a new list (or the same list when nothing changed). */
export function pruneForecasts(list: readonly Forecast[], today: number): Forecast[] {
  return list.every((f) => f.day >= today) ? (list as Forecast[]) : list.filter((f) => f.day >= today);
}

/**
 * Adds (or replaces, by id) a forecast. The result is sorted by day, has no entries before `today`,
 * and holds at most `maxForecasts` entries (the soonest ones). Never mutates `list`.
 */
export function addForecast(list: readonly Forecast[], forecast: Forecast, today: number): Forecast[] {
  const next = list.filter((f) => f.id !== forecast.id && f.day >= today);
  if (forecast.day >= today) next.push(forecast);
  next.sort(byDay);
  return next.length > FORECAST_CONFIG.maxForecasts ? next.slice(0, FORECAST_CONFIG.maxForecasts) : next;
}

/** Forecasts with `fromDay ≤ day < fromDay + days`, in day order (e.g. the next 90 days for a 3-month strip). */
export function getForecastsInWindow(list: readonly Forecast[], fromDay: number, days: number): Forecast[] {
  const end = fromDay + days;
  return list.filter((f) => f.day >= fromDay && f.day < end).sort(byDay);
}
