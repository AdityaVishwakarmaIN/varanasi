import { describe, expect, it } from 'vitest';
import { createRng } from '@/lib/rng';
import { startOutbreak } from '@/lib/disease';
import {
  computeProblemIcons,
  computeProblemIconsForState,
  computeRoadAccessMask,
  isBuildingLevelZoom,
  pickTileProblem,
  PROBLEM_KINDS,
} from '@/lib/problemIcons';
import { deriveAdvisorNotes } from '@/lib/advisorFeed';
import { ADVISOR_CONFIG, countUrgentAdvisorMessages } from '@/lib/advisors';
import {
  CITIZEN_FEED_CONFIG,
  getActiveVoiceConditions,
  isFeedDue,
  nextCitizenFeedEntry,
  pushFeedEntry,
  type CitizenFeedEntry,
} from '@/lib/citizenFeed';
import { CITIZEN_VOICES } from '@/lib/citizenVoices';
import { SYSTEM_TIP_CHECKS } from '@/lib/systemTips';
import { absoluteDay } from '@/lib/seasons';
import { emptyCity, house, road, SIZE } from './feedbackLayers.helpers';

describe('problem icons (S5-T5)', () => {
  it('orders kinds fire > flood > disease > no road > power > water > abandoned', () => {
    expect(PROBLEM_KINDS).toEqual(['fire', 'flood', 'disease', 'no_road', 'power_cut', 'no_power', 'no_water', 'abandoned']);
  });

  it('picks the single highest-priority problem per building', () => {
    const state = emptyCity();
    const tile = house(state, 3, 3, { onFire: true, powered: false, watered: false, abandoned: true });
    const base = { tile, flooded: true, infected: true, hasRoadAccess: false, powerCut: false };
    expect(pickTileProblem(base)).toBe('fire');
    tile.building.onFire = false;
    expect(pickTileProblem(base)).toBe('flood');
    expect(pickTileProblem({ ...base, flooded: false })).toBe('disease');
    expect(pickTileProblem({ ...base, flooded: false, infected: false })).toBe('no_road');
    tile.building.abandoned = false;
    const roaded = { ...base, flooded: false, infected: false, hasRoadAccess: true };
    expect(pickTileProblem(roaded)).toBe('no_power');
    expect(pickTileProblem({ ...roaded, powerCut: true })).toBe('power_cut');
    tile.building.powered = true;
    expect(pickTileProblem(roaded)).toBe('no_water');
    tile.building.watered = true;
    expect(pickTileProblem(roaded)).toBeNull();
    tile.building.abandoned = true;
    expect(pickTileProblem(roaded)).toBe('abandoned');
  });

  it('finds road access through a zone, and flags lots far from roads', () => {
    const state = emptyCity();
    road(state, 0, 5);
    house(state, 1, 5);
    house(state, 2, 5);
    house(state, 20, 20);
    const mask = computeRoadAccessMask(state.grid, SIZE);
    expect(mask[5 * SIZE + 1]).toBe(1);
    expect(mask[5 * SIZE + 2]).toBe(1);
    expect(mask[20 * SIZE + 20]).toBe(0);
    const set = computeProblemIconsForState(state);
    expect(set.counts.no_road).toBe(1);
    expect(set.first.no_road).toEqual({ x: 20, y: 20 });
  });

  it('shows the most common problem per 16x16 district, and infected blocks as disease', () => {
    const state = emptyCity();
    for (let x = 1; x <= 3; x++) house(state, x, 1, { powered: false });
    house(state, 4, 1, { watered: false });
    const noRoads = new Uint8Array(SIZE * SIZE).fill(1);
    const set = computeProblemIcons({
      grid: state.grid, size: SIZE, floodMask: null, outbreakMask: null,
      powerCutFeeders: new Set(), roadAccess: noRoads, infectedBlocks: [3],
    });
    expect(set.tiles.length).toBe(4);
    const d0 = set.districts.find((d) => d.feeder === 0);
    expect(d0?.kind).toBe('no_power');
    expect(d0?.count).toBe(3);
    expect(set.districts.find((d) => d.feeder === 3)?.kind).toBe('disease');
    expect(set.infectedBlocks).toEqual([3]);
  });

  it('switches to district icons below zoom 0.6', () => {
    expect(isBuildingLevelZoom(0.59)).toBe(false);
    expect(isBuildingLevelZoom(0.6)).toBe(true);
  });
});

describe('named advisors (S5-T6)', () => {
  const kinds = (state: ReturnType<typeof emptyCity>) =>
    deriveAdvisorNotes(state, computeProblemIconsForState(state)).map((n) => `${n.advisor}:${n.kind}`);

  it('routes each system to the right advisor', () => {
    const state = emptyCity();
    state.stats.population = 100;
    state.stats.money = -500;
    state.stats.power = { supply: 50, demand: 100, ratio: 0.5, feeders: [0, 1], cut: [0] };
    state.outbreaks = [startOutbreak(3, absoluteDay(state.year, state.month, state.day))];
    road(state, 0, 1);
    house(state, 1, 1, { onFire: true });
    const k = kinds(state);
    expect(k).toContain('treasury:debt');
    expect(k).toContain('engineer:power_shortage');
    expect(k).toContain('health:outbreak');
    expect(k).toContain('police:fire');
  });

  it('gives "Show me" a place and overlay, sorts by priority and caps each advisor', () => {
    const state = emptyCity();
    state.stats.population = 100;
    state.stats.power = { supply: 50, demand: 100, ratio: 0.5, feeders: [0], cut: [0] };
    state.stats.water = { supply: 50, demand: 100, ratio: 0.5, feeders: [0], cut: [] };
    road(state, 0, 1);
    house(state, 1, 1, { powered: false });
    house(state, 2, 1, { watered: false });
    house(state, 20, 20);
    house(state, 21, 20, { abandoned: true });
    const notes = deriveAdvisorNotes(state, computeProblemIconsForState(state));
    const power = notes.find((n) => n.kind === 'power_shortage');
    expect(power?.overlay).toBe('power');
    expect(power?.x).toBe(1);
    expect(notes.filter((n) => n.advisor === 'engineer').length).toBeLessThanOrEqual(ADVISOR_CONFIG.maxPerAdvisor);
    const rank = { critical: 0, high: 1, medium: 2, low: 3 } as const;
    for (let i = 1; i < notes.length; i++) expect(rank[notes[i].priority]).toBeGreaterThanOrEqual(rank[notes[i - 1].priority]);
    expect(countUrgentAdvisorMessages(notes)).toBeGreaterThan(0);
  });

  it('stays quiet in a healthy city', () => {
    expect(deriveAdvisorNotes(emptyCity(), null)).toEqual([]);
  });
});

describe('citizen feed (S5-T7)', () => {
  it('has at least 30 templates, a third of them positive', () => {
    expect(CITIZEN_VOICES.length).toBeGreaterThanOrEqual(30);
    expect(CITIZEN_VOICES.filter((v) => v.positive).length * 3).toBeGreaterThanOrEqual(CITIZEN_VOICES.length);
  });

  it('reflects rolling cuts, with the cut block as the place', () => {
    const state = emptyCity();
    state.stats.population = 50;
    state.stats.power = { supply: 50, demand: 100, ratio: 0.5, feeders: [0, 3], cut: [3] };
    const active = getActiveVoiceConditions(state, null);
    const cut = active.find((a) => a.condition === 'power_cut');
    expect(cut).toEqual({ condition: 'power_cut', x: 23, y: 23 });
    expect(active.some((a) => a.condition === 'power_ok')).toBe(false);
  });

  it('posts at most one message per in-game week', () => {
    expect(isFeedDue(undefined, 10)).toBe(true);
    expect(isFeedDue(10, 16)).toBe(false);
    expect(isFeedDue(10, 17)).toBe(true);

    const state = emptyCity();
    state.mapId = 'varanasi';
    state.stats.population = 50;
    const first = nextCitizenFeedEntry([], state, null, createRng(1));
    expect(first).not.toBeNull();
    expect(first!.text).not.toMatch(/\{name\}|\{area\}/);
    const entries: CitizenFeedEntry[] = [first!];
    expect(nextCitizenFeedEntry(entries, state, null, createRng(2))).toBeNull();
  });

  it('keeps a bounded feed, newest first', () => {
    let entries: CitizenFeedEntry[] = [];
    for (let d = 0; d < 20; d++) entries = pushFeedEntry(entries, { id: `e${d}`, day: d * 7, voiceId: 'v', text: 't', positive: true });
    expect(entries.length).toBe(CITIZEN_FEED_CONFIG.maxEntries);
    expect(entries[0].id).toBe('e19');
  });
});

describe('system tips (S5-T8)', () => {
  it('fires each system tip on its condition', () => {
    const state = emptyCity();
    const off = Object.entries(SYSTEM_TIP_CHECKS).filter(([, check]) => check(state)).map(([id]) => id);
    expect(off).toEqual([]);

    state.stats.population = 50;
    state.stats.power = { supply: 50, demand: 100, ratio: 0.5, feeders: [0], cut: [0] };
    state.stats.water = { supply: 50, demand: 100, ratio: 0.5, feeders: [0], cut: [] };
    state.stats.money = -1;
    state.outbreaks = [startOutbreak(0, 0)];
    state.grid[2][2].building = { ...state.grid[2][2].building, type: 'informal_housing' };
    state.mapId = 'varanasi';
    state.forecasts = [{ id: 'monsoon', day: absoluteDay(state.year, state.month, state.day) + 10, title: 'Monsoon', kind: 'crisis' } as never];
    const today = absoluteDay(state.year, state.month, state.day);
    state.heatwave = { startDay: today + 3, endDay: today + 8 };
    for (const id of ['first_power_cut', 'first_water_shortage', 'debt_warning', 'first_outbreak', 'first_informal_settlement', 'monsoon_forecast', 'first_heatwave'] as const) {
      expect(SYSTEM_TIP_CHECKS[id](state)).toBe(true);
    }
  });

  it('holds crisis tips back when disasters are off', () => {
    const state = emptyCity();
    state.disastersEnabled = false;
    state.outbreaks = [startOutbreak(0, 0)];
    expect(SYSTEM_TIP_CHECKS.first_outbreak(state)).toBe(false);
  });
});
