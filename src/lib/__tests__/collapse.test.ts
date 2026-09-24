import { describe, expect, it } from 'vitest';
import { COLLAPSE_CONFIG, COLLAPSE_MIN_AGE, estimateCollapsesPerYear, getCollapseChance, type CollapseInputs } from '@/lib/collapse';

const D = COLLAPSE_CONFIG.dailyChance;

const old: CollapseInputs = {
  zone: 'residential',
  age: COLLAPSE_MIN_AGE + 1,
  abandoned: false,
  constructionComplete: true,
  season: 'winter',
  floodedThisYear: false,
  fireCoverage: false,
};

describe('COLLAPSE_MIN_AGE', () => {
  it('is 8 years of 1-per-tick ageing (30 ticks x 360 days x 8)', () => {
    expect(COLLAPSE_MIN_AGE).toBe(86400);
  });
});

describe('getCollapseChance', () => {
  it('only old, finished, occupied residential or commercial buildings can collapse', () => {
    expect(getCollapseChance(old)).toBe(COLLAPSE_CONFIG.dailyChance);
    expect(getCollapseChance({ ...old, zone: 'commercial' })).toBe(COLLAPSE_CONFIG.dailyChance);
    expect(getCollapseChance({ ...old, zone: 'industrial' })).toBe(0);
    expect(getCollapseChance({ ...old, age: COLLAPSE_MIN_AGE })).toBe(0);
    expect(getCollapseChance({ ...old, abandoned: true })).toBe(0);
    expect(getCollapseChance({ ...old, constructionComplete: false })).toBe(0);
  });

  it('x3 in monsoon and x2 if flooded this year', () => {
    expect(getCollapseChance({ ...old, season: 'monsoon' })).toBeCloseTo(D * 3, 12);
    expect(getCollapseChance({ ...old, floodedThisYear: true })).toBeCloseTo(D * 2, 12);
    expect(getCollapseChance({ ...old, season: 'monsoon', floodedThisYear: true })).toBeCloseTo(D * 6, 12);
  });

  it('x0.3 with fire coverage or a recent upgrade (not stacked)', () => {
    expect(getCollapseChance({ ...old, fireCoverage: true })).toBeCloseTo(D * 0.3, 12);
    expect(getCollapseChance({ ...old, daysSinceUpgrade: 100 })).toBeCloseTo(D * 0.3, 12);
    expect(getCollapseChance({ ...old, daysSinceUpgrade: 720 })).toBeCloseTo(D * 0.3, 12);
    expect(getCollapseChance({ ...old, daysSinceUpgrade: 721 })).toBe(D);
    expect(getCollapseChance({ ...old, fireCoverage: true, daysSinceUpgrade: 10 })).toBeCloseTo(D * 0.3, 12);
  });

  it('estimateCollapsesPerYear matches the daily chances', () => {
    // 100 buildings: 9 months at D + 3 months at 3D → 100 × D × 1.5 × 360
    expect(estimateCollapsesPerYear(100, false)).toBeCloseTo(100 * D * 1.5 * 360, 6);
    expect(estimateCollapsesPerYear(100, true)).toBeCloseTo(100 * D * 1.5 * 360 * 0.3, 6);
  });
});
