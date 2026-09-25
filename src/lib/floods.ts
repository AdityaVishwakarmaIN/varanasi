/**
 * Monsoon floods and embankments (Sprint 4, S4-T5 / S4-T6). Pure functions; every tunable is in FLOOD_CONFIG.
 *
 * Only meaningful on the Varanasi map: callers must not use the masks on a random map.
 *
 * Timeline of a year:
 *   1 June        → `rollMonsoonStrength` (weak 25% / normal 50% / heavy 25%) and a 30-day forecast.
 *   1 Jul – 30 Sep → `getRiverLevel` rises along a sine curve, peaks mid-August, and is back to 0 on 30 Sep.
 *   Each day       → `computeFloodMask(gridSize, riverLevel, embankments)` (memoized, so it is only rebuilt
 *                    when the level or the embankment set changes).
 *
 * Note on the curve: the real Jul 1 – Sep 30 span is 92 days, but the game calendar has 30-day months,
 * so the flood season here is exactly 90 game days (`floodSeasonDays`).
 */
import type { Rng } from '@/lib/rng';
import { getRiverZoneArrays } from '@/games/isocity/maps/riverZones';
import { getVaranasiLayout, LAYOUT_WATER } from '@/games/isocity/maps/varanasiLayout';
import { CALENDAR } from '@/lib/seasons';

/** How strong this year's monsoon is. Rolled on 1 June. */
export type MonsoonStrength = 'weak' | 'normal' | 'heavy';

export const MONSOON_STRENGTHS: readonly MonsoonStrength[] = ['weak', 'normal', 'heavy'];

/** River level at which floods are at their worst. */
export const MAX_RIVER_LEVEL = 3;

export const FLOOD_CONFIG = {
  /** Chance of each monsoon strength (must sum to 1). */
  strengthChances: { weak: 0.25, normal: 0.5, heavy: 0.25 } as Record<MonsoonStrength, number>,
  /** Highest river level reached by each strength. */
  peakLevel: { weak: 1, normal: 2, heavy: 3 } as Record<MonsoonStrength, number>,
  /** The monsoon strength is rolled (and forecast) on this date each year. */
  rollMonth: 6,
  rollDay: 1,
  /** Forecast shows this many days ahead (1 June + 30 = 1 July, when the river starts rising). */
  forecastDaysAhead: 30,
  /** Flood season: from day 1 of `floodStartMonth` to the last day of `floodEndMonth`. */
  floodStartMonth: 7,
  floodEndMonth: 9,
  /**
   * Shape of the rise and fall. level = min(peak, floor((peak + 1) × sin(π·t)^curveExponent)), t = 0..1 over the season.
   * Using (peak + 1) instead of peak means the peak level is actually reached (floor(peak × sin) would only hit it
   * on the single day where sin = 1, which never lands on a whole day). Raise the exponent for a shorter, sharper peak.
   */
  curveExponent: 1,
  /** Level 1: east-floodplain tiles within this many tiles of the Ganga flood. */
  level1FloodplainDistance: 3,
  /** Level 3: west-bank tiles within this many tiles of the Ganga flood. */
  level3WestBankDistance: 3,
  /** Level 3: land tiles within this many tiles of the Assi or Varuna flood. */
  level3TributaryDistance: 2,
  /** Chance per in-game day that a flooded building becomes abandoned. */
  damageChance: 0.01,
  /** Same, for informal housing (S3-T9). */
  informalDamageChance: 0.05,
  /** Buildings that take no flood damage (ghats are built to flood). */
  damageImmuneTypes: ['ghat', 'embankment', 'road', 'bridge', 'grass', 'empty', 'water', 'tree'] as readonly string[],
  /** Days a receded flood leaves a silt tint on the tile (visual only). */
  siltDays: 10,
  /** Flood water drawn over land tiles. */
  waterColor: 'rgba(110, 95, 60, 0.55)',
  /** Light ripple lines on flood water. */
  rippleColor: 'rgba(200, 185, 150, 0.35)',
  /** Silt left on land after the water goes down. */
  siltColor: 'rgba(140, 115, 70, 0.3)',
  /** Flood-risk overlay colours by the lowest river level that floods the tile. */
  overlayColors: { 1: '#8b1a1a', 2: '#f08c1a', 3: '#f2d33a' } as Record<1 | 2 | 3, string>,
  /** Embankment reach, in tiles (Euclidean). */
  embankmentRadius: 4,
  /** Embankments may be built only on land within this many tiles of the Ganga. */
  embankmentMaxDistanceToGanga: 4,
  /** Embankment cost per tile (₹). */
  embankmentCost: 300,
  /** Land value change near an embankment (it blocks the river view), and its reach in tiles. */
  embankmentLandValuePenalty: -10,
  embankmentLandValueRadius: 2,
  /** Masks kept in the memo cache (older entries are dropped first). */
  maskCacheSize: 24,
} as const;

// ---------------------------------------------------------------------------
// Monsoon strength and river level
// ---------------------------------------------------------------------------

/** Rolls this year's monsoon strength (weak 25%, normal 50%, heavy 25%) with one `rng()` draw. */
export function rollMonsoonStrength(rng: Rng): MonsoonStrength {
  let r = rng();
  for (const s of MONSOON_STRENGTHS) {
    const p = FLOOD_CONFIG.strengthChances[s];
    if (r < p) return s;
    r -= p;
  }
  return 'heavy';
}

/** True on the day the monsoon strength should be rolled (1 June). */
export function isMonsoonRollDay(month: number, day: number): boolean {
  return month === FLOOD_CONFIG.rollMonth && day === FLOOD_CONFIG.rollDay;
}

/** Number of game days in the flood season (3 × 30 = 90). */
export const FLOOD_SEASON_DAYS = (FLOOD_CONFIG.floodEndMonth - FLOOD_CONFIG.floodStartMonth + 1) * CALENDAR.daysPerMonth;

/**
 * Integer river level 0–3 for a date. 0 outside July–September or when no strength has been rolled.
 * Peaks around 15–16 August at the strength's `peakLevel` and falls back to 0 by 30 September.
 */
export function getRiverLevel(month: number, day: number, strength: MonsoonStrength | undefined): number {
  if (!strength) return 0;
  if (month < FLOOD_CONFIG.floodStartMonth || month > FLOOD_CONFIG.floodEndMonth) return 0;
  const dayIndex = (month - FLOOD_CONFIG.floodStartMonth) * CALENDAR.daysPerMonth + (day - 1);
  // Sample the middle of the day so the curve is symmetric around the season's centre (day 44.5 = mid-August).
  const t = (dayIndex + 0.5) / FLOOD_SEASON_DAYS;
  const s = Math.pow(Math.max(0, Math.sin(Math.PI * t)), FLOOD_CONFIG.curveExponent);
  const peak = FLOOD_CONFIG.peakLevel[strength];
  return Math.max(0, Math.min(peak, Math.floor((peak + 1) * s)));
}

/** Monsoon strengths whose peak reaches a given flood-risk level ("Floods in: weak / normal / heavy monsoons"). */
export function getMonsoonsThatFlood(riskLevel: number): MonsoonStrength[] {
  if (riskLevel <= 0) return [];
  return MONSOON_STRENGTHS.filter((s) => FLOOD_CONFIG.peakLevel[s] >= riskLevel);
}

/** Forecast text for the 1 June announcement (wrap in `msg()` in UI code). */
export function getMonsoonForecastText(strength: MonsoonStrength): { title: string; description: string } {
  const titles: Record<MonsoonStrength, string> = { weak: 'WEAK', normal: 'NORMAL', heavy: 'HEAVY' };
  const descriptions: Record<MonsoonStrength, string> = {
    weak: 'The IMD expects a weak monsoon. Only the low east floodplain near the river should flood in July–September.',
    normal: 'The IMD expects a normal monsoon. The east floodplain and the ghats will flood in July–September.',
    heavy: 'The IMD expects a heavy monsoon. Riverbanks will flood in July–September.',
  };
  return { title: `Monsoon forecast: ${titles[strength]}`, description: descriptions[strength] };
}

/** Chance per in-game day that a flooded building of this type becomes abandoned. */
export function getFloodDamageChance(buildingType: string): number {
  if (FLOOD_CONFIG.damageImmuneTypes.includes(buildingType)) return 0;
  if (buildingType === 'informal_housing') return FLOOD_CONFIG.informalDamageChance;
  return FLOOD_CONFIG.damageChance;
}

// ---------------------------------------------------------------------------
// Flood geometry
// ---------------------------------------------------------------------------

/** Zone codes from `getRiverZoneArrays` (see ZONE_CODES in riverZones.ts). */
const ZONE = { river: 1, westRiverfront: 2, westBank: 3, eastFloodplain: 4, eastBank: 5 } as const;

const NEIGHBOURS: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

const tributaryDistanceCache = new Map<number, Uint16Array>();

/** 4-neighbour steps from each tile to the nearest Assi/Varuna tile (65535 if unreachable). Cached per size. */
export function getTributaryDistance(gridSize: number): Uint16Array {
  const cached = tributaryDistanceCache.get(gridSize);
  if (cached) return cached;
  const { water } = getVaranasiLayout(gridSize);
  const n = gridSize * gridSize;
  const dist = new Uint16Array(n).fill(65535);
  const queue = new Int32Array(n);
  let head = 0;
  let tail = 0;
  for (let i = 0; i < n; i++) {
    if (water[i] === LAYOUT_WATER.tributary) {
      dist[i] = 0;
      queue[tail++] = i;
    }
  }
  while (head < tail) {
    const i = queue[head++];
    const x = i % gridSize;
    const y = (i / gridSize) | 0;
    for (const [dx, dy] of NEIGHBOURS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= gridSize || ny >= gridSize) continue;
      const j = ny * gridSize + nx;
      if (dist[j] !== 65535) continue;
      dist[j] = dist[i] + 1;
      queue[tail++] = j;
    }
  }
  tributaryDistanceCache.set(gridSize, dist);
  return dist;
}

const baseRiskCache = new Map<number, Uint8Array>();

/** Lowest river level that floods each tile with no embankments (0 = never; water tiles are 0). Cached per size. */
function getBaseFloodRisk(gridSize: number): Uint8Array {
  const cached = baseRiskCache.get(gridSize);
  if (cached) return cached;
  const { zone, distance } = getRiverZoneArrays(gridSize);
  const { water } = getVaranasiLayout(gridSize);
  const tribDist = getTributaryDistance(gridSize);
  const c = FLOOD_CONFIG;
  const n = gridSize * gridSize;
  const risk = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (water[i] !== LAYOUT_WATER.none || zone[i] === ZONE.river) continue;
    const z = zone[i];
    if (z === ZONE.eastFloodplain && distance[i] <= c.level1FloodplainDistance) risk[i] = 1;
    else if (z === ZONE.eastFloodplain || z === ZONE.westRiverfront) risk[i] = 2;
    else if (
      (z === ZONE.westBank && distance[i] <= c.level3WestBankDistance) ||
      tribDist[i] <= c.level3TributaryDistance
    ) {
      risk[i] = 3;
    }
  }
  baseRiskCache.set(gridSize, risk);
  return risk;
}

/** A tile position. */
export interface TilePos {
  x: number;
  y: number;
}

function embankmentKey(gridSize: number, embankments: readonly TilePos[] | undefined): string {
  if (!embankments || embankments.length === 0) return '';
  const idx: number[] = [];
  for (const e of embankments) {
    if (e.x < 0 || e.y < 0 || e.x >= gridSize || e.y >= gridSize) continue;
    idx.push(e.y * gridSize + e.x);
  }
  idx.sort((a, b) => a - b);
  return idx.join(',');
}

/**
 * Tiles protected by at least one embankment (S4-T6): land tiles within `embankmentRadius` (Euclidean) of an
 * embankment, on the same bank, and not between the embankment and the river (distance to the Ganga ≥ the
 * embankment's). Protection does not stack.
 */
export function getEmbankmentProtection(gridSize: number, embankments: readonly TilePos[]): Uint8Array {
  const { water, side } = getVaranasiLayout(gridSize);
  const { distance } = getRiverZoneArrays(gridSize);
  const r = FLOOD_CONFIG.embankmentRadius;
  const r2 = r * r;
  const out = new Uint8Array(gridSize * gridSize);
  for (const e of embankments) {
    if (e.x < 0 || e.y < 0 || e.x >= gridSize || e.y >= gridSize) continue;
    const ei = e.y * gridSize + e.x;
    if (water[ei] !== LAYOUT_WATER.none) continue;
    const eSide = side[ei];
    const eDist = distance[ei];
    for (let y = Math.max(0, e.y - r); y <= Math.min(gridSize - 1, e.y + r); y++) {
      for (let x = Math.max(0, e.x - r); x <= Math.min(gridSize - 1, e.x + r); x++) {
        const dx = x - e.x;
        const dy = y - e.y;
        if (dx * dx + dy * dy > r2) continue;
        const i = y * gridSize + x;
        if (water[i] !== LAYOUT_WATER.none || side[i] !== eSide || distance[i] < eDist) continue;
        out[i] = 1;
      }
    }
  }
  return out;
}

const riskCache = new Map<string, Uint8Array>();
const maskCache = new Map<string, Uint8Array>();

function remember(cache: Map<string, Uint8Array>, key: string, value: Uint8Array): Uint8Array {
  cache.set(key, value);
  while (cache.size > FLOOD_CONFIG.maskCacheSize) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
  return value;
}

/**
 * Flood-risk map for the `'flood'` overlay: per tile (index y × gridSize + x), the lowest river level that floods it
 * (1 = dark red, 2 = orange, 3 = yellow, 0 = never). Embankments push protected tiles one level later
 * (a level-3 tile becomes safe). Memoized; do not mutate the returned array.
 */
export function getFloodRiskLevel(gridSize: number, embankments?: readonly TilePos[]): Uint8Array {
  const key = `${gridSize}|${embankmentKey(gridSize, embankments)}`;
  const cached = riskCache.get(key);
  if (cached) {
    riskCache.delete(key);
    riskCache.set(key, cached);
    return cached;
  }
  const base = getBaseFloodRisk(gridSize);
  if (!embankments || embankments.length === 0) return remember(riskCache, key, base);
  const protectedTiles = getEmbankmentProtection(gridSize, embankments);
  const risk = new Uint8Array(base.length);
  for (let i = 0; i < base.length; i++) {
    const b = base[i];
    if (b === 0) continue;
    const shifted = protectedTiles[i] ? b + 1 : b;
    risk[i] = shifted > MAX_RIVER_LEVEL ? 0 : shifted;
  }
  return remember(riskCache, key, risk);
}

/**
 * Which tiles are under water at this river level: 1 = flooded land tile, 0 = dry (river tiles are 0, they are
 * water anyway). Follows the S4-T5 level table and the S4-T6 embankment rule. Memoized by
 * (size, level, embankment set), so calling it every day is cheap. Do not mutate the returned array.
 */
export function computeFloodMask(gridSize: number, riverLevel: number, embankments?: readonly TilePos[]): Uint8Array {
  const level = Math.max(0, Math.min(MAX_RIVER_LEVEL, Math.floor(riverLevel)));
  const embKey = level === 0 ? '' : embankmentKey(gridSize, embankments);
  const key = `${gridSize}|${level}|${embKey}`;
  const cached = maskCache.get(key);
  if (cached) {
    maskCache.delete(key);
    maskCache.set(key, cached);
    return cached;
  }
  const mask = new Uint8Array(gridSize * gridSize);
  if (level > 0) {
    const risk = getFloodRiskLevel(gridSize, embankments);
    for (let i = 0; i < risk.length; i++) {
      const r = risk[i];
      if (r !== 0 && r <= level) mask[i] = 1;
    }
  }
  return remember(maskCache, key, mask);
}

/** Number of flooded tiles in a mask. */
export function countFlooded(mask: Uint8Array): number {
  let n = 0;
  for (let i = 0; i < mask.length; i++) n += mask[i];
  return n;
}

/** Whether an embankment may go on this tile, geometry only: land within `embankmentMaxDistanceToGanga` of the Ganga. The caller also rejects ghat tiles. */
export function isEmbankmentSiteInRange(x: number, y: number, gridSize: number): boolean {
  if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) return false;
  const i = y * gridSize + x;
  if (getVaranasiLayout(gridSize).water[i] !== LAYOUT_WATER.none) return false;
  return getRiverZoneArrays(gridSize).distance[i] <= FLOOD_CONFIG.embankmentMaxDistanceToGanga;
}
