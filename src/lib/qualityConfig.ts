/**
 * Graphics quality presets and auto-quality (Sprint 1, S1-T7 / S1-T8). Pure: no React, no DOM.
 *
 * Every visual system that can be made cheaper reads its number from the active preset
 * (see `getActivePreset()` in `graphicsSettings.ts`), never from a hard-coded value.
 * The values below are starting values; tune them during playtesting.
 */

export type QualityLevel = 'low' | 'medium' | 'high';
/** What the player picked in Settings. `auto` lets `stepAutoQuality` choose the level. */
export type QualitySetting = QualityLevel | 'auto';

export const QUALITY_LEVELS: readonly QualityLevel[] = ['low', 'medium', 'high'];
export const QUALITY_SETTINGS: readonly QualitySetting[] = ['auto', 'low', 'medium', 'high'];

/** A per-device cap: desktop and mobile get different maximums. */
export type DeviceCap = { desktop: number; mobile: number };

export interface QualityPreset {
  /** Pedestrian density multiplier (0 = no pedestrians). */
  pedestrianDensity: number;
  /** Fraction of the normal number of cars / buses. */
  vehicleFraction: number;
  /** Draw clouds (and lightning). */
  clouds: boolean;
  /** Fraction of clouds and weather particles (wind dust) compared with High. */
  weatherParticleFraction: number;
  /** Day/night lighting overlay. */
  nightLighting: boolean;
  /** Fraction of smog / firework / train smoke particles (0 = off). */
  particleFraction: number;
  /** Largest device pixel ratio the canvases are rendered at. */
  dprCap: number;
  /** Swaying trees (off: trees are drawn once with the buildings). */
  treeSway: boolean;
  /** S1-T8: hard entity caps. */
  maxCars: DeviceCap;
  maxPedestrians: DeviceCap;
  maxBoats: DeviceCap;
  /**
   * S1-T11: while panning or zooming below this zoom, small animated things (boats, smog,
   * helicopters, seaplanes) are not drawn.
   */
  skipSmallWhileMovingBelowZoom: number;
}

export const QUALITY_PRESETS: Record<QualityLevel, QualityPreset> = {
  low: {
    pedestrianDensity: 0,
    vehicleFraction: 0.4,
    clouds: false,
    weatherParticleFraction: 0,
    nightLighting: false,
    particleFraction: 0,
    dprCap: 1,
    treeSway: false,
    maxCars: { desktop: 320, mobile: 24 },
    maxPedestrians: { desktop: 0, mobile: 0 },
    maxBoats: { desktop: 5, mobile: 2 },
    skipSmallWhileMovingBelowZoom: 0.8,
  },
  medium: {
    pedestrianDensity: 0.5,
    vehicleFraction: 0.7,
    clouds: true,
    weatherParticleFraction: 0.5,
    nightLighting: true,
    particleFraction: 0.5,
    dprCap: 1.5,
    treeSway: true,
    maxCars: { desktop: 560, mobile: 42 },
    maxPedestrians: { desktop: 280, mobile: 40 },
    maxBoats: { desktop: 8, mobile: 3 },
    skipSmallWhileMovingBelowZoom: 0.65,
  },
  high: {
    pedestrianDensity: 1,
    vehicleFraction: 1,
    clouds: true,
    weatherParticleFraction: 1,
    nightLighting: true,
    particleFraction: 1,
    dprCap: 2,
    treeSway: true,
    maxCars: { desktop: 800, mobile: 60 },
    maxPedestrians: { desktop: 560, mobile: 80 },
    maxBoats: { desktop: 12, mobile: 4 },
    skipSmallWhileMovingBelowZoom: 0.5,
  },
};

/** S1-T8: entities spawn only near the visible area and are removed when far off-screen. */
export const ENTITY_CULL_CONFIG = {
  /** New entities spawn inside the visible tiles plus this margin (in tiles). */
  spawnMarginTiles: 10,
  /** Entities further than this many tiles outside the visible area are removed. */
  despawnMarginTiles: 20,
} as const;

/** Level used by `auto` before the first measurement. */
export const AUTO_QUALITY_START: Record<'desktop' | 'mobile', QualityLevel> = {
  desktop: 'high',
  mobile: 'medium',
};

export const AUTO_QUALITY_CONFIG = {
  /** How often `getPerfSnapshot().frameP95` is checked. */
  checkIntervalMs: 2000,
  /** Frame budget per device (p95 over this is "over budget"). */
  budgetMs: { desktop: 16.7, mobile: 33 } as DeviceCap,
  /** Over budget this many checks in a row → one level lower. */
  dropAfterChecks: 3,
  /** Under `raiseBelowFraction` of the budget this many checks in a row → one level higher. */
  raiseAfterChecks: 10,
  raiseBelowFraction: 0.6,
  /** Checks ignored right after a change (the frame window still holds frames of the old level). */
  settleChecks: 2,
} as const;

export function deviceValue(cap: DeviceCap, isMobile: boolean): number {
  return isMobile ? cap.mobile : cap.desktop;
}

/**
 * How many entities a system may keep: its own target (for example from road count)
 * scaled by the preset fraction, never above the preset cap. Always an integer ≥ 0.
 */
export function scaledEntityLimit(baseTarget: number, fraction: number, cap: number): number {
  if (!(fraction > 0) || !(cap > 0) || !(baseTarget > 0)) return 0;
  return Math.max(0, Math.min(Math.floor(cap), Math.floor(baseTarget * fraction)));
}

export function lowerLevel(level: QualityLevel): QualityLevel {
  const i = QUALITY_LEVELS.indexOf(level);
  return QUALITY_LEVELS[Math.max(0, i - 1)];
}

export function higherLevel(level: QualityLevel): QualityLevel {
  const i = QUALITY_LEVELS.indexOf(level);
  return QUALITY_LEVELS[Math.min(QUALITY_LEVELS.length - 1, i + 1)];
}

export function isQualitySetting(value: unknown): value is QualitySetting {
  return typeof value === 'string' && (QUALITY_SETTINGS as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------------------------
// Auto-quality state machine (hysteresis)
// ---------------------------------------------------------------------------------------------

export interface AutoQualityState {
  level: QualityLevel;
  /** Consecutive checks over budget. */
  overCount: number;
  /** Consecutive checks under `raiseBelowFraction` of the budget. */
  underCount: number;
  /** A change that is due but waits until the player stops panning / zooming. */
  pending: 'drop' | 'raise' | null;
  /** Checks still to ignore after a change. */
  settle: number;
}

export interface AutoQualitySample {
  /** `getPerfSnapshot().frameP95` in ms (0 or less = no data yet; ignored). */
  frameP95: number;
  /** True while the player is panning or zooming: no change is applied then. */
  interacting: boolean;
}

export function createAutoQualityState(level: QualityLevel): AutoQualityState {
  return { level, overCount: 0, underCount: 0, pending: null, settle: 0 };
}

/**
 * One auto-quality check (call every `checkIntervalMs`). Returns the new state; `state.level`
 * is the level to use. Rules:
 * - p95 over budget for `dropAfterChecks` checks in a row → one level lower (High → Medium → Low);
 * - p95 under `raiseBelowFraction × budget` for `raiseAfterChecks` checks in a row → one level higher;
 * - in between, both counters reset (the gap is the hysteresis that stops flickering);
 * - a due change waits while the player pans or zooms and is applied at the first quiet check;
 * - after a change, `settleChecks` checks are ignored.
 */
export function stepAutoQuality(
  state: AutoQualityState,
  sample: AutoQualitySample,
  budgetMs: number,
  config: Pick<typeof AUTO_QUALITY_CONFIG, 'dropAfterChecks' | 'raiseAfterChecks' | 'raiseBelowFraction' | 'settleChecks'> = AUTO_QUALITY_CONFIG,
): AutoQualityState {
  const next: AutoQualityState = { ...state };
  if (next.settle > 0) {
    next.settle--;
    return next;
  }
  if (sample.frameP95 > 0) {
    if (sample.frameP95 > budgetMs) {
      next.overCount++;
      next.underCount = 0;
      if (next.pending === 'raise') next.pending = null;
    } else if (sample.frameP95 < budgetMs * config.raiseBelowFraction) {
      next.underCount++;
      next.overCount = 0;
      if (next.pending === 'drop') next.pending = null;
    } else {
      next.overCount = 0;
      next.underCount = 0;
    }
    if (next.overCount >= config.dropAfterChecks && next.level !== 'low') next.pending = 'drop';
    else if (next.underCount >= config.raiseAfterChecks && next.level !== 'high') next.pending = 'raise';
  }
  if (next.pending && !sample.interacting) {
    next.level = next.pending === 'drop' ? lowerLevel(next.level) : higherLevel(next.level);
    next.pending = null;
    next.overCount = 0;
    next.underCount = 0;
    next.settle = config.settleChecks;
  }
  return next;
}
