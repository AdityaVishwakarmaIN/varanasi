/**
 * EMBER perf: simulateTick on the 160x160 benchmark city, and updateCars per frame with a crowded road network.
 * Timing only (no assertions on speed); numbers go to the metrics file.
 */
import { describe, expect, it, vi } from 'vitest';
import { createRng } from '@/lib/rng';
import { generateRandomAdvancedCity, simulateTick } from '@/lib/simulation';
import type { Tile } from '@/types/game';
import { setQualitySetting } from '@/lib/graphicsSettings';
import { makeVehicleRig, quietSim, writeMetrics } from './harness';

const median = (v: number[]) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)];

function timeSimulateTick(weather: 'clear' | 'severe_storm'): { msPerTick: number } {
  const spy = vi.spyOn(Math, 'random').mockImplementation(createRng(7));
  try {
    let state = generateRandomAdvancedCity(160, 'Perf', createRng(7));
    for (let i = 0; i < 10; i++) state = simulateTick(state, weather); // warm up
    const runs: number[] = [];
    for (let r = 0; r < 5; r++) {
      const t0 = performance.now();
      for (let i = 0; i < 6; i++) state = simulateTick(state, weather);
      runs.push((performance.now() - t0) / 6);
    }
    return { msPerTick: +median(runs).toFixed(2) };
  } finally {
    spy.mockRestore();
  }
}

function lattice(n: number, spacing: number): Tile[][] {
  const src = generateRandomAdvancedCity(32, 'Perf', createRng(3)).grid.flat();
  const road = src.find((t) => t.building.type === 'road')!;
  const grass = src.find((t) => t.building.type === 'grass')!;
  const grid: Tile[][] = [];
  for (let y = 0; y < n; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < n; x++) {
      const s = x % spacing === 0 || y % spacing === 0 ? road : grass;
      row.push({ ...s, x, y, building: { ...s.building } } as Tile);
    }
    grid.push(row);
  }
  return grid;
}

function timeUpdateCars(target: number): { organic: number; organicMs: number; cars: number; msPerFrame: number } {
  const spy = vi.spyOn(Math, 'random').mockImplementation(createRng(5));
  try {
    setQualitySetting('high');
    const n = 100;
    const rig = makeVehicleRig(lattice(n, 5), n, { mapId: 'random' });
    for (let i = 0; i < 1500 && rig.cars.current.length < target; i++) rig.step(0.1, { emergency: false });
    const organic = rig.cars.current.length;
    const measure = () => {
      const runs: number[] = [];
      for (let r = 0; r < 7; r++) {
        const t0 = performance.now();
        for (let i = 0; i < 100; i++) rig.step(0.1, { emergency: false });
        runs.push((performance.now() - t0) / 100);
      }
      return +median(runs).toFixed(3);
    };
    const organicMs = measure();
    // The spawner stops short of 800 on this lattice: clone cars (new ids) to reach the target for a fair stress number.
    const base = rig.cars.current.slice();
    for (let i = 0; rig.cars.current.length < target && base.length > 0; i++) {
      rig.cars.current.push({ ...base[i % base.length], id: 100000 + i });
    }
    return { organic, organicMs, cars: rig.cars.current.length, msPerFrame: measure() };
  } finally {
    spy.mockRestore();
  }
}

describe('EMBER perf', () => {
  it('simulateTick 160 and updateCars ~800 cars', () => {
    quietSim();
    const result = {
      label: process.env.EMBER_LABEL ?? 'now',
      simulateTickClear: timeSimulateTick('clear'),
      simulateTickStorm: timeSimulateTick('severe_storm'),
      updateCars: timeUpdateCars(800),
    };
    writeMetrics(`perf-${result.label}`, result);
    console.log('PERF', JSON.stringify(result));
    expect(result.updateCars.cars).toBeGreaterThan(0);
  }, 300000);
});
