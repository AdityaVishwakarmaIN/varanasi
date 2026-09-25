/**
 * Named advisor messages (S5-T6) derived from the current GameState. Every system from Sprints 2–5 that can go
 * wrong raises a message from the right advisor, with a one-line problem, a one-line fix and a "Show me" target.
 * Pure: the panel recomputes this from state; nothing is stored in the save.
 */
import type { GameState, Notification } from '@/types/game';
import {
  createAdvisorNote,
  mergeAdvisorMessages,
  type AdvisorNote,
  type AdvisorPriority,
} from '@/lib/advisors';
import type { ProblemIconSet } from '@/lib/problemIcons';
import { getFeederBounds } from '@/lib/feederZones';
import { formatINR } from '@/lib/format';
import { FAILURE_CONFIG } from '@/lib/failure';
import { isHeatwaveActive, isHeatwavePending } from '@/lib/heatwave';
import { getActiveFestivals, getUpcomingFestivals } from '@/lib/festivals';
import { absoluteDay } from '@/lib/seasons';
import { needsFirstGhat } from '@/lib/gangaTips';
import { getInformalAreaName } from '@/lib/informalSim';

export const ADVISOR_FEED_CONFIG = {
  /** Average traffic on road tiles (0–100) above which the City Engineer complains. */
  trafficHigh: 60,
  /** Tax rate (%) above which the Treasury Officer warns. */
  taxHigh: 14,
  /** Ganga Health below this is a River Officer message (high below `gangaCritical`). */
  gangaPoor: 50,
  gangaCritical: 30,
  /** Recent notifications scanned for one-off events (collapses, displacements). */
  recentNotifications: 12,
  /** Share of population in informal housing that makes the settlement message medium priority. */
  informalMediumCount: 5,
} as const;

/** Fields of GameState the advisors read. */
export type AdvisorFeedState = Pick<
  GameState,
  | 'grid' | 'gridSize' | 'mapId' | 'stats' | 'taxRate' | 'year' | 'month' | 'day' | 'hour'
  | 'riverLevel' | 'forecasts' | 'heatwave' | 'outbreaks' | 'notifications' | 'disastersEnabled'
>;

function priorityByCount(n: number, high: number, critical = Infinity): AdvisorPriority {
  if (n >= critical) return 'critical';
  if (n >= high) return 'high';
  return 'medium';
}

interface GridScan {
  informal: number;
  informalAt?: { x: number; y: number };
  roadTiles: number;
  roadTraffic: number;
  busiestRoad?: { x: number; y: number; traffic: number };
  ghats: number;
}

function scanGrid(state: AdvisorFeedState): GridScan {
  const out: GridScan = { informal: 0, roadTiles: 0, roadTraffic: 0, ghats: 0 };
  const { grid, gridSize } = state;
  for (let y = 0; y < gridSize; y++) {
    const row = grid[y];
    for (let x = 0; x < gridSize; x++) {
      const t = row[x];
      const type = t.building.type;
      if (type === 'road' || type === 'bridge') {
        out.roadTiles++;
        out.roadTraffic += t.traffic;
        if (!out.busiestRoad || t.traffic > out.busiestRoad.traffic) out.busiestRoad = { x, y, traffic: t.traffic };
      } else if (type === 'informal_housing') {
        out.informal++;
        if (!out.informalAt) out.informalAt = { x, y };
      } else if (type === 'ghat') {
        out.ghats++;
      }
    }
  }
  return out;
}

/** One-off events from recent notifications that no live condition covers. */
function notesFromNotifications(list: readonly Notification[]): AdvisorNote[] {
  const out: AdvisorNote[] = [];
  const recent = list.slice(0, ADVISOR_FEED_CONFIG.recentNotifications);
  const at = (n: Notification) => (n.x !== undefined && n.y !== undefined ? { x: n.x, y: n.y } : {});
  const collapse = recent.find((n) => /collapsed/i.test(n.title));
  if (collapse) {
    out.push(createAdvisorNote('collapse', 'collapse', 'medium', 'An old building has collapsed.',
      'Fire station cover lowers the risk; old flood-damaged blocks are most at risk.', { ...at(collapse), overlay: 'fire' }));
  }
  const displaced = recent.find((n) => /displaced/i.test(n.title));
  if (displaced) {
    out.push(createAdvisorNote('informal_settlement', 'displaced', 'medium', 'Families were displaced by a bulldozer.',
      'Formalise settlements instead: zone residential and bring road, power and water.', at(displaced)));
  }
  return out;
}

/**
 * All current advisor messages, sorted by priority (critical first), at most 3 per advisor.
 * @param problems the problem icon set (S5-T5), used for counts and "Show me" targets
 */
export function deriveAdvisorNotes(state: AdvisorFeedState, problems: ProblemIconSet | null): AdvisorNote[] {
  const notes: AdvisorNote[] = [];
  const { stats } = state;
  const c = problems?.counts;
  const first = problems?.first ?? {};
  const today = absoluteDay(state.year, state.month, state.day);
  const crisesOn = state.disastersEnabled !== false;
  const varanasi = state.mapId === 'varanasi';
  const scan = scanGrid(state);

  // ---- Treasury Officer ----
  const net = stats.income - stats.expenses;
  if (stats.money < 0) {
    notes.push(createAdvisorNote('bankruptcy', 'debt', 'critical', `The treasury is in debt: ${formatINR(stats.money)}.`,
      `After ${FAILURE_CONFIG.loanOfferAfterDebtMonths} months in debt you get one emergency loan; balance the budget before then.`));
  }
  if (net < 0) {
    notes.push(createAdvisorNote('budget', 'deficit', net < -500 ? 'critical' : 'high',
      `The city loses ${formatINR(-net)} every month.`, 'Raise taxes a little or cut service budgets in the Budget panel.'));
  }
  if (state.taxRate >= ADVISOR_FEED_CONFIG.taxHigh) {
    notes.push(createAdvisorNote('taxes', 'taxes_high', 'medium', `Taxes are high (${state.taxRate}%) and people are moving less.`,
      'Lower the tax rate once the budget allows it.'));
  }

  // ---- City Engineer ----
  const power = stats.power;
  if (power && power.ratio < 1) {
    const pct = Math.round(power.ratio * 100);
    notes.push(createAdvisorNote('power', 'power_shortage', power.ratio < 0.7 ? 'critical' : 'high',
      `Power supply covers ${pct}% of demand: rolling cuts in ${power.cut.length} block${power.cut.length === 1 ? '' : 's'}.`,
      'Build another power plant.', { ...(first.power_cut ?? first.no_power ?? {}), overlay: 'power' }));
  }
  if (c && c.no_power > 0) {
    notes.push(createAdvisorNote('power', 'no_power', priorityByCount(c.no_power, 10),
      `${c.no_power} building${c.no_power === 1 ? ' has' : 's have'} no power line.`,
      'Extend the power network: build a power plant nearby.', { ...first.no_power, overlay: 'power' }));
  }
  const water = stats.water;
  if (water && water.ratio < 1) {
    const pct = Math.round(water.ratio * 100);
    notes.push(createAdvisorNote('water', 'water_shortage', water.ratio < 0.7 ? 'critical' : 'high',
      `Water supply covers ${pct}% of demand: taps run dry in turns.`,
      varanasi ? 'Build a water tower or the Jal Sansthan Water Works by the Ganga.' : 'Build another water tower.',
      { ...first.no_water, overlay: 'water' }));
  }
  if (c && c.no_water > 0) {
    notes.push(createAdvisorNote('water', 'no_water', priorityByCount(c.no_water, 10),
      `${c.no_water} building${c.no_water === 1 ? ' has' : 's have'} no water.`,
      'Build a water tower within reach of these buildings.', { ...first.no_water, overlay: 'water' }));
  }
  if (c && c.no_road > 0) {
    notes.push(createAdvisorNote('roads', 'no_road', priorityByCount(c.no_road, 20),
      `${c.no_road} zoned lot${c.no_road === 1 ? ' has' : 's have'} no road access and cannot grow.`,
      'Draw a road next to these lots.', { ...first.no_road }));
  }
  const avgTraffic = scan.roadTiles > 0 ? scan.roadTraffic / scan.roadTiles : 0;
  if (avgTraffic > ADVISOR_FEED_CONFIG.trafficHigh && scan.busiestRoad) {
    notes.push(createAdvisorNote('traffic', 'traffic', avgTraffic > 80 ? 'high' : 'medium',
      'The roads are jammed.', 'Add parallel roads, a rail or subway line, or spread out jobs and homes.',
      { x: scan.busiestRoad.x, y: scan.busiestRoad.y }));
  }
  if (c && c.abandoned > 0) {
    notes.push(createAdvisorNote('zoning', 'abandoned', c.abandoned > 10 ? 'high' : c.abandoned > 5 ? 'medium' : 'low',
      `${c.abandoned} building${c.abandoned === 1 ? ' is' : 's are'} abandoned.`,
      'Check demand: zone less of what is oversupplied, and fix power, water and pollution nearby.', { ...first.abandoned }));
  }
  if (scan.informal > 0 && scan.informalAt) {
    const area = getInformalAreaName(scan.informalAt.x, scan.informalAt.y, state.gridSize, state.mapId);
    notes.push(createAdvisorNote('informal_settlement', 'informal', scan.informal >= ADVISOR_FEED_CONFIG.informalMediumCount ? 'medium' : 'low',
      `${scan.informal} informal settlement${scan.informal === 1 ? '' : 's'}, e.g. in ${area}.`,
      'Formalise them: zone residential and bring road, power and water.', { ...scan.informalAt }));
  }
  const jobRatio = stats.jobs / (stats.population || 1);
  if (stats.population > 100 && jobRatio < 0.8) {
    notes.push(createAdvisorNote('zoning', 'jobs', jobRatio < 0.5 ? 'high' : 'medium', 'There are not enough jobs.',
      'Zone more commercial and industrial land.'));
  }

  // ---- River Officer ----
  const riverLevel = crisesOn ? state.riverLevel ?? 0 : 0;
  if (riverLevel > 0) {
    const flooded = c?.flood ?? 0;
    notes.push(createAdvisorNote('flood', 'flood', riverLevel >= 2 || flooded > 20 ? 'critical' : 'high',
      `The Ganga is at flood level ${riverLevel}${flooded > 0 ? `: ${flooded} buildings under water` : ''}.`,
      'Build embankments along the bank to hold back the next level.', { ...first.flood, overlay: 'flood' }));
  }
  const monsoon = (state.forecasts ?? []).find((f) => f.id === 'monsoon' && f.day >= today);
  if (monsoon && riverLevel === 0) {
    notes.push(createAdvisorNote('flood', 'monsoon_forecast', 'medium', monsoon.title,
      'Open the flood overlay and build embankments before July.', { overlay: 'flood' }));
  }
  const ganga = stats.gangaHealth;
  if (varanasi && ganga !== undefined && ganga < ADVISOR_FEED_CONFIG.gangaPoor) {
    notes.push(createAdvisorNote('ganga', 'ganga_poor', ganga < ADVISOR_FEED_CONFIG.gangaCritical ? 'high' : 'medium',
      `Ganga Health is ${Math.round(ganga)}.`, 'Build Sewage Treatment Plants near homes and keep industry away from the river.',
      { overlay: 'ganga' }));
  }
  if (stats.environment < 40) {
    notes.push(createAdvisorNote('pollution', 'pollution', stats.environment < 20 ? 'high' : 'medium', 'Pollution is high.',
      'Plant trees and parks, and move factories away from homes.'));
  }
  if (varanasi && needsFirstGhat(stats.population, scan.ghats)) {
    notes.push(createAdvisorNote('ghats', 'first_ghat', 'low', 'Pilgrims have no ghat to visit.',
      "Build ghats on the Ganga's west bank to earn tourism income.", { overlay: 'ganga' }));
  }

  // ---- Health Officer ----
  const outbreaks = crisesOn ? state.outbreaks ?? [] : [];
  if (outbreaks.length > 0) {
    const b = getFeederBounds(outbreaks[0].feeder, state.gridSize);
    notes.push(createAdvisorNote('disease', 'outbreak', 'critical',
      `Disease outbreak in ${outbreaks.length} block${outbreaks.length === 1 ? '' : 's'}.`,
      'Get a hospital and clean water to the infected block.', { x: b.centerX, y: b.centerY, overlay: 'health' }));
  }
  if (crisesOn && isHeatwaveActive(state.heatwave, today)) {
    notes.push(createAdvisorNote('heatwave', 'heatwave', 'critical', 'A heatwave is hitting the city.',
      'Keep power and water running; trees and parks give shade.'));
  } else if (crisesOn && isHeatwavePending(state.heatwave, today)) {
    notes.push(createAdvisorNote('heatwave', 'heatwave', 'high', 'A heatwave is forecast.',
      'Plant trees and parks for shade and make sure power and water can keep up.'));
  }
  if (stats.health < 50 && stats.population > 0) {
    notes.push(createAdvisorNote('health', 'health_low', stats.health < 30 ? 'high' : 'medium', 'Health care is lacking.',
      'Build hospitals where people live.', { overlay: 'health' }));
  }
  if (stats.education < 50 && stats.population > 0) {
    notes.push(createAdvisorNote('education', 'education_low', stats.education < 30 ? 'high' : 'medium', 'Education levels are low.',
      'Build schools and a university.', { overlay: 'education' }));
  }

  // ---- Police Commissioner ----
  if (c && c.fire > 0) {
    notes.push(createAdvisorNote('fire', 'fire', c.fire > 3 ? 'critical' : 'high',
      `${c.fire} building${c.fire === 1 ? ' is' : 's are'} on fire.`, 'Build fire stations so every block is covered.',
      { ...first.fire, overlay: 'fire' }));
  }
  if (stats.safety < 40 && stats.population > 0) {
    notes.push(createAdvisorNote('crime', 'crime', stats.safety < 20 ? 'critical' : 'high', 'Crime is rising.',
      'Build police stations where people live.', { overlay: 'police' }));
  }
  if (varanasi) {
    const active = getActiveFestivals(state.month, state.day, state.hour).find((f) => f.type === 'management');
    if (active) {
      notes.push(createAdvisorNote('crowds', 'festival_now', 'high', `${active.name} crowds are in the city.`,
        'Keep roads clear and police and fire cover near the ghats.', { overlay: 'police' }));
    } else {
      const next = getUpcomingFestivals(state.month, state.day).find((u) => u.festival.type === 'management');
      if (next) {
        notes.push(createAdvisorNote('festival', 'festival_prep', next.daysUntil <= 7 ? 'high' : 'medium',
          `${next.festival.name} in ${next.daysUntil} day${next.daysUntil === 1 ? '' : 's'}: big crowds are coming.`,
          'Prepare police, fire and hospital cover, road access, water and power near the ghats.', { overlay: 'police' }));
      }
    }
  }

  notes.push(...notesFromNotifications(state.notifications));
  return mergeAdvisorMessages([], notes);
}
