/**
 * Touch controls (S1-T11): pure gesture helpers used by `CanvasIsometricGrid`'s touch handlers.
 * Timings and thresholds live in `TOUCH_CONFIG` (src/lib/controlsConfig.ts).
 *
 * | Gesture             | Action                                                         |
 * |---------------------|----------------------------------------------------------------|
 * | One-finger drag     | Pan (draws instead while Draw mode is on for a draw tool)      |
 * | Two-finger pinch    | Zoom around the pinch centre (and pan with the centre)         |
 * | Tap                 | Use the tool once (expensive placements ask to confirm first)  |
 * | Long-press          | Inspect the tile (tile info) with any tool                     |
 *
 * No React, DOM or timers here, so everything is unit-testable.
 */
import { TOUCH_CONFIG } from '@/lib/controlsConfig';
import { clampZoom, type CameraPose, type Vec2 } from '@/lib/cameraMotion';
import type { Tool } from '@/types/game';

/**
 * - `tap`: short and still → use the tool once.
 * - `longPress`: held still for the long-press time → inspect.
 * - `drag`: moved past the tap distance → pan / draw.
 * - `hold`: still, but between a tap and a long-press → does nothing.
 */
export type TouchKind = 'tap' | 'longPress' | 'drag' | 'hold';

export function classifyTouch(durationMs: number, movedPx: number): TouchKind {
  if (movedPx >= TOUCH_CONFIG.tapMaxMovePx) return 'drag';
  if (durationMs < TOUCH_CONFIG.tapMaxMs) return 'tap';
  if (durationMs >= TOUCH_CONFIG.longPressMs) return 'longPress';
  return 'hold';
}

/** True once a touch has moved far enough from its start to stop being a tap / long-press. */
export function hasMovedBeyondTap(dx: number, dy: number): boolean {
  return Math.hypot(dx, dy) >= TOUCH_CONFIG.tapMaxMovePx;
}

/**
 * Tools that are drawn by dragging on desktop (straight-line roads/rail/subway and zone rectangles,
 * see `showsDragGrid` in CanvasIsometricGrid). Only these show the Draw mode button on touch.
 * Terraform (`zone_water`, `zone_land`) is excluded: it costs 50,000 per tile.
 */
const DRAW_MODE_TOOLS: ReadonlySet<Tool> = new Set<Tool>([
  'road',
  'rail',
  'subway',
  'zone_residential',
  'zone_commercial',
  'zone_industrial',
  'zone_dezone',
]);

export function isDrawModeTool(tool: Tool): boolean {
  return DRAW_MODE_TOOLS.has(tool);
}

/** A tap placement costing more than `confirmCostFraction` of current money asks to confirm first. */
export function needsTapConfirm(cost: number, money: number): boolean {
  return cost > 0 && cost > money * TOUCH_CONFIG.confirmCostFraction;
}

/** Captured when a pinch starts: the world point under the pinch centre stays under the fingers. */
export interface PinchStart {
  distance: number;
  zoom: number;
  /** World position (camera model: screen = world * zoom + offset) under the pinch centre. */
  world: Vec2;
}

export function createPinchStart(pose: CameraPose, distance: number, centre: Vec2): PinchStart {
  return {
    distance,
    zoom: pose.zoom,
    world: { x: (centre.x - pose.offset.x) / pose.zoom, y: (centre.y - pose.offset.y) / pose.zoom },
  };
}

/**
 * Camera pose for the current finger positions: zoom scales with the finger distance, and the
 * world point that was under the pinch centre follows the (moving) centre, so a two-finger drag pans.
 * The offset is unclamped (the caller clamps it to the map bounds).
 */
export function computePinchPose(
  start: PinchStart,
  distance: number,
  centre: Vec2,
  minZoom: number,
  maxZoom: number,
): CameraPose {
  const scale = start.distance > 0 ? distance / start.distance : 1;
  const zoom = clampZoom(start.zoom * scale, minZoom, maxZoom);
  return {
    zoom,
    offset: { x: centre.x - start.world.x * zoom, y: centre.y - start.world.y * zoom },
  };
}
