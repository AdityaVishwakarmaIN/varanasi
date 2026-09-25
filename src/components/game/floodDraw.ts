/**
 * Flood water and silt drawn over land tiles (S4-T5). Drawn on the base layer, so buildings stand in the water.
 */
import type { IsoRenderer } from '@/components/game/gpu/IsoRenderer';
import { TILE_HEIGHT, TILE_WIDTH } from '@/components/game/types';
import { getFloodedIndices } from '@/lib/floodSim';

export interface FloodDrawView {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function diamond(r: IsoRenderer, sx: number, sy: number): void {
  r.beginPath();
  r.moveTo(sx + TILE_WIDTH / 2, sy);
  r.lineTo(sx + TILE_WIDTH, sy + TILE_HEIGHT / 2);
  r.lineTo(sx + TILE_WIDTH / 2, sy + TILE_HEIGHT);
  r.lineTo(sx, sy + TILE_HEIGHT / 2);
  r.closePath();
  r.fill();
}

/**
 * Fills every tile of `mask` inside the view with `color`. `isLand(x, y)` skips river tiles (they are water already).
 * With `rippleColor`, two short light strokes per tile suggest moving water (placed by tile, so they don't flicker).
 */
export function drawFloodMask(
  r: IsoRenderer,
  mask: Uint8Array,
  size: number,
  view: FloodDrawView,
  color: string,
  isLand: (x: number, y: number) => boolean,
  rippleColor?: string
): void {
  const indices = getFloodedIndices(mask);
  r.fillStyle = color;
  for (let k = 0; k < indices.length; k++) {
    const i = indices[k];
    const x = i % size;
    const y = (i / size) | 0;
    const sx = (x - y) * (TILE_WIDTH / 2);
    const sy = (x + y) * (TILE_HEIGHT / 2);
    if (sx + TILE_WIDTH < view.left || sx > view.right || sy + TILE_HEIGHT < view.top || sy > view.bottom) continue;
    if (!isLand(x, y)) continue;
    diamond(r, sx, sy);
  }
  if (!rippleColor) return;
  r.strokeStyle = rippleColor;
  r.lineWidth = 1;
  r.beginPath();
  for (let k = 0; k < indices.length; k++) {
    const i = indices[k];
    const x = i % size;
    const y = (i / size) | 0;
    const sx = (x - y) * (TILE_WIDTH / 2);
    const sy = (x + y) * (TILE_HEIGHT / 2);
    if (sx + TILE_WIDTH < view.left || sx > view.right || sy + TILE_HEIGHT < view.top || sy > view.bottom) continue;
    if (!isLand(x, y)) continue;
    const shift = ((x * 7 + y * 13) % 5) - 2;
    const cx = sx + TILE_WIDTH / 2 + shift * 3;
    const cy = sy + TILE_HEIGHT / 2;
    r.moveTo(cx - 10, cy - 3);
    r.lineTo(cx - 2, cy - 3);
    r.moveTo(cx + 2, cy + 4);
    r.lineTo(cx + 11, cy + 4);
  }
  r.stroke();
}
