/**
 * interpolate.ts — frame-rate-independent motion helpers for the GPU render loop.
 *
 * ROOT CAUSE of the "jerky clouds/entities" issue (see temp_suggestions!B31): motion
 * was driven off the throttled, React-coupled render (the main render skips ~50ms at
 * 3x speed) and scaled by the sim-speed multiplier, and positions snapped to integer
 * device pixels. The GPU-native fix is to advance simulation on a FIXED timestep and
 * render with an interpolation alpha (lerp last->current), decoupled from React, while
 * keeping SUB-PIXEL float positions (the GPU samples fractionally — no snapping).
 *
 * This module is backend-agnostic (no Pixi import) so it can run on the main thread or
 * inside the render worker.
 */

/** A value that can be interpolated between two simulation snapshots. */
export interface Lerpable {
  x: number;
  y: number;
}

/** Linear interpolation between two scalars. */
export function lerp(a: number, b: number, alpha: number): number {
  return a + (b - a) * alpha;
}

/** Linear interpolation of a 2D point into `out` (avoids allocation in the loop). */
export function lerpPoint(prev: Lerpable, curr: Lerpable, alpha: number, out: Lerpable): Lerpable {
  out.x = prev.x + (curr.x - prev.x) * alpha;
  out.y = prev.y + (curr.y - prev.y) * alpha;
  return out;
}

/**
 * Fixed-timestep accumulator. Drive the simulation in fixed steps regardless of the
 * real frame cadence, then render with `alpha` to smoothly blend the last two states.
 *
 * Usage per animation frame:
 *   const steps = clock.advance(nowMs);
 *   for (let i = 0; i < steps; i++) simulate(clock.stepSeconds);  // snapshot prev<-curr each step
 *   render(clock.alpha);                                          // interpolate prev->curr
 */
export class FixedTimestepClock {
  /** Fixed simulation step in seconds. */
  readonly stepSeconds: number;
  private readonly stepMs: number;
  private readonly maxStepsPerFrame: number;
  private accumulatorMs = 0;
  private lastMs: number | null = null;

  /**
   * @param hz simulation frequency (default 60 Hz)
   * @param maxStepsPerFrame clamp to avoid the "spiral of death" after a long stall
   */
  constructor(hz = 60, maxStepsPerFrame = 5) {
    this.stepSeconds = 1 / hz;
    this.stepMs = 1000 / hz;
    this.maxStepsPerFrame = maxStepsPerFrame;
  }

  /** Feed the current high-res timestamp; returns how many fixed steps to simulate now. */
  advance(nowMs: number): number {
    if (this.lastMs === null) {
      this.lastMs = nowMs;
      return 0;
    }
    this.accumulatorMs += nowMs - this.lastMs;
    this.lastMs = nowMs;
    let steps = 0;
    while (this.accumulatorMs >= this.stepMs && steps < this.maxStepsPerFrame) {
      this.accumulatorMs -= this.stepMs;
      steps++;
    }
    // Drop backlog beyond the clamp so we don't permanently lag after a stall.
    if (this.accumulatorMs > this.stepMs * this.maxStepsPerFrame) {
      this.accumulatorMs = this.stepMs * this.maxStepsPerFrame;
    }
    return steps;
  }

  /** Interpolation factor in [0,1): how far we are into the next fixed step. */
  get alpha(): number {
    return this.accumulatorMs / this.stepMs;
  }

  /** Reset after a pause so the next advance() doesn't replay accumulated wall-clock time. */
  reset(): void {
    this.lastMs = null;
    this.accumulatorMs = 0;
  }
}
