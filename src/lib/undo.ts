/**
 * Lightweight undo for the last build / bulldoze action (KITE-04, LANGUR-03, PARROT-07).
 *
 * An entry keeps only the tiles an action changed (shallow copies) plus the money it spent, so a
 * ring of 10 stays tiny: there are no full-grid clones. Pure: no React, DOM or window.
 */
import type { GameState, Tile, Tool } from '@/types/game';
import { TOOL_INFO } from '@/types/game';

export const UNDO_LIMIT = 10;
/** Placements of the same tool this close together are one action (a drag-paint is one undo). */
export const UNDO_MERGE_MS = 500;

/** Tools whose repeated placements form one drag gesture. */
const MERGEABLE_TOOLS: ReadonlySet<Tool> = new Set<Tool>([
  'road', 'rail', 'subway', 'bulldoze', 'tree',
  'zone_residential', 'zone_commercial', 'zone_industrial', 'zone_dezone', 'zone_water', 'zone_land',
]);

export type UndoKind = 'build' | 'demolish' | 'zone';

export interface UndoEntry {
  /** Changes whenever the entry is added or merged into, so the UI can tell it is new. */
  seq: number;
  tool: Tool;
  kind: UndoKind;
  /** Placements merged into this entry. */
  count: number;
  /** Tiles as they were before the action, by `y * gridSize + x`. */
  tiles: Map<number, Tile>;
  /** Money the action cost; undo gives it back. */
  spent: number;
  /** Bulldoze only: the price of what was removed (bulldozing never refunds it). */
  lostValue: number;
  /** Tool or building type that was placed or removed first, for the toast name. */
  subject: string | null;
  landmarksBuilt?: GameState['landmarksBuilt'];
  at: number;
}

/** Same tile contents? Cheap field check: the simulation clones every tile, so identity is useless. */
function sameTile(a: Tile, b: Tile): boolean {
  const p = a.building;
  const q = b.building;
  return (
    a.zone === b.zone &&
    a.hasSubway === b.hasSubway &&
    a.hasRailOverlay === b.hasRailOverlay &&
    p.type === q.type &&
    p.flipped === q.flipped &&
    p.level === q.level &&
    p.bridgeIndex === q.bridgeIndex
  );
}

function copyTile(t: Tile): Tile {
  return { ...t, building: { ...t.building } };
}

export function kindForTool(tool: Tool): UndoKind {
  if (tool === 'bulldoze') return 'demolish';
  if (tool === 'zone_residential' || tool === 'zone_commercial' || tool === 'zone_industrial' || tool === 'zone_dezone') return 'zone';
  return 'build';
}

/** The entry for a state change `prev` to `next`, or null when no tile changed. */
export function createUndoEntry(prev: GameState, next: GameState, tool: Tool, now: number): UndoEntry | null {
  const size = prev.gridSize;
  const tiles = new Map<number, Tile>();
  const kind = kindForTool(tool);
  let subject: string | null = kind === 'demolish' ? null : tool;
  let lostValue = 0;
  for (let y = 0; y < size; y++) {
    const a = prev.grid[y];
    const b = next.grid[y];
    if (!a || !b || a === b) continue;
    for (let x = 0; x < size; x++) {
      if (!a[x] || !b[x] || sameTile(a[x], b[x])) continue;
      tiles.set(y * size + x, copyTile(a[x]));
      if (kind === 'demolish') {
        const type = a[x].building.type;
        lostValue += TOOL_INFO[type as Tool]?.cost ?? 0;
        if (!subject && TOOL_INFO[type as Tool]) subject = type;
      }
    }
  }
  if (tiles.size === 0) return null;
  return {
    seq: 0,
    tool,
    kind,
    count: 1,
    tiles,
    spent: prev.stats.money - next.stats.money,
    lostValue,
    subject,
    landmarksBuilt: prev.landmarksBuilt,
    at: now,
  };
}

/** Adds an entry to the ring: merges a drag into the previous entry, drops the oldest beyond the limit. */
export function pushUndoEntry(stack: readonly UndoEntry[], entry: UndoEntry, seq: number): UndoEntry[] {
  const last = stack[stack.length - 1];
  if (last && last.tool === entry.tool && MERGEABLE_TOOLS.has(entry.tool) && entry.at - last.at <= UNDO_MERGE_MS) {
    const tiles = new Map(entry.tiles);
    for (const [k, t] of last.tiles) tiles.set(k, t); // the oldest copy of a tile wins
    const merged: UndoEntry = {
      ...last,
      seq,
      count: last.count + 1,
      tiles,
      spent: last.spent + entry.spent,
      lostValue: last.lostValue + entry.lostValue,
      subject: last.subject ?? entry.subject,
      at: entry.at,
    };
    return [...stack.slice(0, -1), merged];
  }
  const next = [...stack, { ...entry, seq }];
  return next.length > UNDO_LIMIT ? next.slice(next.length - UNDO_LIMIT) : next;
}

/** Puts the saved tiles back and refunds the money. Copies only the rows it touches. */
export function applyUndo(state: GameState, entry: UndoEntry): GameState {
  const size = state.gridSize;
  const grid = state.grid.slice();
  const copiedRows = new Set<number>();
  for (const [k, tile] of entry.tiles) {
    const y = Math.floor(k / size);
    const x = k % size;
    if (!grid[y]) continue;
    if (!copiedRows.has(y)) {
      grid[y] = grid[y].slice();
      copiedRows.add(y);
    }
    grid[y][x] = copyTile(tile);
  }
  return {
    ...state,
    grid,
    stats: { ...state.stats, money: state.stats.money + entry.spent },
    structureVersion: (state.structureVersion ?? 0) + 1,
    roadNetworkVersion: (state.roadNetworkVersion ?? 0) + 1,
    ...(entry.landmarksBuilt !== undefined ? { landmarksBuilt: entry.landmarksBuilt } : {}),
  };
}
