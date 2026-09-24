import { describe, expect, it } from 'vitest';
import type { Tile } from '@/types/game';
import { getVaranasiLayout, LAYOUT_WATER } from '@/games/isocity/maps/varanasiLayout';
import { getRiverZoneArrays } from '@/games/isocity/maps/riverZones';
import {
  buildGhatNavMask,
  computeBankDistance,
  findRiverRoute,
  getDestinationCandidates,
  getDockRoute,
  getGhatBoatNetwork,
  getMaxGhatBoats,
  groupGhatDocks,
  routeToPolyline,
  screenToTile,
  tileCentreScreen,
  GHAT_BOAT_CONFIG,
} from '../ghatBoats';

const ZONE_WEST_RIVERFRONT = 2;

/** A minimal Varanasi-shaped grid: layout water (Ganga + tributaries) is water, the rest grass. */
function makeGrid(size: number, ghats: number[] = []): Tile[][] {
  const { water } = getVaranasiLayout(size);
  const ghatSet = new Set(ghats);
  const grid: Tile[][] = [];
  for (let y = 0; y < size; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < size; x++) {
      const idx = y * size + x;
      const type = ghatSet.has(idx) ? 'ghat' : water[idx] !== LAYOUT_WATER.none ? 'water' : 'grass';
      row.push({ x, y, zone: 'none', building: { type } } as unknown as Tile);
    }
    grid.push(row);
  }
  return grid;
}

/** West-riverfront tiles in north-to-south order. */
function riverfront(size: number): number[] {
  const { zone } = getRiverZoneArrays(size);
  const out: number[] = [];
  for (let i = 0; i < zone.length; i++) if (zone[i] === ZONE_WEST_RIVERFRONT) out.push(i);
  return out;
}

describe('groupGhatDocks', () => {
  it('groups 8-connected ghats into one dock and keeps separate rows apart', () => {
    const size = 20;
    const nav = new Uint8Array(size * size);
    // A water column at x = 10
    for (let y = 0; y < size; y++) nav[y * size + 10] = 1;
    const idx = (x: number, y: number) => y * size + x;
    // Row A: three ghats (diagonal link included); row B: two ghats far away; C: a ghat with no water next to it
    const ghats = [idx(9, 2), idx(9, 3), idx(8, 4), idx(9, 12), idx(9, 13), idx(3, 3)];
    const docks = groupGhatDocks(ghats, nav, size);
    expect(docks).toHaveLength(2);
    const sizes = docks.map((d) => d.ghats.length).sort();
    expect(sizes).toEqual([2, 3]);
    for (const d of docks) {
      expect(nav[d.waterIdx]).toBe(1);
      // mooring tile is 4-adjacent to one of the dock's ghats
      const wx = d.waterIdx % size;
      const wy = Math.floor(d.waterIdx / size);
      expect(d.ghats.some((g) => Math.abs((g % size) - wx) + Math.abs(Math.floor(g / size) - wy) === 1)).toBe(true);
    }
  });

  it('picks destinations at least the minimum distance away', () => {
    const docks = [
      { ghats: [0], x: 0, y: 0, waterIdx: 1 },
      { ghats: [5], x: 5, y: 0, waterIdx: 6 },
      { ghats: [9], x: 9, y: 0, waterIdx: 10 },
    ];
    expect(getDestinationCandidates(docks, 0, 8)).toEqual([2]);
    expect(getDestinationCandidates(docks, 1, 8)).toEqual([]);
  });

  it('allows one boat per three ghats, capped', () => {
    expect(getMaxGhatBoats(2, 10)).toBe(0);
    expect(getMaxGhatBoats(6, 10)).toBe(2);
    expect(getMaxGhatBoats(100, 10)).toBe(10);
    expect(getMaxGhatBoats(100, 0)).toBe(0);
    expect(GHAT_BOAT_CONFIG.ghatsPerBoat).toBe(3);
  });
});

describe('ghat boat routes on the Varanasi map', () => {
  for (const size of [60, 120]) {
    it(`every route tile and polyline point is Ganga water (size ${size})`, () => {
      const front = riverfront(size);
      // Rows of 3 ghats spread along the west bank
      const ghats: number[] = [];
      for (let k = 0; k < 6; k++) {
        const start = Math.floor((k * front.length) / 6);
        ghats.push(...front.slice(start, start + 3));
      }
      const grid = makeGrid(size, ghats);
      const { water } = getVaranasiLayout(size);
      const network = getGhatBoatNetwork(grid, size, 'varanasi', 1, 1000 + size)!;
      expect(network).not.toBeNull();
      expect(network.docks.length).toBeGreaterThanOrEqual(3);
      let routes = 0;
      for (let a = 0; a < network.docks.length; a++) {
        for (const b of getDestinationCandidates(network.docks, a, GHAT_BOAT_CONFIG.minRouteDistance)) {
          const route = getDockRoute(network, a, b);
          expect(route).not.toBeNull();
          routes++;
          const tiles = route!.tiles;
          expect(tiles[0]).toBe(network.docks[a].waterIdx);
          expect(tiles[tiles.length - 1]).toBe(network.docks[b].waterIdx);
          for (let i = 0; i < tiles.length; i++) {
            expect(water[tiles[i]]).toBe(LAYOUT_WATER.ganga);
            expect(grid[Math.floor(tiles[i] / size)][tiles[i] % size].building.type).toBe('water');
            if (i > 0) {
              const d = Math.abs((tiles[i] % size) - (tiles[i - 1] % size)) +
                Math.abs(Math.floor(tiles[i] / size) - Math.floor(tiles[i - 1] / size));
              expect(d).toBe(1);
            }
          }
          const tileSet = new Set(tiles);
          const poly = route!.poly;
          for (let i = 0; i < poly.length; i += 2) {
            const t = screenToTile(poly[i], poly[i + 1]);
            expect(tileSet.has(t.y * size + t.x)).toBe(true);
          }
        }
      }
      expect(routes).toBeGreaterThan(0);
    });
  }

  it('does not route over land or through the tributaries', () => {
    const size = 60;
    const grid = makeGrid(size);
    const layout = getVaranasiLayout(size);
    const nav = buildGhatNavMask(grid, size, layout.water);
    for (let i = 0; i < nav.length; i++) {
      if (nav[i]) expect(layout.water[i]).toBe(LAYOUT_WATER.ganga);
    }
    // A land tile is never a valid endpoint
    const land = layout.water.findIndex((w) => w === LAYOUT_WATER.none);
    const someWater = nav.findIndex((v) => v === 1);
    expect(findRiverRoute(nav, computeBankDistance(nav, size), size, land, someWater)).toBeNull();
  });

  it('keeps the smoothed polyline inside the route tiles on an L-shaped route', () => {
    const size = 10;
    const route = Int32Array.from([0 * size + 1, 0 * size + 2, 1 * size + 2, 2 * size + 2]);
    const poly = routeToPolyline(route, size);
    const set = new Set(route);
    for (let i = 0; i < poly.length; i += 2) {
      const t = screenToTile(poly[i], poly[i + 1]);
      expect(set.has(t.y * size + t.x)).toBe(true);
    }
    const c = tileCentreScreen(2, 1);
    expect(screenToTile(c.sx, c.sy)).toEqual({ x: 2, y: 1 });
  });

  it('returns no network on the random map', () => {
    expect(getGhatBoatNetwork(makeGrid(20), 20, 'random', 0, 0)).toBeNull();
  });
});
