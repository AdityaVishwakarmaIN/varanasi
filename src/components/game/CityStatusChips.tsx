'use client';

/**
 * Live crisis status (monsoon/river, heatwave, outbreaks, festival event) as small chips, and the
 * "Paused: <crisis>" banner shown after a crisis auto-pauses the game. Shown only while relevant.
 */
import React, { useEffect, useRef, useState } from 'react';
import { msg, useGT, useMessages } from 'gt-next';
import { Biohazard, PartyPopper, Pause, Play, Thermometer, Waves, type LucideIcon } from 'lucide-react';
import type { GameState, Notification } from '@/types/game';
import type { OverlayMode } from '@/components/game/types';
import type { FestivalId } from '@/lib/festivals';
import { FESTIVALS } from '@/lib/festivals';
import { FLOOD_CONFIG, MAX_RIVER_LEVEL } from '@/lib/floods';
import { isHeatwaveActive } from '@/lib/heatwave';
import { getFeederBounds } from '@/lib/feederZones';
import { absoluteDay } from '@/lib/seasons';
import { cn } from '@/lib/utils';

const LABELS = {
  weak: msg('weak'),
  normal: msg('normal'),
  heavy: msg('heavy'),
  resume: msg('Resume'),
};

/** Monsoon is rolled on 1 June; the chip shows from then to the end of the flood season. */
const MONSOON_FROM_MONTH = 6;

type StatusState = Pick<
  GameState,
  'year' | 'month' | 'day' | 'gridSize' | 'monsoonStrength' | 'riverLevel' | 'heatwave' | 'outbreaks' | 'festival'
>;

function Chip({ icon: Icon, label, tone, onClick }: { icon: LucideIcon; label: string; tone: string; onClick?: () => void }) {
  const className = cn(
    'hud-panel pointer-events-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap',
    tone,
    onClick && 'hover:brightness-125 cursor-pointer'
  );
  const content = (
    <>
      <Icon className="w-3.5 h-3.5" aria-hidden />
      {label}
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className={className}>{content}</button>
  ) : (
    <span className={className}>{content}</span>
  );
}

export function CityStatusChips({
  state,
  onOverlay,
  onLocate,
  onOpenFestival,
  className,
}: {
  state: StatusState;
  onOverlay: (overlay: OverlayMode) => void;
  onLocate: (x: number, y: number, overlay?: OverlayMode) => void;
  onOpenFestival: (id: FestivalId) => void;
  className?: string;
}) {
  const gt = useGT();
  const m = useMessages();
  const today = absoluteDay(state.year, state.month, state.day);
  const riverLevel = state.riverLevel ?? 0;
  const showMonsoon =
    !!state.monsoonStrength &&
    (riverLevel > 0 || (state.month >= MONSOON_FROM_MONTH && state.month <= FLOOD_CONFIG.floodEndMonth));
  const heatDaysLeft = isHeatwaveActive(state.heatwave, today) && state.heatwave ? state.heatwave.endDay - today : 0;
  const outbreaks = state.outbreaks ?? [];
  const event = state.festival?.event;
  const activeEvent = event && today >= event.startDay && today <= event.endDay ? event : undefined;

  if (!showMonsoon && heatDaysLeft <= 0 && outbreaks.length === 0 && !activeEvent) return null;

  return (
    <div className={cn('flex flex-wrap gap-1.5 pointer-events-none', className)}>
      {showMonsoon && state.monsoonStrength && (
        <Chip
          icon={Waves}
          tone={riverLevel > 0 ? 'text-sky-300 !border-sky-400/50' : 'text-sky-200/80'}
          label={gt('Monsoon: {strength} · river {level}/{max}', {
            strength: m(LABELS[state.monsoonStrength]),
            level: riverLevel,
            max: MAX_RIVER_LEVEL,
          })}
          onClick={() => onOverlay('flood')}
        />
      )}
      {heatDaysLeft > 0 && (
        <Chip
          icon={Thermometer}
          tone="text-orange-300 !border-orange-400/50"
          label={gt('Heatwave: {days} days left', { days: heatDaysLeft })}
        />
      )}
      {outbreaks.length > 0 && (
        <Chip
          icon={Biohazard}
          tone="text-lime-300 !border-lime-400/50"
          label={gt('Outbreak: {count} areas', { count: outbreaks.length })}
          onClick={() => {
            const b = getFeederBounds(outbreaks[0].feeder, state.gridSize);
            onLocate(b.centerX, b.centerY, 'health');
          }}
        />
      )}
      {activeEvent && (
        <Chip
          icon={PartyPopper}
          tone="text-marigold !border-marigold/50"
          label={FESTIVALS[activeEvent.id]?.name ?? activeEvent.id}
          onClick={() => onOpenFestival(activeEvent.id)}
        />
      )}
    </div>
  );
}

/**
 * "Paused: <crisis title>" after a crisis pauses the game (speed drops to 0 in the same update that adds a
 * crisis notification). Stays until the player resumes.
 */
export function CrisisPauseBanner({
  speed,
  notifications,
  onResume,
  className,
}: {
  speed: GameState['speed'];
  notifications: readonly Notification[];
  onResume: () => void;
  className?: string;
}) {
  const gt = useGT();
  const m = useMessages();
  const [crisisTitle, setCrisisTitle] = useState<string | null>(null);
  const prevRef = useRef({ speed, topId: notifications[0]?.id });

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = { speed, topId: notifications[0]?.id };
    if (speed !== 0) {
      setCrisisTitle(null);
      return;
    }
    if (prev.speed === 0) return;
    // Just paused: was it a crisis that arrived with this update?
    const firstOld = prev.topId === undefined ? -1 : notifications.findIndex((n) => n.id === prev.topId);
    const fresh = firstOld === -1 ? notifications : notifications.slice(0, firstOld);
    const crisis = fresh.find((n) => n.severity === 'crisis');
    if (crisis) setCrisisTitle(crisis.title);
  }, [speed, notifications]);

  if (crisisTitle === null || speed !== 0) return null;
  return (
    <div
      role="status"
      className={cn(
        'hud-panel pointer-events-auto flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm !border-red-400/60',
        className
      )}
    >
      <Pause className="w-4 h-4 shrink-0 text-red-400" aria-hidden />
      <p className="flex-1 min-w-0 truncate text-red-200">{gt('Paused: {title}', { title: crisisTitle })}</p>
      <button
        type="button"
        onClick={onResume}
        className="inline-flex items-center gap-1 rounded-lg px-2 min-h-8 text-xs font-medium text-marigold hover:bg-marigold/10"
      >
        <Play className="w-3.5 h-3.5" aria-hidden />
        {m(LABELS.resume)}
      </button>
    </div>
  );
}
