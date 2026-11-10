import { describe, expect, it } from 'vitest';
import { createRng } from '@/lib/rng';
import { createInitialGameState } from '@/lib/simulation';
import { describeFirePlace } from '@/lib/firePlaces';

describe('describeFirePlace', () => {
  const state = createInitialGameState(20, 'Fire', createRng(1));

  it('uses "a"/"an" for countable buildings on the random map', () => {
    expect(describeFirePlace(state.grid, 20, 3, 3, undefined, 'factory_small')).toMatch(/^a small factory in /);
    expect(describeFirePlace(state.grid, 20, 3, 3, undefined, 'hospital')).toMatch(/^a hospital in /);
  });

  it('has no article before informal housing', () => {
    expect(describeFirePlace(state.grid, 20, 3, 3, undefined, 'informal_housing')).toMatch(/^informal housing in /);
  });
});
