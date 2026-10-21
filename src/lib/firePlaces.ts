/**
 * Player-facing place names for fire notices: "Small House in Chowk" instead of "(34, 13)".
 * Pure helpers (Ember, arena round 2).
 */
import type { Tile } from '@/types/game';
import { VARANASI_MOHALLAS } from '@/lib/citizenVoices';
import { getBuildingDisplayName } from '@/games/isocity/maps/varanasiCatalog';

/** Nearest Varanasi neighbourhood to a tile (map fractions, same convention as VARANASI_MOHALLAS). */
export function getNeighbourhoodName(x: number, y: number, gridSize: number): string {
  const u = (x + 0.5) / Math.max(1, gridSize);
  const v = (y + 0.5) / Math.max(1, gridSize);
  let best = VARANASI_MOHALLAS[0];
  let bestD = Infinity;
  for (const m of VARANASI_MOHALLAS) {
    const d = (m.u - u) ** 2 + (m.v - v) ** 2;
    if (d < bestD) {
      bestD = d;
      best = m;
    }
  }
  return best.name;
}

function titleCase(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** "<building> in <neighbourhood>" for a tile, using the building as it stood (pass the type that burned). */
export function describeFirePlace(
  grid: Tile[][],
  gridSize: number,
  x: number,
  y: number,
  mapId: string | undefined,
  buildingType?: string
): string {
  const type = buildingType ?? grid[y]?.[x]?.building.type ?? 'building';
  const name = getBuildingDisplayName(type, mapId as never) ?? titleCase(type);
  return `${name} in ${getNeighbourhoodName(x, y, gridSize)}`;
}
