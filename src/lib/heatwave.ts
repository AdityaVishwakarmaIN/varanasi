/**
 * Heatwaves (Sprint 4, S4-T7). Pure scheduling state machine and damage maths; tunables in HEATWAVE_CONFIG.
 *
 * Flow:
 *   once per in-game week → `maybeScheduleHeatwave` (summer only, 25%): schedules a heatwave starting 3 days
 *                           later and lasting 5–10 days. The caller forecasts it immediately.
 *   every day            → `isHeatwaveActive`: force weather to `heat_haze`, multiply power/water demand,
 *                           apply `computeHeatwaveHit` to residential tiles lacking power or water.
 *   after it ends        → `clearFinishedHeatwave` drops the stored state.
 *
 * All days are absolute days (see `absoluteDay` in seasons.ts).
 */
import type { Rng } from '@/lib/rng';
import type { Season } from '@/lib/seasons';

export const HEATWAVE_CONFIG = {
  /** Chance per weekly check (summer only) of scheduling a heatwave. */
  chance: 0.25,
  /** Seasons in which heatwaves can be scheduled. */
  seasons: ['summer'] as readonly Season[],
  /** Days between the forecast and the first hot day. */
  leadDays: 3,
  /** Heatwave length in days (inclusive range). */
  minDurationDays: 5,
  maxDurationDays: 10,
  /** Extra demand multipliers while active (on top of the season multipliers). */
  powerDemandMultiplier: 1.15,
  waterDemandMultiplier: 1.15,
  /** Health lost on a residential tile without power or without water. */
  healthHit: 15,
  /** Happiness lost on the same tiles (the doc only says "happiness −"; starting value). */
  happinessHit: 10,
  /** A tree or park within this many tiles (Chebyshev) gives shade. */
  shadeRadius: 3,
  /** Hit multiplier with shade, and (applied again) with a hospital in range. */
  shadeFactor: 0.5,
  hospitalFactor: 0.5,
} as const;

/** A scheduled or running heatwave. Active on days [startDay, endDay). Store as `heatwave?: HeatwaveState` on GameState. */
export interface HeatwaveState {
  startDay: number;
  endDay: number;
}

export interface HeatwaveScheduleInput {
  /** The currently stored heatwave, if any. */
  heatwave: HeatwaveState | undefined;
  /** Today's absolute day. */
  today: number;
  season: Season;
}

/**
 * Weekly heatwave roll. Never schedules a second heatwave while one is forecast or running.
 * Uses `rng()` only when a roll actually happens (summer, no heatwave pending): one draw for the chance,
 * one more for the duration on success.
 * @returns the heatwave to store and whether a new one was just scheduled (→ send the forecast).
 */
export function maybeScheduleHeatwave(
  input: HeatwaveScheduleInput,
  rng: Rng
): { heatwave: HeatwaveState | undefined; scheduled: boolean } {
  const { today, season } = input;
  const current = input.heatwave && today < input.heatwave.endDay ? input.heatwave : undefined;
  if (current || !HEATWAVE_CONFIG.seasons.includes(season)) return { heatwave: current, scheduled: false };
  if (rng() >= HEATWAVE_CONFIG.chance) return { heatwave: undefined, scheduled: false };
  const { minDurationDays: min, maxDurationDays: max } = HEATWAVE_CONFIG;
  const duration = min + Math.min(max - min, Math.floor(rng() * (max - min + 1)));
  const startDay = today + HEATWAVE_CONFIG.leadDays;
  return { heatwave: { startDay, endDay: startDay + duration }, scheduled: true };
}

/** True on the days the heatwave is running. */
export function isHeatwaveActive(heatwave: HeatwaveState | undefined, today: number): boolean {
  return !!heatwave && today >= heatwave.startDay && today < heatwave.endDay;
}

/** True while the heatwave is forecast but has not started yet. */
export function isHeatwavePending(heatwave: HeatwaveState | undefined, today: number): boolean {
  return !!heatwave && today < heatwave.startDay;
}

/** Drops a heatwave whose last day has passed (returns the input otherwise). */
export function clearFinishedHeatwave(heatwave: HeatwaveState | undefined, today: number): HeatwaveState | undefined {
  return heatwave && today >= heatwave.endDay ? undefined : heatwave;
}

/** Power and water demand multipliers for today (1 when no heatwave is running). */
export function getHeatwaveDemandMultipliers(heatwave: HeatwaveState | undefined, today: number): { power: number; water: number } {
  if (!isHeatwaveActive(heatwave, today)) return { power: 1, water: 1 };
  return { power: HEATWAVE_CONFIG.powerDemandMultiplier, water: HEATWAVE_CONFIG.waterDemandMultiplier };
}

/** What one residential tile has during a heatwave. */
export interface HeatwaveTileInput {
  hasPower: boolean;
  hasWater: boolean;
  /** A tree or park within `shadeRadius` tiles (see `computeShadeMask`). */
  hasShade: boolean;
  /** Inside a hospital's coverage. */
  hasHospital: boolean;
}

/**
 * Health and happiness lost by a residential tile during a heatwave.
 * Tiles with both power and water are unharmed; shade halves the hit, a hospital halves it again.
 */
export function computeHeatwaveHit(tile: HeatwaveTileInput): { health: number; happiness: number } {
  if (tile.hasPower && tile.hasWater) return { health: 0, happiness: 0 };
  let factor = 1;
  if (tile.hasShade) factor *= HEATWAVE_CONFIG.shadeFactor;
  if (tile.hasHospital) factor *= HEATWAVE_CONFIG.hospitalFactor;
  return { health: HEATWAVE_CONFIG.healthHit * factor, happiness: HEATWAVE_CONFIG.happinessHit * factor };
}

/**
 * Marks every tile within `radius` tiles (Chebyshev square) of a shade source (tree or park).
 * Returns a mask indexed y × gridSize + x (1 = shaded). Cost is O(sources × radius²).
 */
export function computeShadeMask(
  gridSize: number,
  sources: readonly { x: number; y: number }[],
  radius: number = HEATWAVE_CONFIG.shadeRadius
): Uint8Array {
  const mask = new Uint8Array(gridSize * gridSize);
  for (const s of sources) {
    for (let y = Math.max(0, s.y - radius); y <= Math.min(gridSize - 1, s.y + radius); y++) {
      mask.fill(1, y * gridSize + Math.max(0, s.x - radius), y * gridSize + Math.min(gridSize - 1, s.x + radius) + 1);
    }
  }
  return mask;
}
