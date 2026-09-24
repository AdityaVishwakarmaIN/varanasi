import { describe, expect, it } from 'vitest';
import type { Tile } from '@/types/game';
import { PILGRIM_CONFIG } from '@/lib/pilgrims';
import { PEDESTRIAN_MIN_ACTIVITY_TIME } from '../constants';
import {
  endGhatVisit,
  isActivePilgrim,
  spawnPilgrimAtGhat,
  spawnPilgrimWalking,
  updatePedestrianState,
} from '../pedestrianSystem';

const SIZE = 12;
const GHAT = { x: 6, y: 4 };
const HOME = { x: 1, y: 6 };

/** A road along row 5, a ghat just north of it and a house just south of it. */
function makeGrid(): Tile[][] {
  const grid: Tile[][] = [];
  for (let y = 0; y < SIZE; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < SIZE; x++) {
      let type = 'grass';
      if (y === 5) type = 'road';
      else if (x === GHAT.x && y === GHAT.y) type = 'ghat';
      else if (x === HOME.x && y === HOME.y) type = 'house_small';
      row.push({ x, y, zone: 'none', building: { type } } as unknown as Tile);
    }
    grid.push(row);
  }
  return grid;
}

describe('pilgrims at the ghats (S3-T10)', () => {
  it('a pilgrim at a ghat sits or stands there, dressed in the pilgrim palette, and lingers longer', () => {
    const ped = spawnPilgrimAtGhat(1, GHAT.x, GHAT.y, makeGrid(), SIZE, HOME.x, HOME.y)!;
    expect(ped).not.toBeNull();
    expect(ped.destType).toBe('ghat');
    expect(ped.state).toBe('at_recreation');
    expect(['sitting_bench', 'watching_game']).toContain(ped.activity);
    expect(PILGRIM_CONFIG.clothingColors).toContain(ped.shirtColor);
    expect(ped.activityDuration).toBeGreaterThanOrEqual(PILGRIM_CONFIG.lingerMultiplier * PEDESTRIAN_MIN_ACTIVITY_TIME);
    expect(ped.maxAge).toBeGreaterThan(ped.activityDuration * (1 - ped.activityProgress));
    expect(isActivePilgrim(ped)).toBe(true);
  });

  it('a walking pilgrim arrives at the ghat and stays', () => {
    const grid = makeGrid();
    const ped = spawnPilgrimWalking(2, GHAT.x, GHAT.y, grid, SIZE, HOME.x, HOME.y)!;
    expect(ped.state).toBe('walking');
    for (let i = 0; i < 2000 && ped.state === 'walking'; i++) {
      expect(updatePedestrianState(ped, 0.1, 1, grid, SIZE, [ped])).toBe(true);
    }
    expect(ped.state).toBe('at_recreation');
    expect(ped.destX).toBe(GHAT.x);
    expect(ped.destY).toBe(GHAT.y);
  });

  it('ending a visit sends the pilgrim home, and they stop counting toward the crowd', () => {
    const grid = makeGrid();
    const ped = spawnPilgrimAtGhat(3, GHAT.x, GHAT.y, grid, SIZE, HOME.x, HOME.y)!;
    endGhatVisit(ped);
    updatePedestrianState(ped, 0.1, 1, grid, SIZE, [ped]);
    expect(ped.state).toBe('walking');
    expect(ped.returningHome).toBe(true);
    expect(isActivePilgrim(ped)).toBe(false);
  });
});
