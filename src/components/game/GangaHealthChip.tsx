'use client';

import React from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { RiverIcon } from '@/components/ui/Icons';
import { getGangaTrend } from '@/lib/scoring';
import { GANGA_TREND_ARROW, describeGangaCauses, getGangaHealthLevel } from '@/lib/ganga';
import { formatPopulation } from '@/lib/format';
import type { GangaLoadStats } from '@/types/game';
import { HUD_CHIP_CLASS, HudIconBadge } from '@/components/game/HudStat';

const LEVEL_TEXT_CLASS = {
  good: 'text-green-800',
  fair: 'text-amber-800',
  poor: 'text-red-800',
} as const;

const TREND_LABEL = { up: 'improving', down: 'getting worse', flat: 'steady' } as const;

interface GangaHealthChipProps {
  gangaHealth: number;
  gangaHealthTarget: number | undefined;
  /** What is loading the river now; the tooltip lists the biggest causes. */
  gangaLoad?: GangaLoadStats;
  /** Whether the Ganga overlay is currently on (the chip toggles it). */
  active: boolean;
  onClick: () => void;
  variant: 'desktop' | 'mobile';
}

/** Top-bar river chip (S2-T8): Ganga Health with a trend arrow. Clicking it shows the Ganga overlay. */
export function GangaHealthChip({ gangaHealth, gangaHealthTarget, gangaLoad, active, onClick, variant }: GangaHealthChipProps) {
  const health = Math.round(gangaHealth);
  const target = Math.round(gangaHealthTarget ?? gangaHealth);
  const trend = getGangaTrend(gangaHealth, gangaHealthTarget ?? gangaHealth);
  const colorClass = LEVEL_TEXT_CLASS[getGangaHealthLevel(gangaHealth)];
  const causes = gangaLoad && target < 70 ? describeGangaCauses(gangaLoad, formatPopulation) : [];
  const tooltip =
    `Ganga Health: ${health} (heading to ${target}).` +
    (causes.length > 0 ? ` Main causes: ${causes.map((c, i) => `${i + 1}) ${c}`).join('; ')}.` : '') +
    ` Click to see what's polluting the river.`;
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
          className={`flex items-center gap-1 rounded-none pl-1 pr-1.5 py-0.5 ring-1 ${
            active ? 'bg-ganga/25 ring-ganga/70' : 'bg-ganga/10 ring-ganga/25'
          }`}
        >
          <span className="text-[10px] font-semibold leading-none text-chrome-text">Ganga</span>
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
          className={`${HUD_CHIP_CLASS} press ${
            active ? '!border-ganga/70 !bg-ganga/15' : 'hover:!border-ganga/40'
          }`}
          aria-label={ariaLabel}
          aria-pressed={active}
        >
          <HudIconBadge tint="ganga"><RiverIcon size={16} /></HudIconBadge>
          <span className="flex min-w-0 flex-col items-start leading-none">
            <span className={`text-[15px] font-mono font-semibold ${colorClass}`}>
              {health} <span aria-hidden className="text-xs">{GANGA_TREND_ARROW[trend]}</span>
            </span>
            <span className="mt-1 max-w-full truncate text-[9px] font-semibold uppercase tracking-[0.14em] text-chrome-muted max-[1439px]:tracking-[0.06em]">Ganga</span>
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <p className="max-w-xs">{tooltip}</p>
      </TooltipContent>
    </Tooltip>
  );
}
