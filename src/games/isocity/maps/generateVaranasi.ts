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
      row.push(createTile(x, y, rng() < density ? 'tree' : 'grass'));
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
