'use client';

import { useMemo } from 'react';
import type { GameState } from '@/types/game';
import { deriveAdvisorNotes } from '@/lib/advisorFeed';
import { countUrgentAdvisorMessages, type AdvisorNote } from '@/lib/advisors';
import { computeProblemIconsForState } from '@/lib/problemIcons';

/**
 * Named advisor messages (S5-T6), shared by the panel and the badges. Recomputed once per in-game day (or when
 * notifications, the river level or outbreaks change), not every tick: one grid scan, shared by every caller.
 */
let cache: { key: string; notifications: unknown; outbreaks: unknown; notes: AdvisorNote[] } | null = null;

export function getAdvisorNotes(state: GameState): AdvisorNote[] {
  const key = `${state.id}|${state.gridSize}|${state.year}|${state.month}|${state.day}|${state.riverLevel ?? 0}|${state.taxRate}|${state.disastersEnabled}`;
  if (cache && cache.key === key && cache.notifications === state.notifications && cache.outbreaks === state.outbreaks) {
    return cache.notes;
  }
  const notes = deriveAdvisorNotes(state, computeProblemIconsForState(state));
  cache = { key, notifications: state.notifications, outbreaks: state.outbreaks, notes };
  return notes;
}

export function useAdvisorNotes(state: GameState): { notes: AdvisorNote[]; urgent: number } {
  const notes = getAdvisorNotes(state);
  const urgent = useMemo(() => countUrgentAdvisorMessages(notes), [notes]);
  return { notes, urgent };
}
