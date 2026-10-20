/**
 * "Voices of the City" feed logic (S5-T7): which CITIZEN_VOICES conditions are true in the city right now, and
 * the next message (at most one per in-game week). Pure; the feed component keeps the entries (UI state only).
 */
import type { GameState, Notification } from '@/types/game';
import type { Rng } from '@/lib/rng';
import {
  CITIZEN_VOICES,
  CITIZEN_VOICE_CONFIG,
  VARANASI_MOHALLAS,
  formatCitizenVoice,
  pickCitizenVoice,
  pickFirstName,
  type VoiceCondition,
} from '@/lib/citizenVoices';
import type { ProblemIconSet } from '@/lib/problemIcons';
import { getFeederBounds } from '@/lib/feederZones';
import { absoluteDay, CALENDAR } from '@/lib/seasons';
import { isHeatwaveActive } from '@/lib/heatwave';
import { getUpcomingFestivals } from '@/lib/festivals';
import { isLandmarkType } from '@/lib/landmarks';
import { getInformalAreaName } from '@/lib/informalSim';

export const CITIZEN_FEED_CONFIG = {
  /** Entries kept in the feed. */
  maxEntries: 8,
  /** In-game days an entry stays in the feed (3 months of CALENDAR.daysPerMonth days). */
  lifetimeDays: 3 * CALENDAR.daysPerMonth,
  /** In-game days a resolved problem stays (dimmed) before it is removed. */
  resolvedGraceDays: 14,
  trafficHigh: 60,
  trafficLow: 20,
  gangaClean: 80,
  gangaDirty: 40,
  taxHigh: 14,
  taxLow: 7,
  /** Recent notifications scanned for one-off events (festival outcomes, formalised settlements). */
  recentNotifications: 12,
} as const;

export interface ActiveVoiceCondition {
  condition: VoiceCondition;
  /** Where it is happening, when there is a place (clicking the message jumps there). */
  x?: number;
  y?: number;
}

export interface CitizenFeedEntry {
  id: string;
  /** Absolute day it was posted. */
  day: number;
  voiceId: string;
  text: string;
  positive: boolean;
  x?: number;
  y?: number;
  /** The problem that caused this entry is gone (shown dimmed). Missing in old saves. */
  resolved?: boolean;
  /** Absolute day it was marked resolved; the entry is removed `resolvedGraceDays` later. */
  resolvedDay?: number;
}

export type CitizenFeedState = Pick<
  GameState,
  | 'grid' | 'gridSize' | 'mapId' | 'cityName' | 'stats' | 'taxRate' | 'year' | 'month' | 'day'
  | 'riverLevel' | 'heatwave' | 'outbreaks' | 'weather' | 'notifications' | 'disastersEnabled'
>;

interface Scan {
  roadTiles: number;
  roadTraffic: number;
  busiest?: { x: number; y: number; traffic: number };
  informalAt?: { x: number; y: number };
  ghats: number;
  landmarkAt?: { x: number; y: number };
}

function scan(state: CitizenFeedState): Scan {
  const out: Scan = { roadTiles: 0, roadTraffic: 0, ghats: 0 };
  for (let y = 0; y < state.gridSize; y++) {
    const row = state.grid[y];
    for (let x = 0; x < state.gridSize; x++) {
      const t = row[x];
      const type = t.building.type;
      if (type === 'road' || type === 'bridge') {
        out.roadTiles++;
        out.roadTraffic += t.traffic;
        if (!out.busiest || t.traffic > out.busiest.traffic) out.busiest = { x, y, traffic: t.traffic };
      } else if (type === 'informal_housing') {
        if (!out.informalAt) out.informalAt = { x, y };
      } else if (type === 'ghat') {
        out.ghats++;
      } else if (!out.landmarkAt && isLandmarkType(type)) {
        out.landmarkAt = { x, y };
      }
    }
  }
  return out;
}

function recentMatch(list: readonly Notification[], re: RegExp): Notification | undefined {
  return list.slice(0, CITIZEN_FEED_CONFIG.recentNotifications).find((n) => re.test(`${n.title} ${n.description}`));
}

/** Every voice condition that is true in the city now, with a place when there is one. */
export function getActiveVoiceConditions(state: CitizenFeedState, problems: ProblemIconSet | null): ActiveVoiceCondition[] {
  const out: ActiveVoiceCondition[] = [];
  const add = (condition: VoiceCondition, at?: { x: number; y: number }) => out.push(at ? { condition, x: at.x, y: at.y } : { condition });
  const { stats } = state;
  const cfg = CITIZEN_FEED_CONFIG;
  const pop = stats.population;
  if (pop <= 0) return out;
  const c = problems?.counts;
  const first = problems?.first ?? {};
  const today = absoluteDay(state.year, state.month, state.day);
  const crisesOn = state.disastersEnabled !== false;
  const varanasi = state.mapId === 'varanasi';
  const s = scan(state);

  // Power and water
  const cut = stats.power?.cut ?? [];
  if (cut.length > 0 && (stats.power?.ratio ?? 1) < 1) {
    const b = getFeederBounds(cut[0], state.gridSize);
    add('power_cut', { x: b.centerX, y: b.centerY });
  } else if (stats.power && stats.power.ratio >= 1 && (c?.no_power ?? 0) === 0) {
    add('power_ok');
  }
  if ((stats.water && stats.water.ratio < 1) || (c?.no_water ?? 0) > 0) add('water_shortage', first.no_water);
  else if (stats.water && stats.water.ratio >= 1) add('water_ok');

  // Ganga
  if (varanasi && stats.gangaHealth !== undefined) {
    if (stats.gangaHealth > cfg.gangaClean) add('ganga_clean');
    else if (stats.gangaHealth < cfg.gangaDirty) add('ganga_dirty');
  }

  // Traffic
  const avgTraffic = s.roadTiles > 0 ? s.roadTraffic / s.roadTiles : 0;
  if (avgTraffic > cfg.trafficHigh && s.busiest) add('traffic_high', s.busiest);
  else if (s.roadTiles > 20 && avgTraffic < cfg.trafficLow) add('traffic_low');
  if (varanasi && s.roadTiles > 50) add('cows_on_road', s.busiest);

  // Money and jobs
  if (state.taxRate >= cfg.taxHigh) add('taxes_high');
  else if (state.taxRate <= cfg.taxLow) add('taxes_low');
  const jobRatio = stats.jobs / pop;
  if (pop > 100 && jobRatio < 0.7) add('jobs_short');
  else if (pop > 100 && jobRatio > 1.1) add('jobs_plenty');
  if (stats.money < 0) add('money_low');

  // Services and environment
  if (stats.safety < 40) add('crime_high');
  else if (stats.safety > 70 && pop > 100) add('safe_streets');
  if (stats.environment < 40) add('pollution_high');
  else if (stats.environment > 70) add('green_city');
  if (stats.health < 40) add('health_poor');
  else if (stats.health > 75) add('health_good');
  if (stats.education > 75) add('education_good');
  if (stats.happiness > 75) add('happiness_high');

  // Housing
  if (s.informalAt || stats.demand.residential > 50) add('housing_short', s.informalAt);
  const formalised = recentMatch(state.notifications, /Proper homes/i);
  if (formalised) add('settlement_formalised', formalised.x !== undefined && formalised.y !== undefined ? { x: formalised.x, y: formalised.y } : undefined);

  // Tourism and ghats
  if (varanasi && (stats.tourismIncome ?? 0) > 0 && (stats.tourismIncome ?? 0) >= 0.2 * Math.max(1, stats.income)) add('tourism_high');
  if (varanasi && s.ghats >= 3) add('ghat_busy');

  // Seasons and crises
  if (crisesOn && isHeatwaveActive(state.heatwave, today)) add('heatwave');
  if (crisesOn && (state.riverLevel ?? 0) > 0) add('flood', first.flood);
  if (state.weather === 'fog') add('fog');
  if (crisesOn && state.outbreaks && state.outbreaks.length > 0) {
    const b = getFeederBounds(state.outbreaks[0].feeder, state.gridSize);
    add('disease', { x: b.centerX, y: b.centerY });
  }

  // Festivals and landmarks
  if (varanasi && getUpcomingFestivals(state.month, state.day).some((u) => u.festival.type === 'management')) add('festival_upcoming');
  if (recentMatch(state.notifications, /magnificent|went well/i)) add('festival_success');
  if (recentMatch(state.notifications, /Crowds overwhelmed/i)) add('festival_overwhelmed');
  if (s.landmarkAt) add('landmark_built', s.landmarkAt);

  return out;
}

/** Stored in a feed line instead of the city name, so the line shows the city's current name (it can be renamed). */
export const FEED_CITY_TOKEN = '{city}';

/** Replaces FEED_CITY_TOKEN in a stored feed line with the city's current name. */
export function resolveFeedText(text: string, cityName: string | undefined): string {
  return text.split(FEED_CITY_TOKEN).join(cityName || 'the city');
}

/** Neighbourhood for a message: the mohalla of the place, a random mohalla on Varanasi, or the city name (as a token). */
export function getFeedArea(state: Pick<GameState, 'gridSize' | 'mapId' | 'cityName'>, rng: Rng, at?: { x?: number; y?: number }): string {
  if (state.mapId !== 'varanasi') return FEED_CITY_TOKEN;
  if (at && at.x !== undefined && at.y !== undefined) return getInformalAreaName(at.x, at.y, state.gridSize, state.mapId);
  return VARANASI_MOHALLAS[Math.min(VARANASI_MOHALLAS.length - 1, Math.floor(rng() * VARANASI_MOHALLAS.length))].name;
}

/** True when a week (CITIZEN_VOICE_CONFIG.minDaysBetweenMessages) has passed since the last message. */
export function isFeedDue(lastDay: number | undefined, today: number): boolean {
  return lastDay === undefined || today < lastDay || today - lastDay >= CITIZEN_VOICE_CONFIG.minDaysBetweenMessages;
}

/**
 * The next feed message, or null when one was posted less than a week ago or nothing applies.
 * @param entries current feed, newest first
 */
export function nextCitizenFeedEntry(
  entries: readonly CitizenFeedEntry[],
  state: CitizenFeedState,
  problems: ProblemIconSet | null,
  rng: Rng,
  /** Pass the result of getActiveVoiceConditions when the caller already has it (saves a grid scan). */
  activeConditions?: readonly ActiveVoiceCondition[]
): CitizenFeedEntry | null {
  const today = absoluteDay(state.year, state.month, state.day);
  if (!isFeedDue(entries[0]?.day, today)) return null;
  const active = activeConditions ?? getActiveVoiceConditions(state, problems);
  if (active.length === 0) return null;
  const recent = entries.slice(0, CITIZEN_VOICE_CONFIG.recentMemory).map((e) => e.voiceId).reverse();
  const voice = pickCitizenVoice(active.map((a) => a.condition), rng, recent);
  if (!voice) return null;
  const where = active.find((a) => a.condition === voice.condition);
  const at = where && where.x !== undefined && where.y !== undefined ? { x: where.x, y: where.y } : undefined;
  const text = formatCitizenVoice(voice, { name: pickFirstName(rng), area: getFeedArea(state, rng, at) });
  return { id: `${today}-${voice.id}`, day: today, voiceId: voice.id, text, positive: voice.positive, ...at };
}

/** Adds an entry to the front, keeping at most CITIZEN_FEED_CONFIG.maxEntries. */
export function pushFeedEntry(entries: readonly CitizenFeedEntry[], entry: CitizenFeedEntry): CitizenFeedEntry[] {
  return [entry, ...entries.filter((e) => e.id !== entry.id)].slice(0, CITIZEN_FEED_CONFIG.maxEntries);
}

const VOICE_CONDITION = new Map<string, VoiceCondition>(CITIZEN_VOICES.map((v) => [v.id, v.condition]));

const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

/**
 * Cleans a stored feed (old or hand-edited saves): drops unusable entries, fills missing fields, sorts newest first and
 * keeps at most CITIZEN_FEED_CONFIG.maxEntries. Never throws.
 */
export function normalizeFeedEntries(raw: unknown): CitizenFeedEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: CitizenFeedEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const e = item as Partial<CitizenFeedEntry>;
    if (typeof e.text !== 'string' || !isNum(e.day)) continue;
    const voiceId = typeof e.voiceId === 'string' ? e.voiceId : '';
    out.push({
      id: typeof e.id === 'string' && e.id ? e.id : `${e.day}-${voiceId}`,
      day: e.day,
      voiceId,
      text: e.text,
      positive: e.positive === true,
      ...(isNum(e.x) && isNum(e.y) ? { x: e.x, y: e.y } : {}),
      ...(e.resolved === true ? { resolved: true, ...(isNum(e.resolvedDay) ? { resolvedDay: e.resolvedDay } : {}) } : {}),
    });
  }
  return out.sort((a, b) => b.day - a.day).slice(0, CITIZEN_FEED_CONFIG.maxEntries);
}

/**
 * Expires and resolves feed entries (run once per in-game day, not per frame):
 * - entries older than `lifetimeDays` (or dated in the future, e.g. after loading an older save) are removed;
 * - a problem entry (negative voice) whose condition is no longer in `active` is marked resolved, and removed
 *   `resolvedGraceDays` later; if the condition comes back before that, it is un-resolved;
 * - the list is capped at `maxEntries`.
 * Positive entries and entries of unknown voices only age out. Returns the same array when nothing changed.
 * @param active the current getActiveVoiceConditions result, or null to skip the resolve check
 */
export function pruneFeedEntries(
  entries: readonly CitizenFeedEntry[],
  today: number,
  active: readonly ActiveVoiceCondition[] | null
): readonly CitizenFeedEntry[] {
  const cfg = CITIZEN_FEED_CONFIG;
  const live = active ? new Set(active.map((a) => a.condition)) : null;
  let changed = entries.length > cfg.maxEntries;
  const out: CitizenFeedEntry[] = [];
  for (const e of entries) {
    if (e.day > today || today - e.day >= cfg.lifetimeDays) {
      changed = true;
      continue;
    }
    let next = e;
    const condition = VOICE_CONDITION.get(e.voiceId);
    if (live && condition && !e.positive) {
      if (live.has(condition)) {
        if (e.resolved) {
          const { resolved: _resolved, resolvedDay: _resolvedDay, ...rest } = e;
          next = rest;
        }
      } else if (!e.resolved) {
        next = { ...e, resolved: true, resolvedDay: today };
      } else if (e.resolvedDay === undefined) {
        next = { ...e, resolvedDay: today };
      } else if (today - e.resolvedDay >= cfg.resolvedGraceDays) {
        changed = true;
        continue;
      }
    }
    if (next !== e) changed = true;
    out.push(next);
  }
  return changed ? out.slice(0, cfg.maxEntries) : entries;
}

/**
 * The daily feed step: prunes/resolves the entries, then posts the next message when one is due.
 * One grid scan. Returns the same `entries` array when nothing changed.
 */
export function advanceCitizenFeed(
  entries: readonly CitizenFeedEntry[],
  state: CitizenFeedState,
  problems: ProblemIconSet | null,
  rng: Rng
): { entries: readonly CitizenFeedEntry[]; posted: boolean } {
  const today = absoluteDay(state.year, state.month, state.day);
  const active = getActiveVoiceConditions(state, problems);
  const pruned = pruneFeedEntries(entries, today, active);
  const entry = nextCitizenFeedEntry(pruned, state, problems, rng, active);
  return entry ? { entries: pushFeedEntry(pruned, entry), posted: true } : { entries: pruned, posted: false };
}
