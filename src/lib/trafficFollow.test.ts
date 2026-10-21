import { describe, it, expect } from 'vitest';
import { getFollowGap } from './trafficConfig';
describe('getFollowGap', () => {
  it('car behind car keeps the legacy 0.25', () => expect(getFollowGap('car', 'car')).toBeCloseTo(0.25));
  it('small kinds follow closer', () => {
    expect(getFollowGap('motorbike', 'motorbike')).toBeLessThan(0.2);
    expect(getFollowGap('motorbike', 'car')).toBeLessThan(0.25);
  });
});
