/**
 * EMBER D1: what a burned building leaves behind, what the player is told, and how the lot recovers.
 */
import { describe, expect, it } from 'vitest';
import { simulateTick } from '@/lib/simulation';
import type { BuildingType, GameState } from '@/types/game';
import { makeFireCity, quietSim, seedMath, setTile, writeMetrics } from './harness';

function addUtilities(state: GameState): void {
  // 2x2 power plant at (24,22) and a water tower at (23,20): both cover the whole block.
  setTile(state.grid[22][24], 'power_plant', 'none');
  for (const [dx, dy] of [[1, 0], [0, 1], [1, 1]]) setTile(state.grid[22 + dy][24 + dx], 'empty', 'none');
  setTile(state.grid[20][23], 'water_tower', 'none');
}

function describeLot(state: GameState, x: number, y: number, w = 1, h = 1) {
  const out: string[] = [];
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) {
    const t = state.grid[y + dy][x + dx];
    out.push(`${t.building.type}/${t.zone}${t.building.fireProgress ? `/charred${t.building.fireProgress}` : ''}`);
  }
  return out;
}

interface D1Case { type: BuildingType; w: number; h: number; x: number; y: number }

const CASES: D1Case[] = [
  { type: 'house_small', w: 1, h: 1, x: 8, y: 8 },
  { type: 'shop_small', w: 1, h: 1, x: 9, y: 9 },
  { type: 'apartment_low', w: 2, h: 2, x: 14, y: 8 },
];

describe('EMBER D1 destruction aftermath', () => {
  it('measures remains, notifications and recovery', () => {
    quietSim();
    const results: Record<string, unknown>[] = [];
    for (const c of CASES) {
      const restore = seedMath(4242);
      try {
        let state = makeFireCity(4242);
        addUtilities(state);
        // Clear the neighbourhood so only this lot burns.
        for (let y = c.y - 2; y <= c.y + c.h + 1; y++) for (let x = c.x - 2; x <= c.x + c.w + 1; x++) {
          if (x % 6 === 0 || y % 6 === 0) continue;
          setTile(state.grid[y][x], 'grass', 'residential');
        }
        const zone = c.type.startsWith('shop') ? 'commercial' : 'residential';
        setTile(state.grid[c.y][c.x], c.type, zone);
        for (let dy = 0; dy < c.h; dy++) for (let dx = 0; dx < c.w; dx++) {
          if (dx || dy) setTile(state.grid[c.y + dy][c.x + dx], 'empty', zone);
        }
        const before = describeLot(state, c.x, c.y, c.w, c.h);
        const popBefore = state.grid[c.y][c.x].building.population;
        const b = state.grid[c.y][c.x].building;
        state.grid[c.y][c.x].building = { ...b, onFire: true, fireProgress: 0 };
        const notesBefore = state.notifications.length;
        let destroyedTick = -1;
        let lotAfter1: string[] = [];
        for (let tick = 1; tick <= 400; tick++) {
          state = simulateTick(state, 'clear');
          if (destroyedTick < 0 && !state.grid[c.y][c.x].building.onFire) {
            destroyedTick = tick;
            lotAfter1 = describeLot(state, c.x, c.y, c.w, c.h);
          }
          if (destroyedTick > 0 && tick === destroyedTick + 5) break;
        }
        const lotAfter5 = describeLot(state, c.x, c.y, c.w, c.h);
        const newNotes = state.notifications.slice(0, Math.max(0, state.notifications.length - notesBefore)).map((n) => n.title);
        // Recovery: does the lot build again by itself within 120 days?
        let rebuiltDay: number | null = null;
        for (let tick = 1; tick <= 120 * 30; tick++) {
          state = simulateTick(state, 'clear');
          if (tick % 30 === 0) {
            const t = state.grid[c.y][c.x].building.type;
            if (t !== 'grass' && t !== 'empty') {
              rebuiltDay = tick / 30;
              break;
            }
          }
        }
        results.push({
          type: c.type,
          before,
          popBefore,
          burnTicks: destroyedTick,
          lotAfter1,
          lotAfter5,
          notifications: newNotes,
          zoneKept: state.grid[c.y][c.x].zone !== 'none',
          rebuiltDay,
        });
      } finally {
        restore();
      }
    }
    writeMetrics('D1', results);
    console.log('D1', JSON.stringify(results, null, 1));
    expect(results.length).toBe(CASES.length);
  }, 300000);
});
