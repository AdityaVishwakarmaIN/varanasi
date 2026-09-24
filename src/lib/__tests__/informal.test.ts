import { describe, expect, it } from 'vitest';
import { createRng } from '@/lib/rng';
import {
  INFORMAL_CONFIG,
  advanceFormalisation,
  formatFormalisedMessage,
  isFormalisationSatisfied,
  isInformalCandidate,
  pickInformalSpawnTiles,
  scoreInformalCandidate,
  shouldSpawnInformal,
  type InformalCandidate,
} from '@/lib/informal';

const good: InformalCandidate = {
  x: 10,
  y: 10,
  isGrass: true,
  isUnzoned: true,
  distanceToJobs: 3,
  distanceToRoad: 1,
  riverZone: 'westBank',
};

describe('spawn conditions', () => {
  it('needs demand above 40 and too few empty residential tiles', () => {
    expect(shouldSpawnInformal({ residentialDemand: 50, population: 10000, emptyResidentialTiles: 100 })).toBe(true);
    expect(shouldSpawnInformal({ residentialDemand: 40, population: 10000, emptyResidentialTiles: 100 })).toBe(false);
    expect(shouldSpawnInformal({ residentialDemand: 50, population: 10000, emptyResidentialTiles: 200 })).toBe(false);
    expect(shouldSpawnInformal({ residentialDemand: 50, population: 10000, emptyResidentialTiles: 199 })).toBe(true);
    expect(shouldSpawnInformal({ residentialDemand: 90, population: 0, emptyResidentialTiles: 0 })).toBe(false);
  });
});

describe('candidate filtering', () => {
  it('accepts a grass, unzoned tile near jobs and a road', () => {
    expect(isInformalCandidate(good)).toBe(true);
    expect(isInformalCandidate({ ...good, distanceToJobs: 6, distanceToRoad: 2 })).toBe(true);
  });

  it('rejects every broken rule', () => {
    expect(isInformalCandidate({ ...good, isGrass: false })).toBe(false);
    expect(isInformalCandidate({ ...good, isUnzoned: false })).toBe(false);
    expect(isInformalCandidate({ ...good, distanceToJobs: 7 })).toBe(false);
    expect(isInformalCandidate({ ...good, distanceToJobs: Infinity })).toBe(false);
    expect(isInformalCandidate({ ...good, distanceToRoad: 3 })).toBe(false);
    expect(isInformalCandidate({ ...good, daysSinceBulldozed: 29 })).toBe(false);
    expect(isInformalCandidate({ ...good, daysSinceBulldozed: 30 })).toBe(true);
  });

  it('prefers the floodplain and the riverfront, and tiles near jobs', () => {
    expect(scoreInformalCandidate({ ...good, isGrass: false })).toBe(0);
    const plain = scoreInformalCandidate(good);
    expect(scoreInformalCandidate({ ...good, riverZone: 'eastFloodplain' })).toBeCloseTo(plain * INFORMAL_CONFIG.preferredZoneWeight);
    expect(scoreInformalCandidate({ ...good, riverZone: 'westRiverfront' })).toBeGreaterThan(plain);
    expect(scoreInformalCandidate({ ...good, distanceToJobs: 1 })).toBeGreaterThan(scoreInformalCandidate({ ...good, distanceToJobs: 5 }));
  });
});

describe('picking spawn tiles', () => {
  const candidates: InformalCandidate[] = Array.from({ length: 20 }, (_, i) => ({ ...good, x: i }));

  it('picks at most 3 distinct valid tiles', () => {
    const picked = pickInformalSpawnTiles([...candidates, { ...good, x: 99, isGrass: false }], createRng(1));
    expect(picked.length).toBe(INFORMAL_CONFIG.maxSpawnsPerWeek);
    expect(new Set(picked.map((p) => p.x)).size).toBe(picked.length);
    expect(picked.some((p) => p.x === 99)).toBe(false);
  });

  it('returns fewer when there are fewer candidates, and none when none are valid', () => {
    expect(pickInformalSpawnTiles(candidates.slice(0, 2), createRng(1)).length).toBe(2);
    expect(pickInformalSpawnTiles([{ ...good, isUnzoned: false }], createRng(1))).toEqual([]);
    expect(pickInformalSpawnTiles(candidates, createRng(1), 0)).toEqual([]);
  });

  it('is deterministic for a seed', () => {
    expect(pickInformalSpawnTiles(candidates, createRng(42))).toEqual(pickInformalSpawnTiles(candidates, createRng(42)));
  });

  it('favours preferred river zones', () => {
    const mixed: InformalCandidate[] = [
      ...Array.from({ length: 10 }, (_, i) => ({ ...good, x: i, riverZone: 'eastFloodplain' as const })),
      ...Array.from({ length: 10 }, (_, i) => ({ ...good, x: 100 + i })),
    ];
    const rng = createRng(7);
    let preferred = 0;
    for (let i = 0; i < 300; i++) {
      for (const p of pickInformalSpawnTiles(mixed, rng, 1)) if (p.riverZone === 'eastFloodplain') preferred++;
    }
    expect(preferred).toBeGreaterThan(200);
  });
});

describe('formalisation', () => {
  it('needs zoning, road, power and water', () => {
    const all = { zonedResidential: true, hasRoadAccess: true, powered: true, watered: true };
    expect(isFormalisationSatisfied(all)).toBe(true);
    expect(isFormalisationSatisfied({ ...all, watered: false })).toBe(false);
    expect(isFormalisationSatisfied({ ...all, zonedResidential: false })).toBe(false);
  });

  it('formalises after 30 continuous days and resets on a bad day', () => {
    let days = 0;
    let formalise = false;
    for (let i = 0; i < 29; i++) ({ days, formalise } = advanceFormalisation(days, true));
    expect(days).toBe(29);
    expect(formalise).toBe(false);
    expect(advanceFormalisation(days, true)).toEqual({ days: 30, formalise: true });
    expect(advanceFormalisation(days, false)).toEqual({ days: 0, formalise: false });
  });

  it('messages use the area name', () => {
    expect(formatFormalisedMessage('Lanka')).toBe('Families in Lanka now have proper homes.');
    expect(INFORMAL_CONFIG.displacement.message).toBe('Families were displaced.');
    expect(INFORMAL_CONFIG.displacement.happinessPenalty).toBe(3);
    expect(INFORMAL_CONFIG.displacement.durationDays).toBe(60);
  });
});
