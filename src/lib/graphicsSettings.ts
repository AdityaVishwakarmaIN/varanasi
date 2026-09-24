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
  AUTO_QUALITY_CONFIG,
  AUTO_QUALITY_START,
  QUALITY_PRESETS,
  createAutoQualityState,
  deviceValue,
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
let snapshot: GraphicsSnapshot = {
  qualitySetting,
  qualityLevel: auto.level,
  rendererSetting,
  renderer: 'canvas',
  gpuFailed,
};
let activePreset: QualityPreset = QUALITY_PRESETS[snapshot.qualityLevel];
const listeners = new Set<() => void>();

function recompute(force = false): void {
  const qualityLevel = qualitySetting === 'auto' ? auto.level : qualitySetting;
  const renderer = typeof window === 'undefined'
    ? 'canvas'
    : chooseRenderer({ setting: rendererSetting, override: readOverride(), webgl2: supportsWebGL2(), gpuFailed });
  const prev = snapshot;
  if (
    !force &&
    prev.qualitySetting === qualitySetting &&
    prev.qualityLevel === qualityLevel &&
    prev.rendererSetting === rendererSetting &&
    prev.renderer === renderer &&
    prev.gpuFailed === gpuFailed
  ) {
    return;
  }
  snapshot = { qualitySetting, qualityLevel, rendererSetting, renderer, gpuFailed };
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
  auto = createAutoQualityState(AUTO_QUALITY_START[isMobile ? 'mobile' : 'desktop']);
  recompute(true);
}

export function setQualitySetting(setting: QualitySetting): void {
  qualitySetting = setting;
  writeStored(GRAPHICS_STORAGE_KEYS.quality, setting);
  if (setting === 'auto') auto = createAutoQualityState(snapshot.qualityLevel);
  recompute();
}

export function setRendererSetting(setting: RendererSetting): void {
  rendererSetting = setting;
  writeStored(GRAPHICS_STORAGE_KEYS.renderer, setting);
  recompute();
}

/** The GPU renderer failed (init error or lost context): use Canvas2D for the rest of the session. */
export function reportGpuFailure(reason: unknown): void {
  if (!gpuFailureWarned) {
    gpuFailureWarned = true;
    console.warn('[renderer] GPU renderer unavailable, falling back to Canvas2D:', reason);
  }
  gpuFailed = true;
  recompute();
}

/** One auto-quality check (the map component calls this every AUTO_QUALITY_CONFIG.checkIntervalMs). */
export function runAutoQualityCheck(frameP95: number, interacting: boolean): void {
  if (qualitySetting !== 'auto') return;
  auto = stepAutoQuality(auto, { frameP95, interacting }, deviceValue(AUTO_QUALITY_CONFIG.budgetMs, isMobileDevice));
  recompute();
}

/** Current preset: cheap, safe to call every frame. */
export function getActivePreset(): QualityPreset {
  return activePreset;
}

export function getGraphicsSnapshot(): GraphicsSnapshot {
  return snapshot;
}

/** Device pixel ratio capped by the active preset (use instead of `window.devicePixelRatio`). */
export function getRenderDpr(): number {
  const raw = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  return Math.min(raw, activePreset.dprCap);
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
};
