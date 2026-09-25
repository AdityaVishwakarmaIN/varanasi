/**
 * Cows on the roads (S3-T5): a small list of wandering animals, separate from the cars.
 * A cow ambles along roads, sometimes stands in the middle of a tile for 5–20 s, then moves on.
 * Vehicles on a tile with a standing cow slow to 30% (they drive around it), so traffic never deadlocks.
 * Cows never affect pathfinding or building placement: they only read the grid.
 */
import type { Tile } from '@/types/game';
import type { IsoRenderer } from '@/components/game/gpu/IsoRenderer';
import type { Rng } from '@/lib/rng';
import { COW_CONFIG, pickCowPauseSeconds } from '@/lib/trafficConfig';
import { DIRECTION_META } from './constants';
import type { CarDirection } from './types';
import { getDirectionOptions, isRoadTile, pickNextDirection } from './utils';

export type Cow = {
  id: number;
  tileX: number;
  tileY: number;
  direction: CarDirection;
  /** 0..1 along the current tile. */
  progress: number;
  /** Tiles per second while walking. */
  speed: number;
  /** Sideways position on the road (pixels from the centre line). */
  laneOffset: number;
  color: string;
  /** Seconds left standing still; 0 while walking. */
  pauseSeconds: number;
  /** A cow stops at most once per tile. */
  pausedThisTile: boolean;
};

/** Average car speed in tiles per second (cars spawn at 0.245–0.49); cows walk at a fraction of it. */
const BASE_CAR_SPEED = 0.37;

export function isCowStanding(cow: Cow): boolean {
  return cow.pauseSeconds > 0;
}

/** Tile keys (y * gridSize + x) that have a standing cow: vehicles there slow down. */
export function getStandingCowTiles(cows: readonly Cow[], gridSize: number): Set<number> {
  const out = new Set<number>();
  for (const c of cows) if (isCowStanding(c)) out.add(c.tileY * gridSize + c.tileX);
  return out;
}

/** Speed factor for a vehicle on tile key `key`: 30% next to a standing cow, otherwise 1. */
export function getCowSlowdown(standingTiles: ReadonlySet<number>, key: number): number {
  return standingTiles.has(key) ? COW_CONFIG.vehicleSlowdown : 1;
}

/** A new cow on road tile (x, y), or null if the tile is not a road with somewhere to go. */
export function spawnCow(id: number, x: number, y: number, grid: Tile[][], gridSize: number, rng: Rng): Cow | null {
  if (!isRoadTile(grid, gridSize, x, y)) return null;
  const options = getDirectionOptions(grid, gridSize, x, y);
  if (options.length === 0) return null;
  const colors = COW_CONFIG.colors;
  return {
    id,
    tileX: x,
    tileY: y,
    direction: options[Math.floor(rng() * options.length)],
    progress: rng() * 0.4,
    speed: BASE_CAR_SPEED * COW_CONFIG.walkSpeedMultiplier * (0.8 + rng() * 0.4),
    laneOffset: (rng() - 0.5) * 6,
    color: colors[Math.floor(rng() * colors.length)],
    pauseSeconds: 0,
    pausedThisTile: false,
  };
}

/** Advances one cow by `seconds` of game time. */
export function stepCow(cow: Cow, seconds: number, grid: Tile[][], gridSize: number, rng: Rng): void {
  if (cow.pauseSeconds > 0) {
    cow.pauseSeconds = Math.max(0, cow.pauseSeconds - seconds);
    return;
  }
  const before = cow.progress;
  cow.progress += cow.speed * seconds;
  // Maybe stop in the middle of the tile
  if (!cow.pausedThisTile && before < 0.5 && cow.progress >= 0.5) {
    cow.pausedThisTile = true;
    if (rng() < COW_CONFIG.pauseChancePerTile) {
      cow.progress = 0.5;
      cow.pauseSeconds = pickCowPauseSeconds(rng);
      return;
    }
  }
  if (cow.progress < 1) return;

  const step = DIRECTION_META[cow.direction].step;
  const nx = cow.tileX + step.x;
  const ny = cow.tileY + step.y;
  if (!isRoadTile(grid, gridSize, nx, ny)) {
    // Dead end or the road was removed: turn around on this tile
    const options = getDirectionOptions(grid, gridSize, cow.tileX, cow.tileY);
    const others = options.filter((d) => d !== cow.direction);
    const pool = others.length > 0 ? others : options;
    if (pool.length > 0) cow.direction = pool[Math.floor(rng() * pool.length)];
    cow.progress = 0;
    cow.pausedThisTile = true;
    return;
  }
  cow.tileX = nx;
  cow.tileY = ny;
  cow.progress = Math.min(cow.progress - 1, 0.49);
  cow.pausedThisTile = false;
  const next = pickNextDirection(cow.direction, grid, gridSize, nx, ny);
  if (next) cow.direction = next;
}

/** Draws one cow in its own frame (+x is the way it faces), roughly car-sized. */
export function drawCow(ctx: IsoRenderer, cow: Cow): void {
  const s = 0.5;
  // Body
  ctx.fillStyle = cow.color;
  ctx.beginPath();
  ctx.ellipse(0, 0, 7 * s, 3.4 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  // Hump and head
  ctx.beginPath();
  ctx.ellipse(3.5 * s, 0, 1.8 * s, 2.4 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(8.4 * s, 0, 2 * s, 1.6 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  // Horns and tail
  ctx.fillStyle = '#4A3B2A';
  ctx.fillRect(8.8 * s, -2.6 * s, 0.9 * s, 1.2 * s);
  ctx.fillRect(8.8 * s, 1.4 * s, 0.9 * s, 1.2 * s);
  ctx.fillRect(-8.4 * s, -0.3 * s, 1.8 * s, 0.6 * s);
}
