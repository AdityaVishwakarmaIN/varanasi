/**
 * Festivals wired into the city (S5-T3, S5-T4). The rules live in festivals.ts; this file reads a GameState for them:
 * the event areas, the live readiness checklist, the once-a-day calendar step used by `simulateTick` and the
 * per-tick tourism and happiness effects. No randomness.
 */
import type { GameState, Notification, Tile } from '@/types/game';
import type { OverlayMode } from '@/components/game/types';
import type { ForecastInput } from '@/lib/notifications';
import { addForecast } from '@/lib/notifications';
import { getRiverZone } from '@/games/isocity/maps/riverZones';
import {
  EVENT_CONFIG,
  FESTIVALS,
  estimateAreaTraffic,
  getActiveFestivals,
  getFestivalCrowdMultipliers,
  getFestivalHappinessModifier,
  getFestivalTourismMultiplier,
  getUpcomingFestivals,
  resolveEvent,
  scaleEventMultiplier,
  type FestivalDef,
  type FestivalId,
  type FestivalState,
  type ReadinessInputs,
  type ReadinessResult,
} from '@/lib/festivals';

type Added = Omit<Notification, 'id' | 'timestamp'>;

/** What the festival wiring reads from the city. */
export type FestivalCity = Pick<GameState, 'grid' | 'gridSize' | 'mapId' | 'services' | 'stats' | 'festival'> &
  Partial<Pick<GameState, 'structureVersion'>>;

export const FESTIVAL_SIM_CONFIG = {
  /** Buildings that count as ghats for event areas and the Ganga Aarti. */
  ghatTypes: ['ghat', 'landmark_dashashwamedh'] as readonly string[],
  aartiLandmark: 'landmark_dashashwamedh',
  shivratriLandmark: 'landmark_kashi_vishwanath',
} as const;

/** Management events (Dev Deepawali, Maha Shivratri). */
export function isManagementFestival(id: FestivalId): boolean {
  return FESTIVALS[id].type === 'management';
}

// ---------------------------------------------------------------------------
// Ghats and event areas
// ---------------------------------------------------------------------------

function isGhatType(type: string): boolean {
  return FESTIVAL_SIM_CONFIG.ghatTypes.includes(type);
}

/** Every ghat tile (including the Dashashwamedh landmark), row by row. */
export function findGhatTiles(grid: Tile[][], size: number): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let y = 0; y < size; y++) {
    const row = grid[y];
    for (let x = 0; x < size; x++) if (isGhatType(row[x].building.type)) out.push({ x, y });
  }
  return out;
}

function findBuildingTile(grid: Tile[][], size: number, type: string): { x: number; y: number } | null {
  for (let y = 0; y < size; y++) {
    const row = grid[y];
    for (let x = 0; x < size; x++) if (row[x].building.type === type) return { x, y };
  }
  return null;
}

/**
 * The largest group of touching ghat tiles (8-neighbour). Returns its tiles and the tile nearest its middle,
 * or null without ghats. Ties go to the first group found (row order), so the result is stable.
 */
export function getLargestGhatCluster(ghats: readonly { x: number; y: number }[], size: number): { tiles: { x: number; y: number }[]; center: { x: number; y: number } } | null {
  if (ghats.length === 0) return null;
  const index = new Map<number, number>();
  ghats.forEach((g, i) => index.set(g.y * size + g.x, i));
  const seen = new Uint8Array(ghats.length);
  let best: { x: number; y: number }[] = [];
  for (let i = 0; i < ghats.length; i++) {
    if (seen[i]) continue;
    const cluster: { x: number; y: number }[] = [];
    const stack = [i];
    seen[i] = 1;
    while (stack.length > 0) {
      const g = ghats[stack.pop()!];
      cluster.push(g);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const j = index.get((g.y + dy) * size + (g.x + dx));
          if (j !== undefined && !seen[j] && g.x + dx >= 0 && g.x + dx < size) {
            seen[j] = 1;
            stack.push(j);
          }
        }
      }
    }
    if (cluster.length > best.length) best = cluster;
  }
  const cx = best.reduce((s, g) => s + g.x, 0) / best.length;
  const cy = best.reduce((s, g) => s + g.y, 0) / best.length;
  let center = best[0];
  let bestD = Infinity;
  for (const g of best) {
    const d = (g.x - cx) ** 2 + (g.y - cy) ** 2;
    if (d < bestD) {
      bestD = d;
      center = g;
    }
  }
  return { tiles: best, center };
}

export interface EventArea {
  festivalId: FestivalId;
  /** Tile indices (y * size + x) in the area, ascending. */
  indices: Int32Array;
  /** Where notifications and "Show me" jump to. Null when the area is empty. */
  center: { x: number; y: number } | null;
  /** 1 at full scale; Maha Shivratri without Kashi Vishwanath is 0.5 (visitors × 0.5). */
  scale: number;
}

function markDisk(mask: Uint8Array, size: number, cx: number, cy: number, radius: number): void {
  const r2 = radius * radius;
  for (let y = Math.max(0, cy - radius); y <= Math.min(size - 1, cy + radius); y++) {
    for (let x = Math.max(0, cx - radius); x <= Math.min(size - 1, cx + radius); x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r2) mask[y * size + x] = 1;
    }
  }
}

const areaCache = new Map<string, EventArea>();

/**
 * The event area (S5-T4). Dev Deepawali: every west-bank riverfront tile plus land within 5 tiles of any ghat.
 * Maha Shivratri: within 10 tiles of Kashi Vishwanath, or of the largest ghat cluster at half scale. River tiles are
 * never part of an area. Cached per building layout (structureVersion).
 */
export function getEventArea(city: FestivalCity, festivalId: FestivalId): EventArea {
  const { grid, gridSize: size, mapId } = city;
  const key = `${festivalId}|${size}|${mapId}|${city.structureVersion ?? 0}`;
  const cached = areaCache.get(key);
  if (cached && city.structureVersion !== undefined) return cached;
  const mask = new Uint8Array(size * size);
  const ghats = findGhatTiles(grid, size);
  const cluster = getLargestGhatCluster(ghats, size);
  let center: { x: number; y: number } | null = null;
  let scale = 1;
  if (festivalId === 'maha_shivratri') {
    const temple = findBuildingTile(grid, size, FESTIVAL_SIM_CONFIG.shivratriLandmark);
    const origin = temple ?? cluster?.center ?? null;
    if (!temple) scale = EVENT_CONFIG.shivratriWithoutTempleVisitors;
    if (origin) {
      markDisk(mask, size, origin.x, origin.y, EVENT_CONFIG.shivratriRadius);
      center = origin;
    }
  } else {
    let riverfront: { x: number; y: number } | null = null;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (getRiverZone(x, y, size, mapId) === 'westRiverfront') {
          mask[y * size + x] = 1;
          // The riverfront tile nearest the middle row stands in for the ghats when there are none
          if (!riverfront || Math.abs(y - size / 2) < Math.abs(riverfront.y - size / 2)) riverfront = { x, y };
        }
      }
    }
    for (const g of ghats) markDisk(mask, size, g.x, g.y, EVENT_CONFIG.devDeepawaliGhatRadius);
    center = cluster?.center ?? riverfront;
    if (ghats.length === 0 && !riverfront) center = null;
  }
  const list: number[] = [];
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    const t = grid[(i / size) | 0][i % size];
    if (t.building.type === 'water' || getRiverZone(i % size, (i / size) | 0, size, mapId) === 'river') continue;
    list.push(i);
  }
  const area: EventArea = { festivalId, indices: Int32Array.from(list), center: list.length > 0 ? center : null, scale };
  if (areaCache.size > 8) areaCache.clear();
  areaCache.set(key, area);
  return area;
}

// ---------------------------------------------------------------------------
// Readiness (live checklist)
// ---------------------------------------------------------------------------

/** Measures the checklist inputs inside an area from the current services and stats. */
export function measureReadiness(city: FestivalCity, area: EventArea): ReadinessInputs {
  const { grid, gridSize: size, services, stats } = city;
  let police = 0;
  let fire = 0;
  let water = 0;
  let roads = 0;
  let rail = 0;
  let people = 0;
  let hospital = false;
  for (let k = 0; k < area.indices.length; k++) {
    const i = area.indices[k];
    const x = i % size;
    const y = (i / size) | 0;
    police += services.police[y]?.[x] ?? 0;
    fire += services.fire[y]?.[x] ?? 0;
    if (services.water[y]?.[x]) water++;
    if ((services.health[y]?.[x] ?? 0) > 0) hospital = true;
    const b = grid[y][x].building;
    if (b.type === 'road' || b.type === 'bridge') roads++;
    else if (b.type === 'rail_station') rail++;
    people += (b.population ?? 0) + (b.jobs ?? 0);
  }
  const n = area.indices.length;
  const roadEquivalents = roads + rail * EVENT_CONFIG.railStationRoadTiles;
  return {
    avgPoliceCoverage: n > 0 ? police / n : 0,
    avgFireCoverage: n > 0 ? fire / n : 0,
    hospitalInRange: hospital,
    areaTiles: n,
    roadTiles: roadEquivalents,
    avgRoadTraffic: estimateAreaTraffic(people, roadEquivalents),
    avgWaterCoverage: n > 0 ? (100 * water) / n : 0,
    gangaHealth: stats.gangaHealth ?? 100,
    powerSupplyRatio: stats.power?.ratio ?? 1,
  };
}

/** Overlay for a checklist row's "Show me" (traffic has no overlay: the camera just moves there). */
export function readinessOverlay(result: Pick<ReadinessResult, 'overlay'>): OverlayMode | undefined {
  return result.overlay === 'traffic' ? undefined : result.overlay;
}

export interface EventReadiness {
  area: EventArea;
  inputs: ReadinessInputs;
  checklist: ReadinessResult[];
  passed: number;
}

/** The live checklist for the Event panel. */
export function getEventReadiness(city: FestivalCity, festivalId: FestivalId): EventReadiness {
  const area = getEventArea(city, festivalId);
  const inputs = measureReadiness(city, area);
  const { checklist } = resolveEvent(festivalId, inputs);
  return { area, inputs, checklist, passed: checklist.filter((r) => r.passed).length };
}

// ---------------------------------------------------------------------------
// Daily step
// ---------------------------------------------------------------------------

export interface FestivalForecast {
  input: ForecastInput;
  /** Management events also send a warning notification; visual festivals only go on the strip. */
  notify: boolean;
}

export interface FestivalDayResult {
  festival: FestivalState | undefined;
  forecasts: FestivalForecast[];
  notifications: Added[];
}

function chipIcon(f: FestivalDef): string {
  return f.chip.split(' ')[0];
}

/**
 * Once a day (Varanasi map): put festivals starting within 30 days on the calendar strip (management events with a
 * notification that opens the Event panel), resolve a management event on its first day, and drop finished effects.
 */
export function runFestivalDay(city: FestivalCity, today: number, month: number, day: number): FestivalDayResult {
  const prev = city.festival;
  let festival: FestivalState | undefined = prev;
  const edit = (): FestivalState => {
    if (festival === prev) festival = { ...prev };
    return festival!;
  };
  const result: FestivalDayResult = { festival, forecasts: [], notifications: [] };
  if (city.mapId !== 'varanasi') return result;

  if (prev?.event && today > prev.event.endDay) delete edit().event;
  if (prev?.mood && today > prev.mood.untilDay) delete edit().mood;

  for (const { festival: f, daysUntil } of getUpcomingFestivals(month, day, EVENT_CONFIG.announceDaysAhead)) {
    const occurrence = today + daysUntil;
    const management = f.type === 'management';
    if (daysUntil > 0 && festival?.announced?.[f.id] !== occurrence) {
      const state = edit();
      state.announced = { ...state.announced, [f.id]: occurrence };
      const center = management ? getEventArea(city, f.id).center : null;
      result.forecasts.push({
        notify: management,
        input: {
          id: `festival-${f.id}`,
          title: management ? `${f.name} in ${daysUntil} days` : f.name,
          description: management
            ? `Huge crowds are expected. Open the Event panel to check readiness: police, fire and medical, access, sanitation and power.`
            : `${f.name} is coming in ${daysUntil} days.`,
          daysAhead: daysUntil,
          icon: chipIcon(f),
          ...(center ? { x: center.x, y: center.y } : {}),
        },
      });
    }
    if (daysUntil !== 0 || !management || festival?.event?.startDay === today) continue;

    const readiness = getEventReadiness(city, f.id);
    const center = readiness.area.center;
    if (!center) {
      result.notifications.push({
        title: `${f.name} passed quietly`,
        description: 'Build ghats on the riverfront to host the festival crowds.',
        icon: chipIcon(f),
        severity: 'info',
      });
      continue;
    }
    const failed = readiness.checklist.filter((r) => !r.passed);
    const { outcome } = resolveEvent(f.id, readiness.inputs);
    const scale = readiness.area.scale;
    const state = edit();
    state.event = {
      id: f.id,
      startDay: today,
      endDay: today + (f.durationDays ?? 1) - 1,
      outcome: outcome.kind,
      tourismMultiplier: scaleEventMultiplier(outcome.tourismMultiplier, scale),
    };
    state.mood = { delta: outcome.happinessDelta, untilDay: today + outcome.happinessDays - 1 };
    const halfScale = scale < 1 ? ' Build Kashi Vishwanath Temple for a full-scale Maha Shivratri.' : '';
    const overlay = failed.length > 0 ? readinessOverlay(failed[0]) : undefined;
    result.notifications.push({
      title: outcome.kind === 'triumph' ? `${f.name}: a triumph` : outcome.kind === 'success' ? `${f.name}: a success` : `${f.name}: overwhelmed`,
      description: outcome.message + halfScale,
      icon: outcome.isCrisis ? 'alert' : outcome.kind === 'triumph' ? 'trophy' : chipIcon(f),
      severity: outcome.isCrisis ? 'crisis' : 'info',
      x: center.x,
      y: center.y,
      ...(overlay ? { overlay } : {}),
    });
  }
  result.festival = festival;
  return result;
}

/** Puts the day's festival forecasts on the calendar strip (with a notification for management events). */
export function applyFestivalForecasts(
  state: Pick<GameState, 'year' | 'month' | 'day' | 'forecasts' | 'notifications'>,
  forecasts: readonly FestivalForecast[]
): Pick<GameState, 'forecasts' | 'notifications'> {
  let out: Pick<GameState, 'forecasts' | 'notifications'> = { forecasts: state.forecasts, notifications: state.notifications };
  for (const f of forecasts) {
    const added = addForecast({ ...state, ...out }, f.input);
    out = { forecasts: added.forecasts, notifications: f.notify ? added.notifications : out.notifications };
  }
  return out;
}

/** Per tick: tourism × the running event's multiplier, and the happiness left by the last event. Mutates `stats`. */
export function applyFestivalStats(stats: GameState['stats'], festival: FestivalState | undefined, today: number): void {
  if (!festival) return;
  const mult = getFestivalTourismMultiplier(festival, today);
  if (mult !== 1 && stats.tourismIncome) {
    const extra = Math.floor(stats.tourismIncome * (mult - 1));
    stats.tourismIncome += extra;
    stats.income += extra;
  }
  const mood = getFestivalHappinessModifier(festival, today);
  if (mood !== 0) stats.happiness = Math.max(0, Math.min(100, stats.happiness + mood));
}

// ---------------------------------------------------------------------------
// Renderer and UI helpers
// ---------------------------------------------------------------------------

/** Festivals running at this date and visual hour, plus crowd multipliers for pedestrians and car spawns. */
export function getLiveFestivals(
  city: FestivalCity & Pick<GameState, 'month' | 'day'>,
  hour: number
): { active: FestivalDef[]; crowd: { pedestrians: number; cars: number } } {
  if (city.mapId !== 'varanasi') return { active: [], crowd: { pedestrians: 1, cars: 1 } };
  const active = getActiveFestivals(city.month, city.day, Math.floor(hour));
  const shivratri = active.some((f) => f.id === 'maha_shivratri');
  const scale = shivratri ? getEventArea(city, 'maha_shivratri').scale : 1;
  return { active, crowd: getFestivalCrowdMultipliers(active, scale) };
}

/** The management event announced within 30 days (or running today), soonest first, for the Event panel. */
export function getUpcomingManagementEvent(month: number, day: number): { id: FestivalId; daysUntil: number } | null {
  for (const id of ['maha_shivratri', 'dev_deepawali'] as const) {
    if (getActiveFestivals(month, day, 0).some((f) => f.id === id)) return { id, daysUntil: 0 };
  }
  const next = getUpcomingFestivals(month, day, EVENT_CONFIG.announceDaysAhead).find((u) => u.festival.type === 'management');
  return next ? { id: next.festival.id, daysUntil: next.daysUntil } : null;
}
