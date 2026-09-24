/**
 * Pure camera-feel helpers (S1-T10): smooth zoom towards an anchor point and drag-pan inertia.
 * Tuning numbers live in `CAMERA_CONFIG` (src/lib/controlsConfig.ts).
 *
 * Camera model (same as CanvasIsometricGrid): screen = world * zoom + offset.
 * No React, DOM or timers here, so it can be unit-tested and reused by touch controls (S1-T11).
 */
import { CAMERA_CONFIG, FRAME_MS } from '@/lib/controlsConfig';

export interface Vec2 {
  x: number;
  y: number;
}

export interface CameraPose {
  zoom: number;
  offset: Vec2;
}

export function easeOutCubic(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return 1 - Math.pow(1 - c, 3);
}

export function clampZoom(zoom: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, zoom));
}

/** A zoom animation that keeps the world point under `anchor` (screen px) fixed. */
export interface ZoomAnimation {
  fromZoom: number;
  toZoom: number;
  /** Screen position (relative to the canvas) that stays fixed while zooming. */
  anchor: Vec2;
  /** World position under the anchor when the animation started. */
  world: Vec2;
  startTime: number;
  durationMs: number;
}

export function createZoomAnimation(
  current: CameraPose,
  toZoom: number,
  anchor: Vec2,
  now: number,
  durationMs: number = CAMERA_CONFIG.zoomEaseMs,
): ZoomAnimation {
  return {
    fromZoom: current.zoom,
    toZoom,
    anchor: { x: anchor.x, y: anchor.y },
    world: {
      x: (anchor.x - current.offset.x) / current.zoom,
      y: (anchor.y - current.offset.y) / current.zoom,
    },
    startTime: now,
    durationMs,
  };
}

/** Camera pose at time `now` (unclamped offset). `done` is true on and after the last frame. */
export function sampleZoomAnimation(anim: ZoomAnimation, now: number): CameraPose & { done: boolean } {
  const t = anim.durationMs <= 0 ? 1 : (now - anim.startTime) / anim.durationMs;
  const done = t >= 1;
  const zoom = done ? anim.toZoom : anim.fromZoom + (anim.toZoom - anim.fromZoom) * easeOutCubic(t);
  return {
    zoom,
    offset: {
      x: anim.anchor.x - anim.world.x * zoom,
      y: anim.anchor.y - anim.world.y * zoom,
    },
    done,
  };
}

/**
 * Tracks recent pointer positions during a drag-pan to estimate the release velocity.
 * Velocity is in px per 60 Hz frame (so it can be multiplied by the per-frame friction directly).
 */
export class PanVelocityTracker {
  private samples: { x: number; y: number; t: number }[] = [];

  reset(): void {
    this.samples.length = 0;
  }

  push(x: number, y: number, t: number): void {
    this.samples.push({ x, y, t });
    const cutoff = t - CAMERA_CONFIG.panVelocitySampleMs;
    while (this.samples.length > 2 && this.samples[0].t < cutoff) this.samples.shift();
  }

  /** Release velocity at time `now`; zero if the pointer had stopped before release. */
  getVelocity(now: number): Vec2 {
    const n = this.samples.length;
    if (n < 2) return { x: 0, y: 0 };
    const last = this.samples[n - 1];
    if (now - last.t > CAMERA_CONFIG.panReleaseIdleMs) return { x: 0, y: 0 };
    const first = this.samples[0];
    const dt = last.t - first.t;
    if (dt <= 0) return { x: 0, y: 0 };
    let vx = ((last.x - first.x) / dt) * FRAME_MS;
    let vy = ((last.y - first.y) / dt) * FRAME_MS;
    const speed = Math.hypot(vx, vy);
    const max = CAMERA_CONFIG.panInertiaMaxSpeed;
    if (speed > max) {
      vx = (vx / speed) * max;
      vy = (vy / speed) * max;
    }
    return { x: vx, y: vy };
  }
}

/** True if a release velocity (px/frame) is fast enough to start inertia. */
export function shouldStartInertia(v: Vec2): boolean {
  return Math.hypot(v.x, v.y) >= CAMERA_CONFIG.panInertiaStartSpeed;
}

/**
 * Advance inertia by `dtMs`. Friction is defined per 60 Hz frame, so it is applied as
 * friction^(dtMs / FRAME_MS) to stay frame-rate independent.
 * Returns the offset delta to apply and the new velocity; `stopped` once below the minimum speed.
 */
export function stepInertia(
  v: Vec2,
  dtMs: number,
  friction: number = CAMERA_CONFIG.panInertiaFriction,
): { delta: Vec2; velocity: Vec2; stopped: boolean } {
  const frames = Math.max(0, dtMs) / FRAME_MS;
  const delta = { x: v.x * frames, y: v.y * frames };
  const decay = Math.pow(friction, frames);
  const velocity = { x: v.x * decay, y: v.y * decay };
  const stopped = Math.hypot(velocity.x, velocity.y) < CAMERA_CONFIG.panInertiaMinSpeed;
  return { delta, velocity, stopped };
}

/** What the player is doing with the camera right now (read by the render loop every frame). */
export interface CameraInteraction {
  isMobile: boolean;
  /** One-finger / mouse drag-pan. */
  panning: boolean;
  /** Two-finger pinch (touch). */
  pinching: boolean;
  /** Mouse-wheel / trackpad zoom (desktop). */
  wheelZooming: boolean;
  zoom: number;
}

/**
 * Which animated layers the render loop skips while the camera is being moved (S1-T11), so the
 * rule is the same for pan, pinch and wheel zoom:
 * - `skipSmall`: small animated things (boats, smog, helicopters, seaplanes) while moving and zoomed
 *   out below `smallElementsZoomThreshold`.
 * - Mobile skips all animated entities (drawing and updates) while moving, for frame rate.
 */
export function getInteractionSkips(
  i: CameraInteraction,
  smallElementsZoomThreshold: number,
): { skipUpdates: boolean; skipAnimated: boolean; skipSmall: boolean } {
  const moving = i.panning || i.pinching || i.wheelZooming;
  const skipAll = i.isMobile && moving;
  return {
    skipUpdates: skipAll,
    skipAnimated: skipAll,
    skipSmall: moving && i.zoom < smallElementsZoomThreshold,
  };
}
