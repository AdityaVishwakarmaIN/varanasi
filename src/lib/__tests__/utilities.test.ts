import { describe, expect, it } from 'vitest';
import {
  POWER_CONFIG,
  WATER_CONFIG,
  calculatePowerDemand,
  calculatePowerSupply,
  calculateWaterDemand,
  calculateWaterSupply,
  calculateWaterWorksCapacity,
  getCutCount,
  getCutFeeders,
  getCutMask,
  getSupplyStatus,
  isWaterWorksSiteValid,
  supplyRatio,
  toAbsoluteHour,
} from '@/lib/utilities';

describe('power supply and demand', () => {
  it('sums working plants with a 20% bonus per level', () => {
    expect(calculatePowerSupply([])).toBe(0);
    expect(calculatePowerSupply([{ level: 1, working: true }])).toBe(5000);
    expect(calculatePowerSupply([{ level: 3, working: true }])).toBeCloseTo(7000);
    expect(calculatePowerSupply([{ level: 5, working: true }, { level: 2, working: false }])).toBeCloseTo(9000);
    expect(calculatePowerSupply([{ level: 0, working: true }])).toBe(POWER_CONFIG.plantCapacity);
  });

  it('demand is population + half the jobs, times the season', () => {
    expect(calculatePowerDemand(1000, 400)).toBe(1200);
    expect(calculatePowerDemand(1000, 400, 1.3)).toBeCloseTo(1560);
    expect(calculatePowerDemand(-5, -5)).toBe(0);
  });

  it('ratio is capped at 1, and no demand counts as fully supplied', () => {
    expect(supplyRatio(5000, 10000)).toBe(0.5);
    expect(supplyRatio(20000, 10000)).toBe(1);
    expect(supplyRatio(0, 0)).toBe(1);
    expect(supplyRatio(0, 100)).toBe(0);
  });

  it('status colours follow the thresholds', () => {
    expect(getSupplyStatus(1)).toBe('ok');
    expect(getSupplyStatus(0.9)).toBe('amber');
    expect(getSupplyStatus(0.79)).toBe('red');
    expect(getSupplyStatus(0.9, WATER_CONFIG)).toBe('amber');
  });
});

describe('water supply and demand', () => {
  it('works capacity follows Ganga Health', () => {
    expect(calculateWaterWorksCapacity(100)).toBeCloseTo(12000);
    expect(calculateWaterWorksCapacity(0)).toBeCloseTo(7200);
    expect(calculateWaterWorksCapacity(50)).toBeCloseTo(9600);
    expect(calculateWaterWorksCapacity(150)).toBeCloseTo(12000);
    expect(calculateWaterWorksCapacity(30)).toBeLessThan(calculateWaterWorksCapacity(70));
  });

  it('lowering Ganga Health lowers total water supply', () => {
    const tanks = [{ level: 1, working: true }];
    const works = [{ working: true }];
    expect(calculateWaterSupply(tanks, works, 40)).toBeLessThan(calculateWaterSupply(tanks, works, 90));
    expect(calculateWaterSupply(tanks)).toBe(1500);
    expect(calculateWaterSupply(tanks, [{ working: false }], 100)).toBe(1500);
  });

  it('demand is one unit per resident, times the season', () => {
    expect(calculateWaterDemand(2000)).toBe(2000);
    expect(calculateWaterDemand(2000, 1.2)).toBeCloseTo(2400);
  });

  it('works must be 1..3 tiles from the Ganga', () => {
    expect(isWaterWorksSiteValid(1)).toBe(true);
    expect(isWaterWorksSiteValid(3)).toBe(true);
    expect(isWaterWorksSiteValid(4)).toBe(false);
    expect(isWaterWorksSiteValid(Infinity)).toBe(false);
  });
});

describe('rolling cuts', () => {
  it('cuts round((1 - ratio) × n) feeders', () => {
    expect(getCutCount(1, 10)).toBe(0);
    expect(getCutCount(0.75, 10)).toBe(3); // 2.5 rounds to 3
    expect(getCutCount(0.5, 10)).toBe(5);
    expect(getCutCount(0, 10)).toBe(10);
    expect(getCutCount(0.5, 0)).toBe(0);
    const feeders = [3, 7, 1, 9, 12, 20];
    expect(getCutFeeders(1, feeders, 5).size).toBe(0);
    const cut = getCutFeeders(0.5, feeders, 5);
    expect(cut.size).toBe(3);
    for (const f of cut) expect(feeders).toContain(f);
  });

  it('ignores order and duplicates in the input', () => {
    const a = getCutFeeders(0.6, [5, 1, 3, 9, 7], 11);
    const b = getCutFeeders(0.6, [9, 7, 7, 5, 3, 1, 1], 11);
    expect([...a].sort()).toEqual([...b].sort());
  });

  it('never cuts the same neighbourhood all the time', () => {
    const feeders = [0, 1, 2, 3, 4, 5, 6, 7];
    const first = getCutFeeders(0.75, feeders, 0);
    const next = getCutFeeders(0.75, feeders, 1);
    for (const f of first) expect(next.has(f)).toBe(false);
  });

  it('is fair: over 24 hours every feeder is cut within 1 hour of every other', () => {
    for (let n = 1; n <= 30; n++) {
      const feeders = Array.from({ length: n }, (_, i) => i * 3 + 1);
      for (const ratio of [0.95, 0.9, 0.8, 0.7, 0.6, 0.5, 0.33, 0.2, 0.1]) {
        for (const startHour of [0, 7, 1000]) {
          const counts = new Map<number, number>(feeders.map((f) => [f, 0]));
          for (let h = startHour; h < startHour + 24; h++) {
            for (const f of getCutFeeders(ratio, feeders, h)) counts.set(f, counts.get(f)! + 1);
          }
          const values = [...counts.values()];
          const total = values.reduce((a, b) => a + b, 0);
          expect(total).toBe(24 * getCutCount(ratio, n));
          expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('stays fair over several days with an absolute hour counter', () => {
    const feeders = [2, 4, 8, 16, 32, 33, 34];
    const counts = new Map<number, number>(feeders.map((f) => [f, 0]));
    for (let day = 1; day <= 30; day++) {
      for (let hour = 0; hour < 24; hour++) {
        const abs = toAbsoluteHour({ year: 2026, month: 3, day, hour });
        for (const f of getCutFeeders(0.7, feeders, abs)) counts.set(f, counts.get(f)! + 1);
      }
    }
    const values = [...counts.values()];
    expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(1);
  });

  it('absolute hours increase by one per hour, across days and months', () => {
    const t = { year: 2026, month: 1, day: 30, hour: 23 };
    expect(toAbsoluteHour({ ...t, month: 2, day: 1, hour: 0 })).toBe(toAbsoluteHour(t) + 1);
    expect(toAbsoluteHour({ year: 2027, month: 1, day: 1, hour: 0 })).toBe(
      toAbsoluteHour({ year: 2026, month: 12, day: 30, hour: 23 }) + 1
    );
  });

  it('builds a mask by feeder index', () => {
    const mask = getCutMask(0.5, [0, 2, 4, 6], 0, 8);
    expect(mask.length).toBe(8);
    expect(mask.reduce((a, b) => a + b, 0)).toBe(2);
    expect(mask[1] + mask[3] + mask[5] + mask[7]).toBe(0);
  });
});
