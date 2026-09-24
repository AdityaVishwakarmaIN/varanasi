import { describe, expect, it } from 'vitest';
import { FEEDER_SIZE, getFeederBounds, getFeederCount, getFeederIndex } from '@/lib/feederZones';

describe('feeder zones', () => {
  it('counts blocks, rounding partial blocks up', () => {
    expect(FEEDER_SIZE).toBe(16);
    expect(getFeederCount(160)).toBe(100);
    expect(getFeederCount(120)).toBe(64);
    expect(getFeederCount(60)).toBe(16);
  });

  it('indexes row by row', () => {
    expect(getFeederIndex(0, 0, 160)).toBe(0);
    expect(getFeederIndex(15, 15, 160)).toBe(0);
    expect(getFeederIndex(16, 0, 160)).toBe(1);
    expect(getFeederIndex(0, 16, 160)).toBe(10);
    expect(getFeederIndex(159, 159, 160)).toBe(99);
    expect(getFeederIndex(-1, 0, 160)).toBe(-1);
  });

  it('bounds contain exactly their own tiles and clamp at the edge', () => {
    const size = 60;
    for (let i = 0; i < getFeederCount(size); i++) {
      const b = getFeederBounds(i, size);
      for (let y = b.y0; y < b.y1; y++) for (let x = b.x0; x < b.x1; x++) expect(getFeederIndex(x, y, size)).toBe(i);
      expect(getFeederIndex(b.centerX, b.centerY, size)).toBe(i);
    }
    expect(getFeederBounds(15, 60)).toMatchObject({ x0: 48, y0: 48, x1: 60, y1: 60 });
  });
});
