/**
 * Visual version of the grid for the static map layers (terrain + buildings canvases).
 *
 * The simulation returns a new grid every tick, but most ticks only change values the static layers
 * never draw (population, jobs, age, pollution, land value, crime, traffic, power/water flags). Redrawing
 * the whole map for those ticks cost 70-100 ms on a slow CPU. This tracker keeps a packed snapshot of
 * every field the static layers read per tile and bumps a version number only when one of them differs.
 *
 * It compares values (not object identity), so it also sees buildings changed in place (fire trucks put
 * fires out without copying the tile). Cost: one pass over the grid with a few array writes per tile,
 * run only when the grid object changes.
 *
 * Overlay modes that colour tiles by per-tile values (pollution, land value, power, ...) are not covered
 * here: the renderer keys those on the grid itself.
 */
import type { Tile } from '@/types/game';

const stringCodes = new Map<string, number>();
function codeOf(value: string | undefined): number {
  if (value === undefined) return 0;
  let code = stringCodes.get(value);
  if (code === undefined) {
    code = stringCodes.size + 1;
    stringCodes.set(value, code);
  }
  return code;
}

/** How many recent versions keep their list of changed tiles (for partial redraws). */
const MAX_TRACKED_VERSIONS = 16;

export class GridVisualTracker {
  private grid: Tile[][] | null = null;
  private size = 0;
  /** type, zone and flags per tile. */
  private kind = new Int32Array(0);
  /** level, construction progress and bridge fields per tile. */
  private detail = new Float64Array(0);
  private bridge = new Int32Array(0);
  /** bridge span and index per tile. */
  private bridgeSpan = new Int32Array(0);
  private version = 0;
  /** Tiles (y * size + x) that changed in each recent version, or null when everything did. */
  private changes = new Map<number, Int32Array | null>();
  private changed: number[] = [];

  /** Visual version for `grid`: unchanged when no field the static layers draw has changed. */
  update(grid: Tile[][], size: number): number {
    if (grid === this.grid && size === this.size) return this.version;
    const n = size * size;
    let all = size !== this.size || this.grid === null;
    const changedTiles = this.changed;
    changedTiles.length = 0;
    if (this.kind.length !== n) {
      this.kind = new Int32Array(n);
      this.detail = new Float64Array(n);
      this.bridge = new Int32Array(n);
      this.bridgeSpan = new Int32Array(n);
      all = true;
    }
    const kind = this.kind;
    const detail = this.detail;
    const bridge = this.bridge;
    const bridgeSpan = this.bridgeSpan;
    for (let y = 0; y < size; y++) {
      const row = grid[y];
      const base = y * size;
      for (let x = 0; x < size; x++) {
        const tile = row[x];
        const b = tile.building;
        const i = base + x;
        const k =
          (codeOf(b.type) << 12) |
          (codeOf(tile.zone) << 6) |
          (b.onFire ? 1 : 0) |
          (b.abandoned ? 2 : 0) |
          (b.flipped ? 4 : 0) |
          (tile.hasRailOverlay ? 8 : 0) |
          (tile.hasSubway ? 16 : 0);
        // Construction progress is drawn by phase only (foundation < 40, scaffolding < 100, finished), so
        // the per-tick progress steps of a building under construction do not count as visual changes
        const cp = b.constructionProgress;
        const phase = cp === undefined || cp >= 100 ? 2 : cp >= 40 ? 1 : 0;
        const d = (b.level ?? 0) * 4 + phase;
        const br = b.bridgeType === undefined
          ? 0
          : (codeOf(b.bridgeType) << 20) | (codeOf(b.bridgeOrientation) << 14) | (codeOf(b.bridgePosition) << 10) |
            (codeOf(b.bridgeTrackType) << 6) | ((b.bridgeVariant ?? 0) & 63);
        const bs = b.bridgeType === undefined ? 0 : (((b.bridgeSpan ?? 0) & 0xffff) << 16) | ((b.bridgeIndex ?? 0) & 0xffff);
        if (kind[i] !== k || detail[i] !== d || bridge[i] !== br || bridgeSpan[i] !== bs) {
          // A new building type or bridge piece can change the drawn size: such tiles are stored as ~index
          const major = (kind[i] >> 6) !== (k >> 6) || bridge[i] !== br || bridgeSpan[i] !== bs;
          kind[i] = k;
          detail[i] = d;
          bridge[i] = br;
          bridgeSpan[i] = bs;
          changedTiles.push(major ? ~i : i);
        }
      }
    }
    this.grid = grid;
    this.size = size;
    if (all || changedTiles.length > 0) {
      this.version++;
      this.changes.set(this.version, all ? null : Int32Array.from(changedTiles));
      this.changes.delete(this.version - MAX_TRACKED_VERSIONS);
    }
    return this.version;
  }

  /**
   * Tiles whose visual fields changed after version `from` up to the current version (may repeat a tile;
 * a tile whose building type, zone or bridge piece changed is given as ~index),
   * or null when that is not known (too old, or the grid was replaced or resized).
   */
  changedSince(from: number): Int32Array | null {
    if (from === this.version) return new Int32Array(0);
    if (from > this.version || this.version - from > MAX_TRACKED_VERSIONS - 1) return null;
    const parts: Int32Array[] = [];
    let total = 0;
    for (let v = from + 1; v <= this.version; v++) {
      const part = this.changes.get(v);
      if (!part) return null;
      parts.push(part);
      total += part.length;
    }
    const out = new Int32Array(total);
    let k = 0;
    for (const part of parts) {
      out.set(part, k);
      k += part.length;
    }
    return out;
  }
}

const sharedTracker = new GridVisualTracker();

/**
 * Visual version of the current game grid, shared by the map canvas, the building metadata cache and the
 * minimap. Each new grid object is scanned once however many callers ask.
 */
export function getGridVisualVersion(grid: Tile[][], size: number): number {
  return sharedTracker.update(grid, size);
}

/** Tiles that changed visually since `version` of the shared tracker (see GridVisualTracker.changedSince). */
export function getGridVisualChangesSince(version: number): Int32Array | null {
  return sharedTracker.changedSince(version);
}
