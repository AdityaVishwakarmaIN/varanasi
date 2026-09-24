/**
 * Applies rolling power and water cuts (S3-T7, S3-T8) to service coverage.
 *
 * The cached coverage from S1-T5 is never changed: when a feeder block is cut, this returns a new
 * ServiceCoverage whose power/water rows are copies with the cut blocks set to false. Rows with no cut
 * block, and every other service grid, are shared with the base. The result is cached until the base
 * coverage or the cut sets change (cuts change at most once per in-game hour).
 */

import type { ServiceCoverage } from '@/games/isocity/types/services';
import { FEEDER_SIZE, getFeederColumns } from './feederZones';

let cache: { base: ServiceCoverage; key: string; result: ServiceCoverage } | null = null;

function cutKey(powerCut: ReadonlySet<number>, waterCut: ReadonlySet<number>): string {
  return `${Array.from(powerCut).sort((a, b) => a - b).join(',')}|${Array.from(waterCut).sort((a, b) => a - b).join(',')}`;
}

function cutGrid(grid: boolean[][], cut: ReadonlySet<number>, size: number): boolean[][] {
  if (cut.size === 0) return grid;
  const cols = getFeederColumns(size);
  const rows = grid.slice();
  for (const feeder of cut) {
    const x0 = (feeder % cols) * FEEDER_SIZE;
    const y0 = Math.floor(feeder / cols) * FEEDER_SIZE;
    const x1 = Math.min(size, x0 + FEEDER_SIZE);
    const y1 = Math.min(size, y0 + FEEDER_SIZE);
    for (let y = y0; y < y1; y++) {
      if (rows[y] === grid[y]) rows[y] = grid[y].slice();
      const row = rows[y];
      for (let x = x0; x < x1; x++) row[x] = false;
    }
  }
  return rows;
}

/** Coverage with the cut feeders switched off. Returns `base` itself when nothing is cut. */
export function applyFeederCuts(
  base: ServiceCoverage,
  powerCut: ReadonlySet<number>,
  waterCut: ReadonlySet<number>,
  size: number
): ServiceCoverage {
  if (powerCut.size === 0 && waterCut.size === 0) return base;
  const key = cutKey(powerCut, waterCut);
  if (cache && cache.base === base && cache.key === key) return cache.result;
  const result: ServiceCoverage = {
    ...base,
    power: cutGrid(base.power, powerCut, size),
    water: cutGrid(base.water, waterCut, size),
  };
  cache = { base, key, result };
  return result;
}
