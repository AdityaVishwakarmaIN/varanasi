import { describe, expect, it } from 'vitest';
import {
  AUTO_DPR_CAP,
  AUTO_QUALITY_CONFIG,
  QUALITY_LEVELS,
  QUALITY_PRESETS,
  armAutoQualityState,
  autoRenderDpr,
  createAutoQualityState,
  higherLevel,
  holdAutoQualityState,
  lowerLevel,
  scaledEntityLimit,
  stepAutoQuality,
  type AutoQualitySample,
  type AutoQualityState,
} from '@/lib/qualityConfig';

const DROP_ABOVE = AUTO_QUALITY_CONFIG.dropAboveMs.desktop; // ~33.4
const STEP = AUTO_QUALITY_CONFIG.checkIntervalMs;
const N = AUTO_QUALITY_CONFIG.dropAfterChecks;
const COOLDOWN = AUTO_QUALITY_CONFIG.cooldownChecks;
const SLOW = 45; // clearly janky
const VSYNC = 17.4; // a healthy 60 Hz session: p95 just over one vsync interval
const FINE = 12;

type Check = number | { p95?: number; frames?: number; interacting?: boolean };

/**
 * Feeds one check per entry on a fake clock: check i happens at `t0 + (i + 1) * STEP` and its
 * window started at the previous check (`t0 + i * STEP`). Returns the state after every check.
 */
function run(state: AutoQualityState, checks: Check[], t0 = 0): AutoQualityState[] {
  const out: AutoQualityState[] = [];
  let s = state;
  checks.forEach((c, i) => {
    const o = typeof c === 'number' ? { p95: c } : c;
    const sample: AutoQualitySample = {
      frameP95: o.p95 ?? FINE,
      frameCount: o.frames ?? 120,
      windowStart: t0 + i * STEP,
      interacting: o.interacting ?? false,
    };
    s = stepAutoQuality(s, sample, DROP_ABOVE);
    out.push(s);
  });
  return out;
}

const levels = (states: AutoQualityState[]) => states.map((s) => s.level);
/** An auto state that is armed and past its warm-up at t = 0. */
const armed = (level: AutoQualityState['level']) => createAutoQualityState(level, 0);

describe('QUALITY_PRESETS', () => {
  it('matches the S1-T7 table', () => {
    expect(QUALITY_PRESETS.low.pedestrianDensity).toBe(0);
    expect(QUALITY_PRESETS.medium.pedestrianDensity).toBe(0.5);
    expect(QUALITY_PRESETS.high.pedestrianDensity).toBe(1);
    expect([QUALITY_PRESETS.low, QUALITY_PRESETS.medium, QUALITY_PRESETS.high].map((p) => p.vehicleFraction)).toEqual([0.4, 0.7, 1]);
    expect([QUALITY_PRESETS.low, QUALITY_PRESETS.medium, QUALITY_PRESETS.high].map((p) => p.dprCap)).toEqual([1, 1.5, 2]);
    expect(QUALITY_PRESETS.low.clouds).toBe(false);
    expect(QUALITY_PRESETS.low.nightLighting).toBe(false);
    expect(QUALITY_PRESETS.low.treeSway).toBe(false);
    expect(QUALITY_PRESETS.low.particleFraction).toBe(0);
    expect(QUALITY_PRESETS.medium.particleFraction).toBe(0.5);
    expect(QUALITY_PRESETS.medium.weatherParticleFraction).toBeLessThan(QUALITY_PRESETS.high.weatherParticleFraction);
  });

  it('never allows more entities on a lower level', () => {
    for (let i = 1; i < QUALITY_LEVELS.length; i++) {
      const lo = QUALITY_PRESETS[QUALITY_LEVELS[i - 1]];
      const hi = QUALITY_PRESETS[QUALITY_LEVELS[i]];
      for (const key of ['maxCars', 'maxPedestrians', 'maxBoats'] as const) {
        expect(lo[key].desktop).toBeLessThanOrEqual(hi[key].desktop);
        expect(lo[key].mobile).toBeLessThanOrEqual(hi[key].mobile);
      }
    }
  });
});

describe('autoRenderDpr (resolution under auto)', () => {
  it('is the device ratio capped per device, whatever the auto level', () => {
    expect(autoRenderDpr(1, false)).toBe(1);
    expect(autoRenderDpr(1.25, false)).toBe(1.25);
    expect(autoRenderDpr(3, false)).toBe(AUTO_DPR_CAP.desktop);
    expect(autoRenderDpr(3, true)).toBe(AUTO_DPR_CAP.mobile);
  });

  it('falls back to 1 for a missing or invalid ratio', () => {
    expect(autoRenderDpr(0, false)).toBe(1);
    expect(autoRenderDpr(Number.NaN, true)).toBe(1);
    expect(autoRenderDpr(-2, false)).toBe(1);
  });
});

describe('scaledEntityLimit', () => {
  it('scales the target and clamps to the cap', () => {
    expect(scaledEntityLimit(1000, 1, 800)).toBe(800);
    expect(scaledEntityLimit(1000, 0.4, 800)).toBe(400);
    expect(scaledEntityLimit(100, 0.7, 800)).toBe(70);
  });
  it('returns 0 when off, and whole numbers only', () => {
    expect(scaledEntityLimit(500, 0, 560)).toBe(0);
    expect(scaledEntityLimit(500, 1, 0)).toBe(0);
    expect(scaledEntityLimit(0, 1, 100)).toBe(0);
    expect(scaledEntityLimit(33, 0.5, 100)).toBe(16);
    expect(scaledEntityLimit(10, 1, 7.9)).toBe(7);
  });
});

describe('level order', () => {
  it('steps one level and stops at the ends', () => {
    expect(lowerLevel('high')).toBe('medium');
    expect(lowerLevel('medium')).toBe('low');
    expect(lowerLevel('low')).toBe('low');
    expect(higherLevel('low')).toBe('medium');
    expect(higherLevel('high')).toBe('high');
  });
});

describe('stepAutoQuality (sticky, evidence-gated drops)', () => {
  it(`drops one level after ${N} slow windows in a row, not before`, () => {
    const states = run(armed('high'), Array(N).fill(SLOW));
    expect(levels(states)).toEqual([...Array(N - 1).fill('high'), 'medium']);
  });

  it('never drops on a healthy 60 Hz session (p95 just over one vsync)', () => {
    expect(run(armed('high'), Array(200).fill(VSYNC)).at(-1)!.level).toBe('high');
  });

  it('a healthy window resets the slow streak', () => {
    const states = run(armed('high'), [...Array(N - 1).fill(SLOW), FINE, ...Array(N - 1).fill(SLOW)]);
    expect(states.at(-1)!.level).toBe('high');
  });

  it('never raises, however fast the frames are (no oscillation)', () => {
    const states = run(armed('high'), [...Array(N).fill(SLOW), ...Array(500).fill(1)]);
    expect(new Set(levels(states).slice(N - 1))).toEqual(new Set(['medium']));
    expect(run(armed('low'), Array(500).fill(1)).at(-1)!.level).toBe('low');
  });

  it('alternating slow and fast phases change the level at most once per drop, only downwards', () => {
    const phase = [...Array(N).fill(SLOW), ...Array(20).fill(FINE)];
    const states = run(armed('high'), [...phase, ...phase, ...phase, ...phase]);
    let changes = 0;
    for (let i = 1; i < states.length; i++) {
      if (states[i].level !== states[i - 1].level) {
        changes++;
        expect(QUALITY_LEVELS.indexOf(states[i].level)).toBe(QUALITY_LEVELS.indexOf(states[i - 1].level) - 1);
      }
    }
    expect(changes).toBe(2); // high -> medium -> low, then stays
    expect(states.at(-1)!.level).toBe('low');
  });

  it('ignores the checks right after a drop (cooldown), then needs a fresh streak', () => {
    const states = run(armed('high'), Array(N + COOLDOWN + N - 1).fill(SLOW));
    expect(states.at(-1)!.level).toBe('medium');
    expect(run(states.at(-1)!, [SLOW], (N + COOLDOWN + N - 1) * STEP)[0].level).toBe('low');
  });

  it('never goes below low', () => {
    expect(run(armed('low'), Array(50).fill(SLOW)).at(-1)!.level).toBe('low');
  });

  it('waits while the player is panning or zooming, then drops at the first quiet slow check', () => {
    const states = run(armed('high'), [...Array(N + 2).fill({ p95: SLOW, interacting: true }), SLOW]);
    expect(levels(states.slice(0, N + 2))).toEqual(Array(N + 2).fill('high'));
    expect(states[N + 1].pending).toBe(true);
    expect(states.at(-1)!.level).toBe('medium');
  });

  it('a healthy window cancels a pending drop', () => {
    const states = run(armed('high'), [...Array(N).fill({ p95: SLOW, interacting: true }), FINE]);
    expect(states.at(-1)!.pending).toBe(false);
    expect(states.at(-1)!.level).toBe('high');
  });

  it('ignores windows with too few frames or no data (throttled tab, one long hang)', () => {
    const few = run(armed('high'), Array(20).fill({ p95: SLOW, frames: AUTO_QUALITY_CONFIG.minFrames - 1 }));
    expect(few.at(-1)).toEqual(armed('high'));
    const empty = run(armed('high'), Array(20).fill({ p95: 0, frames: 0 }));
    expect(empty.at(-1)).toEqual(armed('high'));
    // ...and they do not break a streak either
    const mixed = run(armed('high'), [...Array(N - 1).fill(SLOW), { p95: SLOW, frames: 2 }, SLOW]);
    expect(mixed.at(-1)!.level).toBe('medium');
  });
});

describe('auto-quality hold (start-up, warm-up, tab visibility)', () => {
  it('drops no queued decision during a hold or an invalid window', () => {
    const pending = { ...armed('high'), pending: true };
    expect(holdAutoQualityState(pending, 20_000).pending).toBe(false);
    expect(armAutoQualityState(pending, Infinity).pending).toBe(false);
    const next = stepAutoQuality(pending, { frameP95: 0, frameCount: 0, windowStart: 0, interacting: false }, SLOW);
    expect(next.level).toBe('high');
  });
  it('takes no evidence until armed (start-up / loading)', () => {
    const states = run(createAutoQualityState('high'), Array(100).fill(SLOW));
    expect(states.at(-1)).toEqual(createAutoQualityState('high'));
  });

  it('after arming, ignores windows that start before the warm-up ends', () => {
    const warmup = AUTO_QUALITY_CONFIG.warmupMs;
    const s = armAutoQualityState(createAutoQualityState('high'), warmup);
    const ignored = Math.ceil(warmup / STEP); // windows starting at 0, 2000, ... < warmup
    const states = run(s, Array(ignored + N).fill(SLOW));
    expect(levels(states).slice(0, ignored + N - 1)).toEqual(Array(ignored + N - 1).fill('high'));
    expect(states.at(-1)!.level).toBe('medium');
  });

  it('a visibility hold resets the streak and ignores windows that straddle it', () => {
    const t0 = 0;
    const before = run(armed('high'), Array(N - 1).fill(SLOW), t0);
    const resumeAt = (N - 1) * STEP + 500; // tab became visible mid-window
    const held = holdAutoQualityState(before.at(-1)!, resumeAt + AUTO_QUALITY_CONFIG.visibleGraceMs);
    expect(held.overCount).toBe(0);
    const after = run(held, Array(N + 3).fill(SLOW), (N - 1) * STEP);
    // the windows starting before resumeAt + grace are ignored, then a full new streak is needed
    expect(after.slice(0, N).every((s) => s.level === 'high')).toBe(true);
    expect(after.at(-1)!.level).toBe('medium');
  });

  it('a hold never shortens a longer one (an unarmed state stays unarmed)', () => {
    const s = holdAutoQualityState(createAutoQualityState('high'), 5000);
    expect(s.holdUntil).toBe(Number.POSITIVE_INFINITY);
    expect(holdAutoQualityState(createAutoQualityState('high', 9000), 5000).holdUntil).toBe(9000);
  });
});
