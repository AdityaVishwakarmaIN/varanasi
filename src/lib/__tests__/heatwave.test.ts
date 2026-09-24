import { describe, expect, it } from 'vitest';
import { createRng } from '@/lib/rng';
import {
  clearFinishedHeatwave,
  computeHeatwaveHit,
  computeShadeMask,
  getHeatwaveDemandMultipliers,
  HEATWAVE_CONFIG,
  isHeatwaveActive,
  isHeatwavePending,
  maybeScheduleHeatwave,
} from '@/lib/heatwave';

describe('maybeScheduleHeatwave', () => {
  it('never schedules outside summer', () => {
    for (const season of ['monsoon', 'postMonsoon', 'winter'] as const) {
      const r = maybeScheduleHeatwave({ heatwave: undefined, today: 100, season }, () => 0);
      expect(r).toEqual({ heatwave: undefined, scheduled: false });
    }
  });

  it('schedules 3 days ahead for 5-10 days when the roll succeeds', () => {
    const rng = createRng(11);
    for (let i = 0; i < 500; i++) {
      const r = maybeScheduleHeatwave({ heatwave: undefined, today: 100, season: 'summer' }, rng);
      if (!r.scheduled) continue;
      expect(r.heatwave!.startDay).toBe(103);
      const len = r.heatwave!.endDay - r.heatwave!.startDay;
      expect(len).toBeGreaterThanOrEqual(5);
      expect(len).toBeLessThanOrEqual(10);
    }
    const draws = [0, 0.9999];
    const seq = () => draws.shift()!;
    expect(maybeScheduleHeatwave({ heatwave: undefined, today: 0, season: 'summer' }, seq).heatwave).toEqual({ startDay: 3, endDay: 13 });
  });

  it('succeeds about 25% of weekly checks', () => {
    const rng = createRng(2);
    let n = 0;
    for (let i = 0; i < 10000; i++) if (maybeScheduleHeatwave({ heatwave: undefined, today: 0, season: 'summer' }, rng).scheduled) n++;
    expect(n / 10000).toBeCloseTo(HEATWAVE_CONFIG.chance, 1);
  });

  it('does not schedule a second one while one is forecast or running, but does after it ends', () => {
    const hw = { startDay: 103, endDay: 110 };
    expect(maybeScheduleHeatwave({ heatwave: hw, today: 101, season: 'summer' }, () => 0)).toEqual({ heatwave: hw, scheduled: false });
    expect(maybeScheduleHeatwave({ heatwave: hw, today: 105, season: 'summer' }, () => 0)).toEqual({ heatwave: hw, scheduled: false });
    expect(maybeScheduleHeatwave({ heatwave: hw, today: 110, season: 'summer' }, () => 0).scheduled).toBe(true);
  });
});

describe('heatwave state', () => {
  const hw = { startDay: 10, endDay: 15 };
  it('is pending, then active on [start, end), then finished', () => {
    expect(isHeatwavePending(hw, 9)).toBe(true);
    expect(isHeatwaveActive(hw, 9)).toBe(false);
    expect(isHeatwaveActive(hw, 10)).toBe(true);
    expect(isHeatwaveActive(hw, 14)).toBe(true);
    expect(isHeatwaveActive(hw, 15)).toBe(false);
    expect(clearFinishedHeatwave(hw, 14)).toBe(hw);
    expect(clearFinishedHeatwave(hw, 15)).toBeUndefined();
    expect(isHeatwaveActive(undefined, 10)).toBe(false);
  });

  it('adds 1.15x power and water demand only while active', () => {
    expect(getHeatwaveDemandMultipliers(hw, 12)).toEqual({ power: 1.15, water: 1.15 });
    expect(getHeatwaveDemandMultipliers(hw, 9)).toEqual({ power: 1, water: 1 });
  });
});

describe('computeHeatwaveHit', () => {
  const base = { hasPower: true, hasWater: true, hasShade: false, hasHospital: false };

  it('spares tiles that have both power and water', () => {
    expect(computeHeatwaveHit(base)).toEqual({ health: 0, happiness: 0 });
  });

  it('hits tiles missing power or water by 15 health', () => {
    expect(computeHeatwaveHit({ ...base, hasPower: false }).health).toBe(15);
    expect(computeHeatwaveHit({ ...base, hasWater: false }).health).toBe(15);
    expect(computeHeatwaveHit({ ...base, hasWater: false }).happiness).toBeGreaterThan(0);
  });

  it('shade halves the hit and a hospital halves it again', () => {
    const shaded = computeHeatwaveHit({ ...base, hasPower: false, hasShade: true });
    expect(shaded.health).toBe(7.5);
    expect(computeHeatwaveHit({ ...base, hasPower: false, hasShade: true, hasHospital: true }).health).toBe(3.75);
    expect(computeHeatwaveHit({ ...base, hasPower: false, hasHospital: true }).health).toBe(7.5);
  });

  it('greenery measurably helps a block without power', () => {
    const size = 20;
    const shade = computeShadeMask(size, [{ x: 5, y: 5 }]);
    let withTrees = 0;
    let withoutTrees = 0;
    for (let y = 2; y <= 8; y++) {
      for (let x = 2; x <= 8; x++) {
        withTrees += computeHeatwaveHit({ ...base, hasPower: false, hasShade: shade[y * size + x] === 1 }).health;
        withoutTrees += computeHeatwaveHit({ ...base, hasPower: false }).health;
      }
    }
    expect(withTrees).toBe(withoutTrees / 2);
  });
});

describe('computeShadeMask', () => {
  it('covers a Chebyshev square of radius 3 clamped to the map', () => {
    const size = 10;
    const mask = computeShadeMask(size, [{ x: 1, y: 8 }]);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const expected = Math.max(Math.abs(x - 1), Math.abs(y - 8)) <= 3 ? 1 : 0;
        expect(mask[y * size + x]).toBe(expected);
      }
    }
  });
});
