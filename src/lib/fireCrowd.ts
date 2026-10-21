/**
 * Onlookers at fires (arena team CHAOS, round 3): walkers who pass a blaze at a safe distance stop to watch for a
 * few seconds, then walk on. Pure helpers; the call site is a thin loop in updatePedestrians.
 */
export const FIRE_CROWD_CONFIG = {
  /** Tiles from the nearest fire in which a walker may stop to watch. */
  watchRadius: 7,
  /** Closer than this is too hot: walkers keep moving. */
  safeRadius: 2.5,
  /** Chance per check that a walker in the ring stops. */
  stopChance: 0.35,
  minWatchSeconds: 5,
  maxWatchSeconds: 11,
  /** Seconds between refreshes of the cached fire list (grid scan). */
  refreshSeconds: 1.5,
} as const;

export interface FirePoint { x: number; y: number }

/** Nearest fire's distance (tiles) or Infinity. */
export function nearestFireDistance(fires: readonly FirePoint[], x: number, y: number): number {
  let best = Infinity;
  for (let i = 0; i < fires.length; i++) {
    const d = Math.hypot(fires[i].x - x, fires[i].y - y);
    if (d < best) best = d;
  }
  return best;
}

/** Seconds a walker at (x,y) stands and watches, or 0 when they walk on. `roll` and `roll2` are 0..1 random numbers. */
export function getWatchSeconds(fires: readonly FirePoint[], x: number, y: number, roll: number, roll2: number): number {
  const c = FIRE_CROWD_CONFIG;
  const d = nearestFireDistance(fires, x, y);
  if (d < c.safeRadius || d > c.watchRadius) return 0;
  if (roll >= c.stopChance) return 0;
  return c.minWatchSeconds + roll2 * (c.maxWatchSeconds - c.minWatchSeconds);
}
