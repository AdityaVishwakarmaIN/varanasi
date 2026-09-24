/**
 * S2-T10: boats on the Ganga that travel between ghats.
 *
 * Pure helpers (no React, no canvas) plus a small per-map cache:
 *  - which tiles a ghat boat may use (Ganga water in the map layout that is still water, or bridged, in the grid),
 *  - adjacent ghats grouped into docks, each with the river tile boats moor at,
 *  - routes between docks that stay on those river tiles (Dijkstra that prefers the middle of the river),
 *  - routes turned into a smoothed screen-space polyline that never leaves the route's tiles.
 *
 * Everything that scans the grid is recomputed only when the map's structure changes, never per frame.
 */
import type { Tile } from '@/types/game';
import type { MapId } from '@/games/isocity/maps/varanasi';
import { getVaranasiLayout, LAYOUT_WATER } from '@/games/isocity/maps/varanasiLayout';
import { TILE_WIDTH, TILE_HEIGHT } from './types';

export const GHAT_BOAT_CONFIG = {
  /** One boat per this many ghats (rounded down). */
  ghatsPerBoat: 3,
  /** Hard caps on ghat boats (a future QUALITY_PRESETS system scales these; 0 turns ghat boats off). */
  maxBoats: 10,
  maxBoatsMobile: 4,
  /** A destination dock must be at least this far (straight line, tiles) from the origin dock. */
  minRouteDistance: 8,
  /** Route cost bonus for staying away from the banks: cost per tile = 1 + centreBias / (1 + tilesToBank). */
  centreBias: 2,
  /** Cruise speed range (screen px per second at 1× game speed). */
  speedMin: 14,
  speedRange: 8,
  /** Boats slow down within this many px of either end of the route. */
  easeDistance: 50,
  /** Slowest fraction of cruise speed while easing in or out. */
  easeMinFactor: 0.25,
  /** Seconds a boat waits at a ghat before its next trip (min + random range). */
  dockWaitMin: 4,
  dockWaitRange: 4,
  /** Seconds between spawns while under the cap (min + random range). */
  spawnIntervalMin: 1.5,
  spawnIntervalRange: 2,
  /** Dusk lamp glow (boats near the ghats light a lamp): visual hours [start, end). */
  duskLampStartHour: 18,
  duskLampEndHour: 21,
} as const;

/** A group of adjacent ghats that boats treat as one dock. */
export interface GhatDock {
  /** Tile indices (y * gridSize + x) of the ghats in the group. */
  ghats: number[];
  /** The ghat closest to the middle of the group. */
  x: number;
  y: number;
  /** River tile index where boats moor (a navigable tile next to one of the group's ghats). */
  waterIdx: number;
}

const N4: readonly (readonly [number, number])[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const N8: readonly (readonly [number, number])[] = [...N4, [1, 1], [1, -1], [-1, 1], [-1, -1]];

/** Tiles a ghat boat may use: Ganga water in the layout AND still water (or a bridge over it) in the grid. */
export function buildGhatNavMask(grid: Tile[][], gridSize: number, layoutWater: Uint8Array): Uint8Array {
  const nav = new Uint8Array(gridSize * gridSize);
  for (let y = 0; y < gridSize; y++) {
    const row = grid[y];
    for (let x = 0; x < gridSize; x++) {
      const idx = y * gridSize + x;
      if (layoutWater[idx] !== LAYOUT_WATER.ganga) continue;
      const type = row[x].building.type;
      if (type === 'water' || type === 'bridge') nav[idx] = 1;
    }
  }
  return nav;
}

/** 4-neighbour steps from each navigable tile to the nearest non-navigable tile (or map edge counts as open water). */
export function computeBankDistance(nav: Uint8Array, gridSize: number): Uint16Array {
  const n = gridSize * gridSize;
  const dist = new Uint16Array(n).fill(65535);
  const queue = new Int32Array(n);
  let head = 0;
  let tail = 0;
  for (let idx = 0; idx < n; idx++) {
    if (!nav[idx]) {
      dist[idx] = 0;
      queue[tail++] = idx;
    }
  }
  while (head < tail) {
    const idx = queue[head++];
    const x = idx % gridSize;
    const y = (idx / gridSize) | 0;
    for (const [dx, dy] of N4) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= gridSize || ny >= gridSize) continue;
      const nIdx = ny * gridSize + nx;
      if (dist[nIdx] !== 65535) continue;
      dist[nIdx] = dist[idx] + 1;
      queue[tail++] = nIdx;
    }
  }
  return dist;
}

/**
 * Groups 8-connected ghats into docks. A group with no navigable river tile next to any of its ghats is dropped.
 * `ghats` are tile indices (y * gridSize + x).
 */
export function groupGhatDocks(ghats: readonly number[], nav: Uint8Array, gridSize: number): GhatDock[] {
  const isGhat = new Set(ghats);
  const seen = new Set<number>();
  const docks: GhatDock[] = [];
  for (const start of ghats) {
    if (seen.has(start)) continue;
    const group: number[] = [];
    const stack = [start];
    seen.add(start);
    while (stack.length > 0) {
      const idx = stack.pop()!;
      group.push(idx);
      const x = idx % gridSize;
      const y = (idx / gridSize) | 0;
      for (const [dx, dy] of N8) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= gridSize || ny >= gridSize) continue;
        const nIdx = ny * gridSize + nx;
        if (isGhat.has(nIdx) && !seen.has(nIdx)) {
          seen.add(nIdx);
          stack.push(nIdx);
        }
      }
    }
    group.sort((a, b) => a - b);
    let mx = 0;
    let my = 0;
    for (const idx of group) {
      mx += idx % gridSize;
      my += (idx / gridSize) | 0;
    }
    mx /= group.length;
    my /= group.length;
    let best = group[0];
    let bestD = Infinity;
    let waterIdx = -1;
    let waterD = Infinity;
    for (const idx of group) {
      const x = idx % gridSize;
      const y = (idx / gridSize) | 0;
      const d = (x - mx) ** 2 + (y - my) ** 2;
      if (d < bestD) {
        bestD = d;
        best = idx;
      }
      for (const [dx, dy] of N4) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= gridSize || ny >= gridSize) continue;
        const nIdx = ny * gridSize + nx;
        if (!nav[nIdx]) continue;
        const wd = (nx - mx) ** 2 + (ny - my) ** 2;
        if (wd < waterD) {
          waterD = wd;
          waterIdx = nIdx;
        }
      }
    }
    if (waterIdx < 0) continue;
    docks.push({ ghats: group, x: best % gridSize, y: (best / gridSize) | 0, waterIdx });
  }
  return docks;
}

/** Docks at least `minDistance` tiles (straight line) from `docks[origin]`. */
export function getDestinationCandidates(docks: readonly GhatDock[], origin: number, minDistance: number): number[] {
  const o = docks[origin];
  const out: number[] = [];
  for (let i = 0; i < docks.length; i++) {
    if (i === origin) continue;
    if (Math.hypot(docks[i].x - o.x, docks[i].y - o.y) >= minDistance) out.push(i);
  }
  return out;
}

/**
 * Cheapest 4-neighbour route over navigable tiles from `from` to `to` (tile indices, both inclusive), or null.
 * Tiles near the bank cost more, so boats keep to the middle of the river.
 */
export function findRiverRoute(
  nav: Uint8Array,
  bankDist: Uint16Array,
  gridSize: number,
  from: number,
  to: number,
  centreBias: number = GHAT_BOAT_CONFIG.centreBias
): Int32Array | null {
  if (!nav[from] || !nav[to]) return null;
  const n = gridSize * gridSize;
  const cost = new Float64Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  // Binary min-heap of (cost, idx)
  const heapIdx: number[] = [];
  const heapCost: number[] = [];
  const push = (idx: number, c: number) => {
    let i = heapIdx.length;
    heapIdx.push(idx);
    heapCost.push(c);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heapCost[p] <= heapCost[i]) break;
      [heapIdx[p], heapIdx[i]] = [heapIdx[i], heapIdx[p]];
      [heapCost[p], heapCost[i]] = [heapCost[i], heapCost[p]];
      i = p;
    }
  };
  const pop = (): number => {
    const top = heapIdx[0];
    const lastIdx = heapIdx.pop()!;
    const lastCost = heapCost.pop()!;
    if (heapIdx.length > 0) {
      heapIdx[0] = lastIdx;
      heapCost[0] = lastCost;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < heapIdx.length && heapCost[l] < heapCost[m]) m = l;
        if (r < heapIdx.length && heapCost[r] < heapCost[m]) m = r;
        if (m === i) break;
        [heapIdx[m], heapIdx[i]] = [heapIdx[i], heapIdx[m]];
        [heapCost[m], heapCost[i]] = [heapCost[i], heapCost[m]];
        i = m;
      }
    }
    return top;
  };
  cost[from] = 0;
  push(from, 0);
  while (heapIdx.length > 0) {
    const c = heapCost[0];
    const idx = pop();
    if (c > cost[idx]) continue;
    if (idx === to) break;
    const x = idx % gridSize;
    const y = (idx / gridSize) | 0;
    for (const [dx, dy] of N4) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= gridSize || ny >= gridSize) continue;
      const nIdx = ny * gridSize + nx;
      if (!nav[nIdx]) continue;
      const nc = c + 1 + centreBias / (1 + bankDist[nIdx]);
      if (nc < cost[nIdx]) {
        cost[nIdx] = nc;
        prev[nIdx] = idx;
        push(nIdx, nc);
      }
    }
  }
  if (cost[to] === Infinity) return null;
  const path: number[] = [];
  for (let idx = to; idx !== -1; idx = prev[idx]) path.push(idx);
  path.reverse();
  return Int32Array.from(path);
}

/** Screen-space centre of a tile (same space the boats are drawn in). */
export function tileCentreScreen(x: number, y: number): { sx: number; sy: number } {
  return { sx: (x - y) * (TILE_WIDTH / 2) + TILE_WIDTH / 2, sy: (x + y) * (TILE_HEIGHT / 2) + TILE_HEIGHT / 2 };
}

/** Inverse of `tileCentreScreen` (nearest tile to a screen point). */
export function screenToTile(sx: number, sy: number): { x: number; y: number } {
  const a = (sx - TILE_WIDTH / 2) / (TILE_WIDTH / 2);
  const b = (sy - TILE_HEIGHT / 2) / (TILE_HEIGHT / 2);
  return { x: Math.round((a + b) / 2), y: Math.round((b - a) / 2) };
}

/**
 * Turns a tile route into a screen-space polyline (xy pairs) through the tile centres, with one pass of
 * Chaikin corner cutting. Cut points lie on segments between centres of 4-adjacent route tiles, so every point
 * (and every segment) stays inside the route's own tiles.
 */
export function routeToPolyline(route: Int32Array, gridSize: number): Float32Array {
  const m = route.length;
  const cx = new Float64Array(m);
  const cy = new Float64Array(m);
  for (let i = 0; i < m; i++) {
    const { sx, sy } = tileCentreScreen(route[i] % gridSize, (route[i] / gridSize) | 0);
    cx[i] = sx;
    cy[i] = sy;
  }
  if (m < 3) {
    const out = new Float32Array(m * 2);
    for (let i = 0; i < m; i++) {
      out[i * 2] = cx[i];
      out[i * 2 + 1] = cy[i];
    }
    return out;
  }
  const pts: number[] = [cx[0], cy[0]];
  for (let i = 0; i < m - 1; i++) {
    pts.push(0.75 * cx[i] + 0.25 * cx[i + 1], 0.75 * cy[i] + 0.25 * cy[i + 1]);
    pts.push(0.25 * cx[i] + 0.75 * cx[i + 1], 0.25 * cy[i] + 0.75 * cy[i + 1]);
  }
  pts.push(cx[m - 1], cy[m - 1]);
  return Float32Array.from(pts);
}

/** Total length of a polyline (xy pairs). */
export function polylineLength(poly: Float32Array): number {
  let len = 0;
  for (let i = 2; i < poly.length; i += 2) len += Math.hypot(poly[i] - poly[i - 2], poly[i + 1] - poly[i - 1]);
  return len;
}

/** Maximum number of ghat boats for this many (docked) ghats. */
export function getMaxGhatBoats(ghatCount: number, cap: number): number {
  return Math.max(0, Math.min(cap, Math.floor(ghatCount / GHAT_BOAT_CONFIG.ghatsPerBoat)));
}

// ---------------------------------------------------------------------------
// Per-map network cache (rebuilt only when the structure version, grid size or map changes)
// ---------------------------------------------------------------------------

export interface GhatBoatNetwork {
  gridSize: number;
  nav: Uint8Array;
  bankDist: Uint16Array;
  docks: GhatDock[];
  ghatCount: number;
  /** Structure-change counter: boats compare it to know when to re-check their routes. */
  revision: number;
  /** Polyline + tile route cache per "from:to" dock pair. */
  routes: Map<string, { tiles: Int32Array; poly: Float32Array; length: number } | null>;
}

let networkCache: { key: string; network: GhatBoatNetwork | null } = { key: '', network: null };
let networkRevision = 0;

/**
 * The ghat boat network for the current map, or null if this is not the Varanasi map.
 * Rebuilt only when the game (`gameVersion`: new game / load), the map size or `structureVersion` changes.
 */
export function getGhatBoatNetwork(
  grid: Tile[][],
  gridSize: number,
  mapId: MapId | undefined,
  structureVersion: number,
  gameVersion: number
): GhatBoatNetwork | null {
  if (mapId !== 'varanasi' || !grid || gridSize <= 0) return null;
  const key = `${gameVersion}:${gridSize}:${structureVersion}`;
  if (networkCache.key === key && networkCache.network) return networkCache.network;
  const layout = getVaranasiLayout(gridSize);
  const nav = buildGhatNavMask(grid, gridSize, layout.water);
  const ghats: number[] = [];
  for (let y = 0; y < gridSize; y++) {
    const row = grid[y];
    for (let x = 0; x < gridSize; x++) {
      if (row[x].building.type === 'ghat') ghats.push(y * gridSize + x);
    }
  }
  const docks = groupGhatDocks(ghats, nav, gridSize);
  let ghatCount = 0;
  for (const d of docks) ghatCount += d.ghats.length;
  const network: GhatBoatNetwork = {
    gridSize,
    nav,
    bankDist: computeBankDistance(nav, gridSize),
    docks,
    ghatCount,
    revision: ++networkRevision,
    routes: new Map(),
  };
  networkCache = { key, network };
  return network;
}

/** Cached route between two docks of a network (null when the river does not connect them). */
export function getDockRoute(network: GhatBoatNetwork, from: number, to: number) {
  const key = `${from}:${to}`;
  if (network.routes.has(key)) return network.routes.get(key)!;
  const tiles = findRiverRoute(network.nav, network.bankDist, network.gridSize, network.docks[from].waterIdx, network.docks[to].waterIdx);
  const entry = tiles ? { tiles, poly: routeToPolyline(tiles, network.gridSize), length: 0 } : null;
  if (entry) entry.length = polylineLength(entry.poly);
  network.routes.set(key, entry);
  return entry;
}

/** True if every tile of the route is still navigable in the network. */
export function isRouteNavigable(network: GhatBoatNetwork, tiles: Int32Array): boolean {
  for (let i = 0; i < tiles.length; i++) if (!network.nav[tiles[i]]) return false;
  return true;
}
