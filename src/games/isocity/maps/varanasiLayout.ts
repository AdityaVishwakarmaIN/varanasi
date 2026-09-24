/**
 * Pure geometry for the Varanasi map (S2-T2 / S2-T4).
 *
 * `getVaranasiLayout(size)` turns `VARANASI_MAP` into per-tile typed arrays:
 *  - which tiles are Ganga / tributary water,
 *  - which side of the Ganga each tile is on,
 *  - the distance (in tiles) from each tile to the nearest Ganga water tile.
 *
 * The river shape depends ONLY on the map data and the map size (never on the game's random seed),
 * so anything derived from it can be recomputed instead of saved ("single source of truth").
 * Results are cached per size.
 */
import { VARANASI_MAP, VARANASI_GEN_CONFIG } from './varanasi';

export const LAYOUT_WATER = { none: 0, ganga: 1, tributary: 2 } as const;
export const LAYOUT_SIDE = { west: 0, east: 1 } as const;

export interface VaranasiLayout {
  size: number;
  /** Per tile (index y * size + x): 0 land, 1 Ganga, 2 tributary. */
  water: Uint8Array;
  /** Per tile: 0 = west (city) bank, 1 = east bank. Relative to the nearest Ganga centreline point. */
  side: Uint8Array;
  /** Per tile: 4-neighbour steps to the nearest Ganga water tile (0 on the river). Capped at 65535. */
  distance: Uint16Array;
  /** Water tile lists, for WaterBody entries. */
  gangaTiles: { x: number; y: number }[];
  tributaryTiles: { name: string; tiles: { x: number; y: number }[] }[];
}

type Pt = { x: number; y: number };

/** Catmull-Rom spline through the points, sampled `count` times in total. Endpoints are duplicated. */
export function sampleCatmullRom(points: readonly Pt[], count: number): Pt[] {
  if (points.length < 2) return points.map((p) => ({ ...p }));
  const pts = [points[0], ...points, points[points.length - 1]];
  const segments = points.length - 1;
  const out: Pt[] = [];
  for (let i = 0; i < count; i++) {
    const t = (i / (count - 1)) * segments;
    const seg = Math.min(segments - 1, Math.floor(t));
    const f = t - seg;
    const p0 = pts[seg];
    const p1 = pts[seg + 1];
    const p2 = pts[seg + 2];
    const p3 = pts[seg + 3];
    const f2 = f * f;
    const f3 = f2 * f;
    const blend = (a: number, b: number, c: number, d: number) =>
      0.5 * (2 * b + (-a + c) * f + (2 * a - 5 * b + 4 * c - d) * f2 + (-a + 3 * b - 3 * c + d) * f3);
    out.push({ x: blend(p0.x, p1.x, p2.x, p3.x), y: blend(p0.y, p1.y, p2.y, p3.y) });
  }
  return out;
}

/** Smooth, deterministic bank wobble in [-1, 1] along the river (fixed phases: same river every game). */
function wobble(t: number): number {
  return 0.6 * Math.sin(t * 17.3 + 1.1) + 0.4 * Math.sin(t * 41.9 + 2.7);
}

const cache = new Map<number, VaranasiLayout>();

export function getVaranasiLayout(size: number): VaranasiLayout {
  const cached = cache.get(size);
  if (cached) return cached;
  const layout = buildLayout(size);
  cache.set(size, layout);
  return layout;
}

function buildLayout(size: number): VaranasiLayout {
  const n = size * size;
  const water = new Uint8Array(n);
  const nearestSample = new Int32Array(n).fill(-1);
  const nearestDist = new Float32Array(n).fill(Infinity);
  const toTile = (p: { u: number; v: number }): Pt => ({ x: p.u * (size - 1), y: p.v * (size - 1) });
  const inBounds = (x: number, y: number) => x >= 0 && y >= 0 && x < size && y < size;

  // --- Ganga ---
  const gangaCount = Math.max(16, size * VARANASI_GEN_CONFIG.samplesPerTile);
  const ganga = sampleCatmullRom(VARANASI_MAP.ganga.points.map(toTile), gangaCount);
  const baseHalf = Math.max(VARANASI_GEN_CONFIG.minHalfWidth, (VARANASI_MAP.ganga.widthFraction * size) / 2);
  for (let i = 0; i < ganga.length; i++) {
    const s = ganga[i];
    const hw = baseHalf * (1 + VARANASI_GEN_CONFIG.bankWobble * wobble(i / ganga.length));
    const r = Math.ceil(hw) + 1;
    for (let y = Math.floor(s.y) - r; y <= Math.ceil(s.y) + r; y++) {
      for (let x = Math.floor(s.x) - r; x <= Math.ceil(s.x) + r; x++) {
        if (!inBounds(x, y)) continue;
        const d = Math.hypot(x - s.x, y - s.y);
        const idx = y * size + x;
        if (d <= hw) water[idx] = LAYOUT_WATER.ganga;
        if (d < nearestDist[idx]) {
          nearestDist[idx] = d;
          nearestSample[idx] = i;
        }
      }
    }
  }

  // --- Tributaries ---
  for (const trib of VARANASI_MAP.tributaries) {
    const pts = trib.points.map(toTile);
    const samples = sampleCatmullRom(pts, Math.max(16, size * VARANASI_GEN_CONFIG.samplesPerTile));
    const hw = trib.widthTiles / 2 + VARANASI_GEN_CONFIG.tributaryHalfWidthPad;
    const r = Math.ceil(hw) + 1;
    for (const s of samples) {
      for (let y = Math.floor(s.y) - r; y <= Math.ceil(s.y) + r; y++) {
        for (let x = Math.floor(s.x) - r; x <= Math.ceil(s.x) + r; x++) {
          if (!inBounds(x, y)) continue;
          const idx = y * size + x;
          if (water[idx] === LAYOUT_WATER.none && Math.hypot(x - s.x, y - s.y) <= hw) {
            water[idx] = LAYOUT_WATER.tributary;
          }
        }
      }
    }
  }

  // --- Clean-up: remove isolated specks, fill single-tile holes ---
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = y * size + x;
      let waterNeighbours = 0;
      let neighbours = 0;
      let gangaNeighbours = 0;
      for (const [dx, dy] of NEIGHBOURS) {
        const nx = x + dx;
        const ny = y + dy;
        if (!inBounds(nx, ny)) continue;
        neighbours++;
        const w = water[ny * size + nx];
        if (w !== LAYOUT_WATER.none) waterNeighbours++;
        if (w === LAYOUT_WATER.ganga) gangaNeighbours++;
      }
      if (water[idx] !== LAYOUT_WATER.none && waterNeighbours === 0) {
        water[idx] = LAYOUT_WATER.none;
      } else if (water[idx] === LAYOUT_WATER.none && neighbours > 0 && waterNeighbours === neighbours) {
        water[idx] = gangaNeighbours > 0 ? LAYOUT_WATER.ganga : LAYOUT_WATER.tributary;
      }
    }
  }

  // --- Distance to Ganga + nearest centreline sample (multi-source BFS from Ganga water) ---
  const distance = new Uint16Array(n).fill(65535);
  const queue = new Int32Array(n);
  let head = 0;
  let tail = 0;
  for (let idx = 0; idx < n; idx++) {
    if (water[idx] === LAYOUT_WATER.ganga) {
      distance[idx] = 0;
      queue[tail++] = idx;
    }
  }
  while (head < tail) {
    const idx = queue[head++];
    const x = idx % size;
    const y = (idx / size) | 0;
    for (const [dx, dy] of NEIGHBOURS) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(nx, ny)) continue;
      const nIdx = ny * size + nx;
      if (distance[nIdx] !== 65535) continue;
      distance[nIdx] = distance[idx] + 1;
      if (nearestSample[nIdx] === -1) nearestSample[nIdx] = nearestSample[idx];
      queue[tail++] = nIdx;
    }
  }

  // --- Side of the river: sign of the cross product with the centreline tangent (flow runs south → north) ---
  const side = new Uint8Array(n);
  for (let idx = 0; idx < n; idx++) {
    const i = nearestSample[idx];
    if (i < 0) continue;
    const a = ganga[Math.max(0, i - 1)];
    const b = ganga[Math.min(ganga.length - 1, i + 1)];
    const tx = b.x - a.x;
    const ty = b.y - a.y;
    const dx = (idx % size) - ganga[i].x;
    const dy = ((idx / size) | 0) - ganga[i].y;
    // Negative cross = left of the flow direction = west / city bank.
    side[idx] = tx * dy - ty * dx < 0 ? LAYOUT_SIDE.west : LAYOUT_SIDE.east;
  }

  // --- Tile lists for water bodies ---
  const gangaTiles: Pt[] = [];
  for (let idx = 0; idx < n; idx++) {
    if (water[idx] === LAYOUT_WATER.ganga) gangaTiles.push({ x: idx % size, y: (idx / size) | 0 });
  }
  const tributaryTiles = VARANASI_MAP.tributaries.map((trib) => {
    const pts = trib.points.map(toTile);
    const samples = sampleCatmullRom(pts, Math.max(16, size * VARANASI_GEN_CONFIG.samplesPerTile));
    const hw = trib.widthTiles / 2 + VARANASI_GEN_CONFIG.tributaryHalfWidthPad + 0.5;
    const tiles: Pt[] = [];
    const seen = new Set<number>();
    for (const s of samples) {
      const r = Math.ceil(hw);
      for (let y = Math.floor(s.y) - r; y <= Math.ceil(s.y) + r; y++) {
        for (let x = Math.floor(s.x) - r; x <= Math.ceil(s.x) + r; x++) {
          if (!inBounds(x, y)) continue;
          const idx = y * size + x;
          if (seen.has(idx) || water[idx] !== LAYOUT_WATER.tributary) continue;
          if (Math.hypot(x - s.x, y - s.y) <= hw) {
            seen.add(idx);
            tiles.push({ x, y });
          }
        }
      }
    }
    return { name: trib.name, tiles };
  });

  return { size, water, side, distance, gangaTiles, tributaryTiles };
}

const NEIGHBOURS: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
