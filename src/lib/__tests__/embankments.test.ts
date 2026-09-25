import { describe, expect, it } from 'vitest';
import { createRng } from '@/lib/rng';
import { createInitialGameState, placeBuilding } from '@/lib/simulation';
import { getPlacementCheck, PLACEMENT_REASONS } from '@/lib/placement';
import { countFlooded, FLOOD_CONFIG } from '@/lib/floods';
import { getCityEmbankments, getCityFloodMask, getEffectiveLandValue } from '@/lib/floodSim';
import { getRiverZoneArrays } from '@/games/isocity/maps/riverZones';
import { getVaranasiLayout, LAYOUT_WATER } from '@/games/isocity/maps/varanasiLayout';
import { TOOL_INFO, type GameState } from '@/types/game';
import { getToolDisplay, isToolVisible, RIVERFRONT_TOOLS } from '@/games/isocity/maps/varanasiCatalog';

const SIZE = 60;

function newVaranasi(): GameState {
  const state = createInitialGameState(SIZE, 'Embankments', createRng(7), 'varanasi');
  state.stats.money = 1_000_000;
  return state;
}

function isLand(x: number, y: number): boolean {
  return getVaranasiLayout(SIZE).water[y * SIZE + x] === LAYOUT_WATER.none;
}

/** Grass land tiles at exactly this distance from the Ganga. */
function grassAtDistance(state: GameState, d: number): { x: number; y: number }[] {
  const { distance } = getRiverZoneArrays(SIZE);
  const out: { x: number; y: number }[] = [];
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (isLand(x, y) && distance[y * SIZE + x] === d && state.grid[y][x].building.type === 'grass') out.push({ x, y });
    }
  }
  return out;
}

describe('embankment tool (S4-T6)', () => {
  it('is a Varanasi-only riverfront tool costing ₹300', () => {
    expect(TOOL_INFO.embankment.cost).toBe(FLOOD_CONFIG.embankmentCost);
    expect(RIVERFRONT_TOOLS).toContain('embankment');
    expect(isToolVisible('embankment', 'varanasi')).toBe(true);
    expect(isToolVisible('embankment', undefined)).toBe(false);
    expect(getToolDisplay('embankment', TOOL_INFO.embankment, 'varanasi').name).toBe('Embankment (Tatbandh)');
  });
});

describe('embankment placement', () => {
  it('is allowed on grass within 4 tiles of the Ganga', () => {
    const state = newVaranasi();
    const site = grassAtDistance(state, 2)[0];
    expect(getPlacementCheck(state, 'embankment', site.x, site.y).ok).toBe(true);
    const next = placeBuilding(state, site.x, site.y, 'embankment', null);
    expect(next.grid[site.y][site.x].building.type).toBe('embankment');
    expect(next.grid[site.y][site.x].building.constructionProgress).toBe(100);
  });

  it('is blocked far from the river, on water, on ghats and off Varanasi', () => {
    const state = newVaranasi();
    const far = grassAtDistance(state, FLOOD_CONFIG.embankmentMaxDistanceToGanga + 3)[0];
    expect(getPlacementCheck(state, 'embankment', far.x, far.y)).toMatchObject({ ok: false, reason: PLACEMENT_REASONS.embankmentNearGanga });

    const site = grassAtDistance(state, 1)[0];
    state.grid[site.y][site.x].building = { ...state.grid[site.y][site.x].building, type: 'ghat' };
    expect(getPlacementCheck(state, 'embankment', site.x, site.y)).toMatchObject({ ok: false, reason: PLACEMENT_REASONS.embankmentOnGhat });

    let water: { x: number; y: number } | null = null;
    for (let i = 0; i < SIZE * SIZE && !water; i++) if (state.grid[(i / SIZE) | 0][i % SIZE].building.type === 'water') water = { x: i % SIZE, y: (i / SIZE) | 0 };
    expect(getPlacementCheck(state, 'embankment', water!.x, water!.y).ok).toBe(false);

    const random = createInitialGameState(SIZE, 'Random', createRng(7));
    random.stats.money = 1_000_000;
    let grass: { x: number; y: number } | null = null;
    for (let i = 0; i < SIZE * SIZE && !grass; i++) if (random.grid[(i / SIZE) | 0][i % SIZE].building.type === 'grass') grass = { x: i % SIZE, y: (i / SIZE) | 0 };
    expect(placeBuilding(random, grass!.x, grass!.y, 'embankment', null)).toBe(random);
  });
});

describe('embankment land value penalty', () => {
  it('lowers land value by 10 within 2 tiles, without stacking', () => {
    let state = newVaranasi();
    const sites = grassAtDistance(state, 3);
    const e = sites[0];
    const near = { x: e.x, y: e.y + 2 < SIZE ? e.y + 2 : e.y - 2 };
    const far = { x: e.x, y: e.y + 5 < SIZE ? e.y + 5 : e.y - 5 };
    const before = { near: getEffectiveLandValue(state.grid, SIZE, near.x, near.y), far: getEffectiveLandValue(state.grid, SIZE, far.x, far.y) };
    expect(before.near).toBe(state.grid[near.y][near.x].landValue);

    state = placeBuilding(state, e.x, e.y, 'embankment', null);
    expect(getEffectiveLandValue(state.grid, SIZE, near.x, near.y)).toBe(before.near + FLOOD_CONFIG.embankmentLandValuePenalty);
    expect(getEffectiveLandValue(state.grid, SIZE, far.x, far.y)).toBe(before.far);

    // A second embankment next to the first does not double the penalty
    const e2 = { x: e.x, y: near.y > e.y ? e.y + 1 : e.y - 1 };
    state.grid[e2.y][e2.x].building = { ...state.grid[e2.y][e2.x].building, type: 'embankment' };
    expect(getEffectiveLandValue(state.grid, SIZE, near.x, near.y)).toBe(before.near + FLOOD_CONFIG.embankmentLandValuePenalty);
  });
});

describe('embankments shrink the flood mask on the real grid', () => {
  it('a line of embankments floods fewer tiles at every river level', () => {
    const plain = newVaranasi();
    const baseline = [1, 2, 3].map((level) => countFlooded(getCityFloodMask({ ...plain, riverLevel: level })!));

    let state = newVaranasi();
    state = { ...state, id: `${state.id}-emb` };
    const line = grassAtDistance(state, 1);
    for (const { x, y } of line) state = placeBuilding(state, x, y, 'embankment', null);
    expect(getCityEmbankments(state).length).toBe(line.length);
    expect(line.length).toBeGreaterThan(10);

    const withEmb = [1, 2, 3].map((level) => countFlooded(getCityFloodMask({ ...state, riverLevel: level })!));
    for (let i = 0; i < 3; i++) expect(withEmb[i]).toBeLessThanOrEqual(baseline[i]);
    expect(withEmb[1]).toBeLessThan(baseline[1]);
    expect(withEmb[2]).toBeLessThan(baseline[2]);
  });
});
