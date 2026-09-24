import { beforeEach, describe, expect, it } from 'vitest';
import {
  PERF_STATS_CONFIG,
  getPerfSnapshot,
  recordFrame,
  recordSave,
  recordTick,
  resetPerfStats,
  setEntityCount,
  startPerfCapture,
  stopPerfCapture,
} from '@/lib/perfStats';

describe('perfStats', () => {
  beforeEach(() => resetPerfStats());

  it('returns zeros when nothing was recorded', () => {
    const s = getPerfSnapshot();
    expect(s).toMatchObject({ fps: 0, frameP50: 0, frameP95: 0, frameMax: 0, tickP95: 0, tickMax: 0, saveMax: 0 });
    expect(s.entities).toEqual({});
  });

  it('computes percentiles, max and fps from frame times', () => {
    for (let i = 1; i <= 100; i++) recordFrame(i); // 1..100 ms
    const s = getPerfSnapshot();
    expect(s.frameP50).toBe(50);
    expect(s.frameP95).toBe(95);
    expect(s.frameMax).toBe(100);
    // fps uses the last 60 frames: mean of 41..100 = 70.5 ms
    expect(s.fps).toBeCloseTo(1000 / 70.5, 1);
  });

  it('keeps only the last window of values', () => {
    recordFrame(500); // pushed out by the next 300 values
    for (let i = 0; i < PERF_STATS_CONFIG.windowSize; i++) recordFrame(10);
    expect(getPerfSnapshot().frameMax).toBe(10);
  });

  it('tracks ticks, saves and entity counts', () => {
    recordTick(2);
    recordTick(8);
    recordSave(3);
    recordSave(12);
    setEntityCount('cars', 42);
    const s = getPerfSnapshot();
    expect(s.tickMax).toBe(8);
    expect(s.tickP95).toBe(8);
    expect(s.saveMax).toBe(12);
    expect(s.entities).toEqual({ cars: 42 });
  });

  it('capture covers every value, not only the last window', () => {
    startPerfCapture();
    recordFrame(200);
    for (let i = 0; i < PERF_STATS_CONFIG.windowSize * 2; i++) recordFrame(16);
    recordTick(5);
    const result = stopPerfCapture();
    expect(result?.frameMax).toBe(200);
    expect(result?.frames).toBe(PERF_STATS_CONFIG.windowSize * 2 + 1);
    expect(result?.tickMax).toBe(5);
    expect(getPerfSnapshot().frameMax).toBe(16);
    expect(stopPerfCapture()).toBeNull();
  });
});
