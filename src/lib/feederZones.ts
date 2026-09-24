/**
 * Feeder zones: the map split into square blocks of FEEDER_SIZE × FEEDER_SIZE tiles.
 *
 * Shared by power cuts and water rotation (S3-T7 / S3-T8) and disease outbreaks (S4-T9).
 * Blocks are numbered row by row: index = blockRow × columns + blockColumn.
 * The last row/column of blocks is smaller when gridSize is not a multiple of FEEDER_SIZE.
 */

/** Side length of one feeder block, in tiles. */
export const FEEDER_SIZE = 16;

/** Number of feeder blocks along one edge of the map. */
export function getFeederColumns(gridSize: number): number {
  return Math.ceil(gridSize / FEEDER_SIZE);
}

/** Total number of feeder blocks on a `gridSize × gridSize` map. */
export function getFeederCount(gridSize: number): number {
  const cols = getFeederColumns(gridSize);
  return cols * cols;
}

/** Index of the feeder block that contains tile (x, y). Returns -1 for tiles outside the map. */
export function getFeederIndex(x: number, y: number, gridSize: number): number {
  if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) return -1;
  return Math.floor(y / FEEDER_SIZE) * getFeederColumns(gridSize) + Math.floor(x / FEEDER_SIZE);
}

/** Tile rectangle covered by a feeder block. `x1`/`y1` are exclusive; `centerX`/`centerY` are for camera jumps. */
export interface FeederBounds {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  centerX: number;
  centerY: number;
}

/** Bounds of feeder block `index` (clamped to the map edge). */
export function getFeederBounds(index: number, gridSize: number): FeederBounds {
  const cols = getFeederColumns(gridSize);
  const x0 = (index % cols) * FEEDER_SIZE;
  const y0 = Math.floor(index / cols) * FEEDER_SIZE;
  const x1 = Math.min(gridSize, x0 + FEEDER_SIZE);
  const y1 = Math.min(gridSize, y0 + FEEDER_SIZE);
  return { x0, y0, x1, y1, centerX: Math.floor((x0 + x1 - 1) / 2), centerY: Math.floor((y0 + y1 - 1) / 2) };
}
