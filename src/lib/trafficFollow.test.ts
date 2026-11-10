import { describe, it, expect } from 'vitest';
import { getFollowGap, type VehicleKind } from './trafficConfig';
describe('getFollowGap', () => {
  it('car behind car keeps 0.34 (a car is 11 px, a tile 37 px)', () => expect(getFollowGap('car', 'car')).toBeCloseTo(0.34));
  it('small kinds follow closer', () => {
    expect(getFollowGap('motorbike', 'motorbike')).toBeLessThan(0.25);
    expect(getFollowGap('motorbike', 'car')).toBeLessThan(0.34);
  });
  it('no pair of kinds overlaps when queued bumper to bumper', () => {
    // [nose, tail] px from the sprite centre, from drawVehicleKinds; a tile along the road is 37.3 px
    const ext: Record<VehicleKind, [number, number]> = {
      car: [6, 5], auto: [4, 3.5], erickshaw: [3.5, 3.5], motorbike: [2.5, 2.5], cycle_rickshaw: [3.5, 3],
    };
    const kinds = Object.keys(ext) as VehicleKind[];
    for (const f of kinds) for (const l of kinds) {
      expect(getFollowGap(f, l) * 37.3).toBeGreaterThan(ext[f][0] + ext[l][1]);
    }
  });
});
