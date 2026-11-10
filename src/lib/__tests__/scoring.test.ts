import { describe, expect, it } from 'vitest';
import {
  calculateAverageCoverage,
  calculateEnvironmentScore,
  calculateHappiness,
  calculateJobSatisfaction,
  calculateOccupiedCoverageAverages,
  isEnvironmentPlayableBuildingType,
} from '@/lib/scoring';

describe('scoring', () => {
  it('environment score never decreases when trees are added', () => {
    let previous = -1;
    for (let trees = 0; trees <= 1000; trees += 50) {
      const score = calculateEnvironmentScore(trees, 0, 0, 1000);
      expect(score).toBeGreaterThanOrEqual(previous);
      previous = score;
    }
  });

  it('environment score stays within 0-100', () => {
    expect(calculateEnvironmentScore(0, 0, 1_000_000, 100)).toBe(0);
    expect(calculateEnvironmentScore(10_000, 10_000, 0, 100)).toBeLessThanOrEqual(100);
    expect(calculateEnvironmentScore(5, 0, 0, 0)).toBe(0);
  });

  it('average coverage handles empty and filled grids', () => {
    expect(calculateAverageCoverage([])).toBe(0);
    expect(calculateAverageCoverage([[0, 100], [100, 0]])).toBe(50);
  });

  it('occupied coverage averages only over tiles with residents or jobs, weighted by them', () => {
    const g = (vals: number[][]) => vals;
    const services = {
      police: g([[100, 0], [0, 0]]),
      fire: g([[0, 0], [0, 0]]),
      health: g([[50, 0], [100, 0]]),
      education: g([[0, 0], [0, 0]]),
    } as unknown as Parameters<typeof calculateOccupiedCoverageAverages>[0];
    const tile = (population: number, jobs: number) => ({ building: { population, jobs } });
    const grid = [[tile(10, 0), tile(0, 0)], [tile(0, 30), tile(0, 0)]];
    const avg = calculateOccupiedCoverageAverages(services, grid);
    expect(avg.police).toBeCloseTo(25);
    expect(avg.health).toBeCloseTo(87.5);
    const empty = [[tile(0, 0)]];
    expect(calculateOccupiedCoverageAverages(services, empty)).toEqual({ police: 0, fire: 0, health: 0, education: 0 });
  });

  it('grass, water and empty tiles are not part of the developed footprint', () => {
    expect(isEnvironmentPlayableBuildingType('grass')).toBe(false);
    expect(isEnvironmentPlayableBuildingType('water')).toBe(false);
    expect(isEnvironmentPlayableBuildingType('empty')).toBe(false);
    expect(isEnvironmentPlayableBuildingType('road')).toBe(true);
  });

  it('job satisfaction is 100 when jobs cover population', () => {
    expect(calculateJobSatisfaction(100, 50)).toBe(100);
    expect(calculateJobSatisfaction(25, 100)).toBe(25);
  });

  it('happiness is capped at 100 and falls with higher tax', () => {
    const base = { safety: 100, health: 100, education: 100, environment: 100, jobSatisfaction: 100 };
    expect(calculateHappiness({ ...base, taxRate: 0 })).toBeLessThanOrEqual(100);
    expect(calculateHappiness({ ...base, taxRate: 20 })).toBeLessThan(calculateHappiness({ ...base, taxRate: 5 }));
  });
});
