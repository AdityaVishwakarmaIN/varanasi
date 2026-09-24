/**
 * Which renderer draws the map (S1-T7). `chooseRenderer` is pure; `supportsWebGL2` probes the browser.
 *
 * renderer = debug override ?? user setting ?? (WebGL2 available && GPU allowed by default ? 'gpu' : 'canvas')
 *
 * If the GPU renderer fails to start or loses its context, the map component calls
 * `reportGpuFailure()` (graphicsSettings.ts) and the choice falls back to Canvas2D for the
 * rest of the session.
 */

export type RendererKind = 'gpu' | 'canvas';
/** What the player picked in Settings. */
export type RendererSetting = 'auto' | RendererKind;

export const RENDERER_SETTINGS: readonly RendererSetting[] = ['auto', 'gpu', 'canvas'];

export const RENDERER_CONFIG = {
  /**
   * Whether `auto` picks the GPU renderer when WebGL2 is available.
   * OFF: the GPU (PixiJS) path is not at parity with Canvas2D yet and is slower on big maps
   * (see the S1-T7 notes in the Sprint 1 doc). Players can still choose GPU in Settings.
   */
  gpuByDefault: false,
  /** Debug override: build with NEXT_PUBLIC_GPU_RENDERER=1 (gpu) or =0 (canvas). */
  envVar: 'NEXT_PUBLIC_GPU_RENDERER',
  /** Debug override for one page load: `?renderer=gpu` or `?renderer=canvas`. */
  urlParam: 'renderer',
} as const;

export function isRendererSetting(value: unknown): value is RendererSetting {
  return typeof value === 'string' && (RENDERER_SETTINGS as readonly string[]).includes(value);
}

/** Reads a debug override value ('1'/'gpu' → gpu, '0'/'canvas' → canvas, anything else → none). */
export function parseRendererOverride(value: string | null | undefined): RendererKind | null {
  if (value === '1' || value === 'gpu') return 'gpu';
  if (value === '0' || value === 'canvas') return 'canvas';
  return null;
}

export interface RendererChoiceInput {
  setting: RendererSetting;
  /** Debug override from the env var or URL (wins over the setting). */
  override: RendererKind | null;
  webgl2: boolean;
  /** The GPU renderer already failed in this session (init error or lost context). */
  gpuFailed: boolean;
  gpuByDefault?: boolean;
}

export function chooseRenderer({
  setting,
  override,
  webgl2,
  gpuFailed,
  gpuByDefault = RENDERER_CONFIG.gpuByDefault,
}: RendererChoiceInput): RendererKind {
  // The GPU path can never run without WebGL2 or after it failed; Canvas2D always works.
  if (!webgl2 || gpuFailed) return 'canvas';
  const wanted = override ?? (setting === 'auto' ? null : setting);
  if (wanted) return wanted;
  return gpuByDefault ? 'gpu' : 'canvas';
}

let webgl2Cache: boolean | null = null;

/** True when the browser can create a WebGL2 context (probed once, then cached). */
export function supportsWebGL2(): boolean {
  if (webgl2Cache !== null) return webgl2Cache;
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    webgl2Cache = !!gl;
    // Free the probe context right away (browsers limit live WebGL contexts).
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    webgl2Cache = false;
  }
  return webgl2Cache;
}
