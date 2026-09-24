/**
 * Named advisors (S5-T6): who covers what, the message shape, and the merge rules
 * (newer replaces the same kind, at most 3 per advisor, sorted by priority).
 */

export type AdvisorId = 'treasury' | 'engineer' | 'river' | 'health' | 'police';

export interface AdvisorDef {
  id: AdvisorId;
  /** Display name and role. */
  title: string;
  /** What the advisor covers (for the panel subtitle). */
  covers: string;
  /** Avatar key for the illustrated avatar (art pipeline), plus an emoji fallback. */
  avatar: string;
  icon: string;
}

export const ADVISORS: Record<AdvisorId, AdvisorDef> = {
  treasury: {
    id: 'treasury',
    title: 'Treasury Officer',
    covers: 'Money, taxes, loans, bankruptcy risk',
    avatar: 'advisor_treasury',
    icon: '💰',
  },
  engineer: {
    id: 'engineer',
    title: 'City Engineer',
    covers: 'Power, water, roads, traffic, collapses',
    avatar: 'advisor_engineer',
    icon: '🛠️',
  },
  river: {
    id: 'river',
    title: 'River Officer',
    covers: 'Ganga Health, floods, embankments, ghats, tourism',
    avatar: 'advisor_river',
    icon: '🌊',
  },
  health: {
    id: 'health',
    title: 'Health Officer',
    covers: 'Health, disease, heatwaves',
    avatar: 'advisor_health',
    icon: '🩺',
  },
  police: {
    id: 'police',
    title: 'Police Commissioner',
    covers: 'Safety, crime, festivals and crowds',
    avatar: 'advisor_police',
    icon: '🛡️',
  },
};

export const ADVISOR_IDS: readonly AdvisorId[] = ['treasury', 'engineer', 'river', 'health', 'police'];

/** Every topic a system can raise, routed to exactly one advisor. */
export const ADVISOR_TOPICS = {
  money: 'treasury',
  taxes: 'treasury',
  loan: 'treasury',
  bankruptcy: 'treasury',
  budget: 'treasury',
  power: 'engineer',
  water: 'engineer',
  roads: 'engineer',
  traffic: 'engineer',
  collapse: 'engineer',
  zoning: 'engineer',
  housing: 'engineer',
  informal_settlement: 'engineer',
  ganga: 'river',
  flood: 'river',
  embankment: 'river',
  ghats: 'river',
  tourism: 'river',
  pollution: 'river',
  health: 'health',
  disease: 'health',
  heatwave: 'health',
  education: 'health',
  safety: 'police',
  crime: 'police',
  fire: 'police',
  festival: 'police',
  crowds: 'police',
} as const satisfies Record<string, AdvisorId>;

export type AdvisorTopic = keyof typeof ADVISOR_TOPICS;

export type AdvisorPriority = 'low' | 'medium' | 'high' | 'critical';

export const ADVISOR_CONFIG = {
  maxPerAdvisor: 3,
  /** Higher sorts first. */
  priorityRank: { low: 0, medium: 1, high: 2, critical: 3 } as Record<AdvisorPriority, number>,
  /** Priorities counted in the top-bar badge. */
  badgePriorities: ['high', 'critical'] as readonly AdvisorPriority[],
} as const;

/** One advisor message. `kind` identifies the problem (e.g. 'power_shortage'); a newer message of the same kind replaces the old one. */
export interface AdvisorNote {
  id: string;
  advisor: AdvisorId;
  kind: string;
  priority: AdvisorPriority;
  /** One-line problem. */
  problem: string;
  /** One-line suggested fix. */
  fix: string;
  /** "Show me" target. */
  x?: number;
  y?: number;
  /** Overlay to turn on for "Show me" (an OverlayMode value). */
  overlay?: string;
}

export function getAdvisorForTopic(topic: AdvisorTopic): AdvisorId {
  return ADVISOR_TOPICS[topic];
}

/** Builds a message routed by topic. The id is `${advisor}:${kind}`, so the same kind always replaces itself. */
export function createAdvisorNote(
  topic: AdvisorTopic,
  kind: string,
  priority: AdvisorPriority,
  problem: string,
  fix: string,
  showMe: { x?: number; y?: number; overlay?: string } = {}
): AdvisorNote {
  const advisor = getAdvisorForTopic(topic);
  return { id: `${advisor}:${kind}`, advisor, kind, priority, problem, fix, ...showMe };
}

/**
 * Merges new messages into the current list.
 * - A message with the same advisor and kind as an older one replaces it (the last incoming one wins).
 * - Each advisor keeps at most `maxPerAdvisor`: highest priority first, then newest (incoming before existing).
 * - The result is sorted by priority (critical first); ties keep newest first, then the original order.
 */
export function mergeAdvisorMessages(
  existing: readonly AdvisorNote[],
  incoming: readonly AdvisorNote[],
  maxPerAdvisor: number = ADVISOR_CONFIG.maxPerAdvisor
): AdvisorNote[] {
  const key = (m: AdvisorNote) => `${m.advisor}\u0000${m.kind}`;
  // Recency: every incoming message is newer than every existing one, and a later incoming message is newer than an earlier one.
  // Existing messages keep their order (this function outputs newest-first within a priority, so re-merging is stable).
  const byKey = new Map<string, { m: AdvisorNote; recency: number }>();
  existing.forEach((m, i) => {
    if (!byKey.has(key(m))) byKey.set(key(m), { m, recency: -1 - i });
  });
  incoming.forEach((m, i) => byKey.set(key(m), { m, recency: i }));

  const rank = ADVISOR_CONFIG.priorityRank;
  const sorted = [...byKey.values()].sort(
    (a, b) => rank[b.m.priority] - rank[a.m.priority] || b.recency - a.recency
  );
  const perAdvisor = new Map<AdvisorId, number>();
  const out: AdvisorNote[] = [];
  const cap = Math.max(0, Math.floor(maxPerAdvisor));
  for (const { m } of sorted) {
    const n = perAdvisor.get(m.advisor) ?? 0;
    if (n >= cap) continue;
    perAdvisor.set(m.advisor, n + 1);
    out.push(m);
  }
  return out;
}

/** Removes a resolved problem (e.g. power supply is back to 100%). */
export function clearAdvisorMessage(messages: readonly AdvisorNote[], advisor: AdvisorId, kind: string): AdvisorNote[] {
  return messages.filter((m) => !(m.advisor === advisor && m.kind === kind));
}

/** Count for the top-bar advisor badge (high and critical messages). */
export function countUrgentAdvisorMessages(messages: readonly AdvisorNote[]): number {
  return messages.filter((m) => ADVISOR_CONFIG.badgePriorities.includes(m.priority)).length;
}
