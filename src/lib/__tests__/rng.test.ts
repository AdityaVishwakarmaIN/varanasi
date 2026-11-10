import { describe, expect, it } from 'vitest';
import { createRng, rollRng } from '@/lib/rng';

describe('createRng', () => {
  it('gives the same sequence for the same seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = Array.from({ length: 10 }, a);
    const seqB = Array.from({ length: 10 }, b);
    expect(seqA).toEqual(seqB);
  });

  it('gives different sequences for different seeds', () => {
    const seqA = Array.from({ length: 10 }, createRng(1));
    const seqB = Array.from({ length: 10 }, createRng(2));
    expect(seqA).not.toEqual(seqB);
  });

  it('stays within [0, 1)', () => {
    const rng = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('rollRng', () => {
  it('gives the same roll for the same seed and key, and a different one for another year', () => {
    const fallback = () => 0.5;
    expect(rollRng(42, fallback, 'monsoon', 2025)()).toBe(rollRng(42, fallback, 'monsoon', 2025)());
    expect(rollRng(42, fallback, 'monsoon', 2025)()).not.toBe(rollRng(42, fallback, 'monsoon', 2026)());
    expect(rollRng(42, fallback, 'monsoon', 2025)()).not.toBe(rollRng(42, fallback, 'heatwave', 2025)());
  });

  it('falls back to the shared stream without a seed', () => {
    const fallback = () => 0.5;
    expect(rollRng(undefined, fallback, 'monsoon', 2025)).toBe(fallback);
  });
});
