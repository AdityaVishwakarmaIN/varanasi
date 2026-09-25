/**
 * Monsoon floods wired into the city (S4-T5). The model (levels, masks, embankments) is in floods.ts; this file
 * reads it for a GameState, and runs the once-a-day flood step used by `simulateTick`.
 *
 * Everything here is Varanasi-only: on other maps every getter returns null and the daily step does nothing.
 */
import type { GameState, Notification, Tile } from '@/types/game';
import type { ServiceCoverage } from '@/games/isocity/types/services';
import type { Rng } from '@/lib/rng';
import type { ForecastInput } from '@/lib/notifications';
import {
  computeFloodMask,
  FLOOD_CONFIG,
  getFloodDamageChance,
  getFloodRiskLevel,
  getMonsoonForecastText,
  getRiverLevel,
  isMonsoonRollDay,
  rollMonsoonStrength,
  type MonsoonStrength,
  type TilePos,
} from '@/lib/floods';

/** Tunables for how floods touch the city (the flood model's own numbers are in FLOOD_CONFIG). */
export const FLOOD_SIM_CONFIG = {
  /** City happiness lost when every resident is flooded (scaled by the flooded share of the population). */
  happinessPenalty: 25,
  /** Building types that don't count as "buildings in flood zones" for the advisor. */
  notCounted: ['grass', 'empty', 'water', 'tree', 'road', 'bridge', 'rail', 'embankment'] as readonly string[],
} as const;

type FloodStateInput = Pick<GameState, 'mapId' | 'gridSize' | 'grid' | 'riverLevel' | 'structureVersion' | 'id'>;

// ---------------------------------------------------------------------------
// Embankments on the grid (placed in S4-T6)
// ---------------------------------------------------------------------------

/** Positions of every embankment tile on the grid. */
export function collectEmbankments(grid: Tile[][], size: number): TilePos[] {
  const out: TilePos[] = [];
  for (let y = 0; y < size; y++) {
    const row = grid[y];
    for (let x = 0; x < size; x++) {
      if (row[x].building.type === 'embankment') out.push({ x, y });
    }
  }
  return out;
}

/**
 * Land value of a tile after the embankment penalty (S4-T6): an embankment blocks the river view, so tiles within
 * `embankmentLandValueRadius` (Euclidean) of one lose `embankmentLandValuePenalty`. Several embankments do not stack.
 * Returns the stored value unchanged when no embankment is near (so cities without embankments are unaffected).
 */
export function getEffectiveLandValue(grid: Tile[][], size: number, x: number, y: number): number {
  const base = grid[y][x].landValue;
  const r = FLOOD_CONFIG.embankmentLandValueRadius;
  for (let ty = Math.max(0, y - r); ty <= Math.min(size - 1, y + r); ty++) {
    const row = grid[ty];
    for (let tx = Math.max(0, x - r); tx <= Math.min(size - 1, x + r); tx++) {
      const dx = tx - x;
      const dy = ty - y;
      if (dx * dx + dy * dy <= r * r && row[tx].building.type === 'embankment') {
        return Math.max(0, base + FLOOD_CONFIG.embankmentLandValuePenalty);
      }
    }
  }
  return base;
}

let embankmentCache: { key: string; list: TilePos[] } | null = null;

/** Embankments of this city, re-scanned only when the structure version (placing or bulldozing) changes. */
export function getCityEmbankments(state: Pick<GameState, 'grid' | 'gridSize' | 'structureVersion' | 'id'>): TilePos[] {
  const key = `${state.id}|${state.gridSize}|${state.structureVersion ?? 0}`;
  if (embankmentCache && embankmentCache.key === key) return embankmentCache.list;
  const list = collectEmbankments(state.grid, state.gridSize);
  embankmentCache = { key, list };
  return list;
}

// ---------------------------------------------------------------------------
// Masks for a state
// ---------------------------------------------------------------------------

/** Tiles under water right now (1 = flooded), or null when nothing floods (other maps, or the river is low). */
export function getCityFloodMask(state: FloodStateInput): Uint8Array | null {
  if (state.mapId !== 'varanasi' || !state.riverLevel) return null;
  return computeFloodMask(state.gridSize, state.riverLevel, getCityEmbankments(state));
}

/** Flood risk per tile for the overlay (lowest river level that floods it; 0 = never), or null off Varanasi. */
export function getCityFloodRisk(state: Omit<FloodStateInput, 'riverLevel'>): Uint8Array | null {
  if (state.mapId !== 'varanasi') return null;
  return getFloodRiskLevel(state.gridSize, getCityEmbankments(state));
}

/**
 * Tiles that flooded earlier this season and are dry again (silt tint for `siltDays`), or null.
 * `today` is the absolute day (seasons.absoluteDay).
 */
export function getCitySiltMask(
  state: FloodStateInput & Pick<GameState, 'siltLevel' | 'siltUntilDay'>,
  today: number
): Uint8Array | null {
  if (state.mapId !== 'varanasi' || !state.siltLevel || state.siltUntilDay === undefined || today > state.siltUntilDay) return null;
  const level = state.riverLevel ?? 0;
  if (level >= state.siltLevel) return null;
  const embankments = getCityEmbankments(state);
  const was = computeFloodMask(state.gridSize, state.siltLevel, embankments);
  const now = computeFloodMask(state.gridSize, level, embankments);
  const key = `${state.gridSize}|${state.siltLevel}|${level}`;
  const cached = siltCache.get(was);
  if (cached && cached.key === key && cached.now === now) return cached.mask;
  const mask = new Uint8Array(was.length);
  for (let i = 0; i < was.length; i++) mask[i] = was[i] & (now[i] ^ 1);
  siltCache.set(was, { key, now, mask });
  return mask;
}
const siltCache = new WeakMap<Uint8Array, { key: string; now: Uint8Array; mask: Uint8Array }>();

const floodedIndexCache = new WeakMap<Uint8Array, Int32Array>();

/** Indices of the flooded tiles in a mask (cached per mask). */
export function getFloodedIndices(mask: Uint8Array): Int32Array {
  const cached = floodedIndexCache.get(mask);
  if (cached) return cached;
  let n = 0;
  for (let i = 0; i < mask.length; i++) n += mask[i];
  const out = new Int32Array(n);
  let k = 0;
  for (let i = 0; i < mask.length; i++) if (mask[i]) out[k++] = i;
  floodedIndexCache.set(mask, out);
  return out;
}

// ---------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------

let serviceCache: { base: ServiceCoverage; mask: Uint8Array; result: ServiceCoverage } | null = null;

/** Flooded tiles have no power or water. Returns `base` itself when nothing floods; rows without floods are shared. */
export function applyFloodToServices(base: ServiceCoverage, mask: Uint8Array | null, size: number): ServiceCoverage {
  if (!mask) return base;
  if (serviceCache && serviceCache.base === base && serviceCache.mask === mask) return serviceCache.result;
  const power = base.power.slice();
  const water = base.water.slice();
  for (const i of getFloodedIndices(mask)) {
    const x = i % size;
    const y = (i / size) | 0;
    if (power[y] === base.power[y]) power[y] = base.power[y].slice();
    if (water[y] === base.water[y]) water[y] = base.water[y].slice();
    power[y][x] = false;
    water[y][x] = false;
  }
  const result: ServiceCoverage = { ...base, power, water };
  serviceCache = { base, mask, result };
  return result;
}

/** Share of residents living on flooded tiles (0–1). */
export function getFloodedPopulationShare(grid: Tile[][], size: number, mask: Uint8Array | null, population: number): number {
  if (!mask || population <= 0) return 0;
  let flooded = 0;
  for (const i of getFloodedIndices(mask)) flooded += grid[(i / size) | 0][i % size].building.population || 0;
  return Math.min(1, flooded / population);
}

/** Happiness change from flooded homes (≤ 0). */
export function getFloodHappinessModifier(floodedShare: number): number {
  return -FLOOD_SIM_CONFIG.happinessPenalty * floodedShare;
}

/** Buildings (not ghats, roads or bare land) on the tiles of a mask, with the first one's position. */
export function countBuildingsIn(grid: Tile[][], size: number, mask: Uint8Array): { count: number; first?: TilePos } {
  let count = 0;
  let first: TilePos | undefined;
  for (const i of getFloodedIndices(mask)) {
    const x = i % size;
    const y = (i / size) | 0;
    const type = grid[y][x].building.type;
    if (FLOOD_SIM_CONFIG.notCounted.includes(type) || type === 'ghat') continue;
    count++;
    if (!first) first = { x, y };
  }
  return { count, first };
}

// ---------------------------------------------------------------------------
// Daily step
// ---------------------------------------------------------------------------

export type FloodStateFields = Pick<
  GameState,
  'monsoonStrength' | 'riverLevel' | 'floodNotifiedLevel' | 'siltLevel' | 'siltUntilDay'
>;

export interface FloodDayResult {
  fields: FloodStateFields;
  /** Forecast to put on the calendar (1 June). */
  forecast?: ForecastInput;
  notifications: Omit<Notification, 'id' | 'timestamp'>[];
  /** Flooded buildings that became abandoned today. */
  damaged: TilePos[];
}

/**
 * Runs once per in-game day, after the date has moved on to (`month`, `day`) = absolute day `today`.
 * Rolls the monsoon on 1 June, moves the river level, rolls flood damage and writes the notifications.
 */
export function runFloodDay(
  state: Pick<GameState, 'mapId' | 'gridSize' | 'grid' | 'structureVersion' | 'id'> & FloodStateFields,
  month: number,
  day: number,
  today: number,
  rng: Rng
): FloodDayResult {
  const result: FloodDayResult = {
    fields: {
      monsoonStrength: state.monsoonStrength,
      riverLevel: state.riverLevel,
      floodNotifiedLevel: state.floodNotifiedLevel,
      siltLevel: state.siltLevel,
      siltUntilDay: state.siltUntilDay,
    },
    notifications: [],
    damaged: [],
  };
  if (state.mapId !== 'varanasi') return result;
  const size = state.gridSize;
  const f = result.fields;

  if (isMonsoonRollDay(month, day)) {
    const strength: MonsoonStrength = rollMonsoonStrength(rng);
    f.monsoonStrength = strength;
    f.floodNotifiedLevel = 0;
    const text = getMonsoonForecastText(strength);
    result.forecast = {
      id: 'monsoon',
      title: text.title,
      description: text.description,
      daysAhead: FLOOD_CONFIG.forecastDaysAhead,
      icon: '🌧️',
      overlay: 'flood',
    };
  }

  // Advisor on the first day of the flood season: how many buildings sit in this year's flood zone
  if (month === FLOOD_CONFIG.floodStartMonth && day === 1 && f.monsoonStrength) {
    const peak = FLOOD_CONFIG.peakLevel[f.monsoonStrength];
    const zone = computeFloodMask(size, peak, getCityEmbankments(state));
    const { count, first } = countBuildingsIn(state.grid, size, zone);
    result.notifications.push({
      title: 'The monsoon has begun',
      description:
        count > 0
          ? `${count} building${count === 1 ? '' : 's'} stand in this year's flood zone. Open the flood overlay to see which.`
          : "No buildings stand in this year's flood zone.",
      icon: 'flood',
      severity: 'warning',
      overlay: 'flood',
      ...(first ?? {}),
    });
  }

  const previous = state.riverLevel ?? 0;
  const level = getRiverLevel(month, day, f.monsoonStrength);
  f.riverLevel = level;
  const embankments = getCityEmbankments(state);

  if (level > previous && level > (f.floodNotifiedLevel ?? 0)) {
    f.floodNotifiedLevel = level;
    const mask = computeFloodMask(size, level, embankments);
    const { count, first } = countBuildingsIn(state.grid, size, mask);
    if (count > 0) {
      result.notifications.push({
        title: `Flood: the Ganga has risen to level ${level}`,
        description: `${count} building${count === 1 ? ' is' : 's are'} under water: no power, no water and a chance of ruin each day.`,
        icon: 'flood',
        severity: 'crisis',
        overlay: 'flood',
        ...(first ?? {}),
      });
    }
  }

  if (level < previous) {
    f.siltLevel = Math.max(previous, f.siltUntilDay !== undefined && today <= f.siltUntilDay ? f.siltLevel ?? 0 : 0);
    f.siltUntilDay = today + FLOOD_CONFIG.siltDays;
    if (level === 0) {
      result.notifications.push({
        title: 'The floodwaters have gone down',
        description: 'The riverbanks are dry again. Silt marks where the water reached.',
        icon: 'flood',
        severity: 'info',
      });
    }
  }

  // Damage: each flooded building has a small chance of ruin per day
  if (level > 0) {
    const mask = computeFloodMask(size, level, embankments);
    for (const i of getFloodedIndices(mask)) {
      const x = i % size;
      const y = (i / size) | 0;
      const b = state.grid[y][x].building;
      if (b.abandoned) continue;
      const chance = getFloodDamageChance(b.type);
      if (chance > 0 && rng() < chance) result.damaged.push({ x, y });
    }
  }

  return result;
}
