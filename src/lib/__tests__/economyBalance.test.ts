import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  calculateGhatIncome, calculateTourismIncome, GHAT_UPKEEP_MONTHLY, visitorPoolCapacity, visitorPoolFactor,
} from '@/lib/tourism';
import { getLandmarkBonuses, LANDMARKS, LANDMARK_IDS } from '@/lib/landmarks';
import { BUILDING_UPKEEP, getBuildingUpkeep } from '@/lib/upkeep';
import { calculateBaseIndustrialDemand, simulateTick } from '@/lib/simulation';
import { localizeExampleState } from '@/lib/exampleCity';
import { INDUSTRIAL_BUILDINGS } from '@/games/isocity/types/buildings';
import { TOOL_INFO, type Tile } from '@/games/isocity/types/game';
import type { GameState } from '@/types/game';

/** "Healthy river" for the balance targets. */
const HEALTHY = 80;
const GHAT_COST = TOOL_INFO.ghat.cost;
/** The smallest share of its income a ghat keeps however crowded the riverfront gets. */
const TOURISM_MIN_POOL = visitorPoolFactor(1e9, { population: 0, landmarkCount: 0 });
/** A good ghat: road behind it, a bazaar street (7 shops) and three neighbouring ghats. */
const goodGhat = (gangaHealth: number) =>
  calculateGhatIncome({ gangaHealth, hasRoadAccess: true, commercialTilesNearby: 7, otherGhatsNearby: 3 });

const tile = (type: string, zone = 'none', population = 0, jobs = 0) =>
  ({ zone, building: { type, population, jobs } }) as unknown as Tile;

/** Grass with a road (row 8) and a bazaar street (row 7) behind the riverfront row 10, where the ghats go. */
function riverfrontGrid(size = 40): Tile[][] {
  const grid: Tile[][] = Array.from({ length: size }, () => Array.from({ length: size }, () => tile('grass')));
  for (let x = 0; x < size; x++) {
    grid[8][x] = tile('road');
    grid[7][x] = tile('shop_small', 'commercial', 10, 10);
  }
  return grid;
}

describe('ghat economics', () => {
  it('a good ghat on a healthy Ganga pays back in 3–5 years', () => {
    const payback = GHAT_COST / (goodGhat(HEALTHY) - GHAT_UPKEEP_MONTHLY);
    expect(payback).toBeGreaterThanOrEqual(36);
    expect(payback).toBeLessThanOrEqual(60);
  });

  it('per-ghat income falls once ghats outnumber the visitor pool, but total never drops', () => {
    const pool = { population: 2000, landmarkCount: 0 };
    const cap = visitorPoolCapacity(pool);
    expect(cap).toBe(9);
    expect(visitorPoolFactor(9, pool)).toBe(1);
    expect(visitorPoolFactor(18, pool)).toBeLessThan(1);
    expect(visitorPoolFactor(18, pool)).toBeCloseTo(0.5);
    expect(visitorPoolFactor(1000, pool)).toBe(0.4);

    const grid = riverfrontGrid();
    const ghatsAt = (n: number) => Array.from({ length: n }, (_, i) => ({ x: i, y: 10 }));
    const perGhat = (n: number) => calculateTourismIncome(grid, 40, ghatsAt(n), HEALTHY, 1, pool) / n;
    const total = (n: number) => calculateTourismIncome(grid, 40, ghatsAt(n), HEALTHY, 1, pool);
    expect(perGhat(36)).toBeLessThan(perGhat(9) * 0.7);
    expect(total(36)).toBeGreaterThanOrEqual(total(18));
    // Spamming: just past the pool an extra ghat only splits the same crowd, so it cannot cover its own upkeep...
    expect(total(15) - total(14)).toBeLessThan(GHAT_UPKEEP_MONTHLY);
    // ...and far past it a good ghat takes well over 5 years to pay back
    const marginal = total(37) - total(36) - GHAT_UPKEEP_MONTHLY;
    expect(GHAT_COST / marginal).toBeGreaterThan(60);
    // A bigger city or a landmark widens the pool
    expect(visitorPoolCapacity({ population: 10_000, landmarkCount: 1 })).toBeGreaterThan(cap + 20);
  });

  it('a road-side ghat never runs at a loss on a healthy river, however many there are', () => {
    for (const health of [70, 80, 100]) {
      const plain = calculateGhatIncome({ gangaHealth: health, hasRoadAccess: true, commercialTilesNearby: 0, otherGhatsNearby: 0 });
      expect(plain * TOURISM_MIN_POOL - GHAT_UPKEEP_MONTHLY).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('landmark economics', () => {
  /** Monthly net of one landmark sitting on the riverfront grid (its own ghats included), on a healthy Ganga. */
  function landmarkNet(id: (typeof LANDMARK_IDS)[number]): number {
    const fx = getLandmarkBonuses([{ id, x: 20, y: 10 }], HEALTHY);
    const ghatPart = calculateTourismIncome(riverfrontGrid(), 40, [], HEALTHY, 1, undefined, fx.extraGhats);
    return fx.tourismIncome + ghatPart - LANDMARKS[id].upkeepMonthly;
  }

  it('tourism landmarks pay back in 2–4 years and clearly beat a few ghats', () => {
    const fourGoodGhats = 4 * (goodGhat(HEALTHY) - GHAT_UPKEEP_MONTHLY);
    for (const id of LANDMARK_IDS) {
      if (id === 'landmark_bhu') continue; // education landmark: no tourism
      const net = landmarkNet(id);
      const payback = LANDMARKS[id].cost / net;
      expect(payback, id).toBeGreaterThanOrEqual(24);
      expect(payback, id).toBeLessThanOrEqual(48);
      expect(net, id).toBeGreaterThan(fourGoodGhats * 1.5);
    }
  });

  it('costs rise with the unlock order and match the build menu', () => {
    for (let i = 1; i < LANDMARK_IDS.length; i++) {
      expect(LANDMARKS[LANDMARK_IDS[i]].cost).toBeGreaterThan(LANDMARKS[LANDMARK_IDS[i - 1]].cost);
    }
    for (const id of LANDMARK_IDS) expect(TOOL_INFO[id].cost).toBe(LANDMARKS[id].cost);
  });
});

describe('upkeep and demand', () => {
  it('recreation, attractions, stations, bridges, ghats and landmarks all have upkeep', () => {
    const types = [
      'park', 'park_large', 'tennis', 'playground_small', 'football_field', 'baseball_stadium', 'amphitheater',
      'roller_coaster_small', 'stadium', 'museum', 'amusement_park', 'city_hall', 'airport', 'rail_station', 'bridge',
      'ghat', ...LANDMARK_IDS,
    ] as const;
    for (const t of types) expect(getBuildingUpkeep(t)?.monthly ?? 0, t).toBeGreaterThan(0);
    // Small parks cost less than big venues
    expect(BUILDING_UPKEEP.park!.monthly).toBeLessThan(BUILDING_UPKEEP.stadium!.monthly);
  });

  it('the example city stays solvent at default taxes', () => {
    const raw = JSON.parse(readFileSync(join(process.cwd(), 'public/example-states/example_state_9.json'), 'utf8')) as GameState;
    const s = simulateTick(localizeExampleState(raw), 'clear', () => 0.5);
    expect(s.budget.parks.cost).toBeGreaterThan(0);
    expect(s.stats.income - s.stats.expenses).toBeGreaterThan(0);
  });

  it('industrial demand follows jobs vs workers and commercial supply', () => {
    // Idle workers and shops with no suppliers: strong demand
    expect(calculateBaseIndustrialDemand(10_000, 3000, 3000, 0)).toBeGreaterThan(60);
    // More jobs than workers and industry already over-supplying commerce: negative
    expect(calculateBaseIndustrialDemand(10_000, 9000, 3000, 6000)).toBeLessThan(-30);
    // Balanced city sits near zero
    expect(Math.abs(calculateBaseIndustrialDemand(10_000, 7000, 4000, 2400))).toBeLessThan(5);
  });

  it('industrial building list has no duplicates', () => {
    expect(new Set(INDUSTRIAL_BUILDINGS).size).toBe(INDUSTRIAL_BUILDINGS.length);
  });
});
