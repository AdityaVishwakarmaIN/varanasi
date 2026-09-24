/**
 * S2-T4 step 4: the sandy east floodplain of the Varanasi map.
 *
 * Empty grass (and the ground under trees) in the `eastFloodplain` river zone is drawn with a warm sand base
 * instead of green. The colour of every tile is precomputed ONCE per map size from the river-zone typed arrays,
 * so the renderer only does one typed-array read per tile (no per-frame allocations, no string building).
 *
 * Per-tile variety comes from a coordinate hash picking one of a few close sand shades. The outer edge of the
 * floodplain (and one tile of the neighbouring east-bank grass) uses sand/grass mixes so the sand fades into
 * the grass instead of stopping at a hard line.
 */
import { VARANASI_MAP, type MapId } from '@/games/isocity/maps/varanasi';
import { getRiverZoneArrays } from '@/games/isocity/maps/riverZones';
import { ZONE_COLORS, type TileColorScheme } from './drawing';

export const FLOODPLAIN_SAND_CONFIG = {
  /** Sand shades (top face). One is picked per tile by a coordinate hash. */
  sandShades: ['#d9c49a', '#d5bf94', '#dcc8a0', '#d3bc90'],
  /** Grid-line colour for pure sand tiles (only drawn when zoomed in). */
  sandStroke: '#bba77d',
  /**
   * Sand share per blend level (1 = pure sand). Level 0 is the floodplain interior; the next levels are the
   * last two floodplain tiles before the grass and the first east-bank grass tile.
   */
  blendLevels: [1, 0.82, 0.6, 0.3],
} as const;

/** River-zone codes (see `riverZones.ts`). */
const ZONE_EAST_FLOODPLAIN = 4;
const ZONE_EAST_BANK = 5;

export interface FloodplainSand {
  /** Per tile (y * gridSize + x): 0 = not sand, otherwise palette index + 1. */
  index: Uint8Array;
  /** Colour schemes, indexed by `index[i] - 1`. */
  palette: TileColorScheme[];
}

function hexToRgb(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function mixHex(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  let out = '#';
  for (let i = 0; i < 3; i++) {
    const c = Math.round(ca[i] * t + cb[i] * (1 - t));
    out += c.toString(16).padStart(2, '0');
  }
  return out;
}

/** Deterministic small hash of a tile coordinate (0..2^31). */
function tileHash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

function buildPalette(): TileColorScheme[] {
  const grass = ZONE_COLORS.none;
  const { sandShades, sandStroke, blendLevels } = FLOODPLAIN_SAND_CONFIG;
  const palette: TileColorScheme[] = [];
  for (const t of blendLevels) {
    for (const shade of sandShades) {
      palette.push({
        top: mixHex(shade, grass.top, t),
        left: mixHex(shade, grass.left, t),
        right: mixHex(shade, grass.right, t),
        stroke: mixHex(sandStroke, grass.stroke, t),
      });
    }
  }
  return palette;
}

/**
 * Pure: computes the sand index for every tile from the river-zone arrays.
 * `floodplainWidth` is the floodplain's width in tiles (distance to the Ganga at which it ends).
 */
export function computeFloodplainSand(
  zone: Uint8Array,
  distance: Uint16Array,
  floodplainWidth: number
): FloodplainSand {
  const palette = buildPalette();
  const shades = FLOODPLAIN_SAND_CONFIG.sandShades.length;
  const gridSize = Math.round(Math.sqrt(zone.length));
  const index = new Uint8Array(zone.length);
  for (let i = 0; i < zone.length; i++) {
    const z = zone[i];
    let level = -1;
    if (z === ZONE_EAST_FLOODPLAIN) {
      const fromEdge = floodplainWidth - distance[i];
      level = fromEdge >= 2 ? 0 : fromEdge === 1 ? 1 : 2;
    } else if (z === ZONE_EAST_BANK && distance[i] === floodplainWidth + 1) {
      level = 3;
    }
    if (level < 0) continue;
    const variant = tileHash(i % gridSize, (i / gridSize) | 0) % shades;
    index[i] = level * shades + variant + 1;
  }
  return { index, palette };
}

const cache = new Map<number, FloodplainSand>();

/** The floodplain sand lookup for this map, or null when the map has no floodplain (not Varanasi). Cached per size. */
export function getFloodplainSand(gridSize: number, mapId: MapId | undefined): FloodplainSand | null {
  if (mapId !== 'varanasi') return null;
  const cached = cache.get(gridSize);
  if (cached) return cached;
  const { zone, distance } = getRiverZoneArrays(gridSize);
  const floodplainWidth = Math.max(1, Math.round(VARANASI_MAP.eastFloodplainFraction * gridSize));
  const result = computeFloodplainSand(zone, distance, floodplainWidth);
  cache.set(gridSize, result);
  return result;
}
