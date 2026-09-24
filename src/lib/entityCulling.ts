/**
 * S1-T8: helpers so entity work scales with what is on screen, not with the map size. Pure.
 *
 * - Entities spawn inside the visible tile bounds plus a margin and are removed when they are
 *   far outside (ENTITY_CULL_CONFIG in qualityConfig.ts).
 * - How many entities a system wants is based on the road tiles *near the view* (a 2D prefix sum
 *   answers "how many road tiles in this rectangle" in O(1); it is rebuilt only when roads change).
 */
import type { ViewportBounds } from '@/lib/performanceUtils';

export type TileBounds = ViewportBounds;

export function isInBounds(x: number, y: number, b: TileBounds): boolean {
  return x >= b.minTileX && x <= b.maxTileX && y >= b.minTileY && y <= b.maxTileY;
}

/** Grows (or shrinks, with a negative margin) the bounds by `margin` tiles, clamped to the map. */
export function expandBounds(b: TileBounds, margin: number, gridSize: number): TileBounds {
  return {
    minTileX: Math.max(0, b.minTileX - margin),
    minTileY: Math.max(0, b.minTileY - margin),
    maxTileX: Math.min(gridSize - 1, b.maxTileX + margin),
    maxTileY: Math.min(gridSize - 1, b.maxTileY + margin),
  };
}

export function filterInBounds<T extends { x: number; y: number }>(list: readonly T[], b: TileBounds): T[] {
  const out: T[] = [];
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    if (isInBounds(item.x, item.y, b)) out.push(item);
  }
  return out;
}

/**
 * Summed-area table of an n×n predicate: `prefix[(y+1)*(n+1) + (x+1)]` = count of counted tiles
 * with tx ≤ x and ty ≤ y. Build once (O(n²)), then `countInBounds` is O(1).
 */
export function buildCountPrefix(n: number, isCounted: (x: number, y: number) => boolean): Int32Array {
  const w = n + 1;
  const prefix = new Int32Array(w * w);
  for (let y = 0; y < n; y++) {
    let row = 0;
    for (let x = 0; x < n; x++) {
      if (isCounted(x, y)) row++;
      prefix[(y + 1) * w + (x + 1)] = prefix[y * w + (x + 1)] + row;
    }
  }
  return prefix;
}

export function countInBounds(prefix: Int32Array, n: number, b: TileBounds): number {
  if (b.maxTileX < b.minTileX || b.maxTileY < b.minTileY) return 0;
  const w = n + 1;
  const x0 = Math.max(0, b.minTileX);
  const y0 = Math.max(0, b.minTileY);
  const x1 = Math.min(n - 1, b.maxTileX) + 1;
  const y1 = Math.min(n - 1, b.maxTileY) + 1;
  if (x1 <= x0 || y1 <= y0) return 0;
  return prefix[y1 * w + x1] - prefix[y0 * w + x1] - prefix[y1 * w + x0] + prefix[y0 * w + x0];
}

/** A random tile inside the bounds (integer coordinates). */
export function randomTileInBounds(b: TileBounds, random: () => number = Math.random): { x: number; y: number } {
  const x = b.minTileX + Math.floor(random() * (b.maxTileX - b.minTileX + 1));
  const y = b.minTileY + Math.floor(random() * (b.maxTileY - b.minTileY + 1));
  return { x, y };
}
