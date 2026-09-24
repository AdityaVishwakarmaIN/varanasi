import { describe, expect, it } from 'vitest';
import {
  describeGangaTileEffect,
  findStps,
  getCachedGangaTileEffects,
  getGangaHealthLevel,
  getGangaTileEffectInfo,
} from '@/lib/ganga';
import { formatPopulation } from '@/lib/format';
import { createRng } from '@/lib/rng';
import type { BuildingType } from '@/games/isocity/types/buildings';
import type { Tile } from '@/games/isocity/types/game';
import { generateVaranasiTerrain } from '@/games/isocity/maps/generateVaranasi';
import { getDistanceToGanga, getRiverZone } from '@/games/isocity/maps/riverZones';

const makeTile = (x: number, y: number, type: BuildingType = 'grass') =>
  ({
    x,
    y,
    zone: 'none',
    building: { type, population: 0, powered: false, abandoned: false, constructionProgress: 100 },
    landValue: 50,
    pollution: 0,
  }) as unknown as Tile;

const SIZE = 60;

function findTile(pred: (x: number, y: number) => boolean): { x: number; y: number } {
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) if (pred(x, y)) return { x, y };
  }
  throw new Error('no tile found');
}

describe('Ganga tile info', () => {
  it('returns null off the Varanasi map, on the river and outside the catchment', () => {
    const grid = generateVaranasiTerrain(SIZE, createRng(3), makeTile).grid;
    const land = findTile((x, y) => getRiverZone(x, y, SIZE, 'varanasi') === 'westBank' && getDistanceToGanga(x, y, SIZE, 'varanasi') <= 4);
    const river = findTile((x, y) => getRiverZone(x, y, SIZE, 'varanasi') === 'river');
    const far = findTile((x, y) => getDistanceToGanga(x, y, SIZE, 'varanasi') > 8);
    expect(getGangaTileEffectInfo(grid, SIZE, 'random', land.x, land.y)).toBeNull();
    expect(getGangaTileEffectInfo(grid, SIZE, 'varanasi', river.x, river.y)).toBeNull();
    expect(getGangaTileEffectInfo(grid, SIZE, 'varanasi', far.x, far.y)).toBeNull();
    expect(getGangaTileEffectInfo(grid, SIZE, 'varanasi', land.x, land.y)).not.toBeNull();
  });

  it('describes pollution, untreated sewage, treatment and riverside greenery', () => {
    const grid = generateVaranasiTerrain(SIZE, createRng(3), makeTile).grid;
    const home = findTile((x, y) => getRiverZone(x, y, SIZE, 'varanasi') === 'westBank' && getDistanceToGanga(x, y, SIZE, 'varanasi') <= 4);
    grid[home.y][home.x].zone = 'residential';
    grid[home.y][home.x].building = { ...grid[home.y][home.x].building, type: 'house_small', population: 50 };

    const untreated = getGangaTileEffectInfo(grid, SIZE, 'varanasi', home.x, home.y)!;
    expect(untreated.untreatedPopulation).toBe(50);
    expect(describeGangaTileEffect(untreated, formatPopulation)).toEqual([
      { text: 'Untreated sewage from 500 people', tone: 'hurts' },
    ]);

    // A new grid (as after a tick) with a powered STP next door: the home's sewage is treated.
    const next = grid.map(row => row.map(t => ({ ...t, building: { ...t.building } })));
    const stp = { x: home.x, y: home.y + 1 };
    next[stp.y][stp.x].building = { ...next[stp.y][stp.x].building, type: 'sewage_treatment_plant', powered: true };
    expect(findStps(next, SIZE)).toEqual([stp]);
    const treated = getGangaTileEffectInfo(next, SIZE, 'varanasi', home.x, home.y)!;
    expect(treated.treatedPopulation).toBe(50);
    expect(describeGangaTileEffect(treated, formatPopulation)).toEqual([{ text: 'Treated by STP', tone: 'cleans' }]);

    expect(
      describeGangaTileEffect({ pollutionLoad: 12.4, untreatedPopulation: 0, treatedPopulation: 0, riversideGreen: false }, formatPopulation)
    ).toEqual([{ text: 'Adds pollution (+12)', tone: 'hurts' }]);
    expect(
      describeGangaTileEffect({ pollutionLoad: 0, untreatedPopulation: 0, treatedPopulation: 0, riversideGreen: true }, formatPopulation)
    ).toEqual([{ text: 'Cleans the river (riverside greenery)', tone: 'cleans' }]);
    expect(
      describeGangaTileEffect({ pollutionLoad: 0, untreatedPopulation: 0, treatedPopulation: 0, riversideGreen: false }, formatPopulation)
    ).toEqual([{ text: 'No effect', tone: 'neutral' }]);
  });

  it('memoizes tile effects per grid identity', () => {
    const grid = generateVaranasiTerrain(SIZE, createRng(3), makeTile).grid;
    expect(getCachedGangaTileEffects(grid, SIZE)).toBe(getCachedGangaTileEffects(grid, SIZE));
    const copy = grid.slice();
    expect(getCachedGangaTileEffects(copy, SIZE)).not.toBe(getCachedGangaTileEffects(grid, SIZE));
  });
});

describe('getGangaHealthLevel', () => {
  it('uses green ≥ 70, amber 40–69, red < 40 on the rounded value', () => {
    expect(getGangaHealthLevel(70)).toBe('good');
    expect(getGangaHealthLevel(69.6)).toBe('good');
    expect(getGangaHealthLevel(69.4)).toBe('fair');
    expect(getGangaHealthLevel(40)).toBe('fair');
    expect(getGangaHealthLevel(39.4)).toBe('poor');
  });
});
