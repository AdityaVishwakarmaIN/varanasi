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
 *  - Guard against not-yet-ready sources (incomplete images, 0×0 canvases) that would
 *    cause WebGPU `copyExternalImageToTexture` failures.
 */
export class TextureCache {
  private readonly cache = new WeakMap<object, Texture>();

  /**
   * Return a Pixi texture for the given Canvas2D image source, creating it on first use.
   * Canvas-backed sources are treated as dynamic and re-uploaded each call.
   * Returns `null` if the source is not ready for GPU upload.
   */
  get(source: IsoImageSource): Texture | null {
    // Guard: reject sources that aren't ready for GPU upload
    if (!this.isSourceReady(source)) return null;

    const key = source as unknown as object;
    let texture = this.cache.get(key);
    if (!texture) {
      try {
        texture = Texture.from(source as never);
        // Pixel-art: never blur sprites when scaled.
        texture.source.scaleMode = 'nearest';
        this.cache.set(key, texture);
      } catch {
        return null;
      }
    }
    // Canvas/OffscreenCanvas layers are redrawn every frame -> flag for GPU re-upload.
    if (this.isDynamic(source)) {
      try {
        texture.source.update();
      } catch {
        this.cache.delete(key);
        texture.destroy(false);
        return null;
      }
    }
    return texture;
  }

  /**
   * Check whether an image source is fully loaded / has non-zero dimensions.
   * WebGPU's copyExternalImageToTexture rejects sources that aren't decoded or are 0×0.
   */
  private isSourceReady(source: IsoImageSource): boolean {
    if (typeof HTMLImageElement !== 'undefined' && source instanceof HTMLImageElement) {
      return source.complete && source.naturalWidth > 0 && source.naturalHeight > 0;
    }
    if (typeof HTMLCanvasElement !== 'undefined' && source instanceof HTMLCanvasElement) {
      return source.width > 0 && source.height > 0;
    }
    if (typeof OffscreenCanvas !== 'undefined' && source instanceof OffscreenCanvas) {
      return source.width > 0 && source.height > 0;
    }
    if (typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap) {
      return source.width > 0 && source.height > 0;
    }
    // Unknown source type — allow through (Pixi will handle or error gracefully)
    return true;
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
