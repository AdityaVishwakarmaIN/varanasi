/**
 * River zones (S2-T4): "which bank is this tile on?" and "how far is it from the Ganga?".
 *
 * Pure and computed from `VARANASI_MAP` + map size, never saved. Precomputed once per size into typed arrays.
 * On any map that is not Varanasi, zones are 'none' and the distance is Infinity.
 */
import { VARANASI_MAP, type MapId } from './varanasi';
import { getVaranasiLayout, LAYOUT_SIDE, LAYOUT_WATER } from './varanasiLayout';

export type RiverZone = 'river' | 'westRiverfront' | 'westBank' | 'eastFloodplain' | 'eastBank' | 'none';

const ZONE_CODES: readonly RiverZone[] = ['none', 'river', 'westRiverfront', 'westBank', 'eastFloodplain', 'eastBank'];
const ZONE_INDEX: Record<RiverZone, number> = {
  none: 0,
  river: 1,
  westRiverfront: 2,
  westBank: 3,
  eastFloodplain: 4,
  eastBank: 5,
};

interface RiverZoneCache {
  zone: Uint8Array;
  distance: Uint16Array;
}

const cache = new Map<number, RiverZoneCache>();

/** Returns the precomputed zone and distance arrays (index = y * gridSize + x) for a Varanasi map of this size. */
export function getRiverZoneArrays(gridSize: number): RiverZoneCache {
  const cached = cache.get(gridSize);
  if (cached) return cached;
  const layout = getVaranasiLayout(gridSize);
  const n = gridSize * gridSize;
  const zone = new Uint8Array(n);
  const floodplainWidth = Math.max(1, Math.round(VARANASI_MAP.eastFloodplainFraction * gridSize));
  for (let idx = 0; idx < n; idx++) {
    if (layout.water[idx] !== LAYOUT_WATER.none) {
      zone[idx] = ZONE_INDEX.river;
      continue;
    }
    const dist = layout.distance[idx];
    if (layout.side[idx] === LAYOUT_SIDE.west) {
      zone[idx] = dist === 1 ? ZONE_INDEX.westRiverfront : ZONE_INDEX.westBank;
    } else {
      zone[idx] = dist <= floodplainWidth ? ZONE_INDEX.eastFloodplain : ZONE_INDEX.eastBank;
    }
  }
  const result = { zone, distance: layout.distance };
  cache.set(gridSize, result);
  return result;
}

function isVaranasi(mapId: MapId | undefined): boolean {
  return mapId === 'varanasi';
}

export function getRiverZone(x: number, y: number, gridSize: number, mapId: MapId | undefined): RiverZone {
  if (!isVaranasi(mapId) || x < 0 || y < 0 || x >= gridSize || y >= gridSize) return 'none';
  return ZONE_CODES[getRiverZoneArrays(gridSize).zone[y * gridSize + x]];
}

/** 4-neighbour steps to the nearest Ganga water tile (0 on the river). Infinity on non-Varanasi maps. */
export function getDistanceToGanga(x: number, y: number, gridSize: number, mapId: MapId | undefined): number {
  if (!isVaranasi(mapId) || x < 0 || y < 0 || x >= gridSize || y >= gridSize) return Infinity;
  return getRiverZoneArrays(gridSize).distance[y * gridSize + x];
}

/** Every tile index (y * gridSize + x) within `radius` tiles of the Ganga, excluding river tiles. Cached per (size, radius). */
const catchmentCache = new Map<string, Int32Array>();
export function getGangaCatchment(gridSize: number, radius: number): Int32Array {
  const key = `${gridSize}:${radius}`;
  const cached = catchmentCache.get(key);
  if (cached) return cached;
  const { zone, distance } = getRiverZoneArrays(gridSize);
  const list: number[] = [];
  for (let idx = 0; idx < zone.length; idx++) {
    if (zone[idx] !== ZONE_INDEX.river && distance[idx] <= radius) list.push(idx);
  }
  const result = Int32Array.from(list);
  catchmentCache.set(key, result);
  return result;
}
