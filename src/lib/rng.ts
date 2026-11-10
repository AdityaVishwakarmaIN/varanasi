/**
 * Seeded random numbers.
 *
 * `createRng(seed)` returns a function that behaves like `Math.random()` (numbers in [0, 1)),
 * but always produces the same sequence for the same seed. Uses the mulberry32 algorithm:
 * tiny, fast and good enough for map generation and tests.
 */
export type Rng = () => number;

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return function mulberry32() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A fresh 32-bit city seed. */
export function createCitySeed(rng: Rng = Math.random): number {
  return Math.floor(rng() * 4294967296) >>> 0;
}

/**
 * Deterministic random numbers for one yearly/seasonal roll of one city: the same (seed, kind, parts)
 * always gives the same sequence, so reloading a save cannot re-roll it. Without a seed (old state),
 * falls back to `fallback` (the shared stream).
 */
export function rollRng(seed: number | undefined, fallback: Rng, kind: string, ...parts: number[]): Rng {
  if (seed === undefined || !Number.isFinite(seed)) return fallback;
  return createRng(hashString(`${seed}|${kind}|${parts.join('|')}`));
}

/** 32-bit FNV-1a hash of a string (stable across runs). */
export function hashString(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
