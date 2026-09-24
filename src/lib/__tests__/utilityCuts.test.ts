import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRng } from '@/lib/rng';
import { applyFeederCuts } from '@/lib/utilityCuts';
import { getFeederIndex } from '@/lib/feederZones';
import {
  ensureUtilityCapacity,
  generateRandomAdvancedCity,
  recalculateDerivedState,
  simulateTick,
} from '@/lib/simulation';
import type { GameState, ServiceCoverage } from '@/types/game';

function coverage(size: number, value: boolean): ServiceCoverage {
  const bool = () => Array.from({ length: size }, () => Array<boolean>(size).fill(value));
  const num = () => Array.from({ length: size }, () => Array<number>(size).fill(0));
  return { police: num(), fire: num(), health: num(), education: num(), power: bool(), water: bool() };
}

/** Runs `fn` with Math.random seeded, so ticks are reproducible. */
function seeded<T>(seed: number, fn: () => T): T {
  const spy = vi.spyOn(Math, 'random').mockImplementation(createRng(seed));
  try {
    return fn();
  } finally {
    spy.mockRestore();
  }
}

afterEach(() => vi.restoreAllMocks());

describe('applyFeederCuts', () => {
  it('returns the base coverage when nothing is cut', () => {
    const base = coverage(40, true);
    expect(applyFeederCuts(base, new Set(), new Set(), 40)).toBe(base);
  });

  it('switches off only the cut block and never changes the base', () => {
    const size = 40; // 3×3 feeders, the last row/column smaller
    const base = coverage(size, true);
    const cut = applyFeederCuts(base, new Set([4]), new Set(), size); // middle block: x,y in 16..31
    expect(cut).not.toBe(base);
    expect(cut.water).toBe(base.water);
    expect(cut.police).toBe(base.police);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        expect(cut.power[y][x]).toBe(getFeederIndex(x, y, size) !== 4);
        expect(base.power[y][x]).toBe(true);
      }
    }
    // Rows outside the block are shared, rows inside are copies
    expect(cut.power[0]).toBe(base.power[0]);
    expect(cut.power[20]).not.toBe(base.power[20]);
  });

  it('handles the smaller edge block and caches the result', () => {
    const size = 40;
    const base = coverage(size, true);
    const a = applyFeederCuts(base, new Set(), new Set([8]), size); // bottom-right: x,y in 32..39
    expect(a.water[39][39]).toBe(false);
    expect(a.water[31][39]).toBe(true);
    expect(applyFeederCuts(base, new Set(), new Set([8]), size)).toBe(a);
  });
});

describe('rolling cuts in simulateTick (S3-T7/T8)', () => {
  // The raw generator predates capacity limits: its cities need about twice the power they have.
  const raw = () => generateRandomAdvancedCity(60, 'Test', createRng(1000));

  it('an under-supplied city gets rotating power cuts, and only inside coverage', () => {
    let state: GameState = raw();
    state = seeded(1, () => simulateTick(state, 'clear'));
    const power = state.stats.power!;
    expect(power.ratio).toBeLessThan(1);
    state = seeded(2, () => simulateTick(state, 'clear'));
    const cut = state.stats.power!.cut;
    expect(cut.length).toBeGreaterThan(0);
    expect(cut.length).toBeLessThan(power.feeders.length);
    expect(state.advisorMessages.some((m) => m.messages.some((t) => t.includes('taking turns')))).toBe(true);

    // Buildings in a cut block are unpowered even though a plant covers them
    const cutSet = new Set(cut);
    let cutBuildings = 0;
    for (let y = 0; y < 60; y++) {
      for (let x = 0; x < 60; x++) {
        const tile = state.grid[y][x];
        if (tile.zone === 'none' || tile.building.type === 'grass') continue;
        if (cutSet.has(getFeederIndex(x, y, 60))) {
          expect(tile.building.powered).toBe(false);
          cutBuildings++;
        }
      }
    }
    expect(cutBuildings).toBeGreaterThan(0);
  });

  it('the cut blocks rotate over the day', () => {
    let state: GameState = raw();
    const seen = new Set<number>();
    seeded(3, () => {
      for (let i = 0; i < 120; i++) {
        state = simulateTick(state, 'clear');
        for (const f of state.stats.power?.cut ?? []) seen.add(f);
      }
    });
    // ~6 in-game hours at ratio ≈ 0.5: every block with demand takes a turn
    expect(seen.size).toBe(state.stats.power!.feeders.length);
  });

  it('adding capacity ends the cuts', () => {
    const topped = ensureUtilityCapacity(raw());
    expect(topped.stats.power!.ratio).toBe(1);
    expect(topped.stats.power!.supply).toBeGreaterThanOrEqual(topped.stats.power!.demand);
    let state = topped;
    seeded(4, () => {
      for (let i = 0; i < 3; i++) state = simulateTick(state, 'clear');
    });
    expect(state.stats.power!.cut).toEqual([]);
  });

  it('cuts cost tax income and happiness', () => {
    const base = recalculateDerivedState(raw());
    let state = base;
    state = seeded(5, () => simulateTick(simulateTick(state, 'clear'), 'clear'));
    expect(state.stats.power!.cut.length).toBeGreaterThan(0);
    const topped = seeded(5, () => {
      let s = ensureUtilityCapacity(raw());
      s = simulateTick(simulateTick(s, 'clear'), 'clear');
      return s;
    });
    expect(state.stats.happiness).toBeLessThan(topped.stats.happiness);
  });
});
