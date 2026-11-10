/**
 * Shared cache for whole-map scans that depend only on the map's STRUCTURE.
 *
 * The animation loop asks for airports, heliports, marinas, bays, rail tile counts, ... on every frame,
 * and each answer is a scan (or flood fill) over the whole grid. Those answers only change when a tile's
 * structure changes: the player builds or bulldozes, or the simulation constructs or demolishes a
 * building. So results are cached per "structure epoch":
 *
 *  1. Each grid object is mapped to its epoch in a WeakMap, so asking again for the same grid (every
 *     animation frame between two ticks) is one WeakMap lookup.
 *  2. The simulation hands over a new grid object on every tick, even when nothing was built. A grid not
 *     seen before is compared tile by tile with a snapshot of the structural fields of the last new grid
 *     (one cheap O(n) pass, shared by all scans). If nothing structural differs, it joins the same epoch
 *     and every cached result is reused; otherwise a new epoch starts and results are recomputed lazily.
 *
 * Structural fields (the only tile fields a cached scan may read): `building.type`, `hasRailOverlay` and
 * `building.bridgeTrackType`. A scan that reads anything else (population, fires, power, ...) must not be
 * cached here.
 *
 * Grids are treated as immutable, as everywhere else in the renderer (the simulation copies rows on
 * write and returns a new grid object for every change). A grid object changed in place would keep its
 * old epoch.
 *
 * Cached results are shared between callers and frozen: callers must not modify them.
 */
import type { Tile } from '@/types/game';
import {
  findAirports,
  findBays,
  findHeliports,
  findMarinasAndPiers,
  findOceanConnectedMarinas,
  findOceanSpawnPoints,
  type BayInfo,
  type DockInfo,
  type HeliportInfo,
  type OceanSpawnPoint,
} from './gridFinders';
import { countRailTiles } from './railSystem';

interface StructureEpoch {
  /** Increases with every structural change seen (any grid, any size). */
  readonly id: number;
  readonly size: number;
  /** Results of the scans asked for so far, by scan key. Emptied when the epoch is evicted. */
  readonly results: Map<string, unknown>;
}

/**
 * Epochs that keep their results (most recently used last). Older ones drop their results to bound memory
 * (undo history keeps old grids alive). Three covers the renderer alternating between React's committed
 * grid and the newest simulation grid right after a build.
 */
const RETAINED_EPOCHS = 3;

let nextEpochId = 1;
const epochByGrid = new WeakMap<Tile[][], StructureEpoch>();
const retained: StructureEpoch[] = [];

/** Structural fields of the last new grid compared, per tile (index y * size + x). */
let snapshotEpoch: StructureEpoch | null = null;
let snapshotTypes: string[] = [];
/** bit 0: hasRailOverlay, bit 1: bridgeTrackType === 'rail', bit 2: bridgeTrackType === 'road' */
let snapshotRail = new Uint8Array(0);

function railBits(tile: Tile): number {
  const track = tile.building.bridgeTrackType;
  return (tile.hasRailOverlay === true ? 1 : 0) | (track === 'rail' ? 2 : 0) | (track === 'road' ? 4 : 0);
}

function newEpoch(size: number): StructureEpoch {
  return { id: nextEpochId++, size, results: new Map() };
}

/** Compare `grid` with the snapshot, updating the snapshot in place. Returns true if anything differed. */
function updateSnapshot(grid: Tile[][], size: number): boolean {
  const n = size * size;
  let changed = false;
  if (snapshotTypes.length !== n || snapshotEpoch === null || snapshotEpoch.size !== size) {
    snapshotTypes = new Array<string>(n);
    snapshotRail = new Uint8Array(n);
    changed = true;
  }
  const types = snapshotTypes;
  const rail = snapshotRail;
  for (let y = 0; y < size; y++) {
    const row = grid[y];
    const base = y * size;
    for (let x = 0; x < size; x++) {
      const tile = row[x];
      const i = base + x;
      const type = tile.building.type;
      const bits = railBits(tile);
      if (types[i] !== type || rail[i] !== bits) {
        types[i] = type;
        rail[i] = bits;
        changed = true;
      }
    }
  }
  return changed;
}

function getEpoch(grid: Tile[][], size: number): StructureEpoch {
  const known = epochByGrid.get(grid);
  if (known && known.size === size) return known;
  const changed = updateSnapshot(grid, size);
  if (changed || snapshotEpoch === null) snapshotEpoch = newEpoch(size);
  epochByGrid.set(grid, snapshotEpoch);
  return snapshotEpoch;
}

function touch(epoch: StructureEpoch): void {
  const last = retained.length - 1;
  if (retained[last] === epoch) return;
  const at = retained.indexOf(epoch);
  if (at >= 0) retained.splice(at, 1);
  retained.push(epoch);
  while (retained.length > RETAINED_EPOCHS) retained.shift()!.results.clear();
}

/** Freeze arrays and plain objects (recursively) so a caller that modifies a shared result fails loudly. */
function freezeDeep<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  const proto = Object.getPrototypeOf(value);
  if (Array.isArray(value)) {
    for (const item of value) freezeDeep(item);
  } else if (proto === Object.prototype || proto === null) {
    for (const item of Object.values(value)) freezeDeep(item);
  } else {
    return value; // Maps, typed arrays, class instances: left as they are
  }
  return Object.freeze(value);
}

/**
 * Version of the structure of `grid`: equal for two grids exactly when every tile has the same structural
 * fields (see the module comment), as long as the grids are compared one after the other.
 */
export function getGridStructureVersion(grid: Tile[][], size: number): number {
  return getEpoch(grid, size).id;
}

/**
 * Result of `compute(grid, size)`, computed once per structure epoch and shared by all callers.
 * `compute` must read only the structural tile fields (see the module comment), and `key` must name the
 * scan together with all of its parameters. Arrays and plain objects in the result are frozen.
 */
export function getCachedGridScan<T>(
  grid: Tile[][],
  size: number,
  key: string,
  compute: (grid: Tile[][], size: number) => T
): T {
  if (!grid || size <= 0) return compute(grid, size);
  const epoch = getEpoch(grid, size);
  touch(epoch);
  const results = epoch.results;
  if (results.has(key)) return results.get(key) as T;
  const value = freezeDeep(compute(grid, size));
  results.set(key, value);
  return value;
}

// ---------------------------------------------------------------------------
// Cached versions of the per-frame finders (same results as the functions they wrap)
// ---------------------------------------------------------------------------

export function findAirportsCached(grid: Tile[][], size: number): readonly { x: number; y: number }[] {
  return getCachedGridScan(grid, size, 'airports', findAirports);
}

export function findHeliportsCached(grid: Tile[][], size: number): readonly HeliportInfo[] {
  return getCachedGridScan(grid, size, 'heliports', findHeliports);
}

export function findMarinasAndPiersCached(grid: Tile[][], size: number): readonly DockInfo[] {
  return getCachedGridScan(grid, size, 'marinasAndPiers', findMarinasAndPiers);
}

export function findOceanConnectedMarinasCached(grid: Tile[][], size: number): readonly DockInfo[] {
  return getCachedGridScan(grid, size, 'oceanConnectedMarinas', findOceanConnectedMarinas);
}

export function findOceanSpawnPointsCached(grid: Tile[][], size: number): readonly OceanSpawnPoint[] {
  return getCachedGridScan(grid, size, 'oceanSpawnPoints', findOceanSpawnPoints);
}

export function findBaysCached(grid: Tile[][], size: number, minSize: number = 15): readonly BayInfo[] {
  return getCachedGridScan(grid, size, `bays:${minSize}`, (g, s) => findBays(g, s, minSize));
}

export function countRailTilesCached(grid: Tile[][], size: number): number {
  return getCachedGridScan(grid, size, 'railTileCount', countRailTiles);
}
