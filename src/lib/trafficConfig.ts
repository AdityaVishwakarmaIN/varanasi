/**
 * Mixed Indian traffic and cows (S3-T4, S3-T5): data tables and small pure helpers.
 * The vehicle and cow systems in src/components/game/ read these; nothing here touches the canvas.
 */
import type { MapId } from '@/games/isocity/maps/varanasi';
import type { Rng } from '@/lib/rng';

/** Buses already exist as a separate system, so they are not a kind here. */
export type VehicleKind = 'car' | 'auto' | 'erickshaw' | 'motorbike' | 'cycle_rickshaw';

export const VEHICLE_KINDS: readonly VehicleKind[] = ['car', 'auto', 'erickshaw', 'motorbike', 'cycle_rickshaw'];

/** How a kind is drawn in code (like cars today). Colours are CSS hex strings. */
export interface VehicleLook {
  /** Short description for whoever writes the draw code. */
  description: string;
  /** Number of wheels (drives the silhouette). */
  wheels: 2 | 3 | 4;
  /** Body colours to pick from; empty means "use the existing random car colour". */
  bodyColors: readonly string[];
  /** Canopy/roof colours to pick from (3-wheelers and rickshaws). */
  canopyColors: readonly string[];
  /** Length and width relative to a car (1 = car size). */
  lengthScale: number;
  widthScale: number;
}

export interface VehicleKindConfig {
  /** Share of spawned vehicles per map. Each map's shares sum to 1. */
  share: Record<MapId, number>;
  /** Multiplier on the base car speed. */
  speedMultiplier: number;
  look: VehicleLook;
}

export const VEHICLE_MIX: Record<VehicleKind, VehicleKindConfig> = {
  car: {
    share: { varanasi: 0.3, random: 1 },
    speedMultiplier: 1,
    look: { description: 'as today', wheels: 4, bodyColors: [], canopyColors: [], lengthScale: 1, widthScale: 1 },
  },
  auto: {
    share: { varanasi: 0.25, random: 0 },
    speedMultiplier: 0.8,
    look: {
      description: 'small 3-wheeler: yellow-green body, black canopy',
      wheels: 3,
      bodyColors: ['#9ACD32', '#C5D52B', '#E8C547'],
      canopyColors: ['#1A1A1A'],
      lengthScale: 0.75,
      widthScale: 0.8,
    },
  },
  erickshaw: {
    share: { varanasi: 0.15, random: 0 },
    speedMultiplier: 0.6,
    look: {
      description: 'small boxy 3-wheeler, blue or green canopy',
      wheels: 3,
      bodyColors: ['#E6E6E6', '#D0D4D8'],
      canopyColors: ['#1E6FB8', '#2E8B57'],
      lengthScale: 0.7,
      widthScale: 0.75,
    },
  },
  motorbike: {
    share: { varanasi: 0.25, random: 0 },
    speedMultiplier: 1.1,
    look: {
      description: 'thin, one rider',
      wheels: 2,
      bodyColors: ['#202020', '#B22222', '#1F3A93', '#6B6B6B'],
      canopyColors: [],
      lengthScale: 0.5,
      widthScale: 0.3,
    },
  },
  cycle_rickshaw: {
    share: { varanasi: 0.05, random: 0 },
    speedMultiplier: 0.4,
    look: {
      description: 'bicycle plus a small covered seat',
      wheels: 3,
      bodyColors: ['#5A3E2B', '#2F4F4F'],
      canopyColors: ['#8B1A1A', '#1C3F75', '#2E6B30'],
      lengthScale: 0.65,
      widthScale: 0.55,
    },
  },
};

export const TRAFFIC_CONFIG = {
  /** Below this zoom every kind is drawn as the same simple shape (see getLODLevel). */
  detailMinZoom: 0.8,
  /** A motorbike blocked for longer than this may overtake (shift lane offset). */
  motorbikeOvertakeAfterSeconds: 1,
} as const;

/** Picks a vehicle kind by the map's shares. Maps with no shares (or all zero) always get 'car'. */
export function pickVehicleKind(mapId: MapId | undefined, rng: Rng): VehicleKind {
  const map: MapId = mapId ?? 'random';
  let total = 0;
  for (const k of VEHICLE_KINDS) total += Math.max(0, VEHICLE_MIX[k].share[map] ?? 0);
  if (!(total > 0)) return 'car';
  let r = rng() * total;
  let last: VehicleKind = 'car';
  for (const k of VEHICLE_KINDS) {
    const s = Math.max(0, VEHICLE_MIX[k].share[map] ?? 0);
    if (s <= 0) continue;
    last = k;
    if (r < s) return k;
    r -= s;
  }
  return last;
}

/** Speed multiplier for a kind (1 for unknown kinds, e.g. old saves without `kind`). */
export function getVehicleSpeedMultiplier(kind: VehicleKind | undefined): number {
  return kind ? VEHICLE_MIX[kind]?.speedMultiplier ?? 1 : 1;
}

export const COW_CONFIG = {
  /** Hard cap on cows. */
  maxCows: 40,
  /** One cow allowed per this many road tiles. */
  roadTilesPerCow: 60,
  /** Each Gaushala (`animal_pens_farm`) lowers the maximum by this. */
  perGaushalaReduction: 10,
  /** A standing cow pauses for a random time in this range (seconds). */
  pauseMinSeconds: 5,
  pauseMaxSeconds: 20,
  /** Chance per tile reached that a walking cow stops (starting value). */
  pauseChancePerTile: 0.15,
  /** Vehicles on the same tile as a standing cow slow to this fraction of their speed (never 0, so no deadlock). */
  vehicleSlowdown: 0.3,
  /** Cow walking speed relative to a car (starting value). */
  walkSpeedMultiplier: 0.15,
  /** Not drawn below this zoom. */
  minZoomToDraw: 0.8,
  colors: ['#F2F0EA', '#DAD7CF', '#B8B4AC', '#8E8A83'] as readonly string[],
} as const;

/**
 * Maximum cows on the map: min(40, floor(roadTiles / 60)), minus 10 per Gaushala (not below 0),
 * then scaled by the quality preset (e.g. 0.5 on Low).
 */
export function getMaxCows(roadTiles: number, gaushalaCount: number, qualityScale = 1): number {
  const c = COW_CONFIG;
  const base = Math.min(c.maxCows, Math.floor(Math.max(0, roadTiles) / c.roadTilesPerCow));
  const afterGaushalas = Math.max(0, base - c.perGaushalaReduction * Math.max(0, gaushalaCount));
  return Math.floor(afterGaushalas * Math.min(1, Math.max(0, qualityScale)));
}

/** Random pause length in seconds, in [pauseMinSeconds, pauseMaxSeconds]. */
export function pickCowPauseSeconds(rng: Rng): number {
  const c = COW_CONFIG;
  return c.pauseMinSeconds + rng() * (c.pauseMaxSeconds - c.pauseMinSeconds);
}
