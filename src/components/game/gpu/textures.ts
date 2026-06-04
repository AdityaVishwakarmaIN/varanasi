import { Texture } from 'pixi.js';
import type { IsoImageSource } from './IsoRenderer';

/**
 * TextureCache — bridges the game's Canvas2D image sources to Pixi GPU textures.
 *
 * The game draws sprites from `HTMLImageElement` / `ImageBitmap` (sprite sheets decoded
 * by `imageLoader.ts`, with the red key colour already made transparent) and from
 * `HTMLCanvasElement` / `OffscreenCanvas` layer buffers (e.g. the composited cloud layer).
 *
 * Responsibilities:
 *  - Map each distinct image source object to exactly one Pixi `Texture`, keyed by
 *    identity (WeakMap) so textures are reused frame-to-frame and GC'd with their source.
 *  - Force NEAREST sampling so pixel-art stays crisp at every zoom (replaces the
 *    Canvas2D `imageSmoothingEnabled = false` the renderer relied on).
 *  - Re-upload canvas-backed sources whose pixels change each frame (dynamic layers).
 */
export class TextureCache {
  private readonly cache = new WeakMap<object, Texture>();

  /**
   * Return a Pixi texture for the given Canvas2D image source, creating it on first use.
   * Canvas-backed sources are treated as dynamic and re-uploaded each call.
   */
  get(source: IsoImageSource): Texture {
    const key = source as unknown as object;
    let texture = this.cache.get(key);
    if (!texture) {
      texture = Texture.from(source as never);
      // Pixel-art: never blur sprites when scaled.
      texture.source.scaleMode = 'nearest';
      this.cache.set(key, texture);
    }
    // Canvas/OffscreenCanvas layers are redrawn every frame -> flag for GPU re-upload.
    if (this.isDynamic(source)) {
      texture.source.update();
    }
    return texture;
  }

  private isDynamic(source: IsoImageSource): boolean {
    return (
      (typeof HTMLCanvasElement !== 'undefined' && source instanceof HTMLCanvasElement) ||
      (typeof OffscreenCanvas !== 'undefined' && source instanceof OffscreenCanvas)
    );
  }

  /** Drop a single cached texture (e.g. when its source is permanently discarded). */
  release(source: IsoImageSource): void {
    const key = source as unknown as object;
    const texture = this.cache.get(key);
    if (texture) {
      texture.destroy(false);
      this.cache.delete(key);
    }
  }
}
