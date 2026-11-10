/**
 * Varanasi terrain generator (S2-T2).
 *
 * The river comes from `getVaranasiLayout` (fixed by the map data + size). The seed only decides the trees.
 */
import type { Rng } from '@/lib/rng';
import type { BuildingType } from '@/games/isocity/types/buildings';
import type { Tile, WaterBody } from '@/games/isocity/types/game';
import { VARANASI_MAP } from './varanasi';
import { getVaranasiLayout, LAYOUT_SIDE, LAYOUT_WATER } from './varanasiLayout';

export type TileFactory = (x: number, y: number, buildingType?: BuildingType) => Tile;

/** Land value given to river tiles, matching generated lakes/oceans. */
const RIVER_LAND_VALUE = 60;

/** Whether any of the 8 tiles around (x, y) is river water in the layout. */
function touchesWater(water: ArrayLike<number>, size: number, x: number, y: number): boolean {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if ((dx || dy) && nx >= 0 && ny >= 0 && nx < size && ny < size && water[ny * size + nx] !== LAYOUT_WATER.none) {
        return true;
      }
    }
  }
  return false;
}

export function generateVaranasiTerrain(
  size: number,
  rng: Rng,
  createTile: TileFactory
): { grid: Tile[][]; waterBodies: WaterBody[] } {
  const layout = getVaranasiLayout(size);
  const grid: Tile[][] = [];
  for (let y = 0; y < size; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < size; x++) {
      const idx = y * size + x;
      if (layout.water[idx] !== LAYOUT_WATER.none) {
        const tile = createTile(x, y, 'water');
        tile.landValue = RIVER_LAND_VALUE;
        row.push(tile);
        continue;
      }
      const density =
        layout.side[idx] === LAYOUT_SIDE.west ? VARANASI_MAP.treeDensity.westBank : VARANASI_MAP.treeDensity.eastBank;
      // The roll is always taken so the rest of the map keeps its trees. Tiles touching a river (8 neighbours)
      // stay open bank: a tree there overhangs the water around it and reads as standing in the river.
      const roll = rng();
      row.push(createTile(x, y, roll < density && !touchesWater(layout.water, size, x, y) ? 'tree' : 'grass'));
    }
    grid.push(row);
  }

  const center = (tiles: { x: number; y: number }[]) => {
    if (tiles.length === 0) return { centerX: 0, centerY: 0 };
    let sx = 0;
    let sy = 0;
    for (const t of tiles) {
      sx += t.x;
      sy += t.y;
    }
    return { centerX: Math.round(sx / tiles.length), centerY: Math.round(sy / tiles.length) };
  };

  const waterBodies: WaterBody[] = [
    { id: 'river-ganga', name: VARANASI_MAP.ganga.name, type: 'river', tiles: layout.gangaTiles, ...center(layout.gangaTiles) },
    ...layout.tributaryTiles
      .filter((t) => t.tiles.length > 0)
      .map((t) => ({
        id: `river-${t.name.toLowerCase()}`,
        name: t.name,
        type: 'river' as const,
        tiles: t.tiles,
        ...center(t.tiles),
      })),
  ];

  return { grid, waterBodies };
}
