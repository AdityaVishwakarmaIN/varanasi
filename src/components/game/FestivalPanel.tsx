'use client';

/**
 * Festival UI (S5-T3, S5-T4): the top-bar festival chip, a banner while a management event is coming, and the Event
 * panel with the live readiness checklist. Clicking a failing requirement jumps to the event area with its overlay.
 */
import React from 'react';
import { msg, useMessages } from 'gt-next';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { GameState } from '@/types/game';
import type { OverlayMode } from '@/components/game/types';
import { FESTIVALS, getActiveFestivals, type FestivalId } from '@/lib/festivals';
import { getEventReadiness, getUpcomingManagementEvent, isManagementFestival, readinessOverlay } from '@/lib/festivalSim';
import { cn } from '@/lib/utils';

const TEXT = {
  today: msg('today'),
  ready: msg('ready'),
  intro: msg('Huge crowds are coming. Meet all five requirements in the event area for a triumph; three or four is a success.'),
  noArea: msg('There are no ghats yet. Build ghats on the riverfront to host the festival.'),
  showMe: msg('Show me'),
  halfScale: msg('Without Kashi Vishwanath Temple the festival runs at half scale around the largest ghat cluster.'),
};

/** Parses a calendar-strip forecast id or forecast notification id into a management festival, if it is one. */
export function festivalFromEventId(id: string): FestivalId | null {
  const match = /^(?:forecast-)?festival-([a-z_]+)(?:-\d+)?$/.exec(id);
  const fid = match?.[1] as FestivalId | undefined;
  return fid && fid in FESTIVALS && isManagementFestival(fid) ? fid : null;
}

/** "🪔 Diwali" chips for the festivals running now (Varanasi map only). */
export function FestivalChip({
  month,
  day,
  hour,
  mapId,
  className = '',
}: {
  month: number;
  day: number;
  hour: number;
  mapId: GameState['mapId'];
  className?: string;
}) {
  if (mapId !== 'varanasi') return null;
  const active = getActiveFestivals(month, day, Math.floor(hour));
  if (active.length === 0) return null;
  return (
    <>
      {active.map((f) => (
        <span key={f.id} className={cn('inline-flex items-center rounded bg-amber-500/20 px-1 text-[10px] leading-4 text-amber-200', className)}>
          {f.chip}
        </span>
      ))}
    </>
  );
}

/** Small banner over the map while a management event is announced or running; opens the Event panel. */
export function FestivalEventBanner({ state, onOpen, className }: { state: GameState; onOpen: (id: FestivalId) => void; className?: string }) {
  const m = useMessages();
  if (state.mapId !== 'varanasi') return null;
  const upcoming = getUpcomingManagementEvent(state.month, state.day);
  if (!upcoming) return null;
  const f = FESTIVALS[upcoming.id];
  const { passed, checklist } = getEventReadiness(state, upcoming.id);
  return (
    <button
      type="button"
      onClick={() => onOpen(upcoming.id)}
      className={cn(
        'pointer-events-auto rounded-md border border-amber-500/60 bg-card/95 px-3 py-1.5 text-xs shadow-lg hover:bg-accent',
        className
      )}
    >
      <span className="font-medium">{f.chip}</span>
      <span className="text-muted-foreground">
        {' · '}
        {upcoming.daysUntil === 0 ? m(TEXT.today) : `${upcoming.daysUntil}d`}
        {' · '}
        {passed}/{checklist.length} {m(TEXT.ready)}
      </span>
    </button>
  );
}

/** The Event panel: live readiness checklist with "Show me" on each failing requirement. */
export function FestivalEventPanel({
  festivalId,
  state,
  onClose,
  onLocate,
}: {
  festivalId: FestivalId | null;
  state: GameState;
  onClose: () => void;
  onLocate: (x: number, y: number, overlay: OverlayMode | undefined) => void;
}) {
  const m = useMessages();
  const readiness = festivalId ? getEventReadiness(state, festivalId) : null;
  const f = festivalId ? FESTIVALS[festivalId] : null;
  const center = readiness?.area.center ?? null;
  return (
    <Dialog open={!!festivalId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        {f && readiness && (
          <>
            <DialogHeader>
              <DialogTitle>
                {f.chip} · {readiness.passed}/{readiness.checklist.length}
              </DialogTitle>
              <DialogDescription>{m(center ? TEXT.intro : TEXT.noArea)}</DialogDescription>
            </DialogHeader>
            {readiness.area.scale < 1 && <p className="text-xs text-amber-500">{m(TEXT.halfScale)}</p>}
            <ul className="flex flex-col gap-1.5">
              {readiness.checklist.map((r) => {
                const Icon = r.passed ? CheckCircle2 : XCircle;
                const content = (
                  <>
                    <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', r.passed ? 'text-green-500' : 'text-destructive')} aria-hidden />
                    <span className="flex-1 text-left">
                      <span className="font-medium">{r.label}</span>
                      {!r.passed && <span className="block text-xs text-muted-foreground">{r.hint}</span>}
                    </span>
                    {!r.passed && center && <span className="text-xs text-primary">{m(TEXT.showMe)}</span>}
                  </>
                );
                return (
                  <li key={r.requirement}>
                    {r.passed || !center ? (
                      <div className="flex items-start gap-2 rounded px-2 py-1.5 text-sm">{content}</div>
                    ) : (
                      <button
                        type="button"
                        className="flex w-full items-start gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent"
                        onClick={() => {
                          onLocate(center.x, center.y, readinessOverlay(r));
                          onClose();
                        }}
                      >
                        {content}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
