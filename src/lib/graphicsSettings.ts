/**
 * Graphics settings store (S1-T7): the player's renderer and quality choice, the level that
 * `auto` picked, and the resolved renderer. A tiny external store (no React state), so render
 * loops can read `getActivePreset()` every frame for free and React reads it through
 * `useGraphicsSettings()` (src/hooks/useGraphicsSettings.ts). No React import here, so the render
 * worker can use `getRenderDpr()` too.
 *
 * The two choices are small UI preferences and live in localStorage (read synchronously at start).
 */
import {
  AUTO_DPR_CAP,
  AUTO_QUALITY_CONFIG,
  AUTO_QUALITY_START,
  QUALITY_PRESETS,
  armAutoQualityState,
  autoRenderDpr,
  createAutoQualityState,
  deviceValue,
  holdAutoQualityState,
  isQualitySetting,
  stepAutoQuality,
  type AutoQualityState,
  type QualityLevel,
  type QualityPreset,
  type QualitySetting,
} from '@/lib/qualityConfig';
import {
  RENDERER_CONFIG,
  chooseRenderer,
  isRendererSetting,
  parseRendererOverride,
  supportsWebGL2,
  type RendererKind,
  type RendererSetting,
} from '@/lib/rendererSelection';
import { recordEvent as tempRecord } from '@/lib/debug/tempRecorder'; // TEMP-RECORDER

export const GRAPHICS_STORAGE_KEYS = {
  quality: 'varanasi-graphics-quality',
  renderer: 'varanasi-graphics-renderer',
} as const;

export interface GraphicsSnapshot {
  qualitySetting: QualitySetting;
  /** Level in use (equals the setting unless the setting is `auto`). */
  qualityLevel: QualityLevel;
  rendererSetting: RendererSetting;
  /** Renderer in use after override, WebGL2 check and failure fallback. */
  renderer: RendererKind;
  gpuFailed: boolean;
  /**
   * Cap on the render DPR that is in force. Changes only when the player changes the setting (an
   * explicit level's `dprCap`, or `AUTO_DPR_CAP` for `auto`), never when `auto` changes level, so
   * it is the right dependency for canvas-size effects.
   */
  renderDprCap: number;
}

function readStored<T>(key: string, guard: (v: unknown) => v is T, fallback: T): T {
  try {
    const v = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
    return guard(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

function writeStored(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private mode / quota: the choice still applies for this session.
  }
}

function readOverride(): RendererKind | null {
  const fromEnv = parseRendererOverride(process.env.NEXT_PUBLIC_GPU_RENDERER);
  if (typeof window === 'undefined') return fromEnv;
  const fromUrl = parseRendererOverride(new URLSearchParams(window.location.search).get(RENDERER_CONFIG.urlParam));
  return fromUrl ?? fromEnv;
}

let initialized = false;
let isMobileDevice = false;
let qualitySetting: QualitySetting = 'auto';
let rendererSetting: RendererSetting = 'auto';
let gpuFailed = false;
let gpuFailureWarned = false;
let auto: AutoQualityState = createAutoQualityState(AUTO_QUALITY_START.desktop);
/** True once the start-up veil lifted (auto-quality may take evidence after its warm-up). */
let autoArmed = false;
/** Render DPR for `auto`, chosen once per session from the device (see `getRenderDpr`). */
let sessionAutoDpr = 0;

function dprCapFor(setting: QualitySetting): number {
  return setting === 'auto' ? deviceValue(AUTO_DPR_CAP, isMobileDevice) : QUALITY_PRESETS[setting].dprCap;
}

let snapshot: GraphicsSnapshot = {
  qualitySetting,
  qualityLevel: auto.level,
  rendererSetting,
  renderer: 'canvas',
  gpuFailed,
  renderDprCap: dprCapFor(qualitySetting),
};
let activePreset: QualityPreset = QUALITY_PRESETS[snapshot.qualityLevel];
const listeners = new Set<() => void>();

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : 0;
}

function recompute(force = false): void {
  const qualityLevel = qualitySetting === 'auto' ? auto.level : qualitySetting;
  const renderer = typeof window === 'undefined'
    ? 'canvas'
    : chooseRenderer({ setting: rendererSetting, override: readOverride(), webgl2: supportsWebGL2(), gpuFailed });
  const renderDprCap = dprCapFor(qualitySetting);
  const prev = snapshot;
  if (
    !force &&
    prev.qualitySetting === qualitySetting &&
    prev.qualityLevel === qualityLevel &&
    prev.rendererSetting === rendererSetting &&
    prev.renderer === renderer &&
    prev.gpuFailed === gpuFailed &&
    prev.renderDprCap === renderDprCap
  ) {
    return;
  }
  snapshot = { qualitySetting, qualityLevel, rendererSetting, renderer, gpuFailed, renderDprCap };
  // TEMP-RECORDER: renderer / quality changes (prime suspects for the hang)
  if (process.env.NODE_ENV === 'development') {
    tempRecord('graphics:change', {
      force,
      prev: { renderer: prev.renderer, qualityLevel: prev.qualityLevel, qualitySetting: prev.qualitySetting, rendererSetting: prev.rendererSetting, gpuFailed: prev.gpuFailed },
      next: { renderer, qualityLevel, qualitySetting, rendererSetting, gpuFailed },
      dprCap: renderDprCap,
    });
  }
  activePreset = QUALITY_PRESETS[qualityLevel];
  listeners.forEach((l) => l());
}

/** Reads the stored choices once (client only). `isMobile` picks the auto start level and budget. */
export function initGraphicsSettings(isMobile: boolean): void {
  if (initialized && isMobile === isMobileDevice) return;
  const first = !initialized;
  initialized = true;
  isMobileDevice = isMobile;
  if (first) {
    qualitySetting = readStored(GRAPHICS_STORAGE_KEYS.quality, isQualitySetting, 'auto');
    rendererSetting = readStored(GRAPHICS_STORAGE_KEYS.renderer, isRendererSetting, 'auto');
  }
  auto = createAutoQualityState(AUTO_QUALITY_START[isMobile ? 'mobile' : 'desktop'], auto.holdUntil);
  sessionAutoDpr = 0; // the per-device cap changed: choose again
  recompute(true);
}

export function setQualitySetting(setting: QualitySetting): void {
  if (process.env.NODE_ENV === 'development') tempRecord('graphics:setQualitySetting', { setting }); // TEMP-RECORDER
  qualitySetting = setting;
  writeStored(GRAPHICS_STORAGE_KEYS.quality, setting);
  if (setting === 'auto') {
    // Start from the level in use; if the game is already running, take evidence only after a warm-up.
    auto = createAutoQualityState(
      snapshot.qualityLevel,
      autoArmed ? nowMs() + AUTO_QUALITY_CONFIG.warmupMs : Number.POSITIVE_INFINITY,
    );
  }
  recompute();
}

export function setRendererSetting(setting: RendererSetting): void {
  if (process.env.NODE_ENV === 'development') tempRecord('graphics:setRendererSetting', { setting }); // TEMP-RECORDER
  rendererSetting = setting;
  writeStored(GRAPHICS_STORAGE_KEYS.renderer, setting);
  recompute();
}

/** The GPU renderer failed (init error or lost context): use Canvas2D for the rest of the session. */
export function reportGpuFailure(reason: unknown): void {
  // TEMP-RECORDER: every call, with the reason (Error -> name/message/stack, capped)
  if (process.env.NODE_ENV === 'development') {
    tempRecord('graphics:reportGpuFailure', { reason, alreadyFailed: gpuFailed, renderer: snapshot.renderer });
  }
  if (!gpuFailureWarned) {
    gpuFailureWarned = true;
    console.warn('[renderer] GPU renderer unavailable, falling back to Canvas2D:', reason);
  }
  gpuFailed = true;
  recompute();
}

/**
 * The start-up veil lifted at `atMs` (performance.now()): auto-quality may take evidence after
 * `AUTO_QUALITY_CONFIG.warmupMs`. Until this is called, nothing is sampled.
 */
export function armAutoQuality(atMs: number): void {
  autoArmed = true;
  auto = armAutoQualityState(auto, atMs + AUTO_QUALITY_CONFIG.warmupMs);
  if (process.env.NODE_ENV === 'development') tempRecord('graphics:autoQuality', { decision: 'arm', holdUntil: auto.holdUntil }); // TEMP-RECORDER
}

/** The map is (re)starting: take no evidence until `armAutoQuality` is called again. */
export function disarmAutoQuality(): void {
  autoArmed = false;
  auto = armAutoQualityState(auto, Number.POSITIVE_INFINITY);
}

/** Take no evidence from frames before `untilMs` (e.g. just after the tab becomes visible again). */
export function holdAutoQuality(untilMs: number): void {
  auto = holdAutoQualityState(auto, untilMs);
}

/**
 * One auto-quality check over the frames since the previous check (the map component calls this
 * every `AUTO_QUALITY_CONFIG.checkIntervalMs`; `windowStart` is the time of that previous check).
 */
export function runAutoQualityCheck(sample: { frameP95: number; frameCount: number; windowStart: number; interacting: boolean }): void {
  if (qualitySetting !== 'auto') return;
  const prev = auto;
  auto = stepAutoQuality(auto, sample, deviceValue(AUTO_QUALITY_CONFIG.dropAboveMs, isMobileDevice));
  // TEMP-RECORDER: auto-quality decisions (streak changes, pending drop, drop)
  if (
    process.env.NODE_ENV === 'development' &&
    (prev.level !== auto.level || prev.pending !== auto.pending || prev.overCount !== auto.overCount)
  ) {
    tempRecord('graphics:autoQuality', {
      decision: prev.level !== auto.level ? 'drop' : auto.pending ? 'pending' : 'streak',
      from: prev.level,
      to: auto.level,
      overCount: auto.overCount,
      sample,
    });
  }
  recompute();
}

/** Current preset: cheap, safe to call every frame. */
export function getActivePreset(): QualityPreset {
  return activePreset;
}

export function getGraphicsSnapshot(): GraphicsSnapshot {
  return snapshot;
}

let tempLastRenderDpr = 0; // TEMP-RECORDER

/**
 * Render device pixel ratio (use instead of `window.devicePixelRatio`).
 * - `auto`: chosen once per session from the device (`autoRenderDpr`), whatever level auto picks,
 *   so resolution never changes while playing.
 * - explicit Low / Medium / High: the device ratio capped by that level's `dprCap`.
 */
export function getRenderDpr(): number {
  const raw = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  let dpr: number;
  if (qualitySetting === 'auto') {
    if (sessionAutoDpr === 0 && typeof window !== 'undefined') sessionAutoDpr = autoRenderDpr(raw, isMobileDevice);
    dpr = sessionAutoDpr || autoRenderDpr(raw, isMobileDevice);
  } else {
    dpr = Math.min(raw, activePreset.dprCap);
  }
  // TEMP-RECORDER: render DPR changes (one number compare per call)
  if (process.env.NODE_ENV === 'development' && dpr !== tempLastRenderDpr) {
    tempRecord('graphics:renderDpr', { from: tempLastRenderDpr, to: dpr, raw, dprCap: snapshot.renderDprCap, setting: qualitySetting });
    tempLastRenderDpr = dpr;
  }
  return dpr;
}

export function subscribeGraphics(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Snapshot used during server rendering (no window, no stored choices). */
export const SERVER_GRAPHICS_SNAPSHOT: GraphicsSnapshot = {
  qualitySetting: 'auto',
  qualityLevel: AUTO_QUALITY_START.desktop,
  rendererSetting: 'auto',
  renderer: 'canvas',
  gpuFailed: false,
  renderDprCap: AUTO_DPR_CAP.desktop,
};
