import { describe, expect, it } from 'vitest';
import {
  AUTO_QUALITY_CONFIG,
  QUALITY_LEVELS,
  QUALITY_PRESETS,
  createAutoQualityState,
  higherLevel,
  lowerLevel,
  scaledEntityLimit,
  stepAutoQuality,
  type AutoQualityState,
} from '@/lib/qualityConfig';

const BUDGET = AUTO_QUALITY_CONFIG.budgetMs.desktop; // 16.7
const OVER = 25;
const UNDER = 8; // < 60% of 16.7
const BETWEEN = 12; // between 60% and 100%

/** Feeds p95 samples one check at a time (the fake clock is the check index). */
function run(state: AutoQualityState, samples: Array<number | [number, boolean]>): AutoQualityState[] {
  const out: AutoQualityState[] = [];
  let s = state;
  for (const sample of samples) {
    const [p95, interacting] = Array.isArray(sample) ? sample : [sample, false];
    s = stepAutoQuality(s, { frameP95: p95, interacting }, BUDGET);
    out.push(s);
  }
  return out;
}

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

describe('stepAutoQuality (hysteresis)', () => {
  it('drops one level after 3 over-budget checks in a row, not before', () => {
    const states = run(createAutoQualityState('high'), [OVER, OVER, OVER]);
    expect(states.map((s) => s.level)).toEqual(['high', 'high', 'medium']);
  });

  it('a good check in between resets the over-budget streak', () => {
    const states = run(createAutoQualityState('high'), [OVER, OVER, BETWEEN, OVER, OVER]);
    expect(states.at(-1)!.level).toBe('high');
  });

  it('raises one level only after 10 checks under 60% of the budget', () => {
    const nine = run(createAutoQualityState('low'), Array(9).fill(UNDER));
    expect(nine.at(-1)!.level).toBe('low');
    const ten = run(createAutoQualityState('low'), Array(10).fill(UNDER));
    expect(ten.at(-1)!.level).toBe('medium');
  });

  it('does not raise when frames are fine but not well under budget (the hysteresis gap)', () => {
    const states = run(createAutoQualityState('medium'), Array(30).fill(BETWEEN));
    expect(states.at(-1)!.level).toBe('medium');
  });

  it('ignores the checks right after a change', () => {
    const states = run(createAutoQualityState('high'), [OVER, OVER, OVER, OVER, OVER, OVER, OVER]);
    // drop at #3; #4-#5 settle; #6-#8 would be needed for the next drop
    expect(states.map((s) => s.level)).toEqual(['high', 'high', 'medium', 'medium', 'medium', 'medium', 'medium']);
    const more = run(states.at(-1)!, [OVER]);
    expect(more[0].level).toBe('low');
  });

  it('never goes below low or above high', () => {
    expect(run(createAutoQualityState('low'), Array(20).fill(OVER)).at(-1)!.level).toBe('low');
    expect(run(createAutoQualityState('high'), Array(40).fill(UNDER)).at(-1)!.level).toBe('high');
  });

  it('waits while the player is panning or zooming, then applies the change', () => {
    const states = run(createAutoQualityState('high'), [[OVER, true], [OVER, true], [OVER, true], [OVER, true], [BETWEEN, false]]);
    expect(states.slice(0, 4).map((s) => s.level)).toEqual(['high', 'high', 'high', 'high']);
    expect(states[3].pending).toBe('drop');
    expect(states[4].level).toBe('medium');
  });

  it('cancels a pending raise when frames become slow', () => {
    const raised = run(createAutoQualityState('low'), [...Array(10).fill([UNDER, true]), [OVER, true], [BETWEEN, false]]);
    expect(raised.at(-1)!.level).toBe('low');
  });

  it('ignores empty samples', () => {
    const states = run(createAutoQualityState('high'), [0, 0, 0, 0]);
    expect(states.at(-1)).toEqual(createAutoQualityState('high'));
  });
});
