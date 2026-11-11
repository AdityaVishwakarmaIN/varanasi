import { describe, expect, it } from 'vitest';
import { createRng } from '@/lib/rng';
import { createInitialGameState } from '@/lib/simulation';
import { migrateAndValidateState } from '@/lib/saveMigration';

const SIZE = 40;
/** A fresh city round-tripped through JSON, like a save. */
function savedCity(): Record<string, unknown> & { grid: { building: Record<string, unknown>; zone?: unknown }[][] } {
  return JSON.parse(JSON.stringify(createInitialGameState(SIZE, 'Test', createRng(3))));
}

describe('migrateAndValidateState', () => {
  it('preserves known upgrade dates, accepts old saves without them, and drops invalid dates', () => {
    const raw = savedCity();
    raw.grid[0][0].building.lastUpgradeDay = 100;
    raw.grid[0][1].building.lastUpgradeDay = NaN;
    const state = migrateAndValidateState(raw)!;
    expect(state.grid[0][0].building.lastUpgradeDay).toBe(100);
    expect(state.grid[0][1].building.lastUpgradeDay).toBeUndefined();
    expect(state.grid[0][2].building.lastUpgradeDay).toBeUndefined();
  });
  it('keeps a current save as it is', () => {
    const raw = savedCity();
    const before = JSON.parse(JSON.stringify(raw));
    const state = migrateAndValidateState(raw);
    expect(state).not.toBeNull();
    expect(JSON.parse(JSON.stringify(state))).toEqual(before);
  });

  it('rejects saves that are not a gridSize × gridSize grid of tiles', () => {
    expect(migrateAndValidateState(null)).toBeNull();
    expect(migrateAndValidateState('nope')).toBeNull();
    expect(migrateAndValidateState({ ...savedCity(), gridSize: SIZE + 1 })).toBeNull();
    const shortRow = savedCity();
    shortRow.grid[3].pop();
    expect(migrateAndValidateState(shortRow)).toBeNull();
    const noBuilding = savedCity();
    delete (noBuilding.grid[2][2] as Record<string, unknown>).building;
    expect(migrateAndValidateState(noBuilding)).toBeNull();
    const noZone = savedCity();
    delete noZone.grid[1][1].zone;
    expect(migrateAndValidateState(noZone)).toBeNull();
  });

  it('migrates old saves: park_medium, missing fields, tax range, id and seed', () => {
    const raw = savedCity();
    raw.grid[0][0].building.type = 'park_medium';
    delete raw.grid[0][1].building.constructionProgress;
    delete raw.grid[0][1].building.abandoned;
    for (const key of ['adjacentCities', 'waterBodies', 'cities', 'hour', 'effectiveTaxRate', 'id', 'seed', 'gameVersion']) delete raw[key];
    raw.taxRate = 55;
    const state = migrateAndValidateState(raw)!;
    expect(state.grid[0][0].building.type).toBe('park_large');
    expect(state.grid[0][1].building.constructionProgress).toBe(100);
    expect(state.grid[0][1].building.abandoned).toBe(false);
    expect(state.adjacentCities).toEqual([]);
    expect(state.waterBodies).toEqual([]);
    expect(state.cities).toHaveLength(1);
    expect(state.hour).toBe(12);
    expect(state.taxRate).toBe(20);
    expect(state.effectiveTaxRate).toBe(20);
    expect(typeof state.id).toBe('string');
    expect(state.gameVersion).toBe(0);
    // The backfilled seed comes from the id, so reloading the same old save gives the same seed
    const again = savedCity();
    again.id = state.id;
    delete again.seed;
    expect(migrateAndValidateState(again)!.seed).toBe(state.seed);
  });

  it('uses the fallback id for a saved city without one', () => {
    const raw = savedCity();
    delete raw.id;
    expect(migrateAndValidateState(raw, { fallbackId: 'slot-1' })!.id).toBe('slot-1');
  });

  it('rebuilds missing stats, budget and services and replaces non-finite numbers', () => {
    const raw = savedCity();
    delete raw.budget;
    delete raw.services;
    raw.stats = { money: 'lots', population: 40 };
    raw.year = null;
    raw.taxRate = -4;
    const state = migrateAndValidateState(raw)!;
    expect(state.stats.population).toBe(40);
    expect(Number.isFinite(state.stats.money)).toBe(true);
    expect(state.stats.demand.residential).toBeTypeOf('number');
    expect(state.budget.police.funding).toBe(100);
    expect(state.services.power).toHaveLength(SIZE);
    expect(state.year).toBe(2024);
    expect(state.taxRate).toBe(0);
  });
});
