import { describe, expect, it } from 'vitest';
import {
  BENCHMARK_CONFIG,
  createBenchmarkState,
  flythroughCamera,
  isBenchmarkState,
  parseBenchmarkParams,
} from '@/lib/benchmark';

describe('benchmark', () => {
  it('builds the same city every time', () => {
    const a = createBenchmarkState(120);
    const b = createBenchmarkState(120);
    expect(a.gridSize).toBe(120);
    for (let y = 0; y < a.gridSize; y++) {
      for (let x = 0; x < a.gridSize; x++) {
        expect(a.grid[y][x].building.type).toBe(b.grid[y][x].building.type);
        expect(a.grid[y][x].zone).toBe(b.grid[y][x].zone);
      }
    }
  });

  it('marks benchmark states so autosave can skip them', () => {
    expect(isBenchmarkState(createBenchmarkState(120))).toBe(true);
    expect(isBenchmarkState({ id: 'd0c3f1d2-1111-4222-8333-444455556666' })).toBe(false);
    expect(isBenchmarkState(null)).toBe(false);
  });

  it('parses URL parameters', () => {
    expect(parseBenchmarkParams('?bench=160&flythrough=1&perf=1')).toEqual({ bench: 160, flythrough: true });
    expect(parseBenchmarkParams('?bench=120')).toEqual({ bench: 120, flythrough: false });
    expect(parseBenchmarkParams('?bench=99&flythrough=1')).toEqual({ bench: null, flythrough: false });
    expect(parseBenchmarkParams('')).toEqual({ bench: null, flythrough: false });
  });

  it('fly-through stays on the map and zooms in and out once', () => {
    let minZoom = Infinity;
    let maxZoom = -Infinity;
    for (let i = 0; i <= 1000; i++) {
      const c = flythroughCamera(i / 1000, 160);
      expect(c.tileX).toBeGreaterThanOrEqual(0);
      expect(c.tileX).toBeLessThanOrEqual(159);
      expect(c.tileY).toBeGreaterThanOrEqual(0);
      expect(c.tileY).toBeLessThanOrEqual(159);
      minZoom = Math.min(minZoom, c.zoom);
      maxZoom = Math.max(maxZoom, c.zoom);
    }
    expect(maxZoom).toBeCloseTo(BENCHMARK_CONFIG.baseZoom + BENCHMARK_CONFIG.zoomAmplitude, 2);
    expect(minZoom).toBeCloseTo(BENCHMARK_CONFIG.baseZoom - BENCHMARK_CONFIG.zoomAmplitude, 2);
    const start = flythroughCamera(0, 160);
    const end = flythroughCamera(1, 160);
    expect(end.tileX).toBeCloseTo(start.tileX, 6);
    expect(end.tileY).toBeCloseTo(start.tileY, 6);
  });
});
