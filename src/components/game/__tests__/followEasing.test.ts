import { describe, it, expect } from 'vitest';
import { followSpeedFactor, FOLLOW_STOP_GAP, FOLLOW_FREE_GAP } from '../followEasing';

describe('followSpeedFactor', () => {
  it('holds when too close and flows when clear', () => {
    expect(followSpeedFactor(0)).toBe(0);
    expect(followSpeedFactor(FOLLOW_STOP_GAP)).toBe(0);
    expect(followSpeedFactor(FOLLOW_FREE_GAP)).toBe(1);
    expect(followSpeedFactor(2)).toBe(1);
  });
  it('is monotonic between the two gaps', () => {
    let prev = 0;
    for (let g = FOLLOW_STOP_GAP + 0.01; g < FOLLOW_FREE_GAP; g += 0.01) {
      const f = followSpeedFactor(g);
      expect(f).toBeGreaterThan(0);
      expect(f).toBeLessThanOrEqual(1);
      expect(f).toBeGreaterThanOrEqual(prev);
      prev = f;
    }
  });
});
