import { describe, expect, it } from 'vitest';
import {
  EVENT_CONFIG,
  FESTIVALS,
  evaluateReadiness,
  getActiveFestivals,
  getEventOutcome,
  getUpcomingFestivals,
  resolveEvent,
  type ReadinessInputs,
} from '@/lib/festivals';

const ids = (list: { id: string }[]) => list.map((f) => f.id);

describe('festival calendar', () => {
  it('fixed dates and durations', () => {
    expect(ids(getActiveFestivals(2, 26, 12))).toEqual(['maha_shivratri']);
    expect(ids(getActiveFestivals(2, 27, 12))).toEqual(['maha_shivratri']);
    expect(ids(getActiveFestivals(2, 28, 12))).toEqual([]);
    expect(ids(getActiveFestivals(3, 14, 12))).toEqual(['holi']);
    expect(ids(getActiveFestivals(11, 3, 12))).toEqual(['diwali']);
    expect(ids(getActiveFestivals(11, 4, 12))).toEqual([]);
    expect(ids(getActiveFestivals(11, 7, 12))).toEqual(['chhath']);
    expect(ids(getActiveFestivals(11, 15, 12))).toEqual(['dev_deepawali']);
    expect(ids(getActiveFestivals(11, 16, 12))).toEqual([]);
  });

  it('Ganga Aarti runs every evening, visual hours 18 to 20', () => {
    expect(ids(getActiveFestivals(6, 10, 17))).toEqual([]);
    expect(ids(getActiveFestivals(6, 10, 18))).toEqual(['ganga_aarti']);
    expect(ids(getActiveFestivals(6, 10, 19))).toEqual(['ganga_aarti']);
    expect(ids(getActiveFestivals(6, 10, 20))).toEqual([]);
    expect(ids(getActiveFestivals(11, 15, 18))).toEqual(['dev_deepawali', 'ganga_aarti']);
  });

  it('upcoming festivals within 30 days, soonest first, across the year end', () => {
    const up = getUpcomingFestivals(10, 20, 30);
    expect(up.map((u) => [u.festival.id, u.daysUntil])).toEqual([
      ['diwali', 11],
      ['chhath', 16],
      ['dev_deepawali', 25],
    ]);
    expect(getUpcomingFestivals(2, 1).map((u) => [u.festival.id, u.daysUntil])).toEqual([['maha_shivratri', 25]]);
    expect(getUpcomingFestivals(12, 30, 60).map((u) => u.festival.id)).toEqual(['maha_shivratri']);
    expect(getUpcomingFestivals(11, 15, 0).map((u) => u.festival.id)).toEqual(['dev_deepawali']);
    expect(getUpcomingFestivals(6, 1, 30)).toEqual([]);
  });

  it('types', () => {
    expect(FESTIVALS.dev_deepawali.type).toBe('management');
    expect(FESTIVALS.maha_shivratri.type).toBe('management');
    expect(FESTIVALS.holi.type).toBe('visual');
  });
});

const ready: ReadinessInputs = {
  avgPoliceCoverage: 80,
  avgFireCoverage: 60,
  hospitalInRange: true,
  areaTiles: 120,
  roadTiles: 25,
  avgRoadTraffic: 20,
  avgWaterCoverage: 90,
  gangaHealth: 60,
  powerSupplyRatio: 1,
};

function failed(inputs: ReadinessInputs): string[] {
  return evaluateReadiness(inputs)
    .filter((r) => !r.passed)
    .map((r) => r.requirement);
}

describe('readiness checklist', () => {
  it('all five pass for a prepared city', () => {
    const r = evaluateReadiness(ready);
    expect(r.map((x) => x.requirement)).toEqual(['crowd_safety', 'fire_medical', 'access', 'sanitation', 'lights']);
    expect(r.every((x) => x.passed)).toBe(true);
  });

  it('thresholds are inclusive where the table says ≥', () => {
    expect(failed({ ...ready, avgPoliceCoverage: 70, avgFireCoverage: 50, avgWaterCoverage: 80, gangaHealth: 50, roadTiles: 20 })).toEqual([]);
  });

  it('each requirement fails on its own', () => {
    expect(failed({ ...ready, avgPoliceCoverage: 69 })).toEqual(['crowd_safety']);
    expect(failed({ ...ready, avgFireCoverage: 49 })).toEqual(['fire_medical']);
    expect(failed({ ...ready, hospitalInRange: false })).toEqual(['fire_medical']);
    expect(failed({ ...ready, roadTiles: 19 })).toEqual(['access']);
    expect(failed({ ...ready, avgRoadTraffic: EVENT_CONFIG.EVENT_TRAFFIC_LIMIT })).toEqual(['access']);
    expect(failed({ ...ready, avgWaterCoverage: 79 })).toEqual(['sanitation']);
    expect(failed({ ...ready, gangaHealth: 49 })).toEqual(['sanitation']);
    expect(failed({ ...ready, powerSupplyRatio: 0.99 })).toEqual(['lights']);
  });

  it('hints match the table', () => {
    const none = evaluateReadiness({
      avgPoliceCoverage: 0,
      avgFireCoverage: 0,
      hospitalInRange: false,
      areaTiles: 100,
      roadTiles: 0,
      avgRoadTraffic: 100,
      avgWaterCoverage: 0,
      gangaHealth: 0,
      powerSupplyRatio: 0.5,
    });
    expect(none.every((r) => !r.passed)).toBe(true);
    expect(none.map((r) => r.hint)).toEqual([
      'Build police thanas near the ghats',
      'Add a fire station and hospital nearby',
      'Add roads or a rail station so visitors can get in',
      'Improve water supply and clean the Ganga',
      'Add power capacity. Cuts during the festival would be a disaster',
    ]);
  });
});

describe('event outcome', () => {
  it('5 = triumph, 3-4 = success, 0-2 = overwhelmed', () => {
    expect(getEventOutcome(5).kind).toBe('triumph');
    expect(getEventOutcome(4).kind).toBe('success');
    expect(getEventOutcome(3).kind).toBe('success');
    expect(getEventOutcome(2).kind).toBe('overwhelmed');
    expect(getEventOutcome(0).kind).toBe('overwhelmed');
  });

  it('multipliers and happiness', () => {
    expect(getEventOutcome(5)).toMatchObject({ tourismMultiplier: 3, happinessDelta: 5, happinessDays: 60, isCrisis: false });
    expect(getEventOutcome(3)).toMatchObject({ tourismMultiplier: 2, happinessDelta: 2, isCrisis: false });
    expect(getEventOutcome(1)).toMatchObject({ tourismMultiplier: 1, happinessDelta: -5, happinessDays: 30, isCrisis: true });
  });

  it('messages', () => {
    expect(getEventOutcome(5, { festivalId: 'dev_deepawali' }).message).toBe('Dev Deepawali was magnificent! Visitors are raving.');
    expect(getEventOutcome(1, { festivalId: 'dev_deepawali', failed: ['crowd_safety', 'access'] }).message).toBe(
      'Crowds overwhelmed the ghats: not enough police, traffic jams'
    );
    const msg = getEventOutcome(0, { festivalId: 'maha_shivratri', failed: ['lights'] }).message;
    expect(msg).toBe('Crowds overwhelmed the temple lanes: power cuts');
    for (const n of [0, 1, 2, 3, 4, 5]) expect(getEventOutcome(n).message).not.toMatch(/injur|death|dead|died|killed|stampede/i);
  });

  it('resolveEvent ties the checklist to the outcome', () => {
    const r = resolveEvent('dev_deepawali', { ...ready, avgPoliceCoverage: 0, gangaHealth: 0, powerSupplyRatio: 0.5 });
    expect(r.outcome.kind).toBe('overwhelmed');
    expect(r.outcome.message).toBe('Crowds overwhelmed the ghats: not enough police, poor sanitation, power cuts');
    expect(resolveEvent('dev_deepawali', ready).outcome.kind).toBe('triumph');
  });
});
