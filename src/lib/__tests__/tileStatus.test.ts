import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { decodeMsg } from 'gt-next';
import {
  PROBLEM_KINDS,
  computeProblemIconsForState,
  computeRoadAccessMask,
  hasTileRoadAccess,
  listTileProblems,
  pickTileProblem,
  type ProblemTileInput,
} from '@/lib/problemIcons';
import {
  EXTRA_STATUS_KINDS,
  SIM_RULES,
  STATUS_DEFINITIONS,
  STATUS_KINDS,
  getTileStatuses,
  getTileStatusesForState,
  type TileStatus,
  type TileStatusContext,
} from '@/lib/tileStatus';
import { startOutbreak } from '@/lib/disease';
import { getProblemIconAnchor } from '@/components/game/problemIconsDraw';
import { screenToGrid } from '@/components/game/utils';
import { createRng } from '@/lib/rng';
import type { Tile } from '@/types/game';
import { emptyCity, house, road, SIZE } from './feedbackLayers.helpers';

const text = (s: string) => decodeMsg(s);

function makeTile(type: string, zone: Tile['zone'], b: Partial<Tile['building']> = {}): Tile {
  return {
    x: 0,
    y: 0,
    zone,
    pollution: 0,
    landValue: 50,
    crime: 0,
    traffic: 0,
    hasSubway: false,
    building: {
      type,
      level: 1,
      population: 0,
      jobs: 0,
      powered: true,
      watered: true,
      onFire: false,
      fireProgress: 0,
      age: 100,
      constructionProgress: 100,
      abandoned: false,
      ...b,
    },
  } as unknown as Tile;
}

function ctxFor(input: ProblemTileInput, extra: Partial<TileStatusContext> = {}): TileStatusContext {
  return {
    ...input,
    waterCut: false,
    floodRisk: 0,
    demand: { residential: 0, commercial: 0, industrial: 0 },
    exodusActive: false,
    fireCoverage: 0,
    formaliseDays: 0,
    ...extra,
  };
}

/** Building variants the icons treat differently. */
const VARIANTS: [string, Tile['zone']][] = [
  ['grass', 'residential'],
  ['empty', 'commercial'],
  ['house_small', 'residential'],
  ['apartment_low', 'residential'],
  ['shop_small', 'commercial'],
  ['factory_small', 'industrial'],
  ['informal_housing', 'none'],
  ['informal_housing', 'residential'],
  ['hospital', 'none'],
  ['power_plant', 'none'],
  ['road', 'none'],
  ['tree', 'none'],
];

function expectWellFormed(s: TileStatus) {
  expect(text(s.title).length).toBeGreaterThan(0);
  expect(text(s.cause).length).toBeGreaterThan(0);
  for (const line of [s.title, s.cause, s.fix, ...s.notes]) {
    // Every {variable} was filled in
    expect(text(line)).not.toMatch(/[{}]/);
  }
  if (s.icon) expect(text(s.fix).length).toBeGreaterThan(0);
}

describe('status definitions', () => {
  it('every status kind, including every map icon kind, has a title, advice and severity', () => {
    for (const kind of STATUS_KINDS) {
      const def = STATUS_DEFINITIONS[kind];
      expect(text(def.title).length, kind).toBeGreaterThan(0);
      expect(text(def.advice).length, kind).toBeGreaterThan(0);
      expect(['critical', 'warning', 'info']).toContain(def.severity);
    }
    for (const kind of PROBLEM_KINDS) expect(STATUS_DEFINITIONS[kind].icon).toBe(kind);
    for (const kind of EXTRA_STATUS_KINDS) expect(STATUS_DEFINITIONS[kind].icon).toBeNull();
  });
});

describe('getTileStatuses matches the map icons', () => {
  it('lists the icon kind (first, outside outbreaks) for every combination the icon logic sees', () => {
    let drawn = 0;
    for (const [type, zone] of VARIANTS) {
      for (let mask = 0; mask < 1 << 9; mask++) {
        const bit = (n: number) => (mask & (1 << n)) !== 0;
        const tile = makeTile(type, zone, {
          onFire: bit(0),
          powered: bit(1),
          watered: bit(2),
          abandoned: bit(3),
          population: bit(4) ? 10 : 0,
          unservedDays: bit(4) ? 40 : 0,
        });
        const input: ProblemTileInput = { tile, flooded: bit(5), infected: bit(6), hasRoadAccess: bit(7), powerCut: bit(8) };
        const pick = pickTileProblem(input);
        const list = listTileProblems(input);
        expect(list[0] ?? null).toBe(pick);
        const statuses = getTileStatuses(ctxFor(input));
        statuses.forEach(expectWellFormed);
        if (!pick) continue;
        drawn++;
        const own = statuses.find((s) => s.kind === pick);
        expect(own, `${type}/${zone}/${mask} -> ${pick}`).toBeDefined();
        expect(own!.icon).toBe(pick);
        if (!input.infected) expect(statuses[0].kind, `${type}/${zone}/${mask}`).toBe(pick);
      }
    }
    expect(drawn).toBeGreaterThan(1000);
  });

  it('explains every icon kind at least once', () => {
    const seen = new Set<string>();
    for (const [type, zone] of VARIANTS) {
      for (let mask = 0; mask < 1 << 9; mask++) {
        const bit = (n: number) => (mask & (1 << n)) !== 0;
        const tile = makeTile(type, zone, { onFire: bit(0), powered: bit(1), watered: bit(2), abandoned: bit(3), population: bit(4) ? 10 : 0 });
        const pick = pickTileProblem({ tile, flooded: bit(5), infected: bit(6), hasRoadAccess: bit(7), powerCut: bit(8) });
        if (pick) seen.add(pick);
      }
    }
    expect([...seen].sort()).toEqual([...PROBLEM_KINDS].sort());
  });

  it('every tile with an icon in a real state gets that status from getTileStatusesForState', () => {
    const state = emptyCity();
    for (let x = 0; x < 20; x++) road(state, x, 2);
    house(state, 1, 3);
    house(state, 2, 3, { powered: false });
    house(state, 3, 3, { watered: false });
    house(state, 4, 3, { abandoned: true, population: 0 });
    house(state, 5, 3, { onFire: true, fireProgress: 30 });
    house(state, 20, 20); // far from any road
    house(state, 18, 3, { type: 'apartment_low', powered: false });
    state.stats.power!.cut = [1];
    state.outbreaks = [startOutbreak(0, 0)];
    const roadAccess = computeRoadAccessMask(state.grid, SIZE);
    const icons = computeProblemIconsForState(state, roadAccess);
    expect(icons.tiles.length).toBeGreaterThan(4);
    for (let n = 0; n < icons.tiles.length; n++) {
      const i = icons.tiles[n];
      const kind = PROBLEM_KINDS[icons.kinds[n]];
      const x = i % SIZE;
      const y = (i / SIZE) | 0;
      const withMask = getTileStatusesForState(state, x, y, roadAccess);
      const withoutMask = getTileStatusesForState(state, x, y);
      expect(withMask.map((s) => s.kind)).toEqual(withoutMask.map((s) => s.kind));
      expect(withMask.some((s) => s.kind === kind), `${x},${y} ${kind}`).toBe(true);
    }
    // The infected block's badge is explained on its tiles, even empty ones with no icon of their own
    expect(getTileStatusesForState(state, 1, 3).some((s) => s.kind === 'disease')).toBe(true);
    expect(getTileStatusesForState(state, 18, 3)[0].kind).toBe('power_cut');
  });
});

describe('icon placement', () => {
  it('a badge sits over its own footprint, so clicking it selects that building', () => {
    for (let w = 1; w <= 4; w++) {
      for (let h = 1; h <= 4; h++) {
        const { wx, wy } = getProblemIconAnchor(10, 7, w, h);
        // The select tool's ground pick (zoom 1, no offset); probe the badge centre and a few points around it
        for (const [dx, dy] of [[0, 0], [-4, 0], [4, 0], [0, -4], [0, 4]]) {
          const { gridX, gridY } = screenToGrid(wx + dx, wy + dy, 0, 0);
          expect(gridX, `${w}x${h} ${dx},${dy}`).toBeGreaterThanOrEqual(10);
          expect(gridX).toBeLessThan(10 + w);
          expect(gridY, `${w}x${h} ${dx},${dy}`).toBeGreaterThanOrEqual(7);
          expect(gridY).toBeLessThan(7 + h);
        }
      }
    }
  });
});

describe('hasTileRoadAccess', () => {
  it('agrees with computeRoadAccessMask on random maps', () => {
    const rng = createRng(11);
    const zones: Tile['zone'][] = ['none', 'residential', 'commercial', 'industrial'];
    for (let trial = 0; trial < 20; trial++) {
      const state = emptyCity();
      for (const row of state.grid) for (const t of row) {
        const r = rng();
        t.zone = zones[Math.floor(rng() * (r < 0.3 ? 1 : 4))];
        if (r < 0.08) t.building = { ...t.building, type: 'road' };
        else if (r < 0.1) t.building = { ...t.building, type: 'water' };
        else if (r < 0.11) t.building = { ...t.building, type: 'bridge' };
      }
      const mask = computeRoadAccessMask(state.grid, SIZE);
      for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
        expect(hasTileRoadAccess(state.grid, SIZE, x, y), `${trial}:${x},${y}`).toBe(mask[y * SIZE + x] === 1);
      }
    }
  });
});

describe('abandoned buildings', () => {
  const abandonedHome = () => makeTile('apartment_low', 'residential', { abandoned: true });
  const input = (tile: Tile): ProblemTileInput => ({ tile, flooded: false, infected: false, hasRoadAccess: true, powerCut: false });
  const abandonedOf = (ctx: TileStatusContext) => getTileStatuses(ctx).find((s) => s.kind === 'abandoned')!;

  it('blames oversupply when the zone demand is below the abandonment line', () => {
    const s = abandonedOf(ctxFor(input(abandonedHome()), { demand: { residential: -45, commercial: 0, industrial: 0 } }));
    expect(text(s.cause)).toContain('Residential demand is -45');
    expect(text(s.fix)).toContain('above +10');
    expect(s.notes.map(text).join(' ')).toMatch(/jobs/);
  });

  it('blames a long outage for non-starter buildings', () => {
    const tile = makeTile('apartment_low', 'residential', { abandoned: true, unservedDays: 45 });
    const s = abandonedOf(ctxFor(input(tile)));
    expect(text(s.cause)).toContain('45 days');
  });

  it('blames the exodus first and says homes are not rebuilt during it', () => {
    const s = abandonedOf(ctxFor(input(abandonedHome()), { exodusActive: true, demand: { residential: 40, commercial: 0, industrial: 0 } }));
    expect(text(s.cause)).toMatch(/leaving/);
    expect(text(s.fix)).toMatch(/happiness/i);
  });

  it('says it clears by itself when demand is already high', () => {
    const s = abandonedOf(ctxFor(input(abandonedHome()), { demand: { residential: 30, commercial: 0, industrial: 0 } }));
    expect(text(s.fix)).toMatch(/cleared and rebuilt by itself soon/);
  });

  it('says an abandoned informal settlement does not clear by itself', () => {
    const tile = makeTile('informal_housing', 'none', { abandoned: true });
    const s = abandonedOf(ctxFor(input(tile), { demand: { residential: 50, commercial: 0, industrial: 0 } }));
    expect(text(s.fix)).toMatch(/does not clear by itself/);
  });
});

describe('statuses without icons', () => {
  const base = (tile: Tile, extra: Partial<TileStatusContext> = {}) =>
    getTileStatuses(ctxFor({ tile, flooded: false, infected: false, hasRoadAccess: true, powerCut: false }, extra));

  it('construction stalls on missing utilities (not for starters)', () => {
    const stalled = base(makeTile('apartment_low', 'residential', { constructionProgress: 40, powered: false }));
    expect(stalled.find((s) => s.kind === 'under_construction')?.severity).toBe('warning');
    const starter = base(makeTile('house_small', 'residential', { constructionProgress: 40, powered: false }));
    expect(starter.find((s) => s.kind === 'under_construction')?.severity).toBe('info');
  });

  it('an empty lot explains low demand', () => {
    const s = base(makeTile('grass', 'commercial'), { demand: { residential: 0, commercial: -40, industrial: 0 } });
    expect(s.map((x) => x.kind)).toEqual(['empty_lot']);
    expect(text(s[0].cause)).toContain('-40');
  });

  it('burnt lots, informal settlements, old buildings, flood zone and pollution', () => {
    expect(base(makeTile('grass', 'residential', { fireProgress: 30 })).map((s) => s.kind)).toContain('scorched');
    expect(base(makeTile('informal_housing', 'none')).map((s) => s.kind)).toContain('informal');
    expect(base(makeTile('house_small', 'residential', { age: 200_000 })).map((s) => s.kind)).toContain('collapse_risk');
    expect(base(makeTile('house_small', 'residential'), { floodRisk: 2 }).map((s) => s.kind)).toContain('flood_risk');
    expect(base({ ...makeTile('house_small', 'residential'), pollution: 80 } as Tile).map((s) => s.kind)).toContain('pollution');
    expect(base(makeTile('house_small', 'residential', { population: 5 }), { exodusActive: true }).map((s) => s.kind)).toContain('exodus');
    expect(base(makeTile('house_small', 'residential'))).toEqual([]);
  });

  it('a flood explains the outage instead of listing separate power and water problems', () => {
    const tile = makeTile('apartment_low', 'residential', { powered: false, watered: false });
    const s = getTileStatuses(ctxFor({ tile, flooded: true, infected: false, hasRoadAccess: true, powerCut: false }));
    expect(s.map((x) => x.kind)).toEqual(['flood']);
  });
});

describe('SIM_RULES mirror simulation.ts', () => {
  // simulation.ts keeps these as literals; fail loudly when one changes so the explanations follow.
  const src = readFileSync(join(__dirname, '..', 'simulation.ts'), 'utf8');
  it('abandonment, clearing and growth thresholds', () => {
    expect(src).toContain(`zoneDemandValue < ${SIM_RULES.abandonBelowDemand} && building.age > ${SIM_RULES.abandonMinAge}`);
    expect(src).toContain(`zoneDemandValue > ${SIM_RULES.clearAboveDemand} &&`);
    expect(src).toContain(`const UNSERVED_ABANDON_DAYS = ${SIM_RULES.unservedAbandonDays};`);
    const span = SIM_RULES.fullGrowthAtDemand - SIM_RULES.noGrowthAtDemand;
    expect(src).toContain(`(zoneDemandForSpawn + ${-SIM_RULES.noGrowthAtDemand}) / ${span}`);
    expect(src).toContain(`if (buildingType === 'house_small' || buildingType === 'shop_small') return true;`);
  });
});
