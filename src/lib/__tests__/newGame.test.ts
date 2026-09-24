import { describe, expect, it } from 'vitest';
import { resolveNewGame } from '@/lib/newGame';

describe('resolveNewGame', () => {
  it('defaults to the Varanasi map at its fixed size', () => {
    expect(resolveNewGame(undefined, false)).toEqual({ name: 'Varanasi', mapId: 'varanasi', size: 160 });
    expect(resolveNewGame({ size: 90 }, true)).toEqual({ name: 'Varanasi', mapId: 'varanasi', size: 120 });
  });

  it('random maps keep their default size unless one is given', () => {
    expect(resolveNewGame({ mapId: 'random' }, false)).toEqual({ name: 'New City', mapId: 'random', size: 70 });
    expect(resolveNewGame({ mapId: 'random', size: 90, name: ' Kashi ' }, false)).toEqual({ name: 'Kashi', mapId: 'random', size: 90 });
  });
});
