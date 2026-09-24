import { describe, expect, it } from 'vitest';
import { stringifyInSlices } from '@/lib/storage/slicedStringify';
import { createInitialGameState } from '@/lib/simulation';

async function sliced(value: unknown, sliceBudgetMs = 0) {
  const chunks: string[] = [];
  let yields = 0;
  let slices = 0;
  await stringifyInSlices(value, {
    sliceBudgetMs,
    onChunk: (text) => chunks.push(text),
    onSlice: () => {
      slices++;
    },
    yieldFn: async () => {
      yields++;
    },
  });
  return { text: chunks.join(''), chunks, yields, slices };
}

describe('stringifyInSlices', () => {
  it('matches JSON.stringify for tricky values', async () => {
    const value = {
      a: 1,
      skipped: undefined,
      fn: () => 1,
      date: new Date(0),
      nested: { deep: { deeper: [1, 'two', null, true] } },
      'we"ird\nkey': 'va"lue ',
      list: Array.from({ length: 20 }, (_, i) => ({ i, u: undefined, arr: [undefined, i] })),
      sparse: [{ x: 1 }, undefined, () => 0, { y: 2 }, null, { z: 3 }, { w: 4 }, { v: 5 }, { t: 6 }],
      emptyArr: [],
      emptyObj: {},
      nan: NaN,
    };
    const { text } = await sliced(value);
    expect(text).toBe(JSON.stringify(value));
  });

  it('matches JSON.stringify for a real game state and yields between slices', async () => {
    const state = createInitialGameState(40, 'Slices');
    const { text, chunks, yields, slices } = await sliced(state, 0);
    expect(text).toBe(JSON.stringify(state));
    expect(slices).toBe(yields + 1);
    // With a zero budget every element is its own slice.
    expect(yields).toBeGreaterThan(100);
    expect(chunks.length).toBeGreaterThan(100);
  });

  it('produces a single chunk when the budget is never used up', async () => {
    const state = createInitialGameState(20, 'OneChunk');
    const { text, chunks, yields } = await sliced(state, 1e9);
    expect(text).toBe(JSON.stringify(state));
    expect(chunks.length).toBe(1);
    expect(yields).toBe(0);
  });
});
