/**
 * camera.ts — converts the game's view state into a Pixi world `Matrix`.
 *
 * The Canvas2D renderer establishes the world transform on the raw context with:
 *     ctx.scale(dpr * zoom, dpr * zoom);
 *     ctx.translate(offset.x / zoom, offset.y / zoom);
 *
 * Composed (Canvas2D post-multiplies), that is the affine matrix
 *     [ s, 0, 0, s, dpr*offset.x, dpr*offset.y ]   where s = dpr * zoom
 * because  s * (offset.x / zoom) = dpr * offset.x.
 *
 * In the GPU backend this single matrix is applied ONCE at the layer-container
 * level (see PixiRenderer.applyCamera / LayerStack) instead of per draw call, so
 * every world-space draw stays in the same coordinate system as the Canvas2D path.
 */
import { Matrix } from 'pixi.js';

/** The viewport state that defines the world->screen transform. */
export interface CameraState {
  /** Device pixel ratio (window.devicePixelRatio). */
  dpr: number;
  /** Pan offset in CSS pixels (pre-zoom), matching the game's `offset`. */
  offset: { x: number; y: number };
  /** Zoom factor, matching the game's `zoom`. */
  zoom: number;
}

/**
 * Build (or update) the world matrix for the given camera state.
 * @param state camera/viewport state
 * @param out optional Matrix to write into (avoids allocation in the render loop)
 */
export function worldMatrix(state: CameraState, out?: Matrix): Matrix {
  const m = out ?? new Matrix();
  const s = state.dpr * state.zoom;
  m.set(s, 0, 0, s, state.dpr * state.offset.x, state.dpr * state.offset.y);
  return m;
}
