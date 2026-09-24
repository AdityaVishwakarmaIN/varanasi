import { describe, expect, it } from 'vitest';
import {
  calculateAverageCoverage,
  calculateEnvironmentScore,
  calculateHappiness,
  calculateJobSatisfaction,
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
