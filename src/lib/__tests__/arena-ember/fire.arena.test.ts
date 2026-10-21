import { describe, expect, it } from 'vitest';
import { runFireScenario, summarize, writeMetrics, type FireRunResult } from './harness';

const SEEDS = Array.from({ length: Number(process.env.EMBER_SEEDS ?? 16) }, (_, i) => 101 + i * 13);

function many(opts: { station: boolean; funding: number; weather: 'clear' | 'severe_storm'; withTraffic?: boolean }): FireRunResult[] {
  return SEEDS.map((seed) => runFireScenario({ seed, ...opts }));
}

function agg(runs: FireRunResult[]) {
  const nums = (f: (r: FireRunResult) => number) => summarize(runs.map(f));
  const onScene = runs.map((r) => r.firstTruckOnSceneTicks).filter((v): v is number => v !== null);
  return {
    seeds: runs.length,
    burnedDay1: nums((r) => r.burnedDay1),
    burnedDay3: nums((r) => r.burnedDay3),
    burnedDay7: nums((r) => r.burnedDay7),
    lostDay7: nums((r) => r.lostDay7),
    maxSimultaneous: nums((r) => r.maxSimultaneous),
    selfExtinguishedShare: runs.filter((r) => r.selfExtinguished).length / runs.length,
    lastFireTick: nums((r) => r.lastFireTick),
    responseTicks: onScene.length ? summarize(onScene) : null,
    responseShare: onScene.length / runs.length,
    trucksDispatched: nums((r) => r.trucksDispatched),
    fireNotifications: nums((r) => r.fireNotifications),
  };
}

describe('EMBER F1/F2/F3 fire scenarios', () => {
  it('F1 no station, clear weather', () => {
    const a = agg(many({ station: false, funding: 100, weather: 'clear' }));
    writeMetrics('F1', a);
    console.log('F1', JSON.stringify(a));
    expect(a.burnedDay7.mean).toBeGreaterThan(0);
  }, 300000);

  it('F2 station 8 tiles away at 100% funding', () => {
    const a = agg(many({ station: true, funding: 100, weather: 'clear' }));
    writeMetrics('F2', a);
    console.log('F2', JSON.stringify(a));
    expect(a.burnedDay7.mean).toBeGreaterThan(0);
  }, 300000);

  it('F3a station at 50% funding, clear', () => {
    const a = agg(many({ station: true, funding: 50, weather: 'clear' }));
    writeMetrics('F3a_50pct_clear', a);
    console.log('F3a', JSON.stringify(a));
  }, 300000);

  it('F3b station at 50% funding during severe_storm', () => {
    const a = agg(many({ station: true, funding: 50, weather: 'severe_storm' }));
    writeMetrics('F3b_50pct_storm', a);
    console.log('F3b', JSON.stringify(a));
  }, 300000);

  it('F3c station at 100% funding during severe_storm', () => {
    const a = agg(many({ station: true, funding: 100, weather: 'severe_storm' }));
    writeMetrics('F3c_100pct_storm', a);
    console.log('F3c', JSON.stringify(a));
  }, 300000);

  it('F1 storm (no station) for reference', () => {
    const a = agg(many({ station: false, funding: 100, weather: 'severe_storm' }));
    writeMetrics('F1_storm', a);
    console.log('F1s', JSON.stringify(a));
  }, 300000);
});
