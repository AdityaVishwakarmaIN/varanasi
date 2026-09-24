/**
 * Landmarks (S5-T1, S5-T2): data, unlocks from the PEAK displayed population, and placement rules with the
 * red reason shown to the player. Pure: the caller passes map facts in through `LandmarkPlacementContext`.
 *
 * Landmarks are shown respectfully: they never catch fire, collapse, become abandoned or take flood damage
 * (`isLandmarkType` lets those systems skip them).
 */
import { formatIndianNumber } from '@/lib/format';
import { getDistanceToGanga, getRiverZone, type RiverZone } from '@/games/isocity/maps/riverZones';
import type { MapId } from '@/games/isocity/maps/varanasi';

export type LandmarkId =
  | 'landmark_dashashwamedh'
  | 'landmark_kashi_vishwanath'
  | 'landmark_bhu'
  | 'landmark_sarnath'
  | 'landmark_ramnagar_fort';

/** Effects (starting values). Missing fields mean "no effect". */
export interface LandmarkEffects {
  /** Counts as this many ghats for tourism. */
  countsAsGhats?: number;
  /** City-wide happiness points. */
  happiness?: number;
  /** ₹ per tick of tourism income. */
  tourismPerTick?: number;
  /** When true, tourismPerTick is multiplied by the Ganga factor (riverFactor in tourism.ts). */
  tourismGangaAffected?: boolean;
  commercialDemand?: number;
  residentialDemand?: number;
  /** Pilgrim crowds × this within pilgrimRadius tiles. */
  pilgrimMultiplier?: number;
  pilgrimRadius?: number;
  /** Education coverage with this × the university range. */
  educationRangeMultiplier?: number;
  /** Land value bonus within landValueRadius tiles. */
  landValueBonus?: number;
  landValueRadius?: number;
  /** Boat routes also run here (S2-T10). */
  boatDestination?: boolean;
  /** Hosts the nightly Ganga Aarti (S5-T3). */
  hostsGangaAarti?: boolean;
  /** Needed for Maha Shivratri to be at full scale (S5-T4). */
  fullScaleShivratri?: boolean;
}

export interface LandmarkDef {
  id: LandmarkId;
  name: string;
  /** Displayed population (after POPULATION_DISPLAY_SCALE) at which it unlocks. */
  unlockPopulation: number;
  size: { width: number; height: number };
  /** ₹ */
  cost: number;
  /** Plain-English placement rule for the tooltip. */
  placement: string;
  effects: LandmarkEffects;
}

/** In unlock order. */
export const LANDMARKS: Record<LandmarkId, LandmarkDef> = {
  landmark_dashashwamedh: {
    id: 'landmark_dashashwamedh',
    name: 'Dashashwamedh Ghat',
    unlockPopulation: 50_000,
    size: { width: 2, height: 2 },
    cost: 15_000,
    placement: 'Must include at least 2 west-bank riverfront tiles',
    effects: { countsAsGhats: 4, happiness: 2, hostsGangaAarti: true },
  },
  landmark_kashi_vishwanath: {
    id: 'landmark_kashi_vishwanath',
    name: 'Kashi Vishwanath Temple',
    unlockPopulation: 100_000,
    size: { width: 2, height: 2 },
    cost: 40_000,
    placement: 'Within 8 tiles of the Ganga, on the west bank',
    effects: {
      tourismPerTick: 150,
      tourismGangaAffected: true,
      commercialDemand: 10,
      pilgrimMultiplier: 2,
      pilgrimRadius: 10,
      fullScaleShivratri: true,
    },
  },
  landmark_bhu: {
    id: 'landmark_bhu',
    name: 'Banaras Hindu University',
    unlockPopulation: 200_000,
    size: { width: 4, height: 4 },
    cost: 60_000,
    placement: 'Any land outside a flood zone',
    effects: { educationRangeMultiplier: 2, residentialDemand: 10, commercialDemand: 5 },
  },
  landmark_sarnath: {
    id: 'landmark_sarnath',
    name: 'Sarnath',
    unlockPopulation: 300_000,
    size: { width: 3, height: 3 },
    cost: 50_000,
    placement: 'Northern quarter of the map, west of the Ganga',
    effects: { tourismPerTick: 200, tourismGangaAffected: false, happiness: 3 },
  },
  landmark_ramnagar_fort: {
    id: 'landmark_ramnagar_fort',
    name: 'Ramnagar Fort',
    unlockPopulation: 500_000,
    size: { width: 3, height: 3 },
    cost: 80_000,
    placement: 'East bank, beyond the sandy floodplain',
    effects: { tourismPerTick: 250, tourismGangaAffected: true, boatDestination: true, landValueBonus: 20, landValueRadius: 6 },
  },
};

/** All landmark IDs in unlock order. */
export const LANDMARK_IDS: readonly LandmarkId[] = (Object.keys(LANDMARKS) as LandmarkId[]).sort(
  (a, b) => LANDMARKS[a].unlockPopulation - LANDMARKS[b].unlockPopulation
);

/** Placement tunables. */
export const LANDMARK_PLACEMENT_CONFIG = {
  dashashwamedhMinRiverfrontTiles: 2,
  kashiMaxDistanceToGanga: 8,
  /** Sarnath: every footprint tile must have v = y / (gridSize − 1) below this. */
  sarnathMaxV: 0.25,
} as const;

/** Red reasons, exactly as shown to the player. */
export const LANDMARK_REASONS = {
  notVaranasi: 'Landmarks can only be built on the Varanasi map',
  alreadyBuilt: (name: string) => `${name} has already been built. Each landmark can be built once`,
  locked: (population: number) => `Unlocks at ${formatIndianNumber(population)} people`,
  offMap: 'Not enough room here: the landmark would go off the map',
  notFree: 'The whole site must be clear, dry land',
  dashashwamedh: 'Dashashwamedh Ghat must include at least 2 west-bank riverfront tiles',
  kashiWestBank: 'Kashi Vishwanath Temple must be on the Ganga\'s west bank',
  kashiDistance: 'Kashi Vishwanath Temple must be within 8 tiles of the Ganga',
  bhuFlood: 'Banaras Hindu University cannot be built in a flood zone',
  sarnathNorth: 'Sarnath must be in the northern quarter of the map',
  sarnathWest: 'Sarnath must be west of the Ganga',
  ramnagarEast: 'Ramnagar Fort must be on the Ganga\'s east bank',
  ramnagarFloodplain: 'Ramnagar Fort cannot be built on the sandy floodplain',
} as const;

/** True for any landmark building type (used by fire, collapse, abandonment and flood systems to skip them). */
export function isLandmarkType(type: string): type is LandmarkId {
  return Object.prototype.hasOwnProperty.call(LANDMARKS, type);
}

/** Landmarks unlocked at this peak displayed population, in unlock order. */
export function getUnlockedLandmarks(peakDisplayedPopulation: number): LandmarkId[] {
  return LANDMARK_IDS.filter((id) => LANDMARKS[id].unlockPopulation <= peakDisplayedPopulation);
}

/** The next landmark to unlock, or null when all are unlocked. */
export function getNextLandmark(peakDisplayedPopulation: number): LandmarkDef | null {
  for (const id of LANDMARK_IDS) {
    if (LANDMARKS[id].unlockPopulation > peakDisplayedPopulation) return LANDMARKS[id];
  }
  return null;
}

/**
 * Statistics-panel line: "Next landmark: Sarnath at 3,00,000 (you: 2,41,000)", or null when all are unlocked.
 * @param currentDisplayedPopulation shown after "you:"; defaults to the peak
 */
export function formatNextLandmarkLine(peakDisplayedPopulation: number, currentDisplayedPopulation = peakDisplayedPopulation): string | null {
  const next = getNextLandmark(peakDisplayedPopulation);
  if (!next) return null;
  return `Next landmark: ${next.name} at ${formatIndianNumber(next.unlockPopulation)} (you: ${formatIndianNumber(currentDisplayedPopulation)})`;
}

export interface LandmarkPlacementContext {
  gridSize: number;
  mapId: MapId | undefined;
  /** True when the tile is land the landmark may cover (grass or tree, not water, road or another building). */
  isLandFree: (x: number, y: number) => boolean;
  /** Landmarks already built. */
  built: readonly LandmarkId[];
  /** Flood-zone test from the Sprint 4 flood mask. When absent, the east floodplain and west riverfront count as flood zones. */
  isFloodZone?: (x: number, y: number) => boolean;
  /** When given, locked landmarks are refused with "Unlocks at N people". */
  peakDisplayedPopulation?: number;
}

export interface PlacementResult {
  ok: boolean;
  reason?: string;
}

const WEST: ReadonlySet<RiverZone> = new Set<RiverZone>(['westRiverfront', 'westBank']);

/**
 * Can landmark `id` go with its top-left (origin) tile at (x, y)? The footprint extends +x and +y, like other multi-tile buildings.
 * Checks, in order: map, built once, unlocked, bounds, clear land, then the landmark's own rule.
 */
export function canPlaceLandmark(id: LandmarkId, x: number, y: number, ctx: LandmarkPlacementContext): PlacementResult {
  const def = LANDMARKS[id];
  const R = LANDMARK_REASONS;
  if (ctx.mapId !== 'varanasi') return { ok: false, reason: R.notVaranasi };
  if (ctx.built.includes(id)) return { ok: false, reason: R.alreadyBuilt(def.name) };
  if (ctx.peakDisplayedPopulation !== undefined && ctx.peakDisplayedPopulation < def.unlockPopulation) {
    return { ok: false, reason: R.locked(def.unlockPopulation) };
  }
  const { width, height } = def.size;
  if (x < 0 || y < 0 || x + width > ctx.gridSize || y + height > ctx.gridSize) return { ok: false, reason: R.offMap };

  const tiles: { x: number; y: number; zone: RiverZone }[] = [];
  for (let dy = 0; dy < height; dy++) {
    for (let dx = 0; dx < width; dx++) {
      const tx = x + dx;
      const ty = y + dy;
      if (!ctx.isLandFree(tx, ty)) return { ok: false, reason: R.notFree };
      tiles.push({ x: tx, y: ty, zone: getRiverZone(tx, ty, ctx.gridSize, ctx.mapId) });
    }
  }
  const cfg = LANDMARK_PLACEMENT_CONFIG;

  switch (id) {
    case 'landmark_dashashwamedh': {
      const riverfront = tiles.filter((t) => t.zone === 'westRiverfront').length;
      return riverfront >= cfg.dashashwamedhMinRiverfrontTiles ? { ok: true } : { ok: false, reason: R.dashashwamedh };
    }
    case 'landmark_kashi_vishwanath': {
      if (!tiles.every((t) => WEST.has(t.zone))) return { ok: false, reason: R.kashiWestBank };
      const minDist = Math.min(...tiles.map((t) => getDistanceToGanga(t.x, t.y, ctx.gridSize, ctx.mapId)));
      return minDist <= cfg.kashiMaxDistanceToGanga ? { ok: true } : { ok: false, reason: R.kashiDistance };
    }
    case 'landmark_bhu': {
      const isFlood = ctx.isFloodZone;
      const inFlood = tiles.some((t) =>
        isFlood ? isFlood(t.x, t.y) : t.zone === 'eastFloodplain' || t.zone === 'westRiverfront'
      );
      return inFlood ? { ok: false, reason: R.bhuFlood } : { ok: true };
    }
    case 'landmark_sarnath': {
      const maxRow = ctx.gridSize > 1 ? ctx.gridSize - 1 : 1;
      if (!tiles.every((t) => t.y / maxRow < cfg.sarnathMaxV)) return { ok: false, reason: R.sarnathNorth };
      return tiles.every((t) => WEST.has(t.zone)) ? { ok: true } : { ok: false, reason: R.sarnathWest };
    }
    case 'landmark_ramnagar_fort': {
      if (tiles.some((t) => t.zone === 'eastFloodplain')) return { ok: false, reason: R.ramnagarFloodplain };
      return tiles.every((t) => t.zone === 'eastBank') ? { ok: true } : { ok: false, reason: R.ramnagarEast };
    }
  }
}
