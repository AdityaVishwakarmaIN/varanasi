import { describe, expect, it } from 'vitest';
import { BUILDING_STATS } from '@/games/isocity/types/buildings';
import { MIXED_USE_CONFIG, formatMixedUseInfo, getMixedUseResidents, isMixedUse } from '@/lib/mixedUse';

describe('mixed-use commercial', () => {
  it('only small shops, medium shops and low offices at level 2+', () => {
    expect(isMixedUse('shop_small', 1)).toBe(false);
    expect(isMixedUse('shop_small', 2)).toBe(true);
    expect(isMixedUse('office_low', 5)).toBe(true);
    expect(isMixedUse('office_high', 5)).toBe(false);
    expect(isMixedUse('mall', 5)).toBe(false);
    expect(isMixedUse('house_small', 5)).toBe(false);
  });

  it('residents = floor(maxJobs × 0.4 × level × efficiency × 0.8), like jobs', () => {
    const maxJobs = BUILDING_STATS.shop_medium.maxJobs; // 28
    expect(getMixedUseResidents('shop_medium', 1, maxJobs)).toBe(0);
    expect(getMixedUseResidents('shop_medium', 2, maxJobs)).toBe(Math.floor(28 * 0.4 * 2 * 0.8));
    expect(getMixedUseResidents('shop_medium', 3, maxJobs)).toBe(Math.floor(28 * 0.4 * 3 * 0.8));
    expect(getMixedUseResidents('shop_medium', 3, maxJobs, 0.5)).toBe(Math.floor(28 * 0.4 * 3 * 0.5 * 0.8));
    expect(getMixedUseResidents('shop_medium', 3, maxJobs, 0)).toBe(0);
  });

  it('residents are resident-ratio times the jobs formula', () => {
    const maxJobs = BUILDING_STATS.office_low.maxJobs;
    const level = 4;
    const jobs = maxJobs * level * 0.8;
    expect(getMixedUseResidents('office_low', level, maxJobs)).toBe(Math.floor(jobs * MIXED_USE_CONFIG.residentRatio));
  });

  it('formats the tile-info line', () => {
    expect(formatMixedUseInfo(45, 18)).toBe('Shops: 45 jobs · Homes above: 18 residents');
  });
});
