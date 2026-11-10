/**
 * Sprite-sheet key colour: the sheets are painted on a pure red background that is made
 * transparent at load time. Pure (no DOM), shared by the off-main-thread filter worker
 * (src/workers/spriteFilterWorker.ts) and the main-thread fallback in imageLoader.ts.
 */

export const SPRITE_KEY_COLOR = { r: 255, g: 0, b: 0 } as const;
/** Pixels within this RGB distance of the key colour become transparent. */
export const SPRITE_KEY_THRESHOLD = 155;

/**
 * Makes every pixel within `threshold` (Euclidean RGB distance) of the key colour fully
 * transparent, in place, on RGBA bytes (ImageData.data). Uses the squared distance in integers
 * (same result as comparing `sqrt(d²) <= threshold`, without a sqrt and two `Math.pow` per pixel).
 * Returns how many pixels were cleared.
 */
export function keyOutBackground(data: Uint8ClampedArray, threshold: number = SPRITE_KEY_THRESHOLD): number {
  const limit = threshold * threshold;
  const kr = SPRITE_KEY_COLOR.r;
  const kg = SPRITE_KEY_COLOR.g;
  const kb = SPRITE_KEY_COLOR.b;
  let cleared = 0;
  for (let i = 0; i < data.length; i += 4) {
    const dr = data[i] - kr;
    const dg = data[i + 1] - kg;
    const db = data[i + 2] - kb;
    if (dr * dr + dg * dg + db * db <= limit) {
      data[i + 3] = 0;
      cleared++;
    }
  }
  return cleared;
}
