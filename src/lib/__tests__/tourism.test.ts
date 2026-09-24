import { describe, expect, it } from 'vitest';
import { calculateGhatIncome, riverFactor, TOURISM_CONFIG } from '@/lib/tourism';

const base = { gangaHealth: 70, hasRoadAccess: true, commercialTilesNearby: 0, otherGhatsNearby: 0 };

describe('tourism', () => {
  it('a clean river pays more than a dirty one', () => {
    expect(calculateGhatIncome({ ...base, gangaHealth: 90 })).toBeGreaterThan(calculateGhatIncome({ ...base, gangaHealth: 30 }));
    expect(riverFactor(0)).toBe(0);
    expect(riverFactor(100)).toBe(1);
  });

  it('road access matters', () => {
    const withRoad = calculateGhatIncome(base);
    const without = calculateGhatIncome({ ...base, hasRoadAccess: false });
    expect(without).toBeCloseTo(withRoad * TOURISM_CONFIG.noAccessFactor);
  });

  it('commerce and cluster bonuses are capped', () => {
    const plain = calculateGhatIncome({ ...base, gangaHealth: 100 });
    const maxed = calculateGhatIncome({ ...base, gangaHealth: 100, commercialTilesNearby: 1000, otherGhatsNearby: 1000 });
    expect(maxed).toBeCloseTo(plain * TOURISM_CONFIG.commerceBonusCap * TOURISM_CONFIG.clusterBonusCap);
  });
});
