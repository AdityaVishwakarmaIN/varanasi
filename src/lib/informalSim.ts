/**
 * Informal settlements in the running game (S3-T9): the grid side of the pure rules in `informal.ts`.
 *
 * - Once per in-game week, when housing is short, up to 3 settlements appear on free grass near jobs and roads.
 * - Once per in-game day, a settlement the player has zoned residential and given road access, power and water
 *   counts a day toward formalisation; after 30 days in a row it becomes a small house.
 * - Bulldozing one displaces families: a city-wide happiness penalty for 60 days.
 *
 * Everything here is deterministic given Math.random (the simulation's random source).
 */
import type { BuildingType } from '@/games/isocity/types/buildings';
import type { GameState, InformalState, Notification, Tile } from '@/games/isocity/types/game';
import type { MapId } from '@/games/isocity/maps/varanasi';
import { getRiverZone } from '@/games/isocity/maps/riverZones';
import { getFeederColumns, getFeederIndex } from '@/lib/feederZones';
import { getMohallaForFeeder } from '@/lib/citizenVoices';
import {
  INFORMAL_CONFIG,
  advanceFormalisation,
  formatFormalisedMessage,
  isFormalisationSatisfied,
  pickInformalSpawnTiles,
  shouldSpawnInformal,
  type InformalCandidate,
} from '@/lib/informal';

export const INFORMAL_BUILDING: BuildingType = 'informal_housing';
export type { InformalState };

export const EMPTY_INFORMAL_STATE: InformalState = Object.freeze({
  bulldozedDay: Object.freeze({}) as Record<string, number>,
  formaliseDays: Object.freeze({}) as Record<string, number>,
}) as InformalState;

/** Days since the start of year 0 (30-day months, as in simulateTick). */
export function getAbsoluteDay(t: { year: number; month: number; day: number }): number {
  return (t.year * 12 + (t.month - 1)) * 30 + (t.day - 1);
}

/** Neighbourhood name for messages: the mohalla on Varanasi, otherwise a neutral phrase. */
export function getInformalAreaName(x: number, y: number, size: number, mapId: MapId | undefined): string {
  if (mapId !== 'varanasi') return 'your city';
  const cols = getFeederColumns(size);
  return getMohallaForFeeder(getFeederIndex(x, y, size), cols * cols);
}

/** City-wide happiness change from recent displacements and formalisations. */
export function getInformalHappinessModifier(informal: InformalState | undefined, today: number): number {
  if (!informal) return 0;
  let delta = 0;
  if (informal.displacedUntilDay !== undefined && today < informal.displacedUntilDay) {
    delta -= INFORMAL_CONFIG.displacement.happinessPenalty;
  }
  if (informal.formalisedUntilDay !== undefined && today < informal.formalisedUntilDay) {
    delta += INFORMAL_CONFIG.formaliseHappinessBonus;
  }
  return delta;
}

/** Residents of a new settlement ("same as house_medium"). */
export const INFORMAL_RESIDENTS = 14;

/** A new settlement building: built, full, level 1. */
export function createInformalBuilding(base: Tile['building']): Tile['building'] {
  return {
    ...base,
    type: INFORMAL_BUILDING,
    level: 1,
    population: INFORMAL_RESIDENTS,
    jobs: 0,
    constructionProgress: 100,
    abandoned: false,
    onFire: false,
    fireProgress: 0,
    age: 0,
  };
}

function isJobTile(t: Tile): boolean {
  return (t.zone === 'commercial' || t.zone === 'industrial') && t.building.type !== 'grass';
}

function isRoadTile(t: Tile): boolean {
  return t.building.type === 'road' || t.building.type === 'bridge';
}

/** 2D prefix sums of a tile predicate, for fast "any within radius r" box queries. */
function prefixSums(grid: Tile[][], size: number, pred: (t: Tile) => boolean): Int32Array {
  const w = size + 1;
  const sums = new Int32Array(w * w);
  for (let y = 0; y < size; y++) {
    let rowSum = 0;
    const row = grid[y];
    for (let x = 0; x < size; x++) {
      if (pred(row[x])) rowSum++;
      sums[(y + 1) * w + (x + 1)] = sums[y * w + (x + 1)] + rowSum;
    }
  }
  return sums;
}

function boxCount(sums: Int32Array, size: number, x: number, y: number, r: number): number {
  const w = size + 1;
  const x0 = Math.max(0, x - r);
  const y0 = Math.max(0, y - r);
  const x1 = Math.min(size, x + r + 1);
  const y1 = Math.min(size, y + r + 1);
  return sums[y1 * w + x1] - sums[y0 * w + x1] - sums[y1 * w + x0] + sums[y0 * w + x0];
}

/** Chebyshev distance to the nearest counted tile, up to maxR (Infinity beyond). */
function nearestWithin(sums: Int32Array, size: number, x: number, y: number, maxR: number): number {
  if (boxCount(sums, size, x, y, maxR) === 0) return Infinity;
  for (let r = 0; r <= maxR; r++) if (boxCount(sums, size, x, y, r) > 0) return r;
  return Infinity;
}

/** Every free grass tile that passes the hard rules, with the data pickInformalSpawnTiles scores on. */
export function gatherInformalCandidates(
  grid: Tile[][],
  size: number,
  mapId: MapId | undefined,
  informal: InformalState,
  today: number
): InformalCandidate[] {
  const cfg = INFORMAL_CONFIG;
  const jobs = prefixSums(grid, size, isJobTile);
  const roads = prefixSums(grid, size, isRoadTile);
  const out: InformalCandidate[] = [];
  for (let y = 0; y < size; y++) {
    const row = grid[y];
    for (let x = 0; x < size; x++) {
      const t = row[x];
      if (t.building.type !== 'grass' || t.zone !== 'none') continue;
      const distanceToRoad = nearestWithin(roads, size, x, y, cfg.maxDistanceToRoad);
      if (distanceToRoad === Infinity) continue;
      const distanceToJobs = nearestWithin(jobs, size, x, y, cfg.maxDistanceToJobs);
      if (distanceToJobs === Infinity) continue;
      const bulldozed = informal.bulldozedDay[String(y * size + x)];
      out.push({
        x, y, isGrass: true, isUnzoned: true, distanceToJobs, distanceToRoad,
        daysSinceBulldozed: bulldozed === undefined ? undefined : today - bulldozed,
        riverZone: getRiverZone(x, y, size, mapId),
      });
    }
  }
  return out;
}

/** Residential-zoned tiles still waiting for a building. */
export function countEmptyResidentialTiles(grid: Tile[][], size: number): number {
  let n = 0;
  for (let y = 0; y < size; y++) {
    const row = grid[y];
    for (let x = 0; x < size; x++) if (row[x].zone === 'residential' && row[x].building.type === 'grass') n++;
  }
  return n;
}

export interface InformalDayInput {
  grid: Tile[][];
  size: number;
  mapId: MapId | undefined;
  informal: InformalState | undefined;
  /** Absolute day that just started. */
  today: number;
  /** True on the weekly spawn check. */
  weekly: boolean;
  residentialDemand: number;
  population: number;
  /** Origin indices (y * size + x) of every settlement, from the tick's grid scan. */
  settlements: readonly number[];
  /** Road access as the simulation defines it (for formalisation). */
  hasRoadAccess: (x: number, y: number) => boolean;
  /** Returns a tile that may be written this tick (the simulation's copy-on-write grid). */
  writable: (x: number, y: number) => Tile;
}

export interface InformalDayResult {
  informal: InformalState;
  /** Tiles whose building changed (spawned or formalised). */
  changed: number;
  notifications: Omit<Notification, 'id' | 'timestamp'>[];
}

/** One in-game day of settlement upkeep: formalisation progress, and on weekly days, new settlements. */
export function runInformalDay(input: InformalDayInput): InformalDayResult {
  const { grid, size, today } = input;
  const prev = input.informal ?? EMPTY_INFORMAL_STATE;
  const formaliseDays: Record<string, number> = {};
  const notifications: InformalDayResult['notifications'] = [];
  let formalisedUntilDay = prev.formalisedUntilDay;
  let changed = 0;

  // Formalisation: zoned residential + road + power + water, 30 days in a row
  const formalisedAreas: string[] = [];
  for (const idx of input.settlements) {
    const x = idx % size;
    const y = Math.floor(idx / size);
    const t = grid[y][x];
    if (t.building.type !== INFORMAL_BUILDING) continue;
    const zoned = t.zone === 'residential';
    const satisfied = isFormalisationSatisfied({
      zonedResidential: zoned,
      hasRoadAccess: zoned && input.hasRoadAccess(x, y),
      powered: t.building.powered,
      watered: t.building.watered,
    });
    const step = advanceFormalisation(prev.formaliseDays[String(idx)] ?? 0, satisfied);
    if (step.formalise) {
      const w = input.writable(x, y);
      w.building = {
        ...w.building,
        type: INFORMAL_CONFIG.formalisedBuilding,
        level: 1,
        population: Math.min(w.building.population, 6),
        age: 0,
      };
      changed++;
      formalisedUntilDay = today + INFORMAL_CONFIG.displacement.durationDays;
      formalisedAreas.push(getInformalAreaName(x, y, size, input.mapId));
    } else if (step.days > 0) {
      formaliseDays[String(idx)] = step.days;
    }
  }
  for (const area of new Set(formalisedAreas)) {
    notifications.push({ title: 'Proper homes', description: formatFormalisedMessage(area), icon: 'home' });
  }

  // Bulldoze records only matter for the cooldown
  const bulldozedDay: Record<string, number> = {};
  for (const [k, day] of Object.entries(prev.bulldozedDay)) {
    if (today - day < INFORMAL_CONFIG.bulldozeCooldownDays) bulldozedDay[k] = day;
  }

  const informal: InformalState = { bulldozedDay, formaliseDays };
  if (prev.displacedUntilDay !== undefined && today < prev.displacedUntilDay) informal.displacedUntilDay = prev.displacedUntilDay;
  if (formalisedUntilDay !== undefined && today < formalisedUntilDay) informal.formalisedUntilDay = formalisedUntilDay;

  // Weekly spawn
  if (input.weekly) {
    const short = shouldSpawnInformal({
      residentialDemand: input.residentialDemand,
      population: input.population,
      emptyResidentialTiles: countEmptyResidentialTiles(grid, size),
    });
    if (short) {
      const candidates = gatherInformalCandidates(grid, size, input.mapId, informal, today);
      for (const c of pickInformalSpawnTiles(candidates, Math.random)) {
        const w = input.writable(c.x, c.y);
        w.building = createInformalBuilding(w.building);
        changed++;
      }
    }
  }

  return { informal, changed, notifications };
}

/** Bookkeeping after the player bulldozes (x, y): the spawn cooldown, and displacement if it was a settlement. */
export function recordBulldoze(
  state: GameState,
  x: number,
  y: number,
  wasSettlement: boolean
): Pick<GameState, 'informal' | 'notifications'> {
  const today = getAbsoluteDay(state);
  const prev = state.informal ?? EMPTY_INFORMAL_STATE;
  const key = String(y * state.gridSize + x);
  const formaliseDays = { ...prev.formaliseDays };
  delete formaliseDays[key];
  const informal: InformalState = {
    ...prev,
    bulldozedDay: { ...prev.bulldozedDay, [key]: today },
    formaliseDays,
  };
  if (!wasSettlement) return { informal, notifications: state.notifications };
  informal.displacedUntilDay = today + INFORMAL_CONFIG.displacement.durationDays;
  const notification: Notification = {
    id: `informal-displaced-${today}-${key}`,
    title: 'Families displaced',
    description: INFORMAL_CONFIG.displacement.message,
    icon: 'alert',
    timestamp: Date.now(),
  };
  return { informal, notifications: [notification, ...state.notifications].slice(0, 10) };
}
