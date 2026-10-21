/**
 * EMBER T1 (traffic health on the example city) and T2 (emergency trip time through traffic vs empty roads).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { localizeExampleState } from '@/lib/exampleCity';
import { getDirectionOptions, isRoadTile } from '@/components/game/utils';
import type { GameState } from '@/types/game';
import { makeVehicleRig, seedMath, summarize, writeMetrics } from './harness';

const loadExample = (): GameState =>
  localizeExampleState(JSON.parse(readFileSync(join(process.cwd(), 'public/example-states/example_state_9.json'), 'utf8')) as GameState);

const FRAME = 0.1;

function busiestJunction(grid: GameState['grid'], size: number): { x: number; y: number } {
  // Most central 4-way junction.
  let best = { x: 0, y: 0 };
  let bestScore = Infinity;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!isRoadTile(grid, size, x, y)) continue;
      if (getDirectionOptions(grid, size, x, y).length < 4) continue;
      const score = Math.abs(x - size / 2) + Math.abs(y - size / 2);
      if (score < bestScore) {
        bestScore = score;
        best = { x, y };
      }
    }
  }
  return best;
}

describe('EMBER T1 traffic health', () => {
  it('example city: speed, stopped share, streaks, gridlock, junction throughput', () => {
    const results: Record<string, number>[] = [];
    for (const seed of [11, 23, 37]) {
      const restore = seedMath(seed);
      try {
        const state = loadExample();
        const rig = makeVehicleRig(state.grid, state.gridSize, { mapId: 'varanasi' });
        const junction = busiestJunction(state.grid, state.gridSize);
        const warm = 90;
        const measure = 240;
        rig.step(warm);
        const last = new Map<number, { x: number; y: number; p: number }>();
        const streak = new Map<number, number>();
        let longest = 0;
        let carFrames = 0;
        let stoppedFrames = 0;
        let distance = 0;
        let junctionEntries = 0;
        let gridlockedCars = 0;
        const gridlockSeen = new Set<number>();
        let lastWindowStopped = 0;
        let lastWindowFrames = 0;
        const frames = Math.round(measure / FRAME);
        for (let f = 0; f < frames; f++) {
          rig.step(FRAME);
          for (const car of rig.cars.current) {
            const prev = last.get(car.id);
            const key = { x: car.tileX, y: car.tileY, p: car.progress };
            if (prev) {
              const moved = prev.x !== key.x || prev.y !== key.y || Math.abs(prev.p - key.p) > 1e-6;
              carFrames++;
              if (moved) {
                const d = prev.x !== key.x || prev.y !== key.y ? Math.max(0, 1 - prev.p) + key.p : Math.abs(key.p - prev.p);
                distance += Math.min(d, 2);
                streak.set(car.id, 0);
              } else {
                stoppedFrames++;
                const s = (streak.get(car.id) ?? 0) + FRAME;
                streak.set(car.id, s);
                if (s > longest) longest = s;
                if (s >= 45 && !gridlockSeen.has(car.id)) {
                  gridlockSeen.add(car.id);
                  gridlockedCars++;
                }
              }
              if (f >= frames - 300) {
                lastWindowFrames++;
                if (!moved) lastWindowStopped++;
              }
              if ((prev.x !== key.x || prev.y !== key.y) && key.x === junction.x && key.y === junction.y) junctionEntries++;
            }
            last.set(car.id, key);
          }
        }
        const carSeconds = (carFrames * FRAME) || 1;
        results.push({
          seed,
          cars: rig.cars.current.length,
          avgSpeedTilesPerSec: Math.round((distance / carSeconds) * 1000) / 1000,
          stoppedPct: Math.round((stoppedFrames / Math.max(1, carFrames)) * 1000) / 10,
          longestStoppedSec: Math.round(longest * 10) / 10,
          gridlockedCars,
          finalWindowStoppedPct: Math.round((lastWindowStopped / Math.max(1, lastWindowFrames)) * 1000) / 10,
          junctionThroughputPerMin: Math.round((junctionEntries / (measure / 60)) * 10) / 10,
          junctionX: junction.x,
          junctionY: junction.y,
        });
      } finally {
        restore();
      }
    }
    const pick = (k: string) => summarize(results.map((r) => r[k]));
    const out = {
      runs: results,
      avgSpeedTilesPerSec: pick('avgSpeedTilesPerSec'),
      stoppedPct: pick('stoppedPct'),
      longestStoppedSec: pick('longestStoppedSec'),
      gridlockedCars: pick('gridlockedCars'),
      finalWindowStoppedPct: pick('finalWindowStoppedPct'),
      junctionThroughputPerMin: pick('junctionThroughputPerMin'),
    };
    writeMetrics('T1', out);
    console.log('T1', JSON.stringify(out));
    expect(results.length).toBe(3);
  }, 600000);
});

describe('EMBER T2 emergency trip vs empty roads', () => {
  it('fire truck trip time with and without traffic', () => {
    const loadedTimes: number[] = [];
    const emptyTimes: number[] = [];
    const ratios: number[] = [];
    const base = loadExample();
    const size = base.gridSize;
    // Stations and targets from the example city.
    const stations: { x: number; y: number }[] = [];
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (base.grid[y][x].building.type === 'fire_station') stations.push({ x, y });
    const targets: { x: number; y: number }[] = [];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const t = base.grid[y][x].building.type;
        if (t === 'house_small' || t === 'shop_small') targets.push({ x, y });
      }
    }
    const pairs: { s: { x: number; y: number }; t: { x: number; y: number } }[] = [];
    let k = 0;
    for (const t of targets) {
      const s = stations.reduce((b, c) => (Math.abs(c.x - t.x) + Math.abs(c.y - t.y) < Math.abs(b.x - t.x) + Math.abs(b.y - t.y) ? c : b));
      const d = Math.abs(s.x - t.x) + Math.abs(s.y - t.y);
      if (d >= 10 && d <= 22 && k++ % 9 === 0) pairs.push({ s, t });
      if (pairs.length >= 10) break;
    }
    const tripTime = (withTraffic: boolean, pair: (typeof pairs)[number], seed: number): number | null => {
      const restore = seedMath(seed);
      try {
        const state = loadExample();
        const rig = makeVehicleRig(state.grid, size, { mapId: 'varanasi' });
        if (withTraffic) rig.step(60, { emergency: false });
        // keep the dispatcher out: dispatch directly
        if (!rig.systems.dispatchEmergencyVehicle('fire_truck', pair.s.x, pair.s.y, pair.t.x, pair.t.y)) return null;
        let t = 0;
        while (t < 240) {
          rig.step(FRAME, { cars: withTraffic, emergency: true });
          t += FRAME;
          const v = rig.emergency.current[0];
          if (!v) return null;
          if (v.state !== 'dispatching') return t;
        }
        return null;
      } finally {
        restore();
      }
    };
    for (let i = 0; i < pairs.length; i++) {
      const empty = tripTime(false, pairs[i], 500 + i);
      const loaded = tripTime(true, pairs[i], 500 + i);
      if (empty === null || loaded === null) continue;
      emptyTimes.push(empty);
      loadedTimes.push(loaded);
      ratios.push(loaded / empty);
    }
    const out = {
      pairs: ratios.length,
      emptySec: summarize(emptyTimes),
      loadedSec: summarize(loadedTimes),
      ratio: summarize(ratios),
      meanRatio: Math.round((ratios.reduce((a, b) => a + b, 0) / Math.max(1, ratios.length)) * 1000) / 1000,
    };
    writeMetrics('T2', out);
    console.log('T2', JSON.stringify(out));
    expect(ratios.length).toBeGreaterThan(3);
  }, 600000);
});
