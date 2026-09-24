/**
 * Seasons, the game calendar and simulation-owned weather (Sprint 4, S4-T1 / S4-T2 / S4-T3 / S4-T8).
 *
 * Pure module: no React, DOM or `Math.random()`. Randomness comes from an injected `Rng`
 * (see `src/lib/rng.ts`), so weather picks are saveable and testable.
 *
 * Game calendar (matches `simulateTick` in `src/lib/simulation.ts`):
 *   30 ticks = 1 day, 30 days = 1 month, 12 months = 1 year (360 days), first year = 2024.
 */
import type { Rng } from '@/lib/rng';

// ---------------------------------------------------------------------------
// Calendar
// ---------------------------------------------------------------------------

/** The simulation's calendar constants. Every month has exactly 30 days. */
export const CALENDAR = {
  ticksPerDay: 30,
  daysPerMonth: 30,
  monthsPerYear: 12,
  daysPerWeek: 7,
  /** Year 0 of the absolute day count (same epoch as `totalTicks` in `simulateTick`). */
  epochYear: 2024,
} as const;

/** Days in one game year (12 × 30 = 360). */
export const DAYS_PER_YEAR = CALENDAR.daysPerMonth * CALENDAR.monthsPerYear;

/** Ticks in one game year (360 × 30 = 10,800). */
export const TICKS_PER_YEAR = DAYS_PER_YEAR * CALENDAR.ticksPerDay;

/**
 * Absolute day number since 1 Jan of `CALENDAR.epochYear` (1 Jan 2024 = 0).
 * Use it for "until" fields such as `weatherUntilDay`, heatwave start/end and forecast days.
 * @param month 1–12
 * @param day 1–30
 */
export function absoluteDay(year: number, month: number, day: number): number {
  return ((year - CALENDAR.epochYear) * CALENDAR.monthsPerYear + (month - 1)) * CALENDAR.daysPerMonth + (day - 1);
}

/** Inverse of `absoluteDay`. */
export function fromAbsoluteDay(abs: number): { year: number; month: number; day: number } {
  const d = Math.floor(abs);
  const monthIndex = Math.floor(d / CALENDAR.daysPerMonth);
  const day = d - monthIndex * CALENDAR.daysPerMonth + 1;
  const yearOffset = Math.floor(monthIndex / CALENDAR.monthsPerYear);
  const month = monthIndex - yearOffset * CALENDAR.monthsPerYear + 1;
  return { year: CALENDAR.epochYear + yearOffset, month, day };
}

/** Wraps any integer month onto 1–12 (13 → 1, 0 → 12). */
export function normalizeMonth(month: number): number {
  const m = Math.floor(month) - 1;
  return (((m % CALENDAR.monthsPerYear) + CALENDAR.monthsPerYear) % CALENDAR.monthsPerYear) + 1;
}

// ---------------------------------------------------------------------------
// Seasons
// ---------------------------------------------------------------------------

/** The Indian seasons used by the game. */
export type Season = 'summer' | 'monsoon' | 'postMonsoon' | 'winter';

/** All seasons in calendar order (starting with the one that begins in March). */
export const SEASONS: readonly Season[] = ['summer', 'monsoon', 'postMonsoon', 'winter'];

/** Which months (1–12) belong to each season. */
export const SEASON_MONTHS: Record<Season, readonly number[]> = {
  summer: [3, 4, 5, 6],
  monsoon: [7, 8, 9],
  postMonsoon: [10, 11],
  winter: [12, 1, 2],
};

const MONTH_TO_SEASON: readonly Season[] = (() => {
  const out: Season[] = new Array(13);
  for (const season of SEASONS) for (const m of SEASON_MONTHS[season]) out[m] = season;
  return out;
})();

/** The season for a month (1–12; other integers wrap). Mar–Jun summer, Jul–Sep monsoon, Oct–Nov post-monsoon, Dec–Feb winter. */
export function getSeason(month: number): Season {
  return MONTH_TO_SEASON[normalizeMonth(month)];
}

/** Player-facing season names (wrap in `msg()` in UI code). */
export const SEASON_LABELS: Record<Season, string> = {
  summer: 'Summer',
  monsoon: 'Monsoon',
  postMonsoon: 'Post-monsoon',
  winter: 'Winter',
};

/** Calendar-strip colours: summer orange, monsoon blue-grey, post-monsoon gold, winter pale blue. */
export const SEASON_COLORS: Record<Season, string> = {
  summer: '#e8892b',
  monsoon: '#6b7f8e',
  postMonsoon: '#d4a53a',
  winter: '#a9cbe8',
};

/** Calendar-strip colour for a season. */
export function getSeasonColor(season: Season): string {
  return SEASON_COLORS[season];
}

/** Gameplay multipliers for one season (S4-T3). 1 = no change. */
export interface SeasonEffects {
  /** Multiplies power demand (`seasonMultiplier` in utilities, S3-T7). */
  powerDemand: number;
  /** Multiplies water demand (S3-T8). */
  waterDemand: number;
  /** Multiplies ghat / landmark tourism income (S2-T9). */
  tourism: number;
  /** Multiplies tree growth chance (`treeGrowth.ts`). */
  treeGrowth: number;
  /** Multiplies vehicle speed. Fog is applied separately (see `getVehicleSpeedMultiplier`). */
  vehicleSpeed: number;
  /** Multiplies Ganga Health's daily approach while it is recovering and the river is not in flood. */
  gangaRecovery: number;
}

/** Starting values from S4-T3. Tuned in S4-T12. */
export const SEASON_CONFIG: Record<Season, SeasonEffects> = {
  summer: { powerDemand: 1.3, waterDemand: 1.25, tourism: 0.8, treeGrowth: 0.5, vehicleSpeed: 1.0, gangaRecovery: 1 },
  monsoon: { powerDemand: 1.0, waterDemand: 0.9, tourism: 0.5, treeGrowth: 2.0, vehicleSpeed: 0.85, gangaRecovery: 2 },
  postMonsoon: { powerDemand: 1.0, waterDemand: 1.0, tourism: 1.4, treeGrowth: 1.0, vehicleSpeed: 1.0, gangaRecovery: 1 },
  winter: { powerDemand: 1.05, waterDemand: 0.95, tourism: 1.1, treeGrowth: 0.7, vehicleSpeed: 1.0, gangaRecovery: 1 },
};

/**
 * Multiplier for the Ganga's daily approach step (S2-T7 `dailyApproach`).
 * The monsoon's fresh water speeds up recovery, but only while health is rising and the river is not in flood.
 */
export function getGangaRecoveryMultiplier(season: Season, riverLevel: number, currentHealth: number, targetHealth: number): number {
  if (riverLevel > 0 || targetHealth <= currentHealth) return 1;
  return SEASON_CONFIG[season].gangaRecovery;
}

/** One entry of the calendar strip. `startDay`/`endDay` are absolute days (end exclusive). */
export interface CalendarMonth {
  month: number;
  year: number;
  season: Season;
  startDay: number;
  endDay: number;
}

/** The current month plus the following `count − 1` months, for the calendar strip (S4-T1 shows 3). */
export function getUpcomingMonths(month: number, year: number, count: number): CalendarMonth[] {
  const out: CalendarMonth[] = [];
  let m = normalizeMonth(month);
  let y = year + Math.floor((Math.floor(month) - 1) / CALENDAR.monthsPerYear);
  for (let i = 0; i < count; i++) {
    const startDay = absoluteDay(y, m, 1);
    out.push({ month: m, year: y, season: getSeason(m), startDay, endDay: startDay + CALENDAR.daysPerMonth });
    m++;
    if (m > CALENDAR.monthsPerYear) {
      m = 1;
      y++;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Weather
// ---------------------------------------------------------------------------

/**
 * Weather decided by the simulation. The first four match the renderer's `CloudWeatherMode`
 * (`src/components/game/types.ts`); `fog` and `heat_haze` are new in S4-T2.
 */
export type SimWeather = 'clear' | 'light_clouds' | 'storm' | 'severe_storm' | 'fog' | 'heat_haze';

/** Every weather mode, in the order `pickWeather` walks the probability table. */
export const SIM_WEATHERS: readonly SimWeather[] = ['clear', 'light_clouds', 'storm', 'severe_storm', 'fog', 'heat_haze'];

/** Probability of each weather mode per season (S4-T2). Each row sums to 1. */
export const SEASON_WEATHER: Record<Season, Record<SimWeather, number>> = {
  summer: { clear: 0.45, light_clouds: 0.2, storm: 0.05, severe_storm: 0, fog: 0, heat_haze: 0.3 },
  monsoon: { clear: 0.05, light_clouds: 0.25, storm: 0.5, severe_storm: 0.2, fog: 0, heat_haze: 0 },
  postMonsoon: { clear: 0.55, light_clouds: 0.35, storm: 0.1, severe_storm: 0, fog: 0, heat_haze: 0 },
  winter: { clear: 0.45, light_clouds: 0.2, storm: 0, severe_storm: 0, fog: 0.35, heat_haze: 0 },
};

/** Weather duration and winter-fog tunables (S4-T2 / S4-T8). */
export const WEATHER_CONFIG = {
  /** A weather spell lasts between these many days (inclusive). */
  minDurationDays: 2,
  maxDurationDays: 5,
  /** Fog slows traffic during hours [fogStartHour, fogEndHour) of the visual day. */
  fogStartHour: 0,
  fogEndHour: 11,
  /** Vehicle speed multiplier while fog is active (on top of the season multiplier). */
  fogVehicleSpeed: 0.6,
} as const;

/** Picks a weather mode for the season from `SEASON_WEATHER` using one `rng()` draw. */
export function pickWeather(season: Season, rng: Rng): SimWeather {
  const table = SEASON_WEATHER[season];
  let total = 0;
  for (const w of SIM_WEATHERS) total += table[w];
  let r = rng() * total;
  let last: SimWeather = 'clear';
  for (const w of SIM_WEATHERS) {
    const p = table[w];
    if (p <= 0) continue;
    last = w;
    if (r < p) return w;
    r -= p;
  }
  return last;
}

/** Whole number of days (2–5 by default, inclusive) that a new weather spell lasts. */
export function rollWeatherDuration(rng: Rng): number {
  const { minDurationDays: min, maxDurationDays: max } = WEATHER_CONFIG;
  return min + Math.min(max - min, Math.floor(rng() * (max - min + 1)));
}

/** The weather fields the simulation stores on `GameState`. */
export interface WeatherState {
  weather?: SimWeather;
  /** Absolute day (see `absoluteDay`) on which the next weather is picked. */
  weatherUntilDay?: number;
}

/**
 * Daily weather step: keeps the current weather until `weatherUntilDay`, then picks a new one for the season.
 * Missing fields (old saves) trigger an immediate pick. `forced` (e.g. `heat_haze` during a heatwave) replaces the
 * weather without touching the schedule, so the next normal pick still happens on `weatherUntilDay`.
 */
export function advanceWeather(
  prev: WeatherState,
  today: number,
  season: Season,
  rng: Rng,
  forced?: SimWeather
): { weather: SimWeather; weatherUntilDay: number; changed: boolean } {
  let weather = prev.weather;
  let until = prev.weatherUntilDay;
  if (weather === undefined || until === undefined || today >= until) {
    weather = pickWeather(season, rng);
    until = today + rollWeatherDuration(rng);
  }
  const final = forced ?? weather;
  return { weather: final, weatherUntilDay: until, changed: final !== prev.weather };
}

/** True while winter fog is thick enough to slow traffic and ground planes (S4-T8). */
export function isFogActive(weather: SimWeather | undefined, hour: number): boolean {
  return weather === 'fog' && hour >= WEATHER_CONFIG.fogStartHour && hour < WEATHER_CONFIG.fogEndHour;
}

/** Season vehicle-speed multiplier, times the fog slowdown when fog is active. */
export function getVehicleSpeedMultiplier(season: Season, weather: SimWeather | undefined, hour: number): number {
  const base = SEASON_CONFIG[season].vehicleSpeed;
  return isFogActive(weather, hour) ? base * WEATHER_CONFIG.fogVehicleSpeed : base;
}
