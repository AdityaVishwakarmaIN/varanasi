// ============================================================================
// IMAGE LOADING UTILITIES
// ============================================================================
// Handles loading and caching of sprite images with optional background filtering
// and WebP optimization for faster loading on slow connections.

// Background color to filter from sprite sheets
const BACKGROUND_COLOR = { r: 255, g: 0, b: 0 };
// Color distance threshold - pixels within this distance will be made transparent
const COLOR_THRESHOLD = 155; // Adjust this value to be more/less aggressive
// Image cache for building sprites
const imageCache = new Map<string, HTMLImageElement>();
const bitmapCache = new Map<string, ImageBitmap>();

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

function createProcessingSurface(width: number, height: number, preferOffscreen: boolean = false): ProcessingSurface {
  if (preferOffscreen && typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get offscreen canvas context');
    }
    return { canvas, ctx };
  }

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
  preferOffscreen: boolean = false
): ProcessingSurface {
  const { width, height } = getCanvasImageDimensions(image as CachedCanvasImage);
  const surface = createProcessingSurface(width, height, preferOffscreen);
  const { ctx } = surface;

  ctx.drawImage(image, 0, 0);

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const distance = Math.sqrt(
      Math.pow(r - BACKGROUND_COLOR.r, 2) +
      Math.pow(g - BACKGROUND_COLOR.g, 2) +
      Math.pow(b - BACKGROUND_COLOR.b, 2)
    );

    if (distance <= threshold) {
      data[i + 3] = 0;
    }
  }

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
      imageCache.set(src, img);
      notifyImageLoaded();
      resolve(img);
    };
    img.onerror = reject;
    img.src = src;
  });
}

async function loadBitmapDirect(src: string): Promise<ImageBitmap> {
  const response = await fetch(src);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${src}`);
  }

  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);
  bitmapCache.set(src, bitmap);
  notifyImageLoaded();
  return bitmap;
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

export async function loadImageBitmap(src: string): Promise<ImageBitmap> {
  if (bitmapCache.has(src)) {
    return bitmapCache.get(src)!;
  }

  const webpPath = getWebPPath(src);
  if (webpPath) {
    try {
      const bitmap = await loadBitmapDirect(webpPath);
      bitmapCache.set(src, bitmap);
      return bitmap;
    } catch {
      console.debug(`WebP bitmap not available for ${src}, using source asset`);
    }
  }

  return loadBitmapDirect(src);
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

      const surface = applyBackgroundFilter(img, threshold, false);
      if (!(surface.canvas instanceof HTMLCanvasElement)) {
        reject(new Error('Expected an HTMLCanvasElement processing surface'));
        return;
      }

      const filteredImg = new Image();
      filteredImg.onload = () => {
        resolve(filteredImg);
      };
      filteredImg.onerror = (error) => {
        reject(new Error('Failed to create filtered image'));
      };
      filteredImg.src = surface.canvas.toDataURL();
    } catch (error) {
      reject(error);
    }
  });
}

export async function filterBackgroundColorToBitmap(
  image: CanvasImageSource,
  threshold: number = COLOR_THRESHOLD
): Promise<ImageBitmap> {
  const surface = applyBackgroundFilter(image, threshold, true);

  if ('transferToImageBitmap' in surface.canvas) {
    return surface.canvas.transferToImageBitmap();
  }

  return createImageBitmap(surface.canvas);
}

/**
 * Loads an image and applies background color filtering if it's a sprite sheet
 * @param src The image source path
 * @param applyFilter Whether to apply background color filtering (default: true for sprite sheets)
 * @returns Promise resolving to the loaded (and optionally filtered) image
 */
export function loadSpriteImage(src: string, applyFilter: boolean = true): Promise<HTMLImageElement> {
  // Check if this is already cached (as filtered version)
  const cacheKey = applyFilter ? `${src}_filtered` : src;
  if (imageCache.has(cacheKey)) {
    return Promise.resolve(imageCache.get(cacheKey)!);
  }
  
  return loadImage(src).then((img) => {
    if (applyFilter) {
      return filterBackgroundColor(img).then((filteredImg: HTMLImageElement) => {
        imageCache.set(cacheKey, filteredImg);
        return filteredImg;
      });
    }
    return img;
  });
}

export async function loadSpriteImageBitmap(src: string, applyFilter: boolean = true): Promise<ImageBitmap> {
  const cacheKey = applyFilter ? `${src}_filtered` : src;
  if (bitmapCache.has(cacheKey)) {
    return bitmapCache.get(cacheKey)!;
  }

  const bitmap = await loadImageBitmap(src);
  if (!applyFilter) {
    bitmapCache.set(cacheKey, bitmap);
    return bitmap;
  }

  const filtered = await filterBackgroundColorToBitmap(bitmap);
  bitmapCache.set(cacheKey, filtered);
  return filtered;
}

/**
 * Check if an image is cached
 * @param src The image source path
 * @param filtered Whether to check for the filtered version
 */
export function isImageCached(src: string, filtered: boolean = false): boolean {
  const cacheKey = filtered ? `${src}_filtered` : src;
  return imageCache.has(cacheKey);
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

export function getCachedBitmap(src: string, filtered: boolean = false): ImageBitmap | undefined {
  const cacheKey = filtered ? `${src}_filtered` : src;
  return bitmapCache.get(cacheKey);
}

/**
 * Clear the image cache
 */
export function clearImageCache(): void {
  bitmapCache.forEach((bitmap) => {
    bitmap.close();
  });
  bitmapCache.clear();
  imageCache.clear();
}
