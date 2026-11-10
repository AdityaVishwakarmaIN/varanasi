import { describe, expect, it } from 'vitest';
import { calculateGangaTargetHealth, getGangaTrend, stepGangaHealth, SCORING_CONFIG } from '@/lib/scoring';
import { gatherGangaInputs } from '@/lib/ganga';
import { createRng } from '@/lib/rng';
import { BUILDING_STATS, type BuildingType } from '@/games/isocity/types/buildings';
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

describe('Ganga balance (tile pollution settles at about the building stat)', () => {
  const size = 60;
  const GANGA = SCORING_CONFIG.ganga;
  const build = () => generateVaranasiTerrain(size, createRng(3), makeTile).grid;

  /** West-bank catchment land tiles, nearest the river first (ties in row-major order). */
  function westBankByDistance(grid: Tile[][]): { x: number; y: number; d: number }[] {
    const tiles: { x: number; y: number; d: number }[] = [];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const zone = getRiverZone(x, y, size, 'varanasi');
        if (zone !== 'westBank' && zone !== 'westRiverfront') continue;
        if (grid[y][x].building.type === 'water') continue;
        const d = getDistanceToGanga(x, y, size, 'varanasi');
        if (d <= GANGA.catchmentRadius) tiles.push({ x, y, d });
      }
    }
    return tiles.sort((a, b) => a.d - b.d);
  }

  function setBuilding(
    grid: Tile[][],
    t: { x: number; y: number },
    type: BuildingType,
    pollution: number,
    population = 0,
    zone: Tile['zone'] = 'none'
  ) {
    const tile = grid[t.y][t.x];
    tile.zone = zone;
    tile.building = { ...tile.building, type, population, powered: true, constructionProgress: 100 };
    tile.pollution = pollution;
  }

  const target = (grid: Tile[][], stps: { x: number; y: number }[] = []) =>
    calculateGangaTargetHealth(gatherGangaInputs(grid, size, stps)).targetHealth;

  it('an empty bank sits at the upstream baseline (plus credit for its few riverside trees)', () => {
    const health = target(build());
    expect(health).toBeGreaterThanOrEqual(75);
    expect(health).toBeLessThanOrEqual(80);
  });

  it('a handful of factories right on the bank noticeably hurt, without killing the river', () => {
    const grid = build();
    const base = target(grid);
    const bank = westBankByDistance(grid).filter((t) => t.d <= GANGA.bankDistance);
    for (let i = 0; i < 4; i++) setBuilding(grid, bank[i * 3], 'factory_medium', BUILDING_STATS.factory_medium.pollution, 0, 'industrial');
    const after = target(grid);
    expect(base - after).toBeGreaterThan(10);
    expect(after).toBeGreaterThan(45);
  });

  it('the same factories at the edge of the catchment hurt much less', () => {
    const grid = build();
    const base = target(grid);
    const far = westBankByDistance(grid).filter((t) => t.d === GANGA.catchmentRadius);
    for (let i = 0; i < 4; i++) setBuilding(grid, far[i * 3], 'factory_medium', BUILDING_STATS.factory_medium.pollution, 0, 'industrial');
    expect(base - target(grid)).toBeLessThan(6);
  });

  /**
   * A city of a few lakh with ~2 lakh shown (~20,000 simulation people) in the catchment of a 120-tile map:
   * streets, shops, blocks of flats (2x2: only the origin tile carries pollution) and houses at their settled
   * pollution, 10 riverside trees planted beside the map's own, and optionally STPs spread along the river.
   */
  function riversideCity(withStps: boolean) {
    const bigSize = 120;
    const grid = generateVaranasiTerrain(bigSize, createRng(3), makeTile).grid;
    const tiles: { x: number; y: number; d: number }[] = [];
    for (let y = 0; y < bigSize; y++) {
      for (let x = 0; x < bigSize; x++) {
        const zone = getRiverZone(x, y, bigSize, 'varanasi');
        if ((zone !== 'westBank' && zone !== 'westRiverfront') || grid[y][x].building.type === 'water') continue;
        const d = getDistanceToGanga(x, y, bigSize, 'varanasi');
        if (d <= GANGA.catchmentRadius) tiles.push({ x, y, d });
      }
    }
    let trees = 0;
    for (const t of tiles) {
      if (trees < 10 && getRiverZone(t.x, t.y, bigSize, 'varanasi') === 'westRiverfront') {
        setBuilding(grid, t, 'tree', 0);
        trees++;
      }
    }
    // Every 12 inland tiles: 2 road, 1 shop, 1 block of flats (+3 footprint tiles), 5 houses
    const pattern: [BuildingType, Tile['zone'], number][] = [
      ['road', 'none', 0], ['shop_small', 'commercial', 0], ['apartment_high', 'residential', 260],
      ['empty', 'residential', 0], ['empty', 'residential', 0], ['empty', 'residential', 0], ['road', 'none', 0],
      ['house_medium', 'residential', 14], ['house_medium', 'residential', 14], ['house_medium', 'residential', 14],
      ['house_medium', 'residential', 14], ['house_medium', 'residential', 14],
    ];
    const inland = tiles.filter((t) => t.d >= 3);
    const homes: { x: number; y: number }[] = [];
    inland.forEach((t, i) => {
      const [type, zone, population] = pattern[i % pattern.length];
      setBuilding(grid, t, type, BUILDING_STATS[type].pollution, population, zone);
      if (population > 0) homes.push(t);
    });
    const stps: { x: number; y: number }[] = [];
    if (withStps) {
      // Eight plants, spread along the river (the homes run north-south beside it)
      const byRow = [...homes].sort((a, b) => a.y - b.y || a.x - b.x);
      const step = Math.floor(byRow.length / 8);
      for (let i = Math.floor(step / 2); i < byRow.length; i += step) {
        stps.push(byRow[i]);
        setBuilding(grid, byRow[i], 'sewage_treatment_plant', 0);
      }
    }
    const inputsOf = () => gatherGangaInputs(grid, bigSize, stps);
    return { inputsOf, trees };
  }

  it('a well-run city of a few lakh with STPs and a green belt keeps the river at 60-80', () => {
    const { inputsOf, trees } = riversideCity(true);
    expect(trees).toBe(10);
    const inputs = inputsOf();
    expect(inputs.catchmentPopulation).toBeGreaterThan(15_000);
    expect(inputs.untreatedPopulation).toBeLessThan(inputs.catchmentPopulation * 0.05);
    const health = calculateGangaTargetHealth(inputs).targetHealth;
    expect(health).toBeGreaterThanOrEqual(60);
    expect(health).toBeLessThanOrEqual(80);
  });

  it('the same city without STPs pushes the river toward poor', () => {
    const { inputsOf } = riversideCity(false);
    expect(calculateGangaTargetHealth(inputsOf()).targetHealth).toBeLessThan(40);
  });

  it('heavy unchecked industry along the bank tanks the river', () => {
    const grid = build();
    const tiles = westBankByDistance(grid);
    for (let i = 0; i < 24; i++) {
      const type = i % 2 === 0 ? 'factory_large' : 'factory_medium';
      setBuilding(grid, tiles[i * 4], type, BUILDING_STATS[type].pollution, 0, 'industrial');
    }
    expect(target(grid)).toBeLessThan(10);
  });

  it('informal settlements (unzoned) drain untreated sewage', () => {
    const grid = build();
    setBuilding(grid, westBankByDistance(grid)[5], 'informal_housing', 0, 14);
    expect(gatherGangaInputs(grid, size, []).untreatedPopulation).toBe(14);
  });
});
