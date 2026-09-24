import { describe, expect, it } from 'vitest';
import { createRng } from '@/lib/rng';
import type { BuildingType } from '@/games/isocity/types/buildings';
import type { Tile } from '@/games/isocity/types/game';
import { generateVaranasiTerrain } from '@/games/isocity/maps/generateVaranasi';
import { getDistanceToGanga, getGangaCatchment, getRiverZone } from '@/games/isocity/maps/riverZones';

const makeTile = (x: number, y: number, type: BuildingType = 'grass') =>
  ({ x, y, zone: 'none', building: { type }, landValue: 50, pollution: 0 }) as unknown as Tile;

function gangaComponent(grid: Tile[][], size: number, tiles: { x: number; y: number }[]) {
  const inGanga = new Set(tiles.map((t) => t.y * size + t.x));
  const start = tiles[0];
  const seen = new Set<number>([start.y * size + start.x]);
  const stack = [start];
  while (stack.length) {
    const { x, y } = stack.pop()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      const idx = ny * size + nx;
      if (nx < 0 || ny < 0 || nx >= size || ny >= size || seen.has(idx) || !inGanga.has(idx)) continue;
      if (grid[ny][nx].building.type !== 'water') continue;
      seen.add(idx);
      stack.push({ x: nx, y: ny });
    }
  }
  return seen;
}

describe.each([60, 120, 160])('Varanasi map at size %i', (size) => {
  const { grid, waterBodies } = generateVaranasiTerrain(size, createRng(7), makeTile);
  const ganga = waterBodies.find((b) => b.name === 'Ganga')!;

  it('has the Ganga, Assi and Varuna', () => {
    expect(waterBodies.map((b) => b.name).sort()).toEqual(['Assi', 'Ganga', 'Varuna']);
    expect(waterBodies.every((b) => b.type === 'river')).toBe(true);
  });

  it('the Ganga is one connected body touching the south and east edges', () => {
    const component = gangaComponent(grid, size, ganga.tiles);
    expect(component.size).toBe(ganga.tiles.length);
    expect(ganga.tiles.some((t) => t.y === size - 1)).toBe(true);
    expect(ganga.tiles.some((t) => t.x === size - 1)).toBe(true);
  });

  it('water covers 5–12% of tiles', () => {
    let water = 0;
    for (const row of grid) for (const t of row) if (t.building.type === 'water') water++;
    const share = water / (size * size);
    expect(share).toBeGreaterThanOrEqual(0.05);
    expect(share).toBeLessThanOrEqual(0.12);
  });

  it('is identical for the same seed', () => {
    const again = generateVaranasiTerrain(size, createRng(7), makeTile).grid;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        expect(again[y][x].building.type).toBe(grid[y][x].building.type);
      }
    }
  });

  it('river zones match the terrain', () => {
    const mid = Math.floor(size * 0.6);
    const row = grid[mid];
    const firstWater = row.findIndex((t) => t.building.type === 'water');
    expect(firstWater).toBeGreaterThan(0);
    expect(getRiverZone(firstWater, mid, size, 'varanasi')).toBe('river');
    expect(getRiverZone(firstWater - 1, mid, size, 'varanasi')).toBe('westRiverfront');
    expect(getRiverZone(firstWater - 5, mid, size, 'varanasi')).toBe('westBank');
    expect(getDistanceToGanga(firstWater - 1, mid, size, 'varanasi')).toBe(1);
    let lastWater = firstWater;
    while (lastWater + 1 < size && row[lastWater + 1].building.type === 'water') lastWater++;
    expect(getRiverZone(lastWater + 1, mid, size, 'varanasi')).toBe('eastFloodplain');
    expect(getRiverZone(0, 0, size, 'random')).toBe('none');
    expect(getDistanceToGanga(0, 0, size, undefined)).toBe(Infinity);
    expect(getGangaCatchment(size, 8).length).toBeGreaterThan(0);
  });
});
