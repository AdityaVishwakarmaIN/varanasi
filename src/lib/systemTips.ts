/**
 * Contextual "first time" tips for every system (S5-T8). Pure conditions over GameState; useTipSystem shows
 * each once (it remembers shown tips; Settings → "Reset tips" forgets them).
 */
import type { GameState } from '@/types/game';
import { absoluteDay } from '@/lib/seasons';
import { isHeatwaveActive, isHeatwavePending } from '@/lib/heatwave';
import { getUpcomingFestivals } from '@/lib/festivals';
import { getUnlockedLandmarks } from '@/lib/landmarks';
import { toDisplayPopulation } from '@/lib/format';

export const SYSTEM_TIP_CONFIG = {
  /** festival_prep fires when a managed festival is this many days away or closer. */
  festivalPrepDays: 30,
} as const;

export type SystemTipId =
  | 'first_power_cut'
  | 'first_water_shortage'
  | 'first_informal_settlement'
  | 'monsoon_forecast'
  | 'first_heatwave'
  | 'first_outbreak'
  | 'first_landmark_unlocked'
  | 'festival_prep'
  | 'debt_warning';

export type SystemTipState = Pick<
  GameState,
  'grid' | 'gridSize' | 'mapId' | 'stats' | 'year' | 'month' | 'day' | 'forecasts' | 'riverLevel' | 'heatwave'
  | 'outbreaks' | 'disastersEnabled'
>;

function hasBuilding(state: SystemTipState, type: string): boolean {
  for (let y = 0; y < state.gridSize; y++) {
    const row = state.grid[y];
    for (let x = 0; x < state.gridSize; x++) if (row[x].building.type === type) return true;
  }
  return false;
}

const crises = (s: SystemTipState) => s.disastersEnabled !== false;
const today = (s: SystemTipState) => absoluteDay(s.year, s.month, s.day);

export const SYSTEM_TIP_CHECKS: Record<SystemTipId, (state: SystemTipState) => boolean> = {
  first_power_cut: (s) => (s.stats.power?.cut.length ?? 0) > 0,
  first_water_shortage: (s) => s.stats.population > 0 && !!s.stats.water && (s.stats.water.ratio < 1 || s.stats.water.cut.length > 0),
  first_informal_settlement: (s) => hasBuilding(s, 'informal_housing'),
  monsoon_forecast: (s) =>
    crises(s) && s.mapId === 'varanasi' &&
    ((s.forecasts ?? []).some((f) => f.id === 'monsoon') || (s.riverLevel ?? 0) > 0),
  first_heatwave: (s) => crises(s) && (isHeatwavePending(s.heatwave, today(s)) || isHeatwaveActive(s.heatwave, today(s))),
  first_outbreak: (s) => crises(s) && (s.outbreaks?.length ?? 0) > 0,
  first_landmark_unlocked: (s) =>
    s.mapId === 'varanasi' && getUnlockedLandmarks(toDisplayPopulation(s.stats.population)).length > 0,
  festival_prep: (s) =>
    s.mapId === 'varanasi' &&
    getUpcomingFestivals(s.month, s.day, SYSTEM_TIP_CONFIG.festivalPrepDays).some((u) => u.festival.type === 'management'),
  debt_warning: (s) => s.stats.money < 0,
};
