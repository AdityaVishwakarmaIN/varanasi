import { describe, expect, it } from 'vitest';
import { CongestionMap, pickLeastCongested } from '../trafficModel';

describe('CongestionMap', () => {
  it('rises toward the jam level and decays back to free', () => {
    const map = new CongestionMap();
    const counts = new Uint16Array([3, 0]);
    for (let i = 0; i < 100; i++) map.update(counts, 0.1);
    expect(map.level[0]).toBeGreaterThan(0.9);
    expect(map.level[1]).toBe(0);
    counts[0] = 0;
    for (let i = 0; i < 200; i++) map.update(counts, 0.1);
    expect(map.level[0]).toBeLessThan(0.01);
  });

  it('does not change while paused (dt = 0)', () => {
    const map = new CongestionMap();
    map.update(new Uint16Array([3]), 0);
    expect(map.level[0]).toBe(0);
  });
});

describe('pickLeastCongested', () => {
  it('prefers free exits but never rules out a jammed one', () => {
    const level = new Float32Array([1, 0]);
    const cand = [0, 1];
    let jammed = 0;
    const N = 1000;
    for (let i = 0; i < N; i++) if (pickLeastCongested(level, cand, 2, (i + 0.5) / N) === 0) jammed++;
    expect(jammed / N).toBeGreaterThan(0.05);
    expect(jammed / N).toBeLessThan(0.15);
  });

  it('is uniform when nothing is congested', () => {
    const level = new Float32Array(3);
    expect(pickLeastCongested(level, [0, 1, 2], 3, 0.1)).toBe(0);
    expect(pickLeastCongested(level, [0, 1, 2], 3, 0.5)).toBe(1);
    expect(pickLeastCongested(level, [0, 1, 2], 3, 0.9)).toBe(2);
  });
});
