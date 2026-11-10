import { describe, expect, it } from 'vitest';
import { FIRE_CROWD_CONFIG, getWatchSeconds, nearestFireDistance } from '@/lib/fireCrowd';

describe('fire onlookers', () => {
  const fires = [{ x: 10, y: 10 }];
  it('measures the nearest fire', () => {
    expect(nearestFireDistance([], 0, 0)).toBe(Infinity);
    expect(nearestFireDistance(fires, 13, 14)).toBe(5);
  });
  it('stops walkers in the ring only, for a bounded time', () => {
    const c = FIRE_CROWD_CONFIG;
    expect(getWatchSeconds(fires, 11, 10, 0, 0)).toBe(0); // too hot
    expect(getWatchSeconds(fires, 30, 10, 0, 0)).toBe(0); // too far
    expect(getWatchSeconds(fires, 14, 10, 0.99, 0)).toBe(0); // walks on
    expect(getWatchSeconds(fires, 14, 10, 0, 0)).toBe(c.minWatchSeconds);
    expect(getWatchSeconds(fires, 14, 10, 0, 1)).toBe(c.maxWatchSeconds);
  });
});
