import { describe, expect, it } from 'vitest';
import { createRng } from '@/lib/rng';
import { generateRandomAdvancedCity, createInitialGameState } from '@/lib/simulation';

describe('seeded map generation', () => {
  it('generateRandomAdvancedCity gives identical layouts for the same seed', () => {
    const a = generateRandomAdvancedCity(60, 'Test', createRng(42));
    const b = generateRandomAdvancedCity(60, 'Test', createRng(42));
    for (let y = 0; y < 60; y++) {
      for (let x = 0; x < 60; x++) {
        expect(a.grid[y][x].building.type).toBe(b.grid[y][x].building.type);
        expect(a.grid[y][x].zone).toBe(b.grid[y][x].zone);
      }
    }
  });

  it('createInitialGameState gives different terrain for different seeds', () => {
    const a = createInitialGameState(60, 'A', createRng(1));
    const b = createInitialGameState(60, 'B', createRng(2));
    let differences = 0;
    for (let y = 0; y < 60; y++) {
      for (let x = 0; x < 60; x++) {
        if (a.grid[y][x].building.type !== b.grid[y][x].building.type) differences++;
      }
    }
    expect(differences).toBeGreaterThan(0);
  });
});
