import { describe, expect, it } from 'vitest';
import { createRng } from '@/lib/rng';
import { bulldozeTile, createInitialGameState, placeBuilding } from '@/lib/simulation';
import { applyUndo, createUndoEntry, pushUndoEntry, UNDO_LIMIT, UNDO_MERGE_MS, type UndoEntry } from '@/lib/undo';
import type { BuildingType, GameState, Tool } from '@/types/game';

const SIZE = 20;

function flatState(): GameState {
  const state = createInitialGameState(SIZE, 'Test', createRng(7));
  const template = state.grid[0][0].building;
  for (const row of state.grid) {
    for (const tile of row) {
      tile.building = { ...template, type: 'grass' };
      tile.zone = 'none';
      tile.hasSubway = false;
    }
  }
  state.stats = { ...state.stats, money: 100_000 };
  return state;
}

function build(prev: GameState, tool: Tool, x: number, y: number, cost: number, at: number): { next: GameState; entry: UndoEntry } {
  const placed = placeBuilding(prev, x, y, tool as BuildingType, null);
  const next = { ...placed, stats: { ...placed.stats, money: placed.stats.money - cost } };
  return { next, entry: createUndoEntry(prev, next, tool, at)! };
}

describe('undo', () => {
  it('snapshots only the changed tiles and restores them and the money', () => {
    const state = flatState();
    const { next, entry } = build(state, 'power_plant', 4, 4, 3000, 0);
    expect(entry.tiles.size).toBe(4); // 2x2 footprint, not the grid
    expect(entry.spent).toBe(3000);
    const undone = applyUndo(next, entry);
    expect(undone.stats.money).toBe(state.stats.money);
    expect(undone.grid[4][4].building.type).toBe('grass');
    expect(undone.grid[5][5].building.type).toBe('grass');
    // untouched rows are shared, not cloned
    expect(undone.grid[0]).toBe(next.grid[0]);
  });

  it('undoes a bulldoze and remembers the price of the building', () => {
    const built = build(flatState(), 'power_plant', 4, 4, 3000, 0).next;
    const razed = bulldozeTile(built, 4, 4);
    const entry = createUndoEntry(built, razed, 'bulldoze', 10)!;
    expect(entry.kind).toBe('demolish');
    expect(entry.subject).toBe('power_plant');
    expect(entry.lostValue).toBeGreaterThanOrEqual(3000);
    expect(applyUndo(razed, entry).grid[4][4].building.type).toBe('power_plant');
  });

  it('returns no entry when nothing changed', () => {
    const state = flatState();
    expect(createUndoEntry(state, state, 'road', 0)).toBeNull();
  });

  it('merges a quick drag into one entry, keeping the oldest tile copies', () => {
    let state = flatState();
    let stack: UndoEntry[] = [];
    let seq = 0;
    for (let i = 0; i < 5; i++) {
      const r = build(state, 'road', i, 2, 25, i * 50);
      state = r.next;
      stack = pushUndoEntry(stack, r.entry, ++seq);
    }
    expect(stack).toHaveLength(1);
    expect(stack[0].count).toBe(5);
    expect(stack[0].tiles.size).toBe(5);
    expect(stack[0].spent).toBe(125);
    const undone = applyUndo(state, stack[0]);
    expect(undone.grid[2][3].building.type).toBe('grass');
  });

  it('does not merge slow actions and keeps at most 10 entries', () => {
    let state = flatState();
    let stack: UndoEntry[] = [];
    for (let i = 0; i < UNDO_LIMIT + 4; i++) {
      const r = build(state, 'road', i, 3, 25, i * (UNDO_MERGE_MS + 1));
      state = r.next;
      stack = pushUndoEntry(stack, r.entry, i + 1);
    }
    expect(stack).toHaveLength(UNDO_LIMIT);
    expect(stack[UNDO_LIMIT - 1].seq).toBe(UNDO_LIMIT + 4);
  });
});
