import { describe, expect, it } from 'vitest';
import { createRng } from '@/lib/rng';
import {
  PILGRIM_CONFIG,
  getGhatCrowdFactor,
  getGhatCrowdTarget,
  getPilgrimTarget,
  pickPilgrimClothing,
  shouldBecomePilgrim,
} from '@/lib/pilgrims';

describe('ghat crowd curve', () => {
  it('peaks at dawn and dusk, quiet at noon and at night', () => {
    for (const h of [5, 6, 7, 8, 17, 18, 19, 20]) expect(getGhatCrowdFactor(h)).toBeCloseTo(1);
    expect(getGhatCrowdFactor(12.5)).toBeCloseTo(PILGRIM_CONFIG.quietFactor);
    expect(getGhatCrowdFactor(0)).toBeCloseTo(PILGRIM_CONFIG.quietFactor);
    expect(getGhatCrowdFactor(6)).toBeGreaterThan(getGhatCrowdFactor(12) * 3);
  });

  it('is smooth, bounded and wraps around midnight', () => {
    let prev = getGhatCrowdFactor(0);
    for (let h = 0.05; h <= 48; h += 0.05) {
      const f = getGhatCrowdFactor(h);
      expect(f).toBeGreaterThanOrEqual(PILGRIM_CONFIG.quietFactor - 1e-9);
      expect(f).toBeLessThanOrEqual(1 + 1e-9);
      expect(Math.abs(f - prev)).toBeLessThan(0.05);
      prev = f;
    }
    expect(getGhatCrowdFactor(30)).toBeCloseTo(getGhatCrowdFactor(6));
    expect(getGhatCrowdFactor(-6)).toBeCloseTo(getGhatCrowdFactor(18));
  });

  it('ramps up before dawn', () => {
    expect(getGhatCrowdFactor(4)).toBeGreaterThan(getGhatCrowdFactor(3.5));
    expect(getGhatCrowdFactor(4)).toBeLessThan(1);
  });
});

describe('pilgrim numbers', () => {
  it('scale with tourism income and respect the quality cap', () => {
    expect(getPilgrimTarget(0, 100)).toBe(0);
    expect(getPilgrimTarget(100, 1000)).toBe(50);
    expect(getPilgrimTarget(100000, 80)).toBe(80);
    expect(getPilgrimTarget(200, 1000)).toBeGreaterThan(getPilgrimTarget(100, 1000));
    expect(getGhatCrowdTarget(100, 1000, 6)).toBe(50);
    expect(getGhatCrowdTarget(100, 1000, 12)).toBe(Math.round(50 * PILGRIM_CONFIG.quietFactor));
  });

  it('only on the Varanasi map, about 30% of pedestrians', () => {
    const rng = createRng(9);
    expect(shouldBecomePilgrim('random', rng)).toBe(false);
    let n = 0;
    for (let i = 0; i < 10000; i++) if (shouldBecomePilgrim('varanasi', rng)) n++;
    expect(n / 10000).toBeCloseTo(PILGRIM_CONFIG.share, 1);
  });

  it('clothing comes from the palette', () => {
    const rng = createRng(2);
    for (let i = 0; i < 50; i++) expect(PILGRIM_CONFIG.clothingColors).toContain(pickPilgrimClothing(rng));
  });
});
