/**
 * perfStats: tiny, allocation-free performance counters (no React, no DOM).
 *
 * The render loop, the simulation scheduler and the autosave call `recordFrame`,
 * `recordTick` and `recordSave`. The PerfHud reads `getPerfSnapshot()` twice per second.
 *
 * Each series keeps the last `PERF_STATS_CONFIG.windowSize` values in a ring buffer
 * (a preallocated Float64Array), so recording costs a couple of array writes.
 *
 * For repeatable measurements (the benchmark fly-through) a *capture* can be started:
 * while capturing, every value is also appended to an unbounded list so the result
 * covers the whole run and not only the last 300 samples.
 */

export const PERF_STATS_CONFIG = {
  /** How many recent values each series keeps (about 5 s of frames at 60 fps). */
  windowSize: 300,
  /** FPS is computed from the average of this many most recent frame times. */
  fpsWindow: 60,
} as const;

export type PerfSnapshot = {
  fps: number;
  frameP50: number;
  frameP95: number;
  frameMax: number;
  tickP95: number;
  tickMax: number;
  saveMax: number;
  entities: Record<string, number>;
};

class RingBuffer {
  private readonly values: Float64Array;
  private next = 0;
  private size = 0;

  constructor(capacity: number) {
    this.values = new Float64Array(capacity);
  }

  push(value: number): void {
    this.values[this.next] = value;
    this.next = (this.next + 1) % this.values.length;
    if (this.size < this.values.length) this.size++;
  }

  get length(): number {
    return this.size;
  }

  /** Copies the stored values (oldest first) into `out` and returns how many were copied. */
  copyTo(out: Float64Array): number {
    const cap = this.values.length;
    const start = this.size < cap ? 0 : this.next;
    for (let i = 0; i < this.size; i++) {
      out[i] = this.values[(start + i) % cap];
    }
    return this.size;
  }

  /** Mean of the most recent `n` values (0 when empty). */
  recentMean(n: number): number {
    const count = Math.min(n, this.size);
    if (count === 0) return 0;
    const cap = this.values.length;
    let sum = 0;
    for (let i = 1; i <= count; i++) {
      sum += this.values[(this.next - i + cap) % cap];
    }
    return sum / count;
  }

  clear(): void {
    this.next = 0;
    this.size = 0;
  }
}

const frames = new RingBuffer(PERF_STATS_CONFIG.windowSize);
const ticks = new RingBuffer(PERF_STATS_CONFIG.windowSize);
const saves = new RingBuffer(PERF_STATS_CONFIG.windowSize);
const entityCounts = new Map<string, number>();
// Scratch buffer for percentile calculations (only used when a snapshot is taken).
const scratch = new Float64Array(PERF_STATS_CONFIG.windowSize);

type Capture = { frames: number[]; ticks: number[]; saves: number[] };
let capture: Capture | null = null;

/** Nearest-rank percentile of the first `count` values of `sorted` (which must be sorted). */
function percentileOfSorted(sorted: ArrayLike<number>, count: number, p: number): number {
  if (count === 0) return 0;
  const rank = Math.ceil((p / 100) * count) - 1;
  return sorted[Math.min(count - 1, Math.max(0, rank))];
}

function maxOf(values: ArrayLike<number>, count: number): number {
  let max = 0;
  for (let i = 0; i < count; i++) if (values[i] > max) max = values[i];
  return max;
}

function round(value: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

/** Record how long one frame took, in ms (time between consecutive animation frames). */
export function recordFrame(ms: number): void {
  frames.push(ms);
  capture?.frames.push(ms);
}

/** Record how long one simulation tick took, in ms. */
export function recordTick(ms: number): void {
  ticks.push(ms);
  capture?.ticks.push(ms);
}

/** Record how long a save blocked the main thread, in ms. */
export function recordSave(ms: number): void {
  saves.push(ms);
  capture?.saves.push(ms);
}

/** Set the current number of live entities of one kind (for example 'cars'). */
export function setEntityCount(name: string, n: number): void {
  entityCounts.set(name, n);
}

let rendererName = 'unknown';

/** Name of the active renderer ('canvas' or 'gpu'), set by the map component. */
export function setPerfRenderer(name: string): void {
  rendererName = name;
}

export function getPerfRenderer(): string {
  return rendererName;
}

function entitiesRecord(): Record<string, number> {
  const out: Record<string, number> = {};
  entityCounts.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

/** Summary of the recent window (last 300 values of each series). */
export function getPerfSnapshot(): PerfSnapshot {
  const frameCount = frames.copyTo(scratch);
  const frameMax = maxOf(scratch, frameCount);
  const sortedFrames = scratch.subarray(0, frameCount).sort();
  const frameP50 = percentileOfSorted(sortedFrames, frameCount, 50);
  const frameP95 = percentileOfSorted(sortedFrames, frameCount, 95);

  const tickCount = ticks.copyTo(scratch);
  const tickMax = maxOf(scratch, tickCount);
  const tickP95 = percentileOfSorted(scratch.subarray(0, tickCount).sort(), tickCount, 95);

  const saveCount = saves.copyTo(scratch);
  const saveMax = maxOf(scratch, saveCount);

  const meanFrame = frames.recentMean(PERF_STATS_CONFIG.fpsWindow);
  return {
    fps: meanFrame > 0 ? round(1000 / meanFrame, 1) : 0,
    frameP50: round(frameP50),
    frameP95: round(frameP95),
    frameMax: round(frameMax),
    tickP95: round(tickP95),
    tickMax: round(tickMax),
    saveMax: round(saveMax),
    entities: entitiesRecord(),
  };
}

/** Start recording every value (not only the last 300) until `stopPerfCapture()`. */
export function startPerfCapture(): void {
  capture = { frames: [], ticks: [], saves: [] };
}

export type PerfCaptureResult = PerfSnapshot & { frames: number; ticks: number; saves: number };

/** Stop the capture and summarise every value recorded since `startPerfCapture()`. */
export function stopPerfCapture(): PerfCaptureResult | null {
  const c = capture;
  capture = null;
  if (!c) return null;

  const sortedFrames = Float64Array.from(c.frames).sort();
  const sortedTicks = Float64Array.from(c.ticks).sort();
  let frameSum = 0;
  for (let i = 0; i < c.frames.length; i++) frameSum += c.frames[i];

  return {
    fps: frameSum > 0 ? round((c.frames.length * 1000) / frameSum, 1) : 0,
    frameP50: round(percentileOfSorted(sortedFrames, sortedFrames.length, 50)),
    frameP95: round(percentileOfSorted(sortedFrames, sortedFrames.length, 95)),
    frameMax: round(maxOf(sortedFrames, sortedFrames.length)),
    tickP95: round(percentileOfSorted(sortedTicks, sortedTicks.length, 95)),
    tickMax: round(maxOf(sortedTicks, sortedTicks.length)),
    saveMax: round(maxOf(c.saves, c.saves.length)),
    entities: entitiesRecord(),
    frames: c.frames.length,
    ticks: c.ticks.length,
    saves: c.saves.length,
  };
}

/** Clear every series and entity count (a running capture is restarted empty). */
export function resetPerfStats(): void {
  frames.clear();
  ticks.clear();
  saves.clear();
  entityCounts.clear();
  if (capture) capture = { frames: [], ticks: [], saves: [] };
}
