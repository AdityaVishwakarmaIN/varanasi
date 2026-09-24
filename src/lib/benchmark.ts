/**
 * Benchmark city and camera fly-through (Sprint 1, S1-T2). Pure logic: no React, no DOM.
 *
 * - `createBenchmarkState(size)` always builds the same city (fixed seed).
 * - Benchmark states get an id starting with `BENCHMARK_CONFIG.idPrefix`. Autosave skips
 *   writing them, so loading a benchmark never overwrites the player's saved city.
 * - `flythroughCamera(t, gridSize)` gives the camera target for progress `t` in [0, 1].
 */
import { generateRandomAdvancedCity } from '@/lib/simulation';
import { createRng } from '@/lib/rng';
import type { GameState } from '@/types/game';

export const BENCHMARK_CONFIG = {
  seed: 20260924,
  cityName: 'Benchmark',
  sizes: [120, 160] as const,
  idPrefix: 'benchmark-',
  /** Wait after loading before measuring, so sprites load and the first render settles. */
  settleMs: 3000,
  /** Length of the measured fly-through. */
  flythroughMs: 30000,
  /** Game speed during the fly-through (tick targets are defined at speed 3). */
  flythroughSpeed: 3 as const,
  /** Camera zoom for most of the fly-through. */
  baseZoom: 1,
  /** Figure-eight size as a fraction of the map size. */
  pathRadiusFraction: 0.3,
  /** Part of the run (fractions of 0..1) during which the camera zooms in, then out, once. */
  zoomWindow: [0.4, 0.7] as const,
  /** Zoom swing around baseZoom during the zoom window (in to base+amp, out to base-amp). */
  zoomAmplitude: 0.6,
};

export type BenchmarkSize = (typeof BENCHMARK_CONFIG.sizes)[number];

export function isBenchmarkSize(n: number): n is BenchmarkSize {
  return (BENCHMARK_CONFIG.sizes as readonly number[]).includes(n);
}

/** The fixed benchmark city. Same size gives the same layout every time. */
export function createBenchmarkState(size: BenchmarkSize): GameState {
  const state = generateRandomAdvancedCity(size, BENCHMARK_CONFIG.cityName, createRng(BENCHMARK_CONFIG.seed));
  return { ...state, id: `${BENCHMARK_CONFIG.idPrefix}${size}` };
}

/** True for a city created by `createBenchmarkState` (autosave must not persist it). */
export function isBenchmarkState(state: Pick<GameState, 'id'> | null | undefined): boolean {
  return typeof state?.id === 'string' && state.id.startsWith(BENCHMARK_CONFIG.idPrefix);
}

export type BenchmarkParams = {
  bench: BenchmarkSize | null;
  flythrough: boolean;
};

/** Reads `?bench=120|160` and `?flythrough=1` from a URL query string. */
export function parseBenchmarkParams(search: string): BenchmarkParams {
  const params = new URLSearchParams(search);
  const size = Number(params.get('bench'));
  const bench = isBenchmarkSize(size) ? size : null;
  return { bench, flythrough: bench !== null && params.get('flythrough') === '1' };
}

/**
 * Camera target at progress `t` (0..1) of the fly-through: a figure-eight around the map
 * centre (in tile coordinates), with one zoom-in-then-out during `zoomWindow`.
 */
export function flythroughCamera(t: number, gridSize: number): { tileX: number; tileY: number; zoom: number } {
  const { pathRadiusFraction, zoomWindow, zoomAmplitude, baseZoom } = BENCHMARK_CONFIG;
  const clamped = Math.min(1, Math.max(0, t));
  const angle = clamped * Math.PI * 2;
  const centre = (gridSize - 1) / 2;
  const radius = gridSize * pathRadiusFraction;
  // Lemniscate of Gerono: x = sin(a), y = sin(a)cos(a); one full figure-eight per run.
  const tileX = centre + radius * Math.sin(angle);
  const tileY = centre + radius * Math.sin(angle) * Math.cos(angle);

  let zoom = baseZoom;
  const [z0, z1] = zoomWindow;
  if (clamped > z0 && clamped < z1) {
    const u = (clamped - z0) / (z1 - z0);
    zoom = baseZoom + zoomAmplitude * Math.sin(u * Math.PI * 2);
  }
  return { tileX, tileY, zoom };
}

/** Builds the benchmark city and loads it through GameContext's `loadState`. */
export function loadBenchmarkCity(size: BenchmarkSize, loadState: (stateString: string) => boolean): boolean {
  return loadState(JSON.stringify(createBenchmarkState(size)));
}
