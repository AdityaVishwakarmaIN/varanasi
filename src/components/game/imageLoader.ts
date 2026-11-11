// ============================================================================
// IMAGE LOADING UTILITIES
// ============================================================================
// Handles loading and caching of sprite images with optional background filtering
// and WebP optimization for faster loading on slow connections.

import { SPRITE_KEY_THRESHOLD, keyOutBackground } from '@/lib/spriteKeyColor';
import type { SpriteFilterRequest, SpriteFilterResponse } from '@/workers/spriteFilterWorker';

// Color distance threshold - pixels within this distance of the red key colour become transparent
const COLOR_THRESHOLD = SPRITE_KEY_THRESHOLD;
// Image cache for building sprites
const imageCache = new Map<string, HTMLImageElement>();

// Track WebP support (detected once on first use)
let webpSupported: boolean | null = null;

// Event emitter for image loading progress (to trigger re-renders)
type ImageLoadCallback = () => void;
const imageLoadCallbacks = new Set<ImageLoadCallback>();

export type CachedCanvasImage = HTMLImageElement | ImageBitmap;

function isHtmlImage(image: CachedCanvasImage): image is HTMLImageElement {
  return 'naturalWidth' in image;
}

export function getCanvasImageDimensions(image: CachedCanvasImage): { width: number; height: number } {
  if (isHtmlImage(image)) {
    return {
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
    };
  }

  return {
    width: image.width,
    height: image.height,
  };
}

type ProcessingSurface = {
  canvas: HTMLCanvasElement | OffscreenCanvas;
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
};

function createProcessingSurface(width: number, height: number): ProcessingSurface {
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get canvas context');
    }
    return { canvas, ctx };
  }

  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get offscreen canvas context');
    }
    return { canvas, ctx };
  }

  throw new Error('No canvas implementation available for image processing');
}

function applyBackgroundFilter(
  image: CanvasImageSource,
  threshold: number,
): ProcessingSurface {
  const { width, height } = getCanvasImageDimensions(image as CachedCanvasImage);
  const surface = createProcessingSurface(width, height);
  const { ctx } = surface;

  ctx.drawImage(image, 0, 0);

  const imageData = ctx.getImageData(0, 0, width, height);
  keyOutBackground(imageData.data, threshold);
  ctx.putImageData(imageData, 0, 0);
  return surface;
}

/**
 * Check if the browser supports WebP format
 * Uses a small test image to detect support
 */
async function checkWebPSupport(): Promise<boolean> {
  if (webpSupported !== null) {
    return webpSupported;
  }
  
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      webpSupported = img.width > 0 && img.height > 0;
      resolve(webpSupported);
    };
    img.onerror = () => {
      webpSupported = false;
      resolve(false);
    };
    // Tiny 1x1 WebP image
    img.src = 'data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=';
  });
}

/**
 * Get the WebP path for a PNG image
 */
function getWebPPath(src: string): string | null {
  if (src.endsWith('.png')) {
    return src.replace(/\.png$/, '.webp');
  }
  return null;
}

/**
 * Register a callback to be notified when images are loaded
 * @returns Cleanup function to unregister the callback
 */
export function onImageLoaded(callback: ImageLoadCallback): () => void {
  imageLoadCallbacks.add(callback);
  return () => { imageLoadCallbacks.delete(callback); };
}

/**
 * Notify all registered callbacks that an image has loaded
 */
function notifyImageLoaded() {
  imageLoadCallbacks.forEach(cb => cb());
}

/**
 * Load an image directly without WebP optimization
 * @param src The image source path
 * @returns Promise resolving to the loaded image
 */
function loadImageDirect(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // Decode off the main thread before the image is used, so the first drawImage / GPU upload
      // does not decode it synchronously in the middle of a frame.
      decodeLoadedImage(img).then(() => {
        imageCache.set(src, img);
        notifyImageLoaded();
        resolve(img);
      });
    };
    img.onerror = reject;
    img.src = src;
  });
}

/** `img.decode()` where supported; never rejects for an image that already loaded. */
function decodeLoadedImage(img: HTMLImageElement): Promise<void> {
  if (typeof img.decode !== 'function') return Promise.resolve();
  return img.decode().catch(() => undefined);
}

/** An <img> for an encoded blob, decoded (off the main thread where supported) before it resolves. */
function imageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    // The object URL is not revoked: each sheet is loaded once per session and cached for good,
    // and the browser may need the encoded bytes again if it discards the decoded pixels.
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      decodeLoadedImage(img).then(() => resolve(img));
    };
    img.onerror = () => reject(new Error('Failed to decode filtered sprite sheet'));
    img.src = url;
  });
}

/**
 * Load an image from a source URL, preferring WebP if available
 * @param src The image source path (PNG)
 * @returns Promise resolving to the loaded image
 */
export async function loadImage(src: string): Promise<HTMLImageElement> {
  // Return cached image if available
  if (imageCache.has(src)) {
    return imageCache.get(src)!;
  }
  
  // Check if we should try WebP
  const webpPath = getWebPPath(src);
  if (webpPath) {
    const supportsWebP = await checkWebPSupport();
    
    if (supportsWebP) {
      // Try loading WebP first
      try {
        const img = await loadImageDirect(webpPath);
        // Also cache under the PNG path for future lookups
        imageCache.set(src, img);
        return img;
      } catch {
        // WebP failed (file might not exist), fall back to PNG
        console.debug(`WebP not available for ${src}, using PNG`);
      }
    }
  }
  
  // Load PNG directly
  return loadImageDirect(src);
}

/**
 * Filters colors close to the background color from an image, making them transparent
 * @param img The source image to process
 * @param threshold Maximum color distance to consider as background (default: COLOR_THRESHOLD)
 * @returns A new HTMLImageElement with filtered colors made transparent
 */
export function filterBackgroundColor(img: HTMLImageElement, threshold: number = COLOR_THRESHOLD): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    try {
      if (typeof document === 'undefined') {
        reject(new Error('HTMLImageElement filtering requires a document-backed canvas'));
        return;
      }

      const surface = applyBackgroundFilter(img, threshold);
      if (!(surface.canvas instanceof HTMLCanvasElement)) {
        reject(new Error('Expected an HTMLCanvasElement processing surface'));
        return;
      }

      // toBlob encodes asynchronously (toDataURL encoded synchronously on the main thread)
      surface.canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Failed to create filtered image'));
          return;
        }
        imageFromBlob(blob).then(resolve, reject);
      }, 'image/png');
    } catch (error) {
      reject(error);
    }
  });
}

// ---------------------------------------------------------------------------------------------
// Off-main-thread sprite-sheet filtering (src/workers/spriteFilterWorker.ts)
// ---------------------------------------------------------------------------------------------

type FilterJob = { resolve: (blob: Blob) => void; reject: (error: Error) => void };
/** The worker answered with an HTTP error: the asset itself is missing. */
class SpriteFetchError extends Error {}

let filterWorkers: Worker[] | null = null;
let filterWorkersBroken = false;
let nextFilterWorker = 0;
let nextFilterJobId = 1;
const filterJobs = new Map<number, FilterJob>();

function failFilterWorkers(reason: string): void {
  filterWorkersBroken = true;
  for (const [id, job] of filterJobs) {
    filterJobs.delete(id);
    job.reject(new Error(reason));
  }
  filterWorkers?.forEach((w) => w.terminate());
  filterWorkers = null;
}

function getFilterWorker(): Worker | null {
  if (filterWorkersBroken) return null;
  if (
    typeof window === 'undefined' ||
    typeof Worker === 'undefined' ||
    typeof OffscreenCanvas === 'undefined' ||
    typeof createImageBitmap === 'undefined'
  ) {
    return null;
  }
  if (!filterWorkers) {
    try {
      // A few workers decode/filter/encode the start-up sheets in parallel; the remaining cores
      // stay free for the main thread and the GPU process.
      const cores = typeof navigator !== 'undefined' && navigator.hardwareConcurrency ? navigator.hardwareConcurrency : 2;
      const count = Math.max(1, Math.min(3, cores - 1));
      filterWorkers = [];
      for (let i = 0; i < count; i++) {
        const worker = new Worker(new URL('../../workers/spriteFilterWorker.ts', import.meta.url), { name: `sprite-filter-${i}` });
        worker.onmessage = (event: MessageEvent<SpriteFilterResponse>) => {
          const msg = event.data;
          const job = filterJobs.get(msg.id);
          if (!job) return;
          filterJobs.delete(msg.id);
          if (msg.ok) job.resolve(msg.blob);
          else job.reject(msg.status ? new SpriteFetchError(msg.error) : new Error(msg.error));
        };
        worker.onerror = (event) => {
          // The worker script itself failed (blocked, unsupported): filter on the main thread instead
          event.preventDefault();
          console.warn('[imageLoader] sprite filter worker failed, filtering on the main thread:', event.message);
          failFilterWorkers(`sprite filter worker failed: ${event.message}`);
        };
        filterWorkers.push(worker);
      }
    } catch (error) {
      console.warn('[imageLoader] sprite filter worker unavailable, filtering on the main thread:', error);
      failFilterWorkers('sprite filter worker unavailable');
      return null;
    }
  }
  const worker = filterWorkers[nextFilterWorker % filterWorkers.length];
  nextFilterWorker++;
  return worker;
}

function filterInWorker(worker: Worker, path: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const id = nextFilterJobId++;
    filterJobs.set(id, { resolve, reject });
    // The worker resolves relative URLs against its own script URL: send an absolute one
    const url = new URL(path, document.baseURI).href;
    const request: SpriteFilterRequest = { id, url, threshold: COLOR_THRESHOLD };
    worker.postMessage(request);
  });
}

/**
 * Fetch + decode + key out + encode in a worker (WebP first when supported, then the PNG).
 * Resolves null when no worker can be used; rejects with SpriteFetchError when the file is missing.
 */
async function loadFilteredInWorker(src: string): Promise<HTMLImageElement | null> {
  const webpPath = getWebPPath(src);
  const candidates = webpPath && (await checkWebPSupport()) ? [webpPath, src] : [src];
  let lastError: unknown = null;
  for (const path of candidates) {
    const worker = getFilterWorker();
    if (!worker) return null;
    try {
      return await imageFromBlob(await filterInWorker(worker, path));
    } catch (error) {
      lastError = error;
      // Only a missing file moves on to the next candidate; anything else (no OffscreenCanvas 2D,
      // a codec error, the worker died) is the caller's cue to filter on the main thread.
      if (!(error instanceof SpriteFetchError)) return null;
    }
  }
  throw lastError instanceof Error ? lastError : new SpriteFetchError(`Failed to load sprite sheet ${src}`);
}

function loadUncachedImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

/** Main-thread fallback: load the unfiltered sheet WITHOUT caching or announcing it, then filter it. */
async function loadFilteredOnMainThread(src: string): Promise<HTMLImageElement> {
  const webpPath = getWebPPath(src);
  let raw: HTMLImageElement | null = null;
  if (webpPath && (await checkWebPSupport())) {
    raw = await loadUncachedImage(webpPath).catch(() => null);
  }
  if (!raw) raw = await loadUncachedImage(src);
  return filterBackgroundColor(raw);
}

const pendingSpriteLoads = new Map<string, Promise<HTMLImageElement>>();

/**
 * Loads an image and applies background color filtering if it's a sprite sheet.
 * A filtered sheet is cached (under `${src}_filtered`) and announced through `onImageLoaded` only
 * once it is filtered and decoded; the red-background original is never cached on the way (it
 * used to be, and was drawn red until the filtered copy replaced it without a notification).
 * The filtering runs in a worker where possible. Concurrent calls for one sheet share one load.
 * @param src The image source path
 * @param applyFilter Whether to apply background color filtering (default: true for sprite sheets)
 * @returns Promise resolving to the loaded (and optionally filtered) image
 */
export function loadSpriteImage(src: string, applyFilter: boolean = true): Promise<HTMLImageElement> {
  if (!applyFilter) return loadImage(src);
  const cacheKey = `${src}_filtered`;
  const cached = imageCache.get(cacheKey);
  if (cached) return Promise.resolve(cached);
  const pending = pendingSpriteLoads.get(cacheKey);
  if (pending) return pending;

  const load = (async () => {
    const filtered = (await loadFilteredInWorker(src)) ?? (await loadFilteredOnMainThread(src));
    imageCache.set(cacheKey, filtered);
    notifyImageLoaded();
    return filtered;
  })();
  pendingSpriteLoads.set(cacheKey, load);
  const forget = () => {
    pendingSpriteLoads.delete(cacheKey);
  };
  load.then(forget, forget);
  return load;
}

/**
 * Get a cached image if available
 * @param src The image source path
 * @param filtered Whether to get the filtered version
 */
export function getCachedImage(src: string, filtered: boolean = false): HTMLImageElement | undefined {
  const cacheKey = filtered ? `${src}_filtered` : src;
  return imageCache.get(cacheKey);
}

