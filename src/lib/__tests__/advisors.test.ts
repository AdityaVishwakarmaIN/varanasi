import { describe, expect, it } from 'vitest';
import {
  ADVISORS,
  ADVISOR_IDS,
  ADVISOR_TOPICS,
  clearAdvisorMessage,
  countUrgentAdvisorMessages,
  createAdvisorNote,
  getAdvisorForTopic,
  mergeAdvisorMessages,
  type AdvisorId,
  type AdvisorNote,
  type AdvisorPriority,
} from '@/lib/advisors';

function note(advisor: AdvisorId, kind: string, priority: AdvisorPriority, problem = kind): AdvisorNote {
  return { id: `${advisor}:${kind}`, advisor, kind, priority, problem, fix: 'fix it' };
}

describe('advisors', () => {
  it('five advisors with their roles', () => {
    expect(ADVISOR_IDS.map((id) => ADVISORS[id].title)).toEqual([
      'Treasury Officer',
      'City Engineer',
      'River Officer',
      'Health Officer',
      'Police Commissioner',
    ]);
  });

  it('routes topics to the right advisor', () => {
    expect(getAdvisorForTopic('bankruptcy')).toBe('treasury');
    expect(getAdvisorForTopic('power')).toBe('engineer');
    expect(getAdvisorForTopic('collapse')).toBe('engineer');
    expect(getAdvisorForTopic('flood')).toBe('river');
    expect(getAdvisorForTopic('tourism')).toBe('river');
    expect(getAdvisorForTopic('heatwave')).toBe('health');
    expect(getAdvisorForTopic('festival')).toBe('police');
    for (const a of Object.values(ADVISOR_TOPICS)) expect(ADVISOR_IDS).toContain(a);
  });

  it('creates routed messages with Show me targets', () => {
    const m = createAdvisorNote('power', 'power_shortage', 'high', 'Power cuts', 'Build a plant', { x: 3, y: 4, overlay: 'power' });
    expect(m).toEqual({
      id: 'engineer:power_shortage',
      advisor: 'engineer',
      kind: 'power_shortage',
      priority: 'high',
      problem: 'Power cuts',
      fix: 'Build a plant',
      x: 3,
      y: 4,
      overlay: 'power',
    });
  });
});

describe('mergeAdvisorMessages', () => {
  it('a newer message replaces the same kind', () => {
    const merged = mergeAdvisorMessages([note('engineer', 'power', 'medium', 'old')], [note('engineer', 'power', 'high', 'new')]);
    expect(merged).toHaveLength(1);
    expect(merged[0].problem).toBe('new');
    expect(merged[0].priority).toBe('high');
  });

  it('the same kind from different advisors does not collide', () => {
    const merged = mergeAdvisorMessages([note('engineer', 'x', 'low')], [note('river', 'x', 'low')]);
    expect(merged).toHaveLength(2);
  });

  it('the last incoming duplicate wins', () => {
    const merged = mergeAdvisorMessages([], [note('health', 'heat', 'low', 'a'), note('health', 'heat', 'critical', 'b')]);
    expect(merged.map((m) => m.problem)).toEqual(['b']);
  });

  it('caps each advisor at 3, keeping the most important then the newest', () => {
    const existing = [note('engineer', 'a', 'low'), note('engineer', 'b', 'medium'), note('engineer', 'c', 'critical')];
    const incoming = [note('engineer', 'd', 'low'), note('engineer', 'e', 'high'), note('police', 'f', 'low')];
    const merged = mergeAdvisorMessages(existing, incoming);
    const engineer = merged.filter((m) => m.advisor === 'engineer').map((m) => m.kind);
    expect(engineer).toEqual(['c', 'e', 'b']);
    expect(merged.filter((m) => m.advisor === 'police')).toHaveLength(1);
    expect(mergeAdvisorMessages(existing, incoming, 1).filter((m) => m.advisor === 'engineer').map((m) => m.kind)).toEqual(['c']);
  });

  it('newer wins a priority tie for the last slot', () => {
    const existing = [note('river', 'a', 'low'), note('river', 'b', 'low'), note('river', 'c', 'low')];
    const merged = mergeAdvisorMessages(existing, [note('river', 'd', 'low')]);
    expect(merged.map((m) => m.kind)).toEqual(['d', 'a', 'b']);
  });

  it('sorts by priority across advisors', () => {
    const merged = mergeAdvisorMessages(
      [note('treasury', 'money', 'low'), note('health', 'disease', 'critical')],
      [note('police', 'crowds', 'medium'), note('river', 'flood', 'high')]
    );
    expect(merged.map((m) => m.priority)).toEqual(['critical', 'high', 'medium', 'low']);
  });

  it('is stable when re-merged with nothing new', () => {
    const once = mergeAdvisorMessages([], [note('river', 'a', 'low'), note('river', 'b', 'high'), note('river', 'c', 'low')]);
    expect(mergeAdvisorMessages(once, [])).toEqual(once);
  });

  it('clears resolved problems and counts urgent ones', () => {
    const list = [note('engineer', 'power', 'high'), note('river', 'flood', 'critical'), note('police', 'x', 'medium')];
    expect(countUrgentAdvisorMessages(list)).toBe(2);
    expect(clearAdvisorMessage(list, 'engineer', 'power').map((m) => m.kind)).toEqual(['flood', 'x']);
  });
});
