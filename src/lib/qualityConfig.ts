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
  /**
   * Largest device pixel ratio the canvases are rendered at when the player picks this level
   * explicitly. `auto` ignores it and uses `AUTO_DPR_CAP` instead, so an automatic level change
   * never changes resolution (see `autoRenderDpr`).
   */
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

/**
 * Render DPR cap while the setting is `auto`. Chosen once per session from the device
 * (`autoRenderDpr`) and independent of the auto level: resolution is the one thing the player sees
 * immediately (the whole map goes soft), so auto only trades away things that come and go anyway
 * (traffic, crowds, particles, clouds, night lighting, tree sway).
 */
export const AUTO_DPR_CAP: DeviceCap = { desktop: 2, mobile: 1.5 };

/** Render DPR used by `auto`: the device ratio, capped per device. Pure (pass `window.devicePixelRatio`). */
export function autoRenderDpr(rawDevicePixelRatio: number, isMobile: boolean): number {
  const raw = Number.isFinite(rawDevicePixelRatio) && rawDevicePixelRatio > 0 ? rawDevicePixelRatio : 1;
  return Math.min(raw, deviceValue(AUTO_DPR_CAP, isMobile));
}

export const AUTO_QUALITY_CONFIG = {
  /** How often the auto-quality check runs. Each check looks only at frames since the previous one. */
  checkIntervalMs: 2000,
  /**
   * A check window is "slow" when its frame p95 is above this. Deliberately far above one vsync
   * interval: on a 60 Hz display a healthy rAF p95 is ~16.7-17.5 ms (vsync jitter), so a 16.7 ms
   * budget called every healthy session slow. ~33 ms (desktop) means more than 1 frame in 20 is
   * slower than 30 fps; ~50 ms (mobile) is the same at 20 fps.
   */
  dropAboveMs: { desktop: 33.4, mobile: 50 } as DeviceCap,
  /** Slow this many valid windows in a row (~10 s) → one level lower. */
  dropAfterChecks: 5,
  /** Windows with fewer frames than this (tab throttled, a single long hang) carry no evidence. */
  minFrames: 8,
  /** Checks ignored after a drop, while entity counts shrink to the new caps. */
  cooldownChecks: 5,
  /** After the start-up veil lifts: no evidence is taken for this long (assets decode, caches fill). */
  warmupMs: 8000,
  /** After the tab becomes visible again: no evidence for this long (GPU/textures wake up). */
  visibleGraceMs: 4000,
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
// Auto-quality policy: sticky, evidence-gated drops
// ---------------------------------------------------------------------------------------------
//
// Why drops are sticky (auto never raises during a session):
// The old machine raised after 10 cheap checks and dropped after 3 slow ones. Frames measured at a
// lower level are cheaper *because* of that level, so "fast at Low" is no evidence that High is
// affordable: it raised, got slow again, dropped, and so on, a visible oscillation every ~30 s
// (and, while the level also capped DPR, a blurry/sharp flip each time). A one-way ratchet cannot
// oscillate. The cost is that a session that hit one bad patch stays one level lower until the
// next session (auto starts again at the device's start level) or until the player picks a level
// explicitly in Settings, which always wins.
//
// What counts as evidence:
// - only non-overlapping windows of frames (each check sees the frames since the previous check,
//   never a rolling 300-frame window that still holds frames from before a change);
// - only windows that started after `holdUntil` (nothing during start-up/loading: `holdUntil` is
//   Infinity until the start-up veil lifts, then a warm-up; a grace period after the tab becomes
//   visible again; hidden tabs produce no frames);
// - only windows with at least `minFrames` frames;
// - slow = p95 clearly janky (`dropAboveMs`), not one vsync interval;
// - `dropAfterChecks` slow windows in a row (any healthy window resets the streak).
// A due drop waits while the player pans or zooms and is applied at the first quiet check; after a
// drop, `cooldownChecks` checks are ignored while entity counts shrink to the new caps.

export interface AutoQualityState {
  level: QualityLevel;
  /** Consecutive valid slow windows. */
  overCount: number;
  /** A drop is due but waits until the player stops panning / zooming. */
  pending: boolean;
  /** Checks still to ignore after a drop. */
  cooldown: number;
  /** Windows that started before this time (ms, same clock as samples) are ignored. Infinity = not armed. */
  holdUntil: number;
}

export interface AutoQualitySample {
  /** Frame p95 (ms) of the frames recorded since the previous check. */
  frameP95: number;
  /** How many frames the window holds. */
  frameCount: number;
  /** When the window started (ms, the time of the previous check). */
  windowStart: number;
  /** True while the player is panning or zooming: no change is applied then. */
  interacting: boolean;
}

export type AutoQualityConfig = Pick<typeof AUTO_QUALITY_CONFIG, 'dropAfterChecks' | 'minFrames' | 'cooldownChecks'>;

export function createAutoQualityState(level: QualityLevel, holdUntil = Number.POSITIVE_INFINITY): AutoQualityState {
  return { level, overCount: 0, pending: false, cooldown: 0, holdUntil };
}

/** Ignore every window that starts before `untilMs` (never shortens an existing hold). */
export function holdAutoQualityState(state: AutoQualityState, untilMs: number): AutoQualityState {
  return { ...state, overCount: 0, pending: false, holdUntil: Math.max(state.holdUntil, untilMs) };
}

/** Set the hold exactly (arm after start-up with `now + warmupMs`, disarm with Infinity). */
export function armAutoQualityState(state: AutoQualityState, untilMs: number): AutoQualityState {
  return { ...state, overCount: 0, pending: false, holdUntil: untilMs };
}

/**
 * One auto-quality check (call every `checkIntervalMs` with the frames since the previous check).
 * Returns the new state; `state.level` is the level to use. It only ever moves down.
 */
export function stepAutoQuality(
  state: AutoQualityState,
  sample: AutoQualitySample,
  dropAboveMs: number,
  config: AutoQualityConfig = AUTO_QUALITY_CONFIG,
): AutoQualityState {
  const next: AutoQualityState = { ...state };
  if (next.cooldown > 0) {
    next.cooldown--;
    return next;
  }
  const valid =
    sample.windowStart >= next.holdUntil &&
    sample.frameCount >= config.minFrames &&
    sample.frameP95 > 0;
  if (valid) {
    if (sample.frameP95 > dropAboveMs) {
      next.overCount++;
      if (next.overCount >= config.dropAfterChecks && next.level !== 'low') next.pending = true;
    } else {
      next.overCount = 0;
      next.pending = false;
    }
  }
  if (valid && next.pending && !sample.interacting) {
    next.level = lowerLevel(next.level);
    next.pending = false;
    next.overCount = 0;
    next.cooldown = config.cooldownChecks;
  }
  return next;
}
