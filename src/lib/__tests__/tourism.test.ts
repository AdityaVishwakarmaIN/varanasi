import { describe, expect, it } from 'vitest';
import { calculateGhatIncome, calculateTourismIncome, riverFactor, TOURISM_CONFIG } from '@/lib/tourism';
import { calculateTaxIncome } from '@/lib/simulation';
import type { Tile } from '@/games/isocity/types/game';

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

describe('tourism balance (S2-T9 design target)', () => {
  // A healthy mid-game Varanasi: displayed population ~1 lakh (sim 10,000), Ganga Health 70,
  // 20 ghats in four rows of five, each row with a road behind it and a bazaar street.
  const size = 40;
  const tile = (type: string, zone = 'none', population = 0, jobs = 0) =>
    ({ zone, building: { type, population, jobs } }) as unknown as Tile;
  const grid: Tile[][] = Array.from({ length: size }, () => Array.from({ length: size }, () => tile('grass')));
  const ghats: { x: number; y: number }[] = [];
  for (const rowY of [5, 15, 25, 35]) {
    for (let x = 5; x < 10; x++) {
      grid[rowY][x] = tile('ghat');
      ghats.push({ x, y: rowY });
    }
    for (let x = 3; x < 12; x++) {
      grid[rowY - 2][x] = tile('road');
      grid[rowY - 3][x] = tile('shop_small', 'commercial', 10, 10);
    }
  }

  it('tourism is 15–25% of total income', () => {
    const tourism = calculateTourismIncome(grid, size, ghats, 70);
    const population = 10_000;
    for (const jobsPerResident of [0.4, 0.6, 0.8]) {
      const tax = calculateTaxIncome(population, population * jobsPerResident, 9);
      const share = tourism / (tourism + tax);
      expect(share).toBeGreaterThanOrEqual(0.15);
      expect(share).toBeLessThanOrEqual(0.25);
    }
  });
});
