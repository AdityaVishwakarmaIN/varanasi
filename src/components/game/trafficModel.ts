// Congestion model for wandering traffic: a per-tile EMA of how jammed each road tile is, and an
// exit choice that prefers free roads. Pure typed-array code, no React/canvas deps.

/** Per-tile congestion, 0 free .. 1 jammed, smoothed over ~2 s so cars don't flip-flop. */
export class CongestionMap {
  level = new Float32Array(0);
  /** `count[i]` = vehicles on tile i this tick; `dt` in seconds. */
  update(count: Uint16Array, dt: number, capacity = 3): void {
    if (this.level.length !== count.length) this.level = new Float32Array(count.length);
    const a = 1 - Math.exp(-dt / 2);
    const lv = this.level;
    for (let i = 0; i < lv.length; i++) {
      const c = count[i];
      if (c === 0 && lv[i] < 0.001) { lv[i] = 0; continue; }
      lv[i] += (Math.min(1, c / capacity) - lv[i]) * a;
    }
  }
}

const WEIGHTS = new Float32Array(4);

/**
 * Picks an index into `cand` (tile indices, at most 4), weighting each by (1 - congestion)^2 + 0.1 so
 * jammed exits are rare but never impossible. `rnd` in [0, 1).
 */
export function pickLeastCongested(level: Float32Array, cand: ArrayLike<number>, n: number, rnd: number): number {
  let total = 0;
  for (let i = 0; i < n; i++) { const f = 1 - (level[cand[i]] ?? 0); WEIGHTS[i] = f * f + 0.1; total += WEIGHTS[i]; }
  let r = rnd * total;
  for (let i = 0; i < n; i++) { r -= WEIGHTS[i]; if (r <= 0) return i; }
  return n - 1;
}
