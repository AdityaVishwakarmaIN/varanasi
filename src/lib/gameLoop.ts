/**
 * gameLoop: fixed-timestep simulation scheduler (Sprint 1, S1-T4). No React.
 *
 * Replaces `setInterval(simulateTick, interval)`. Each animation frame adds the elapsed time to
 * an accumulator and runs one simulation tick per full interval owed, with two guards:
 * - spiral-of-death guard: at most `maxTicksPerFrame` ticks per frame; extra owed time is dropped
 *   (the game slows down briefly instead of freezing);
 * - tick-time guard: after a tick slower than `slowTickMs`, no second tick runs in that frame.
 *
 * `setPaused(true)` is a *system* pause (for example while the tab is hidden): the loop stops
 * requesting frames and the paused time is never owed, so no ticks catch up on resume.
 */

/** Simulation tick interval in ms for game speeds 1, 2 and 3. */
export const TICK_INTERVAL_MS = {
  desktop: [500, 300, 200],
  mobile: [750, 450, 300],
} as const;

export const GAME_LOOP_CONFIG = {
  /** Spiral-of-death guard: never run more ticks than this in one frame. */
  maxTicksPerFrame: 2,
  /** A tick slower than this (ms) prevents a second tick in the same frame. */
  slowTickMs: 12,
  /** React state is synced from the simulation at most this often (ms). */
  uiSyncIntervalMs: 500,
} as const;

/** Tick interval for a game speed. Speed 0 (paused) returns Infinity: no ticks. */
export function getTickIntervalMs(speed: 0 | 1 | 2 | 3, isMobile: boolean): number {
  if (speed === 0) return Infinity;
  return (isMobile ? TICK_INTERVAL_MS.mobile : TICK_INTERVAL_MS.desktop)[speed - 1];
}

/** Time source and frame scheduler; injectable so tests can drive the loop by hand. */
export type SchedulerEnv = {
  now: () => number;
  requestFrame: (callback: () => void) => number;
  cancelFrame: (id: number) => void;
};

function browserEnv(): SchedulerEnv {
  return {
    now: () => performance.now(),
    requestFrame: (callback) => requestAnimationFrame(() => callback()),
    cancelFrame: (id) => cancelAnimationFrame(id),
  };
}

export class SimulationScheduler {
  private readonly onTick: () => void;
  private readonly getIntervalMs: () => number;
  private readonly env: SchedulerEnv;
  private running = false;
  private paused = false;
  private frameId: number | null = null;
  private lastTime = 0;
  private accumulator = 0;

  constructor(onTick: () => void, getIntervalMs: () => number, env?: Partial<SchedulerEnv>) {
    this.onTick = onTick;
    this.getIntervalMs = getIntervalMs;
    this.env = { ...browserEnv(), ...env };
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.accumulator = 0;
    this.lastTime = this.env.now();
    if (!this.paused) this.scheduleFrame();
  }

  stop(): void {
    this.running = false;
    this.cancelPendingFrame();
  }

  setPaused(paused: boolean): void {
    if (paused === this.paused) return;
    this.paused = paused;
    if (paused) {
      this.cancelPendingFrame();
      return;
    }
    // Resume: the time spent paused is never owed.
    this.lastTime = this.env.now();
    if (this.running) this.scheduleFrame();
  }

  get isRunning(): boolean {
    return this.running;
  }

  get isPaused(): boolean {
    return this.paused;
  }

  private scheduleFrame(): void {
    if (this.frameId === null) {
      this.frameId = this.env.requestFrame(this.frame);
    }
  }

  private cancelPendingFrame(): void {
    if (this.frameId !== null) {
      this.env.cancelFrame(this.frameId);
      this.frameId = null;
    }
  }

  private frame = (): void => {
    this.frameId = null;
    if (!this.running || this.paused) return;
    this.scheduleFrame();

    const now = this.env.now();
    const elapsed = Math.max(0, now - this.lastTime);
    this.lastTime = now;

    const interval = this.getIntervalMs();
    if (!(interval > 0) || !Number.isFinite(interval)) {
      this.accumulator = 0; // game speed 0: nothing is owed
      return;
    }

    this.accumulator += elapsed;
    const { maxTicksPerFrame, slowTickMs } = GAME_LOOP_CONFIG;
    let ticks = 0;
    let slowTick = false;
    while (this.accumulator >= interval && ticks < maxTicksPerFrame && !slowTick) {
      const tickStart = this.env.now();
      this.onTick();
      slowTick = this.env.now() - tickStart > slowTickMs;
      this.accumulator -= interval;
      ticks++;
    }

    if (this.accumulator >= interval) {
      // Spiral-of-death guard: after the maximum ticks, drop the extra time. After a slow tick,
      // carry at most one tick to the next frame.
      this.accumulator = slowTick && ticks < maxTicksPerFrame ? interval : 0;
    }
  };
}
