/**
 * Simulation tick benchmark (S1-T5). Skipped by default.
 *
 * Run with:  BENCH=1 npx vitest run src/lib/__tests__/simBench.test.ts
 * Optional:  BENCH_TICKS=200  BENCH_SIZE=160  BENCH_PROFILE=1 (adds a per-function self-time breakdown)
 *
 * Builds the benchmark city (same seed as the in-game benchmark), runs `simulateTick` repeatedly with a
 * seeded Math.random, and prints p50 / p95 / max tick time in milliseconds.
 */
import { afterAll, beforeAll, describe, it } from 'vitest';
import { Session } from 'node:inspector/promises';
import { createRng } from '@/lib/rng';
import { generateRandomAdvancedCity, simulateTick } from '@/lib/simulation';
import type { GameState } from '@/types/game';

const BENCH_SEED = 20260924;
const size = Number(process.env.BENCH_SIZE ?? 160);
const ticks = Number(process.env.BENCH_TICKS ?? 200);
const warmup = 20;

function percentile(sorted: number[], p: number): number {
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

interface ProfileNode {
  id: number;
  callFrame: { functionName: string; url: string; lineNumber: number };
  hitCount?: number;
  children?: number[];
}

function summariseProfile(profile: { nodes: ProfileNode[]; samples?: number[]; timeDeltas?: number[] }): string {
  // Self time per function, from sample counts weighted by time deltas.
  const selfUs = new Map<number, number>();
  const samples = profile.samples ?? [];
  const deltas = profile.timeDeltas ?? [];
  for (let i = 0; i < samples.length; i++) {
    selfUs.set(samples[i], (selfUs.get(samples[i]) ?? 0) + (deltas[i] ?? 0));
  }
  const byName = new Map<string, number>();
  let total = 0;
  for (const node of profile.nodes) {
    const us = selfUs.get(node.id) ?? 0;
    if (!us) continue;
    const file = node.callFrame.url.split('/').pop() || '(native)';
    const name = `${node.callFrame.functionName || '(anonymous)'} ${file}:${node.callFrame.lineNumber + 1}`;
    byName.set(name, (byName.get(name) ?? 0) + us);
    total += us;
  }
  const rows = [...byName.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
  return rows
    .map(([name, us]) => `  ${((us / total) * 100).toFixed(1).padStart(5)}%  ${(us / 1000).toFixed(1).padStart(8)} ms  ${name}`)
    .join('\n');
}

describe.skipIf(!process.env.BENCH)('simulateTick benchmark', () => {
  // Plain swap instead of vi.spyOn: the spy records every call, which distorts the timings.
  const realRandom = Math.random;
  beforeAll(() => {
    Math.random = createRng(BENCH_SEED + 1);
  });
  afterAll(() => {
    Math.random = realRandom;
  });

  it(`runs ${ticks} ticks on the ${size}x${size} benchmark city`, async () => {
    let state: GameState = generateRandomAdvancedCity(size, 'Benchmark', createRng(BENCH_SEED));
    for (let i = 0; i < warmup; i++) state = simulateTick(state, 'clear');

    const session = new Session();
    const profile = !!process.env.BENCH_PROFILE;
    if (profile) {
      session.connect();
      await session.post('Profiler.enable');
      await session.post('Profiler.setSamplingInterval', { interval: 100 });
      await session.post('Profiler.start');
    }

    const times: number[] = [];
    for (let i = 0; i < ticks; i++) {
      const t0 = performance.now();
      state = simulateTick(state, 'clear');
      times.push(performance.now() - t0);
    }

    let breakdown = '';
    if (profile) {
      const { profile: cpuProfile } = await session.post('Profiler.stop');
      breakdown = summariseProfile(cpuProfile as unknown as Parameters<typeof summariseProfile>[0]);
      session.disconnect();
    }

    const sorted = [...times].sort((a, b) => a - b);
    const mean = times.reduce((s, t) => s + t, 0) / times.length;
    console.log(
      `[bench] ${size}x${size}, ${ticks} ticks: p50=${percentile(sorted, 50).toFixed(2)} ms  ` +
        `p95=${percentile(sorted, 95).toFixed(2)} ms  max=${sorted[sorted.length - 1].toFixed(2)} ms  ` +
        `mean=${mean.toFixed(2)} ms  (pop=${state.stats.population}, structureVersion=${state.structureVersion})`
    );
    if (breakdown) console.log(`[bench] top self-time functions:\n${breakdown}`);
    // TEMP-PHASE
    const ph = (globalThis as Record<string, unknown>).__phase as Record<string, number> | undefined;
    if (ph) console.log('[phase]', JSON.stringify(Object.fromEntries(Object.entries(ph).map(([k, v]) => [k, +(v / ph.ticks).toFixed(3)]))));
  }, 120_000);
});
