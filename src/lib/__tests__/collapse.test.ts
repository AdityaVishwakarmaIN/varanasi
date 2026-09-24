import { describe, expect, it } from 'vitest';
import { COLLAPSE_CONFIG, COLLAPSE_MIN_AGE, estimateCollapsesPerYear, getCollapseChance, type CollapseInputs } from '@/lib/collapse';

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
    expect(getCollapseChance({ ...old, season: 'monsoon' })).toBeCloseTo(0.0015, 12);
    expect(getCollapseChance({ ...old, floodedThisYear: true })).toBeCloseTo(0.001, 12);
    expect(getCollapseChance({ ...old, season: 'monsoon', floodedThisYear: true })).toBeCloseTo(0.003, 12);
  });

  it('x0.3 with fire coverage or a recent upgrade (not stacked)', () => {
    expect(getCollapseChance({ ...old, fireCoverage: true })).toBeCloseTo(0.00015, 12);
    expect(getCollapseChance({ ...old, daysSinceUpgrade: 100 })).toBeCloseTo(0.00015, 12);
    expect(getCollapseChance({ ...old, daysSinceUpgrade: 720 })).toBeCloseTo(0.00015, 12);
    expect(getCollapseChance({ ...old, daysSinceUpgrade: 721 })).toBe(0.0005);
    expect(getCollapseChance({ ...old, fireCoverage: true, daysSinceUpgrade: 10 })).toBeCloseTo(0.00015, 12);
  });

  it('estimateCollapsesPerYear matches the daily chances', () => {
    // 100 buildings: 9 months at 0.0005 + 3 months at 0.0015 → 100 × 0.0005 × 1.5 × 360 = 27
    expect(estimateCollapsesPerYear(100, false)).toBeCloseTo(27, 6);
    expect(estimateCollapsesPerYear(100, true)).toBeCloseTo(8.1, 6);
  });
});
