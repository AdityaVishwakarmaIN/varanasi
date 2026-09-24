import { describe, expect, it } from 'vitest';
import { getRiverZoneArrays } from '@/games/isocity/maps/riverZones';
import { computeFloodplainSand, getFloodplainSand, FLOODPLAIN_SAND_CONFIG } from '../floodplainSand';

const ZONE_EAST_FLOODPLAIN = 4;

describe('floodplain sand', () => {
  it('is only computed on the Varanasi map and cached per size', () => {
    expect(getFloodplainSand(60, 'random')).toBeNull();
    expect(getFloodplainSand(60, undefined)).toBeNull();
    const a = getFloodplainSand(60, 'varanasi');
    expect(a).not.toBeNull();
    expect(getFloodplainSand(60, 'varanasi')).toBe(a);
  });

  it('marks every floodplain tile as sand and nothing on the west bank or river', () => {
    const size = 120;
    const sand = getFloodplainSand(size, 'varanasi')!;
    const { zone } = getRiverZoneArrays(size);
    let floodplain = 0;
    for (let i = 0; i < zone.length; i++) {
      if (zone[i] === ZONE_EAST_FLOODPLAIN) {
        floodplain++;
        expect(sand.index[i]).toBeGreaterThan(0);
      } else if (zone[i] !== 5) {
        expect(sand.index[i]).toBe(0);
      }
      if (sand.index[i] > 0) expect(sand.palette[sand.index[i] - 1].top).toMatch(/^#[0-9a-f]{6}$/);
    }
    expect(floodplain).toBeGreaterThan(0);
  });

  it('blends toward grass at the outer edge', () => {
    // A 1-row strip: distances 1..6 with floodplain width 4 (tiles 1..4 floodplain, 5 = east bank fringe, 6 = east bank)
    const zone = Uint8Array.from([1, 4, 4, 4, 4, 5, 5, 1, 1]);
    const distance = Uint16Array.from([0, 1, 2, 3, 4, 5, 6, 0, 0]);
    const { index } = computeFloodplainSand(zone, distance, 4);
    const shades = FLOODPLAIN_SAND_CONFIG.sandShades.length;
    const level = (i: number) => Math.floor((index[i] - 1) / shades);
    expect(level(1)).toBe(0);
    expect(level(2)).toBe(0);
    expect(level(3)).toBe(1);
    expect(level(4)).toBe(2);
    expect(level(5)).toBe(3);
    expect(index[6]).toBe(0);
    expect(index[0]).toBe(0);
  });
});
