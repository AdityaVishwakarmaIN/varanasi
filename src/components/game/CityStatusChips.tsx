'use client';

/**
 * Live crisis status (monsoon/river, heatwave, outbreaks, festival event) as small chips. Shown only while relevant.
 */
import React from 'react';
import { msg, useGT, useMessages } from 'gt-next';
import { Biohazard, PartyPopper, Thermometer, Waves, type LucideIcon } from 'lucide-react';
import type { GameState } from '@/types/game';
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
};

/** Monsoon is rolled on 1 June; the chip shows from then to the end of the flood season. */
const MONSOON_FROM_MONTH = 6;

type StatusState = Pick<
  GameState,
  'year' | 'month' | 'day' | 'gridSize' | 'monsoonStrength' | 'riverLevel' | 'heatwave' | 'outbreaks' | 'festival'
>;

function Chip({ icon: Icon, label, tone, onClick }: { icon: LucideIcon; label: string; tone: string; onClick?: () => void }) {
  const className = cn(
    'hud-panel pointer-events-auto inline-flex items-center gap-1.5 rounded-none px-2.5 py-1 text-xs font-medium whitespace-nowrap',
    tone,
    onClick && 'press hover:!bg-chrome-well cursor-pointer'
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
          tone={riverLevel > 0 ? 'text-sky-800 !border-sky-600/60' : 'text-sky-800/80'}
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
          tone="text-orange-800 !border-orange-500/60"
          label={gt('Heatwave: {days} days left', { days: heatDaysLeft })}
        />
      )}
      {outbreaks.length > 0 && (
        <Chip
          icon={Biohazard}
          tone="text-lime-800 !border-lime-600/60"
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
          tone="text-chrome-accent !border-marigold/60"
          label={FESTIVALS[activeEvent.id]?.name ?? activeEvent.id}
          onClick={() => onOpenFestival(activeEvent.id)}
        />
      )}
    </div>
  );
}
