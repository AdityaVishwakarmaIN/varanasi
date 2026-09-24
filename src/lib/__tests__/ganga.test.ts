import { describe, expect, it } from 'vitest';
import { calculateGangaTargetHealth, getGangaTrend, stepGangaHealth, SCORING_CONFIG } from '@/lib/scoring';
import { gatherGangaInputs } from '@/lib/ganga';
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

describe('calculateGangaTargetHealth', () => {
  it('an empty map starts at 75', () => {
    const r = calculateGangaTargetHealth({ catchmentPollution: 0, untreatedPopulation: 0, riversideGreenTiles: 0 });
    expect(r.targetHealth).toBeCloseTo(75, 0);
  });

  it('industrial load lowers the target and it stays within 0-100', () => {
    const base = calculateGangaTargetHealth({ catchmentPollution: 0, untreatedPopulation: 0, riversideGreenTiles: 0 });
    const dirty = calculateGangaTargetHealth({ catchmentPollution: 60, untreatedPopulation: 0, riversideGreenTiles: 0 });
    const awful = calculateGangaTargetHealth({ catchmentPollution: 1e9, untreatedPopulation: 1e9, riversideGreenTiles: 0 });
    const lush = calculateGangaTargetHealth({ catchmentPollution: 0, untreatedPopulation: 0, riversideGreenTiles: 1e6 });
    expect(dirty.targetHealth).toBeLessThan(base.targetHealth);
    expect(awful.targetHealth).toBe(0);
    expect(lush.targetHealth).toBe(100);
  });

  it('moves slowly toward the target and reports a trend', () => {
    expect(stepGangaHealth(50, 100)).toBeCloseTo(50 + 50 * SCORING_CONFIG.ganga.dailyApproach);
    expect(getGangaTrend(50, 60)).toBe('up');
    expect(getGangaTrend(50, 40)).toBe('down');
    expect(getGangaTrend(50, 51)).toBe('flat');
  });
});

describe('gatherGangaInputs', () => {
  const size = 60;
  const build = () => generateVaranasiTerrain(size, createRng(3), makeTile).grid;

  function riverfrontHomes(grid: Tile[][], count: number) {
    const homes: { x: number; y: number }[] = [];
    for (let y = 0; y < size && homes.length < count; y++) {
      for (let x = 0; x < size && homes.length < count; x++) {
        if (
          getRiverZone(x, y, size, 'varanasi') === 'westBank' &&
          getDistanceToGanga(x, y, size, 'varanasi') <= 4 &&
          grid[y][x].building.type !== 'water'
        ) {
          const t = grid[y][x];
          t.zone = 'residential';
          t.building = { ...t.building, type: 'house_small', population: 200 };
          homes.push({ x, y });
        }
      }
    }
    return homes;
  }

  it('a powered STP near homes raises the target', () => {
    const grid = build();
    const homes = riverfrontHomes(grid, 20);
    const before = gatherGangaInputs(grid, size, []);
    expect(before.untreatedPopulation).toBeGreaterThan(0);

    const stp = homes[0];
    grid[stp.y][stp.x].building = {
      ...grid[stp.y][stp.x].building,
      type: 'sewage_treatment_plant',
      powered: true,
      population: 0,
    };
    const after = gatherGangaInputs(grid, size, [stp]);
    expect(after.treatedPopulation).toBeGreaterThan(0);
    expect(after.treatedPopulation).toBeLessThanOrEqual(SCORING_CONFIG.ganga.stpCapacity);
    expect(calculateGangaTargetHealth(after).targetHealth).toBeGreaterThan(calculateGangaTargetHealth(before).targetHealth);

    // Unpowered STPs treat nothing.
    grid[stp.y][stp.x].building.powered = false;
    expect(gatherGangaInputs(grid, size, [stp]).treatedPopulation).toBe(0);
  });
});

describe('Ganga overlay helpers', () => {
  it('river colour goes from brown to blue', async () => {
    const { getGangaRiverColor } = await import('@/lib/ganga');
    expect(getGangaRiverColor(0, 1)).toBe('rgba(107, 79, 42, 1)');
    expect(getGangaRiverColor(50, 1)).toBe('rgba(95, 127, 90, 1)');
    expect(getGangaRiverColor(100, 1)).toBe('rgba(58, 123, 213, 1)');
  });

  it('marks polluting catchment tiles as hurting and treated homes as cleaning', async () => {
    const { computeGangaTileEffects, GANGA_TILE_EFFECT } = await import('@/lib/ganga');
    const size = 60;
    const grid = generateVaranasiTerrain(size, createRng(3), makeTile).grid;
    let home: { x: number; y: number } | null = null;
    let factory: { x: number; y: number } | null = null;
    for (let y = 0; y < size && (!home || !factory); y++) {
      for (let x = 0; x < size; x++) {
        if (getRiverZone(x, y, size, 'varanasi') !== 'westBank' || getDistanceToGanga(x, y, size, 'varanasi') > 4) continue;
        if (!home) home = { x, y };
        else if (!factory && Math.abs(x - home.x) + Math.abs(y - home.y) > 3) factory = { x, y };
      }
    }
    grid[home!.y][home!.x].zone = 'residential';
    grid[home!.y][home!.x].building = { ...grid[home!.y][home!.x].building, type: 'house_small', population: 50 };
    grid[factory!.y][factory!.x].pollution = 40;
    const before = computeGangaTileEffects(grid, size, []);
    expect(before.effect[home!.y * size + home!.x]).toBe(GANGA_TILE_EFFECT.hurts);
    expect(before.effect[factory!.y * size + factory!.x]).toBe(GANGA_TILE_EFFECT.hurts);

    const stp = { x: home!.x, y: home!.y + 1 < size ? home!.y + 1 : home!.y - 1 };
    grid[stp.y][stp.x].building = { ...grid[stp.y][stp.x].building, type: 'sewage_treatment_plant', powered: true };
    const after = computeGangaTileEffects(grid, size, [stp]);
    expect(after.effect[home!.y * size + home!.x]).toBe(GANGA_TILE_EFFECT.cleans);
    expect(after.treated[home!.y * size + home!.x]).toBe(50);
  });
});
