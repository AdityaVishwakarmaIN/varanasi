import { describe, expect, it } from 'vitest';
import { createRng } from '@/lib/rng';
import {
  COW_CONFIG,
  VEHICLE_KINDS,
  VEHICLE_MIX,
  getMaxCows,
  getVehicleSpeedMultiplier,
  pickCowPauseSeconds,
  pickVehicleKind,
  stepOvertake,
  TRAFFIC_CONFIG,
  type VehicleKind,
} from '@/lib/trafficConfig';

describe('vehicle mix', () => {
  it('shares sum to 1 on every map', () => {
    for (const map of ['varanasi', 'random'] as const) {
      const sum = VEHICLE_KINDS.reduce((a, k) => a + VEHICLE_MIX[k].share[map], 0);
      expect(sum).toBeCloseTo(1);
    }
  });

  it('the random map only gets cars', () => {
    const rng = createRng(3);
    for (let i = 0; i < 200; i++) expect(pickVehicleKind('random', rng)).toBe('car');
    expect(pickVehicleKind(undefined, rng)).toBe('car');
  });

  it('the Varanasi map matches the configured shares', () => {
    const rng = createRng(11);
    const counts: Record<VehicleKind, number> = { car: 0, auto: 0, erickshaw: 0, motorbike: 0, cycle_rickshaw: 0 };
    const n = 20000;
    for (let i = 0; i < n; i++) counts[pickVehicleKind('varanasi', rng)]++;
    for (const k of VEHICLE_KINDS) expect(counts[k] / n).toBeCloseTo(VEHICLE_MIX[k].share.varanasi, 1);
  });

  it('speed multipliers', () => {
    expect(getVehicleSpeedMultiplier('cycle_rickshaw')).toBe(0.4);
    expect(getVehicleSpeedMultiplier('motorbike')).toBe(1.1);
    expect(getVehicleSpeedMultiplier(undefined)).toBe(1);
  });
});

describe('cows', () => {
  it('max = min(40, roadTiles / 60)', () => {
    expect(getMaxCows(0, 0)).toBe(0);
    expect(getMaxCows(59, 0)).toBe(0);
    expect(getMaxCows(600, 0)).toBe(10);
    expect(getMaxCows(10000, 0)).toBe(40);
  });

  it('each Gaushala removes 10, never below 0', () => {
    expect(getMaxCows(10000, 1)).toBe(30);
    expect(getMaxCows(10000, 4)).toBe(0);
    expect(getMaxCows(600, 5)).toBe(0);
  });

  it('lower quality scales it down', () => {
    expect(getMaxCows(10000, 0, 0.5)).toBe(20);
    expect(getMaxCows(10000, 1, 0.5)).toBe(15);
  });

  it('pauses are 5 to 20 seconds and slowdown is gentle', () => {
    const rng = createRng(5);
    for (let i = 0; i < 100; i++) {
      const s = pickCowPauseSeconds(rng);
      expect(s).toBeGreaterThanOrEqual(5);
      expect(s).toBeLessThanOrEqual(20);
    }
    expect(COW_CONFIG.vehicleSlowdown).toBe(0.3);
    expect(COW_CONFIG.vehicleSlowdown).toBeGreaterThan(0);
  });
});

describe('motorbike overtaking (S3-T4)', () => {
  it('a blocked motorbike overtakes only after waiting longer than the threshold', () => {
    const bike = { kind: 'motorbike' as VehicleKind };
    const wait = TRAFFIC_CONFIG.motorbikeOvertakeAfterSeconds;
    expect(stepOvertake(bike, true, wait * 0.6)).toBe(false);
    expect(stepOvertake(bike, true, wait * 0.6)).toBe(true);
    expect(bike).toMatchObject({ overtaking: true, blockedSeconds: 0 });
    // Already overtaking: nothing more to do
    expect(stepOvertake(bike, true, 10)).toBe(false);
  });

  it('the wait resets when the road clears', () => {
    const bike = { kind: 'motorbike' as VehicleKind };
    stepOvertake(bike, true, 0.9);
    stepOvertake(bike, false, 0.1);
    expect(stepOvertake(bike, true, 0.9)).toBe(false);
  });

  it('other kinds queue and never overtake', () => {
    for (const kind of VEHICLE_KINDS.filter((k) => k !== 'motorbike')) {
      const v = { kind };
      expect(stepOvertake(v, true, 100)).toBe(false);
      expect(v).toEqual({ kind });
    }
  });
});
