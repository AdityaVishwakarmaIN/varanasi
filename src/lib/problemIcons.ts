/**
 * Problem icons (S5-T5, feedback layer 1): which problem each building shows, derived from the current GameState.
 *
 * Pure and cheap: one scan of the grid plus one multi-source BFS for road access. The renderer
 * (components/game/problemIconsDraw.ts) caches the result and refreshes it at most once per `refreshMs`.
 * Nothing here changes simulation state.
 */
import type { GameState, Tile } from '@/types/game';
import { FEEDER_SIZE, getFeederBounds, getFeederColumns, getFeederCount } from '@/lib/feederZones';
import { getCityFloodMask } from '@/lib/floodSim';
import { getOutbreakMask } from '@/lib/crisisSim';

/** Problem kinds, in priority order (index 0 wins). */
export const PROBLEM_KINDS = [
  'fire',
  'flood',
  'disease',
  'no_road',
  'power_cut',
  'no_power',
  'no_water',
  'abandoned',
] as const;
export type ProblemKind = (typeof PROBLEM_KINDS)[number];

export const PROBLEM_ICON_CONFIG = {
  /** Below this zoom only district-level icons (one per feeder block) are drawn. */
  districtZoomBelow: 0.6,
  /** District block size, in tiles (the feeder blocks). */
  districtSize: FEEDER_SIZE,
  /** The renderer recomputes the icon set at most this often. */
  refreshMs: 1000,
  /** Same reach as the simulation's road-access check (a path through the same zone). */
  roadAccessDistance: 8,
  /** Icon radius in screen pixels (kept constant across zoom so icons stay readable). */
  screenRadius: 9,
  /** District icon radius in screen pixels. */
  districtScreenRadius: 13,
} as const;

/** Buildings that are not "buildings" for the icons (terrain, networks, footprint fillers). */
const NON_BUILDINGS: ReadonlySet<string> = new Set([
  'grass', 'empty', 'water', 'road', 'bridge', 'rail', 'tree', 'embankment',
]);

export function isProblemBuilding(tile: Tile): boolean {
  return !NON_BUILDINGS.has(tile.building.type);
}

/** Zoned and built on (not an empty lot, not a footprint filler). */
function isDevelopedZone(tile: Tile): boolean {
  return tile.zone !== 'none' && tile.building.type !== 'grass' && tile.building.type !== 'empty';
}

/** 1 per tile that the simulation's road-access rule can reach (a road within `maxDistance` steps through the same zone). */
export function computeRoadAccessMask(grid: Tile[][], size: number, maxDistance: number = PROBLEM_ICON_CONFIG.roadAccessDistance): Uint8Array {
  const n = size * size;
  const dist = new Int16Array(n).fill(-1);
  const queue = new Int32Array(n);
  let head = 0;
  let tail = 0;
  const isRoad = (t: Tile) => t.building.type === 'road' || t.building.type === 'bridge';
  // Seeds: zoned tiles next to a road (distance 0).
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const t = grid[y][x];
      if (t.zone === 'none') continue;
      if (
        (x > 0 && isRoad(grid[y][x - 1])) || (x < size - 1 && isRoad(grid[y][x + 1])) ||
        (y > 0 && isRoad(grid[y - 1][x])) || (y < size - 1 && isRoad(grid[y + 1][x]))
      ) {
        dist[y * size + x] = 0;
        queue[tail++] = y * size + x;
      }
    }
  }
  // Spread through the same zone: a tile k steps from a road-side tile is reachable when k < maxDistance.
  while (head < tail) {
    const i = queue[head++];
    const d = dist[i];
    if (d + 1 >= maxDistance) continue;
    const x = i % size;
    const y = (i / size) | 0;
    const zone = grid[y][x].zone;
    const tryPush = (nx: number, ny: number) => {
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) return;
      const j = ny * size + nx;
      if (dist[j] !== -1) return;
      const t = grid[ny][nx];
      if (t.zone !== zone || t.building.type === 'water') return;
      dist[j] = d + 1;
      queue[tail++] = j;
    };
    tryPush(x - 1, y);
    tryPush(x + 1, y);
    tryPush(x, y - 1);
    tryPush(x, y + 1);
  }
  const mask = new Uint8Array(n);
  for (let i = 0; i < n; i++) if (dist[i] >= 0) mask[i] = 1;
  return mask;
}

export interface ProblemTileInput {
  tile: Tile;
  flooded: boolean;
  infected: boolean;
  hasRoadAccess: boolean;
  /** The tile's feeder block is in a rolling power cut right now. */
  powerCut: boolean;
}

/** The single problem a tile shows (highest priority), or null. */
export function pickTileProblem(input: ProblemTileInput): ProblemKind | null {
  const { tile, flooded, infected, hasRoadAccess, powerCut } = input;
  const b = tile.building;
  if (b.onFire) return 'fire';
  const building = isProblemBuilding(tile);
  const developed = isDevelopedZone(tile);
  if (flooded && building) return 'flood';
  if (infected && building && (b.population > 0 || b.jobs > 0)) return 'disease';
  // Empty zoned lots without a road never grow: flag them too, so the player sees why.
  if (tile.zone !== 'none' && b.type !== 'empty' && !hasRoadAccess) return 'no_road';
  if (developed && !b.abandoned) {
    if (!b.powered) return powerCut ? 'power_cut' : 'no_power';
    if (!b.watered) return 'no_water';
  }
  if (b.abandoned) return 'abandoned';
  return null;
}

export interface DistrictProblem {
  feeder: number;
  kind: ProblemKind;
  /** Buildings in the block with this problem. */
  count: number;
  /** Block centre (tile coordinates). */
  x: number;
  y: number;
}

export interface ProblemIconSet {
  size: number;
  /** Tile indices (y * size + x) with a problem, and the problem at the same position. */
  tiles: Int32Array;
  kinds: Uint8Array;
  /** Per feeder block, its most common problem (disease counts every infected block once, even without buildings). */
  districts: DistrictProblem[];
  /** Buildings per problem kind, and the first one found (for "Show me"). */
  counts: Record<ProblemKind, number>;
  first: Partial<Record<ProblemKind, { x: number; y: number }>>;
  /** Infected feeder blocks (drawn as one biohazard per block at building zoom). */
  infectedBlocks: number[];
}

export interface ProblemIconInput {
  grid: Tile[][];
  size: number;
  floodMask: Uint8Array | null;
  outbreakMask: Uint8Array | null;
  /** Feeder blocks in a rolling power cut. */
  powerCutFeeders: ReadonlySet<number>;
  /** From computeRoadAccessMask; null skips the no-road check. */
  roadAccess: Uint8Array | null;
  /** Infected blocks (feeder indices). */
  infectedBlocks?: readonly number[];
}

export function kindIndex(kind: ProblemKind): number {
  return PROBLEM_KINDS.indexOf(kind);
}

export function computeProblemIcons(input: ProblemIconInput): ProblemIconSet {
  const { grid, size, floodMask, outbreakMask, powerCutFeeders, roadAccess } = input;
  const tiles: number[] = [];
  const kinds: number[] = [];
  const counts = Object.fromEntries(PROBLEM_KINDS.map((k) => [k, 0])) as Record<ProblemKind, number>;
  const first: ProblemIconSet['first'] = {};
  const feederCount = getFeederCount(size);
  const cols = getFeederColumns(size);
  const perBlock = new Uint16Array(feederCount * PROBLEM_KINDS.length);
  for (let y = 0; y < size; y++) {
    const row = grid[y];
    const feederRow = Math.floor(y / FEEDER_SIZE) * cols;
    for (let x = 0; x < size; x++) {
      const tile = row[x];
      const i = y * size + x;
      const b = tile.building;
      // Fast skip: natural or network tiles with nothing wrong.
      if (tile.zone === 'none' && !b.onFire && NON_BUILDINGS.has(b.type)) continue;
      const feeder = feederRow + Math.floor(x / FEEDER_SIZE);
      const kind = pickTileProblem({
        tile,
        flooded: floodMask ? floodMask[i] === 1 : false,
        infected: outbreakMask ? outbreakMask[i] === 1 : false,
        hasRoadAccess: roadAccess ? roadAccess[i] === 1 : true,
        powerCut: powerCutFeeders.has(feeder),
      });
      if (!kind) continue;
      const k = kindIndex(kind);
      tiles.push(i);
      kinds.push(k);
      counts[kind]++;
      if (!first[kind]) first[kind] = { x, y };
      perBlock[feeder * PROBLEM_KINDS.length + k]++;
    }
  }
  const infectedBlocks = [...(input.infectedBlocks ?? [])].filter((f) => f >= 0 && f < feederCount);
  const districts: DistrictProblem[] = [];
  for (let f = 0; f < feederCount; f++) {
    let bestK = -1;
    let bestN = 0;
    for (let k = 0; k < PROBLEM_KINDS.length; k++) {
      const n = perBlock[f * PROBLEM_KINDS.length + k];
      // Most common wins; ties go to the higher priority (lower index).
      if (n > bestN) {
        bestN = n;
        bestK = k;
      }
    }
    if (bestK < 0 && infectedBlocks.includes(f)) {
      bestK = kindIndex('disease');
      bestN = 1;
    }
    if (bestK < 0) continue;
    const bounds = getFeederBounds(f, size);
    districts.push({ feeder: f, kind: PROBLEM_KINDS[bestK], count: bestN, x: bounds.centerX, y: bounds.centerY });
  }
  return {
    size,
    tiles: Int32Array.from(tiles),
    kinds: Uint8Array.from(kinds),
    districts,
    counts,
    first,
    infectedBlocks,
  };
}

/** Fields of GameState the icons read. */
export type ProblemStateInput = Pick<
  GameState,
  'grid' | 'gridSize' | 'mapId' | 'riverLevel' | 'structureVersion' | 'id' | 'outbreaks' | 'stats' | 'disastersEnabled'
>;

/** Builds the icon set straight from a GameState (floods, outbreaks and rolling cuts included). */
export function computeProblemIconsForState(state: ProblemStateInput, roadAccess?: Uint8Array | null): ProblemIconSet {
  const size = state.gridSize;
  const crisesOn = state.disastersEnabled !== false;
  const floodMask = crisesOn ? getCityFloodMask(state) : null;
  const outbreakMask = crisesOn ? getOutbreakMask(state.outbreaks, size) : null;
  return computeProblemIcons({
    grid: state.grid,
    size,
    floodMask,
    outbreakMask,
    powerCutFeeders: new Set(state.stats.power?.cut ?? []),
    roadAccess: roadAccess === undefined ? computeRoadAccessMask(state.grid, size) : roadAccess,
    infectedBlocks: crisesOn ? (state.outbreaks ?? []).map((o) => o.feeder) : [],
  });
}

/** Whether to draw per-building icons (true) or district icons (false) at this zoom. */
export function isBuildingLevelZoom(zoom: number): boolean {
  return zoom >= PROBLEM_ICON_CONFIG.districtZoomBelow;
}
