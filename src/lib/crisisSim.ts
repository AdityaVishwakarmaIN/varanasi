/**
 * Heatwaves (S4-T7), disease outbreaks (S4-T9) and old-building collapse (S4-T10) wired into the city.
 * The rules live in heatwave.ts, disease.ts and collapse.ts; this file reads a GameState for them and runs the
 * once-a-day step used by `simulateTick`. Nothing here draws randomness except through the `rng` it is given.
 */
import type { GameState, Notification, Tile } from '@/types/game';
import type { ServiceCoverage } from '@/games/isocity/types/services';
import type { Rng } from '@/lib/rng';
import type { ForecastInput } from '@/lib/notifications';
import type { Season } from '@/lib/seasons';
import {
  clearFinishedHeatwave,
  computeHeatwaveHit,
  computeShadeMask,
  HEATWAVE_CONFIG,
  isHeatwaveActive,
  maybeScheduleHeatwave,
  type HeatwaveState,
} from '@/lib/heatwave';
import {
  advanceOutbreak,
  calculateDiseaseRisk,
  DISEASE_CONFIG,
  DISEASE_FACTOR_LABELS,
  getTopRiskFactor,
  rollOutbreak,
  startOutbreak,
  type DiseaseRiskInputs,
  type OutbreakState,
} from '@/lib/disease';
import { getCollapseChance } from '@/lib/collapse';
import { isLandmarkType } from '@/lib/landmarks';
import { getFeederBounds, getFeederCount } from '@/lib/feederZones';
import { getMohallaForFeeder } from '@/lib/citizenVoices';
import { getDistanceToGanga } from '@/games/isocity/maps/riverZones';
import { SCORING_CONFIG } from '@/lib/scoring';

export const CRISIS_SIM_CONFIG = {
  /** Heatwave and disease rolls happen on days where absoluteDay % weekDays === 0. */
  weekDays: 7,
  /** Buildings that give shade in a heatwave. */
  shadeTypes: ['tree', 'park', 'park_large', 'community_garden', 'playground_small', 'playground_large'] as readonly string[],
} as const;

type Added = Omit<Notification, 'id' | 'timestamp'>;

export function isWeeklyCheckDay(today: number): boolean {
  return today % CRISIS_SIM_CONFIG.weekDays === 0;
}

// ---------------------------------------------------------------------------
// Heatwaves
// ---------------------------------------------------------------------------

export interface HeatwaveDayResult {
  heatwave: HeatwaveState | undefined;
  forecast?: ForecastInput;
  notifications: Added[];
}

/** Once a day: drop a finished heatwave, roll a new one weekly in summer (forecast), and announce the first hot day. */
export function runHeatwaveDay(heatwave: HeatwaveState | undefined, today: number, season: Season, rng: Rng): HeatwaveDayResult {
  const result: HeatwaveDayResult = { heatwave: clearFinishedHeatwave(heatwave, today), notifications: [] };
  if (isWeeklyCheckDay(today)) {
    const next = maybeScheduleHeatwave({ heatwave: result.heatwave, today, season }, rng);
    result.heatwave = next.heatwave;
    if (next.scheduled && next.heatwave) {
      result.forecast = {
        id: 'heatwave',
        title: 'Heatwave coming',
        description: `The IMD warns of a heatwave lasting ${next.heatwave.endDay - next.heatwave.startDay} days. Homes without power or water will suffer; trees, parks and hospitals help.`,
        daysAhead: HEATWAVE_CONFIG.leadDays,
        icon: 'heat',
        overlay: 'power',
      };
    }
  }
  if (result.heatwave && today === result.heatwave.startDay) {
    result.notifications.push({
      title: 'Heatwave!',
      description: 'Neighbourhoods without power or water are suffering.',
      icon: 'heat',
      severity: 'crisis',
      overlay: 'power',
    });
  }
  return result;
}

let shadeCache: { key: string; mask: Uint8Array } | null = null;

/** Tiles shaded by a nearby tree or park, re-scanned only when buildings change. */
export function getShadeMask(grid: Tile[][], size: number, structureVersion: number): Uint8Array {
  const key = `${size}|${structureVersion}`;
  if (shadeCache && shadeCache.key === key) return shadeCache.mask;
  const sources: { x: number; y: number }[] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (CRISIS_SIM_CONFIG.shadeTypes.includes(grid[y][x].building.type)) sources.push({ x, y });
    }
  }
  const mask = computeShadeMask(size, sources);
  shadeCache = { key, mask };
  return mask;
}

/**
 * City-wide health and happiness lost to a running heatwave: each residential tile's hit (heatwave.ts), weighted by
 * its residents. Returns zeros when no heatwave is running.
 */
export function getHeatwaveCityHit(
  grid: Tile[][],
  size: number,
  services: Pick<ServiceCoverage, 'power' | 'water' | 'health'>,
  heatwave: HeatwaveState | undefined,
  today: number,
  structureVersion: number
): { health: number; happiness: number } {
  if (!isHeatwaveActive(heatwave, today)) return { health: 0, happiness: 0 };
  const shade = getShadeMask(grid, size, structureVersion);
  let people = 0;
  let health = 0;
  let happiness = 0;
  for (let y = 0; y < size; y++) {
    const row = grid[y];
    for (let x = 0; x < size; x++) {
      const b = row[x].building;
      if (row[x].zone !== 'residential' || !b.population) continue;
      const hit = computeHeatwaveHit({
        hasPower: services.power[y][x],
        hasWater: services.water[y][x],
        hasShade: shade[y * size + x] === 1,
        hasHospital: services.health[y][x] > 0,
      });
      people += b.population;
      health += hit.health * b.population;
      happiness += hit.happiness * b.population;
    }
  }
  return people > 0 ? { health: health / people, happiness: happiness / people } : { health: 0, happiness: 0 };
}

// ---------------------------------------------------------------------------
// Disease
// ---------------------------------------------------------------------------

export interface DiseaseDayInput {
  grid: Tile[][];
  size: number;
  services: Pick<ServiceCoverage, 'water' | 'health'>;
  mapId: GameState['mapId'];
  gangaHealth: number | undefined;
  season: Season;
  today: number;
  outbreaks: readonly OutbreakState[] | undefined;
  /** Tiles that were under water within the last `recentFloodDays` (or null). */
  recentFloodMask: Uint8Array | null;
}

export interface DiseaseDayResult {
  outbreaks: OutbreakState[] | undefined;
  notifications: Added[];
  /** Population to remove now, per feeder block. */
  losses: { feeder: number; fraction: number }[];
}

interface BlockScan {
  inputs: DiseaseRiskInputs;
  hospitalCoverage: number;
  waterCoverage: number;
}

function scanBlock(input: DiseaseDayInput, feeder: number): BlockScan {
  const { grid, size, services } = input;
  const b = getFeederBounds(feeder, size);
  let population = 0;
  let residential = 0;
  let dry = 0;
  let tiles = 0;
  let hospital = 0;
  let watered = 0;
  let catchment = false;
  let flooded = false;
  const catchmentRadius = SCORING_CONFIG.ganga.catchmentRadius;
  for (let y = b.y0; y < b.y1; y++) {
    for (let x = b.x0; x < b.x1; x++) {
      const tile = grid[y][x];
      if (tile.building.type === 'water') continue;
      tiles++;
      hospital += Math.min(100, services.health[y][x]);
      if (services.water[y][x]) watered++;
      if (tile.zone === 'residential') {
        residential++;
        population += tile.building.population || 0;
        if (!services.water[y][x]) dry++;
      }
      if (!catchment && getDistanceToGanga(x, y, size, input.mapId) <= catchmentRadius) catchment = true;
      if (!flooded && input.recentFloodMask?.[y * size + x]) flooded = true;
    }
  }
  return {
    inputs: {
      population,
      residentialTiles: residential,
      residentialTilesWithoutWater: dry,
      gangaHealth: input.gangaHealth,
      hasCatchmentTiles: catchment,
      floodedRecently: flooded,
      season: input.season,
    },
    hospitalCoverage: tiles > 0 ? hospital / tiles : 0,
    waterCoverage: tiles > 0 ? (watered / tiles) * 100 : 0,
  };
}

/** Once a day: advance running outbreaks (cure, population loss); weekly, roll new ones in blocks with residents. */
export function runDiseaseDay(input: DiseaseDayInput, rng: Rng): DiseaseDayResult {
  const result: DiseaseDayResult = { outbreaks: undefined, notifications: [], losses: [] };
  const kept: OutbreakState[] = [];
  const infected = new Set<number>();
  const feederCount = getFeederCount(input.size);

  for (const outbreak of input.outbreaks ?? []) {
    const scan = scanBlock(input, outbreak.feeder);
    const step = advanceOutbreak(outbreak, { today: input.today, hospitalCoverage: scan.hospitalCoverage, waterCoverage: scan.waterCoverage });
    if (step.populationLossFraction > 0) result.losses.push({ feeder: outbreak.feeder, fraction: step.populationLossFraction });
    if (step.outbreak) {
      kept.push(step.outbreak);
      infected.add(outbreak.feeder);
    } else {
      const area = getMohallaForFeeder(outbreak.feeder, feederCount);
      result.notifications.push({
        title: step.ended === 'cured' ? `The outbreak in ${area} is over` : `The outbreak in ${area} has burnt out`,
        description:
          step.ended === 'cured'
            ? 'Hospitals and clean water stopped the disease.'
            : 'It ran its course without hospitals and clean water, and took more lives.',
        icon: 'info',
        severity: step.ended === 'cured' ? 'info' : 'warning',
      });
    }
  }

  if (isWeeklyCheckDay(input.today)) {
    for (let feeder = 0; feeder < feederCount; feeder++) {
      if (infected.has(feeder)) continue;
      const scan = scanBlock(input, feeder);
      if (scan.inputs.population <= 0) continue;
      if (!rollOutbreak(calculateDiseaseRisk(scan.inputs), rng)) continue;
      kept.push(startOutbreak(feeder, input.today));
      const area = getMohallaForFeeder(feeder, feederCount);
      const cause = DISEASE_FACTOR_LABELS[getTopRiskFactor(scan.inputs)];
      const b = getFeederBounds(feeder, input.size);
      result.notifications.push({
        title: `Disease outbreak in ${area}`,
        description: `${cause} in ${area}. Hospital coverage and clean water will end it.`,
        icon: 'alert',
        severity: 'crisis',
        overlay: 'health',
        x: b.centerX,
        y: b.centerY,
      });
    }
  }

  result.outbreaks = kept.length > 0 ? kept : undefined;
  return result;
}

const outbreakMaskCache = new WeakMap<readonly OutbreakState[], { size: number; mask: Uint8Array }>();

/** Tiles in infected blocks (1 = infected), or null when there are no outbreaks. Cached per outbreak list. */
export function getOutbreakMask(outbreaks: readonly OutbreakState[] | undefined, size: number): Uint8Array | null {
  if (!outbreaks || outbreaks.length === 0) return null;
  const cached = outbreakMaskCache.get(outbreaks);
  if (cached && cached.size === size) return cached.mask;
  const mask = new Uint8Array(size * size);
  for (const o of outbreaks) {
    const b = getFeederBounds(o.feeder, size);
    for (let y = b.y0; y < b.y1; y++) mask.fill(1, y * size + b.x0, y * size + b.x1);
  }
  outbreakMaskCache.set(outbreaks, { size, mask });
  return mask;
}

/** City health lost to outbreaks: the block penalty weighted by the share of residents in infected blocks. */
export function getDiseaseHealthPenalty(grid: Tile[][], size: number, mask: Uint8Array | null, population: number): number {
  if (!mask || population <= 0) return 0;
  let sick = 0;
  for (let y = 0; y < size; y++) {
    const row = grid[y];
    for (let x = 0; x < size; x++) if (mask[y * size + x]) sick += row[x].building.population || 0;
  }
  return DISEASE_CONFIG.healthPenalty * Math.min(1, sick / population);
}

// ---------------------------------------------------------------------------
// Collapse
// ---------------------------------------------------------------------------

export interface CollapseDayResult {
  collapsed: { x: number; y: number }[];
  notifications: Added[];
}

/** Once a day: each old residential or commercial building may collapse (becomes abandoned, residents gone). */
export function runCollapseDay(
  grid: Tile[][],
  size: number,
  services: Pick<ServiceCoverage, 'fire'>,
  season: Season,
  floodedThisYear: Uint8Array | null,
  rng: Rng
): CollapseDayResult {
  const result: CollapseDayResult = { collapsed: [], notifications: [] };
  for (let y = 0; y < size; y++) {
    const row = grid[y];
    for (let x = 0; x < size; x++) {
      const tile = row[x];
      const b = tile.building;
      if (isLandmarkType(b.type)) continue; // Landmarks never collapse (S5-T1)
      const chance = getCollapseChance({
        zone: tile.zone,
        age: b.age ?? 0,
        abandoned: !!b.abandoned,
        constructionComplete: b.constructionProgress === undefined || b.constructionProgress >= 100,
        season,
        floodedThisYear: !!floodedThisYear?.[y * size + x],
        fireCoverage: services.fire[y][x] > 0,
      });
      if (chance <= 0 || rng() >= chance) continue;
      result.collapsed.push({ x, y });
      result.notifications.push({
        title: 'An old building has collapsed',
        description: 'Ageing buildings can fall, most often in the monsoon. Fire stations nearby inspect them and cut the risk.',
        icon: 'alert',
        severity: 'crisis',
        overlay: 'fire',
        x,
        y,
      });
    }
  }
  return result;
}
