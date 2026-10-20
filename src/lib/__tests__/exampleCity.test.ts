import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EXAMPLE_START_GANGA_HEALTH, EXAMPLE_TYPE_MAP, localizeExampleState, varanasiExampleState } from '@/lib/exampleCity';
import { getBuildingSize, simulateTick } from '@/lib/simulation';
import { getVaranasiLayout, LAYOUT_WATER } from '@/games/isocity/maps/varanasiLayout';
import { getRiverZone } from '@/games/isocity/maps/riverZones';
import { isToolVisible } from '@/games/isocity/maps/varanasiCatalog';
import type { GameState } from '@/types/game';

const loadExample = () => JSON.parse(readFileSync(join(process.cwd(), 'public/example-states/example_state_9.json'), 'utf8')) as GameState;

describe('EXAMPLE_TYPE_MAP', () => {
  it('maps only Varanasi-hidden types, to visible types of the same footprint', () => {
    for (const [from, to] of Object.entries(EXAMPLE_TYPE_MAP)) {
      expect(isToolVisible(from as never, 'varanasi')).toBe(false);
      expect(isToolVisible(to as never, 'varanasi')).toBe(true);
      expect(getBuildingSize(to!)).toEqual(getBuildingSize(from as never));
    }
  });
});

describe('localizeExampleState', () => {
  it('puts the example city on the Varanasi map with a real Ganga', () => {
    const raw = loadExample();
    expect(raw.mapId).toBeUndefined();
    const s = localizeExampleState(raw);
    expect(s.mapId).toBe('varanasi');
    expect(s.cityName).toBe('Kashi Nagar');

    // The Ganga is cut into the grid exactly where the map data says it is.
    const layout = getVaranasiLayout(s.gridSize);
    for (let y = 0; y < s.gridSize; y++) {
      for (let x = 0; x < s.gridSize; x++) {
        const isRiver = layout.water[y * s.gridSize + x] !== LAYOUT_WATER.none;
        if (isRiver) expect(s.grid[y][x].building.type).toBe('water');
        if (isRiver) expect(getRiverZone(x, y, s.gridSize, s.mapId)).toBe('river');
      }
    }
    const ganga = s.waterBodies.find((w) => w.id === 'river-ganga');
    expect(ganga?.name).toBe('Ganga');
    expect(ganga?.type).toBe('river');
    expect(ganga!.tiles.length).toBeGreaterThan(50);
    // Every water body tile is water; no sea is left, the lakes keep Indian names.
    for (const w of s.waterBodies) {
      for (const t of w.tiles) expect(s.grid[t.y][t.x].building.type).toBe('water');
      if (w.type !== 'river') expect(w.type).toBe('lake');
    }
    expect(s.waterBodies.some((w) => w.type === 'lake')).toBe(true);
    const waterTiles = s.grid.flat().filter((t) => t.building.type === 'water').length;
    expect(waterTiles).toBe(s.waterBodies.reduce((n, w) => n + w.tiles.length, 0));
    expect(s.stats.gangaHealth).toBe(EXAMPLE_START_GANGA_HEALTH);
    expect(s.stats.gangaHealthTarget).toBeGreaterThanOrEqual(0);
    expect(s.stats.gangaHealthTarget).toBeLessThanOrEqual(100);
  });

  it('swaps the American-only types and leaves no half buildings behind', () => {
    const raw = loadExample();
    const before = raw.grid.flat().map((t) => t.building.type);
    expect(before).toContain('mountain_lodge');
    const s = localizeExampleState(raw);
    const types = s.grid.flat().map((t) => t.building.type);
    for (const from of Object.keys(EXAMPLE_TYPE_MAP)) expect(types).not.toContain(from);
    expect(types).toContain('greenhouse_garden');
    expect(types).toContain('park_large');

    // Every multi-tile building still has its whole footprint of 'empty' tiles inside the map and off the river.
    const size = s.gridSize;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const type = s.grid[y][x].building.type;
        if (type === 'empty') continue;
        const w = getBuildingSize(type).width;
        for (let dy = 0; dy < w; dy++) {
          for (let dx = 0; dx < w; dx++) {
            if (dx === 0 && dy === 0) continue;
            expect(s.grid[y + dy]?.[x + dx]?.building.type).toBe('empty');
          }
        }
      }
    }
  });

  it('does not change the input, and leaves a save that has a mapId alone', () => {
    const raw = loadExample();
    const snapshot = JSON.stringify(raw);
    localizeExampleState(raw);
    expect(JSON.stringify(raw)).toBe(snapshot);

    const random = { ...raw, mapId: 'random' as const };
    const out = varanasiExampleState(random);
    expect(out).toBe(random);
    expect(localizeExampleState(random).waterBodies.some((w) => w.type === 'ocean')).toBe(true);
  });

  it('survives a few ticks with the Ganga systems running', () => {
    let s = localizeExampleState(loadExample());
    for (let i = 0; i < 70; i++) s = simulateTick(s, 'clear', () => 0.5);
    expect(s.mapId).toBe('varanasi');
    expect(Number.isFinite(s.stats.gangaHealth)).toBe(true);
    expect(Number.isFinite(s.stats.gangaHealthTarget)).toBe(true);
    expect(Number.isFinite(s.stats.tourismIncome)).toBe(true);
    expect(s.grid.length).toBe(s.gridSize);
  });

  it('returns a state with no usable grid untouched', () => {
    const s = localizeExampleState({ cityName: 'x', waterBodies: [] });
    expect(s.cityName).toBe('Kashi Nagar');
    expect((s as { mapId?: unknown }).mapId).toBeUndefined();
  });
});
