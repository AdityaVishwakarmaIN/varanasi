/**
 * PixiApp.ts — bootstraps a Pixi v8 Application for the isometric renderer.
 *
 * Uses WebGL because Pixi's WebGPU image upload path can reject otherwise valid
 * canvas/image sources with `copyExternalImageToTexture` at runtime.
 * Antialiasing is OFF and texture sampling is nearest (set per-texture in
 * textures.ts) so the pixel-art sprites stay crisp, matching the Canvas2D path's
 * `imageSmoothingEnabled = false`. Background is transparent so the page/cloud
 * layering shows through. `autoDensity` is false because the game manages the
 * backing-store size and device-pixel-ratio itself (see CanvasIsometricGrid).
 *
 * This module performs no rendering on its own; the render loop (P4) drives it.
 * It is client-only — `Application.init` touches the DOM/GPU and must not run on
 * the server.
 */
import { Application } from 'pixi.js';

export interface PixiAppOptions {
  /** Target canvas. Supports the main thread and the OffscreenCanvas worker path. */
  canvas: HTMLCanvasElement | OffscreenCanvas;
  /** Backing-store width in device pixels. */
  width: number;
  /** Backing-store height in device pixels. */
  height: number;
  /** Render resolution; the game already pre-scales sizes, so default is 1. */
  resolution?: number;
}

/** Create and initialise a Pixi Application (WebGPU preferred, WebGL2 fallback). */
export async function createPixiApp(opts: PixiAppOptions): Promise<Application> {
  const app = new Application();
  await app.init({
    canvas: opts.canvas as unknown as HTMLCanvasElement,
    width: opts.width,
    height: opts.height,
    antialias: false,
    preference: 'webgl',
    resolution: opts.resolution ?? 1,
    autoDensity: false,
    backgroundAlpha: 0,
  });
  return app;
}
