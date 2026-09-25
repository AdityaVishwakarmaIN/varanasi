import { describe, expect, it } from 'vitest';
import type { Tile } from '@/types/game';
import { createRng } from '@/lib/rng';
import { COW_CONFIG } from '@/lib/trafficConfig';
import { getCowSlowdown, getStandingCowTiles, isCowStanding, spawnCow, stepCow, type Cow } from '../cowSystem';

const SIZE = 10;

/** A single road along row 4, everything else grass. */
function makeGrid(): Tile[][] {
  return Array.from({ length: SIZE }, (_, y) =>
    Array.from({ length: SIZE }, (_, x) => ({ x, y, zone: 'none', building: { type: y === 4 ? 'road' : 'grass' } }) as unknown as Tile)
  );
}

function roadCow(grid: Tile[][], seed = 1): Cow {
  return spawnCow(1, 5, 4, grid, SIZE, createRng(seed))!;
}

describe('cows (S3-T5)', () => {
  it('spawn only on roads', () => {
    const grid = makeGrid();
    expect(spawnCow(1, 5, 3, grid, SIZE, createRng(1))).toBeNull();
    const cow = roadCow(grid);
    expect(cow).not.toBeNull();
    expect(COW_CONFIG.colors).toContain(cow.color);
    expect(isCowStanding(cow)).toBe(false);
  });

  it('walk along the road and never leave it', () => {
    const grid = makeGrid();
    const cow = roadCow(grid);
    const rng = createRng(7);
    for (let i = 0; i < 4000; i++) {
      stepCow(cow, 0.1, grid, SIZE, rng);
      expect(cow.tileY).toBe(4);
      expect(cow.tileX).toBeGreaterThanOrEqual(0);
      expect(cow.tileX).toBeLessThan(SIZE);
    }
  });

  it('sometimes stand still for 5 to 20 seconds, then move on', () => {
    const grid = makeGrid();
    const cow = roadCow(grid);
    const rng = createRng(3);
    let pauses = 0;
    let wasStanding = false;
    for (let i = 0; i < 50000; i++) {
      stepCow(cow, 0.1, grid, SIZE, rng);
      const standing = isCowStanding(cow);
      if (standing && !wasStanding) {
        pauses++;
        expect(cow.pauseSeconds).toBeGreaterThanOrEqual(COW_CONFIG.pauseMinSeconds - 0.1);
        expect(cow.pauseSeconds).toBeLessThanOrEqual(COW_CONFIG.pauseMaxSeconds);
        expect(cow.progress).toBe(0.5);
      }
      wasStanding = standing;
    }
    expect(pauses).toBeGreaterThan(0);
    // The last pause ends: the cow is never stuck forever
    for (let i = 0; i < 250; i++) stepCow(cow, 0.1, grid, SIZE, rng);
    expect(cow.pauseSeconds).toBeLessThanOrEqual(COW_CONFIG.pauseMaxSeconds);
  });

  it('slow vehicles on a standing cow’s tile to 30%, never to a stop', () => {
    const grid = makeGrid();
    const cow = roadCow(grid);
    expect(getStandingCowTiles([cow], SIZE).size).toBe(0);
    cow.pauseSeconds = 10;
    const tiles = getStandingCowTiles([cow], SIZE);
    const key = 4 * SIZE + 5;
    expect(getCowSlowdown(tiles, key)).toBe(0.3);
    expect(getCowSlowdown(tiles, key + 1)).toBe(1);
    expect(COW_CONFIG.vehicleSlowdown).toBeGreaterThan(0);
  });
});
