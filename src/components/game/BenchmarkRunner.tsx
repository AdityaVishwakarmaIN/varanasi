'use client';

import { useEffect, useState } from 'react';
import { useGame } from '@/context/GameContext';
import {
  BENCHMARK_CONFIG,
  flythroughCamera,
  loadBenchmarkCity,
  parseBenchmarkParams,
  type BenchmarkSize,
} from '@/lib/benchmark';
import { getPerfRenderer, resetPerfStats, startPerfCapture, stopPerfCapture } from '@/lib/perfStats';
import { getCameraController, offsetToCenterWorldPoint } from '@/components/game/cameraController';
import { gridToScreen } from '@/components/game/utils';
import { TILE_HEIGHT, TILE_WIDTH } from '@/components/game/types';

declare global {
  interface Window {
    /** Result of the last benchmark fly-through (for automated runs). */
    __flythroughResult?: Record<string, unknown>;
  }
}

/**
 * Drives the camera along the fixed fly-through path for BENCHMARK_CONFIG.flythroughMs,
 * then logs the performance summary as JSON. Returns a cancel function.
 */
function runFlythrough(size: BenchmarkSize, setSpeed: (speed: 0 | 1 | 2 | 3) => void): () => void {
  let cancelled = false;
  let frameId = 0;
  let startedAt = -1;

  const step = (now: number) => {
    if (cancelled) return;
    const controller = getCameraController();
    // Wait until the map component is mounted and shows the benchmark city.
    if (!controller || controller.getCamera().gridSize !== size) {
      frameId = requestAnimationFrame(step);
      return;
    }
    if (startedAt < 0) {
      setSpeed(BENCHMARK_CONFIG.flythroughSpeed);
      resetPerfStats();
      startPerfCapture();
      startedAt = now;
      console.info(`[flythrough] started on bench-${size} (${BENCHMARK_CONFIG.flythroughMs / 1000} s)`);
    }

    const t = (now - startedAt) / BENCHMARK_CONFIG.flythroughMs;
    const { tileX, tileY, zoom } = flythroughCamera(t, size);
    const { screenX, screenY } = gridToScreen(tileX, tileY, 0, 0);
    const { canvasSize } = controller.getCamera();
    const offset = offsetToCenterWorldPoint(screenX + TILE_WIDTH / 2, screenY + TILE_HEIGHT / 2, zoom, canvasSize);
    controller.setCamera({ offset, zoom });

    if (t < 1) {
      frameId = requestAnimationFrame(step);
      return;
    }
    const summary = stopPerfCapture();
    const result = {
      map: `bench-${size}`,
      renderer: getPerfRenderer(),
      durationMs: Math.round(now - startedAt),
      speed: BENCHMARK_CONFIG.flythroughSpeed,
      ...summary,
    };
    window.__flythroughResult = result;
    console.log(`[flythrough] ${JSON.stringify(result)}`);
  };

  const settle = setTimeout(() => {
    frameId = requestAnimationFrame(step);
  }, BENCHMARK_CONFIG.settleMs);

  return () => {
    cancelled = true;
    clearTimeout(settle);
    cancelAnimationFrame(frameId);
    if (startedAt >= 0) stopPerfCapture();
  };
}

/**
 * URL-driven benchmark (S1-T2): `?bench=120|160` loads the fixed benchmark city on start,
 * and `&flythrough=1` then runs the measured camera fly-through. Renders nothing.
 * The benchmark city is never autosaved (see `isBenchmarkState`), so the player's save is safe.
 */
export function BenchmarkRunner() {
  const { isStateReady, loadState, setSpeed } = useGame();
  const [loadedSize, setLoadedSize] = useState<BenchmarkSize | null>(null);

  // Load the benchmark city once, after the saved game (if any) has been read.
  useEffect(() => {
    if (!isStateReady || loadedSize !== null) return;
    const { bench } = parseBenchmarkParams(window.location.search);
    if (bench === null) return;
    const id = setTimeout(() => {
      const start = performance.now();
      if (!loadBenchmarkCity(bench, loadState)) {
        console.error(`[benchmark] failed to load bench-${bench}`);
        return;
      }
      console.info(`[benchmark] loaded bench-${bench} in ${Math.round(performance.now() - start)} ms`);
      setLoadedSize(bench);
    }, 0);
    return () => clearTimeout(id);
  }, [isStateReady, loadedSize, loadState]);

  useEffect(() => {
    if (loadedSize === null || !parseBenchmarkParams(window.location.search).flythrough) return;
    return runFlythrough(loadedSize, setSpeed);
  }, [loadedSize, setSpeed]);

  return null;
}
