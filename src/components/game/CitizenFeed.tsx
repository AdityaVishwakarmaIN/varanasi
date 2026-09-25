'use client';

import React, { useEffect, useState } from 'react';
import { msg, useMessages } from 'gt-next';
import { ChevronDown, ChevronUp, MapPin, MessageCircle } from 'lucide-react';
import { useGame } from '@/context/GameContext';
import { absoluteDay } from '@/lib/seasons';
import { createRng } from '@/lib/rng';
import { computeProblemIconsForState } from '@/lib/problemIcons';
import { isFeedDue, nextCitizenFeedEntry, pushFeedEntry, type CitizenFeedEntry } from '@/lib/citizenFeed';
import { cn } from '@/lib/utils';

const LABELS = {
  title: msg('Voices of the City'),
  empty: msg('Citizens will speak up about life in the city.'),
  expand: msg('Show citizen voices'),
  collapse: msg('Hide citizen voices'),
  locate: msg('Show on map'),
};

const STORAGE_PREFIX = 'isocity-citizen-feed-';

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function loadEntries(cityId: string): CitizenFeedEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + cityId);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as CitizenFeedEntry[]) : [];
  } catch {
    return [];
  }
}

function saveEntries(cityId: string, entries: CitizenFeedEntry[]): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + cityId, JSON.stringify(entries));
  } catch {
    // Storage full or blocked: the feed is cosmetic.
  }
}

/**
 * "Voices of the City" (S5-T7): a collapsible feed of short citizen messages, at most one per in-game week,
 * chosen from CITIZEN_VOICES by what is true in the city. Clicking a message with a place jumps there.
 * Desktop: bottom-left of the map. Mobile: a small chip that expands above the toolbar.
 */
export function CitizenFeed({
  onLocate,
  className,
  compact = false,
}: {
  onLocate: (x: number, y: number) => void;
  className?: string;
  compact?: boolean;
}) {
  const { state } = useGame();
  const m = useMessages();
  const [open, setOpen] = useState(!compact);
  const [feed, setFeed] = useState<{ cityId: string; entries: CitizenFeedEntry[] }>({ cityId: '', entries: [] });
  const [unread, setUnread] = useState(0);
  const today = absoluteDay(state.year, state.month, state.day);
  const cityId = state.id;

  // Load the saved feed when the city changes.
  useEffect(() => {
    setFeed({ cityId, entries: loadEntries(cityId) });
  }, [cityId]);

  // Once per in-game day, post a message if a week has passed since the last one.
  useEffect(() => {
    if (feed.cityId !== cityId) return;
    if (!isFeedDue(feed.entries[0]?.day, today)) return;
    const entry = nextCitizenFeedEntry(feed.entries, state, computeProblemIconsForState(state), createRng(hashString(cityId) ^ today));
    if (!entry) return;
    const entries = pushFeedEntry(feed.entries, entry);
    saveEntries(cityId, entries);
    setFeed({ cityId, entries });
    setUnread((u) => u + 1);
    // `state` is read at the day boundary only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today, cityId, feed]);

  const entries = feed.cityId === cityId ? feed.entries : [];
  const toggle = () => {
    setOpen((o) => !o);
    setUnread(0);
  };

  return (
    <div className={cn('pointer-events-auto', className)}>
      <div className="rounded-lg border border-border/70 bg-card/90 shadow-lg backdrop-blur-sm overflow-hidden">
        <button
          type="button"
          onClick={toggle}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-foreground min-h-[36px]"
          aria-expanded={open}
          aria-label={m(open ? LABELS.collapse : LABELS.expand)}
        >
          <MessageCircle className="h-3.5 w-3.5 text-primary" />
          <span className="flex-1">{m(LABELS.title)}</span>
          {!open && unread > 0 && (
            <span className="min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] leading-4 text-center">
              {unread}
            </span>
          )}
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
        </button>
        {open && (
          <ul className={cn('border-t border-border/50 overflow-y-auto', compact ? 'max-h-[32vh]' : 'max-h-56')}>
            {entries.length === 0 ? (
              <li className="px-3 py-2 text-xs text-muted-foreground">{m(LABELS.empty)}</li>
            ) : (
              entries.map((e) => {
                const canLocate = e.x !== undefined && e.y !== undefined;
                return (
                  <li key={e.id} className="border-b border-border/30 last:border-b-0">
                    <button
                      type="button"
                      disabled={!canLocate}
                      onClick={() => canLocate && onLocate(e.x!, e.y!)}
                      title={canLocate ? m(LABELS.locate) : undefined}
                      className={cn(
                        'flex w-full items-start gap-2 px-3 py-2 text-left text-xs leading-snug',
                        canLocate ? 'hover:bg-primary/10 cursor-pointer' : 'cursor-default',
                      )}
                    >
                      <span className={cn('mt-1 h-1.5 w-1.5 shrink-0 rounded-full', e.positive ? 'bg-green-400' : 'bg-amber-400')} />
                      <span className="flex-1 text-foreground/90">{e.text}</span>
                      {canLocate && <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
