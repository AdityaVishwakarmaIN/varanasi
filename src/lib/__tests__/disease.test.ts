import { describe, expect, it } from 'vitest';
import { createRng } from '@/lib/rng';
import {
  advanceOutbreak,
  calculateDiseaseRisk,
  DISEASE_CONFIG,
  DISEASE_FACTOR_LABELS,
  getDiseaseRiskFactors,
  getTopRiskFactor,
  rollOutbreak,
  startOutbreak,
  wasFloodedRecently,
  type DiseaseRiskInputs,
} from '@/lib/disease';

const calm: DiseaseRiskInputs = {
  population: 0,
  residentialTiles: 10,
  residentialTilesWithoutWater: 0,
  gangaHealth: 80,
  hasCatchmentTiles: true,
  floodedRecently: false,
  season: 'winter',
};

describe('calculateDiseaseRisk', () => {
  it('is the base risk for an empty, watered block in winter', () => {
    expect(calculateDiseaseRisk(calm)).toBeCloseTo(0.01, 10);
  });

  it('densityFactor = 1 + population / 2000', () => {
    expect(calculateDiseaseRisk({ ...calm, population: 2000 })).toBeCloseTo(0.02, 10);
    expect(calculateDiseaseRisk({ ...calm, population: 1000 })).toBeCloseTo(0.015, 10);
  });

  it('waterFactor = 1 + share of residential tiles without water', () => {
    expect(calculateDiseaseRisk({ ...calm, residentialTilesWithoutWater: 5 })).toBeCloseTo(0.015, 10);
    expect(calculateDiseaseRisk({ ...calm, residentialTilesWithoutWater: 10 })).toBeCloseTo(0.02, 10);
    expect(getDiseaseRiskFactors({ ...calm, residentialTiles: 0, residentialTilesWithoutWater: 0 }).water).toBe(1);
  });

  it('riverFactor 1.5 only when Ganga Health < 50 and the block touches the catchment', () => {
    expect(calculateDiseaseRisk({ ...calm, gangaHealth: 49 })).toBeCloseTo(0.015, 10);
    expect(calculateDiseaseRisk({ ...calm, gangaHealth: 50 })).toBeCloseTo(0.01, 10);
    expect(calculateDiseaseRisk({ ...calm, gangaHealth: 20, hasCatchmentTiles: false })).toBeCloseTo(0.01, 10);
    expect(calculateDiseaseRisk({ ...calm, gangaHealth: undefined })).toBeCloseTo(0.01, 10);
  });

  it('floodFactor 2 and seasonFactor 2 in monsoon and post-monsoon', () => {
    expect(calculateDiseaseRisk({ ...calm, floodedRecently: true })).toBeCloseTo(0.02, 10);
    expect(calculateDiseaseRisk({ ...calm, season: 'monsoon' })).toBeCloseTo(0.02, 10);
    expect(calculateDiseaseRisk({ ...calm, season: 'postMonsoon' })).toBeCloseTo(0.02, 10);
    expect(calculateDiseaseRisk({ ...calm, season: 'summer' })).toBeCloseTo(0.01, 10);
  });

  it('multiplies everything: dense, dry, dirty, flooded, monsoon block', () => {
    const worst = { ...calm, population: 4000, residentialTilesWithoutWater: 10, gangaHealth: 30, floodedRecently: true, season: 'monsoon' as const };
    // 0.01 × 3 × 2 × 1.5 × 2 × 2 = 0.36
    expect(calculateDiseaseRisk(worst)).toBeCloseTo(0.36, 10);
  });

  it('is capped at 1', () => {
    expect(calculateDiseaseRisk({ ...calm, population: 1e7, floodedRecently: true, season: 'monsoon' })).toBe(1);
  });

  it('outbreaks happen mostly in dense, under-watered, flood-hit blocks during the monsoon', () => {
    const rng = createRng(8);
    const risky = { ...calm, population: 3000, residentialTilesWithoutWater: 8, floodedRecently: true, season: 'monsoon' as const };
    let calmN = 0;
    let riskyN = 0;
    for (let i = 0; i < 5000; i++) {
      if (rollOutbreak(calculateDiseaseRisk(calm), rng)) calmN++;
      if (rollOutbreak(calculateDiseaseRisk(risky), rng)) riskyN++;
    }
    expect(riskyN).toBeGreaterThan(calmN * 10);
  });
});

describe('getTopRiskFactor', () => {
  it('names the biggest multiplier', () => {
    expect(getTopRiskFactor({ ...calm, population: 6000 })).toBe('density');
    expect(getTopRiskFactor({ ...calm, population: 500, residentialTilesWithoutWater: 9 })).toBe('water');
    expect(getTopRiskFactor({ ...calm, gangaHealth: 10 })).toBe('river');
  });

  it('breaks ties toward the more fixable cause (flood before season)', () => {
    expect(getTopRiskFactor({ ...calm, floodedRecently: true, season: 'monsoon' })).toBe('flood');
    expect(getTopRiskFactor({ ...calm, season: 'monsoon' })).toBe('season');
    expect(DISEASE_FACTOR_LABELS.flood).toMatch(/flood/i);
  });
});

describe('wasFloodedRecently', () => {
  it('looks back 20 days', () => {
    expect(wasFloodedRecently(undefined, 100)).toBe(false);
    expect(wasFloodedRecently(80, 100)).toBe(true);
    expect(wasFloodedRecently(79, 100)).toBe(false);
  });
});

describe('advanceOutbreak', () => {
  const bad = { hospitalCoverage: 20, waterCoverage: 40 };
  const good = { hospitalCoverage: 70, waterCoverage: 90 };

  it('loses 1% population per full week', () => {
    let o = startOutbreak(3, 0);
    let r = advanceOutbreak(o, { today: 6, ...bad });
    expect(r.populationLossFraction).toBe(0);
    o = r.outbreak!;
    r = advanceOutbreak(o, { today: 7, ...bad });
    expect(r.populationLossFraction).toBeCloseTo(0.01, 10);
    expect(r.outbreak!.lastLossDay).toBe(7);
    // Two weeks at once compound.
    r = advanceOutbreak(r.outbreak!, { today: 21, ...bad });
    expect(r.populationLossFraction).toBeCloseTo(1 - 0.99 * 0.99, 10);
  });

  it('lasts at least 14 days and cures 14 days after coverage becomes good', () => {
    let o = startOutbreak(0, 0);
    for (let day = 1; day <= 13; day++) {
      const r = advanceOutbreak(o, { today: day, ...good });
      expect(r.ended).toBeNull();
      o = r.outbreak!;
    }
    expect(o.cureConditionsSinceDay).toBe(1);
    const r = advanceOutbreak(o, { today: 15, ...good });
    expect(r.ended).toBe('cured');
    expect(r.outbreak).toBeNull();
  });

  it('resets the cure clock when coverage drops', () => {
    let o = startOutbreak(0, 0);
    o = advanceOutbreak(o, { today: 10, ...good }).outbreak!;
    o = advanceOutbreak(o, { today: 20, ...bad }).outbreak!;
    expect(o.cureConditionsSinceDay).toBeUndefined();
    o = advanceOutbreak(o, { today: 21, ...good }).outbreak!;
    expect(advanceOutbreak(o, { today: 34, ...good }).ended).toBeNull();
    expect(advanceOutbreak(o, { today: 35, ...good }).ended).toBe('cured');
  });

  it('needs both hospital >= 60 and water >= 80', () => {
    let o = startOutbreak(0, 0);
    o = advanceOutbreak(o, { today: 1, hospitalCoverage: 60, waterCoverage: 79 }).outbreak!;
    expect(o.cureConditionsSinceDay).toBeUndefined();
    o = advanceOutbreak(o, { today: 2, hospitalCoverage: 59, waterCoverage: 100 }).outbreak!;
    expect(o.cureConditionsSinceDay).toBeUndefined();
    o = advanceOutbreak(o, { today: 3, hospitalCoverage: 60, waterCoverage: 80 }).outbreak!;
    expect(o.cureConditionsSinceDay).toBe(3);
  });

  it('burns out after 60 days with a bigger population loss', () => {
    let o = startOutbreak(0, 0);
    let lastWeekly = 0;
    for (let day = 1; day < 60; day++) {
      const r = advanceOutbreak(o, { today: day, ...bad });
      expect(r.ended).toBeNull();
      if (r.populationLossFraction > 0) lastWeekly = r.populationLossFraction;
      o = r.outbreak!;
    }
    const r = advanceOutbreak(o, { today: 60, ...bad });
    expect(r.ended).toBe('selfResolved');
    expect(r.outbreak).toBeNull();
    expect(r.populationLossFraction).toBeGreaterThan(lastWeekly);
    expect(r.populationLossFraction).toBeGreaterThanOrEqual(DISEASE_CONFIG.selfResolveExtraLoss);
  });
});
