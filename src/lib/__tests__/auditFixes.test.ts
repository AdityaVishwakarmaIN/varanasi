import { afterEach, describe, expect, it, vi } from 'vitest';
import { canRollThroughRed } from '@/components/game/junctionYield';
import { DIRECTION_META } from '@/components/game/constants';
import { simulateTick } from '@/lib/simulation';
import type { Car } from '@/components/game/types';
import { makeFireCity, quietSim, seedMath, BLOCK } from './arena-ember/harness';

afterEach(() => vi.restoreAllMocks());

describe('audit fixes', () => {
  it('a car held at red sees a cross-street car about to enter the junction', () => {
    const size = 20;
    const jx = 10, jy = 10;
    // 'east' moves y-1, so a car at (10,11) heading east enters (10,10) next; 'north' moves x-1
    expect(DIRECTION_META.east.step).toEqual({ x: 0, y: -1 });
    expect(DIRECTION_META.north.step).toEqual({ x: -1, y: 0 });
    const cross = { id: 2, direction: 'east', tileX: jx, tileY: jy + 1, progress: 0.9 } as unknown as Car;
    const map = new Map<number, Car[]>([[cross.tileY * size + cross.tileX, [cross]]]);
    expect(canRollThroughRed(map, size, jx, jy, 'north')).toBe(false);
    // A car queued behind on its own street does not block the roll-through
    const same = { id: 3, direction: 'north', tileX: jx + 1, tileY: jy, progress: 0.2 } as unknown as Car;
    expect(canRollThroughRed(new Map([[jy * size + jx + 1, [same]]]), size, jx, jy, 'north')).toBe(true);
  });

  it('a blaze reached by spread alone points its notification at a fire, not at tile (0,0)', () => {
    quietSim();
    let state = makeFireCity(3);
    state.disastersEnabled = true;
    state.speed = 1;
    // 7 burning tiles (threshold 8): one more spread makes it a blaze
    let n = 0;
    for (let y = BLOCK.y0 + 1; y <= BLOCK.y1 && n < 7; y++) {
      for (let x = BLOCK.x0 + 1; x <= BLOCK.x0 + 4 && n < 7; x++) {
        const b = state.grid[y][x].building;
        if (b.type === 'grass' || b.type === 'road') continue;
        b.onFire = true; b.fireProgress = 50; n++;
      }
    }
    const restore = seedMath(11);
    let blaze: { x?: number; y?: number } | undefined;
    try {
      for (let t = 0; t < 40 && !blaze; t++) {
        state = simulateTick(state);
        blaze = state.notifications.find((x) => x.id === 'fire-incident' && x.title === 'Blaze out of control');
      }
    } finally { restore(); }
    expect(blaze).toBeDefined();
    expect([blaze!.x, blaze!.y]).not.toEqual([0, 0]);
  });
});
