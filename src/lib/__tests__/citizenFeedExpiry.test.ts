import { describe, expect, it } from 'vitest';
import { createRng } from '@/lib/rng';
import {
  advanceCitizenFeed,
  CITIZEN_FEED_CONFIG,
  getActiveVoiceConditions,
  normalizeFeedEntries,
  pruneFeedEntries,
  type CitizenFeedEntry,
} from '@/lib/citizenFeed';
import { absoluteDay } from '@/lib/seasons';
import { emptyCity } from './feedbackLayers.helpers';

const cfg = CITIZEN_FEED_CONFIG;
const entry = (over: Partial<CitizenFeedEntry> = {}): CitizenFeedEntry => ({
  id: 'e', day: 100, voiceId: 'power_cut_cricket', text: 'Power cut again', positive: false, ...over,
});

describe('citizen feed expiry', () => {
  it('lives three in-game months', () => {
    expect(cfg.lifetimeDays).toBe(90);
    const fresh = entry({ voiceId: 'happiness_high', positive: true });
    expect(pruneFeedEntries([fresh], 100 + 89, null)).toEqual([fresh]);
    expect(pruneFeedEntries([fresh], 100 + 90, null)).toEqual([]);
  });

  it('drops entries dated in the future (older save loaded)', () => {
    expect(pruneFeedEntries([entry({ day: 500 })], 100, null)).toEqual([]);
  });

  it('marks a solved problem resolved, then removes it after the grace period', () => {
    const e = entry();
    const solved = pruneFeedEntries([e], 105, []);
    expect(solved).toEqual([{ ...e, resolved: true, resolvedDay: 105 }]);
    // Nothing changes while still inside the grace period: same array back.
    expect(pruneFeedEntries(solved, 110, [])).toBe(solved);
    expect(pruneFeedEntries(solved, 105 + cfg.resolvedGraceDays, [])).toEqual([]);
  });

  it('keeps a problem entry while its condition is still true, and un-resolves it when it returns', () => {
    const e = entry();
    const active = [{ condition: 'power_cut' as const }];
    const same = [e];
    expect(pruneFeedEntries(same, 105, active)).toBe(same);
    const back = pruneFeedEntries([{ ...e, resolved: true, resolvedDay: 103 }], 105, active);
    expect(back).toEqual([e]);
    expect('resolved' in back[0]).toBe(false);
  });

  it('never resolves positive or unknown-voice entries', () => {
    const list = [entry({ id: 'a', voiceId: 'power_ok', positive: true }), entry({ id: 'b', voiceId: 'gone_template' })];
    expect(pruneFeedEntries(list, 105, [])).toBe(list);
  });

  it('caps the list length', () => {
    const many = Array.from({ length: cfg.maxEntries + 4 }, (_, i) => entry({ id: `e${i}`, voiceId: 'happiness_high', positive: true, day: 100 - i }));
    expect(pruneFeedEntries(many, 101, null)).toHaveLength(cfg.maxEntries);
  });

  it('tolerates old or broken stored feeds', () => {
    expect(normalizeFeedEntries(null)).toEqual([]);
    expect(normalizeFeedEntries({})).toEqual([]);
    const out = normalizeFeedEntries([
      null, 'x', { text: 'no day' }, { day: 3 },
      { day: 5, text: 'old', voiceId: 'flood' },
      { id: 'n', day: 9, text: 'new', voiceId: 'fog', positive: true, x: 2, y: 3, resolved: true },
    ]);
    expect(out.map((e) => e.text)).toEqual(['new', 'old']);
    expect(out[0]).toMatchObject({ id: 'n', positive: true, x: 2, y: 3, resolved: true });
    expect(out[1]).toEqual({ id: '5-flood', day: 5, voiceId: 'flood', text: 'old', positive: false });
  });

  it('resolves a power-cut complaint once the power is back, via the real condition check', () => {
    const state = emptyCity();
    state.stats.population = 50;
    state.stats.power = { supply: 50, demand: 100, ratio: 0.5, feeders: [0, 3], cut: [3] };
    const today = absoluteDay(state.year, state.month, state.day);
    const complaint = entry({ id: 'c', day: today - 8 });
    expect(getActiveVoiceConditions(state, null).some((a) => a.condition === 'power_cut')).toBe(true);
    expect(advanceCitizenFeed([complaint], state, null, createRng(2)).entries.find((e) => e.id === 'c')?.resolved).toBeUndefined();

    state.stats.power = { supply: 120, demand: 100, ratio: 1.2, feeders: [0, 3], cut: [] };
    const later = advanceCitizenFeed([complaint], state, null, createRng(3));
    expect(later.entries.find((e) => e.id === 'c')).toMatchObject({ resolved: true, resolvedDay: today });
  });
});
