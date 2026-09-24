'use client';

import React from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { RiverIcon } from '@/components/ui/Icons';
import { getGangaTrend } from '@/lib/scoring';
import { GANGA_TREND_ARROW, getGangaHealthLevel } from '@/lib/ganga';

const LEVEL_TEXT_CLASS = {
  good: 'text-green-500',
  fair: 'text-amber-500',
  poor: 'text-red-500',
} as const;

const TREND_LABEL = { up: 'improving', down: 'getting worse', flat: 'steady' } as const;

interface GangaHealthChipProps {
  gangaHealth: number;
  gangaHealthTarget: number | undefined;
  /** Whether the Ganga overlay is currently on (the chip toggles it). */
  active: boolean;
  onClick: () => void;
  variant: 'desktop' | 'mobile';
}

/** Top-bar river chip (S2-T8): Ganga Health with a trend arrow. Clicking it shows the Ganga overlay. */
export function GangaHealthChip({ gangaHealth, gangaHealthTarget, active, onClick, variant }: GangaHealthChipProps) {
  const health = Math.round(gangaHealth);
  const target = Math.round(gangaHealthTarget ?? gangaHealth);
  const trend = getGangaTrend(gangaHealth, gangaHealthTarget ?? gangaHealth);
  const colorClass = LEVEL_TEXT_CLASS[getGangaHealthLevel(gangaHealth)];
  const tooltip = `Ganga Health: ${health} (heading to ${target}). Click to see what's polluting the river.`;
  const ariaLabel = `Ganga Health ${health}, ${TREND_LABEL[trend]}. ${active ? 'Hide' : 'Show'} the Ganga overlay.`;

  if (variant === 'mobile') {
    // 44 px touch target; the visible chip stays small so the row still fits a 390 px screen.
    return (
      <button
        type="button"
        onClick={onClick}
        className="h-11 min-w-11 px-1 -my-3 flex items-center justify-center active:opacity-70"
        title={tooltip}
        aria-label={ariaLabel}
        aria-pressed={active}
      >
        <span
          className={`flex items-center gap-0.5 rounded-sm px-1 py-0.5 ${
            active ? 'bg-cyan-500/20 ring-1 ring-cyan-500/60' : 'bg-secondary/60'
          }`}
        >
          <RiverIcon size={11} className="text-cyan-400" />
          <span className={`text-[10px] font-mono font-semibold tabular-nums ${colorClass}`}>{health}</span>
          <span className={`text-[10px] leading-none ${colorClass}`} aria-hidden>{GANGA_TREND_ARROW[trend]}</span>
        </span>
      </button>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          className={`flex items-center gap-1.5 rounded-md px-2 h-9 border transition-colors ${
            active ? 'border-cyan-500/60 bg-cyan-500/15' : 'border-transparent hover:bg-secondary'
          }`}
          aria-label={ariaLabel}
          aria-pressed={active}
        >
          <RiverIcon size={16} className="text-cyan-400" />
          <span className="flex flex-col items-start leading-none">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-0.5">Ganga</span>
            <span className={`text-sm font-mono tabular-nums font-semibold ${colorClass}`}>
              {health} <span aria-hidden>{GANGA_TREND_ARROW[trend]}</span>
            </span>
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{tooltip}</p>
      </TooltipContent>
    </Tooltip>
  );
}
