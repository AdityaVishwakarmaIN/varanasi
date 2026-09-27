'use client';

import React from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { PowerIcon, WaterIcon } from '@/components/ui/Icons';
import { POWER_CONFIG, WATER_CONFIG, getSupplyStatus, type SupplyStatus } from '@/lib/utilities';
import { formatIndianNumber } from '@/lib/format';
import type { UtilitySupplyStats } from '@/types/game';
import { HUD_CHIP_CLASS, HudIconBadge } from '@/components/game/HudStat';

const STATUS_TEXT_CLASS: Record<SupplyStatus, string> = {
  ok: 'text-emerald-300',
  amber: 'text-amber-300',
  red: 'text-red-400',
};

const KIND = {
  power: { label: 'Power', icon: PowerIcon, iconClass: 'text-yellow-400', config: POWER_CONFIG, cutText: 'without power' },
  water: { label: 'Water', icon: WaterIcon, iconClass: 'text-sky-400', config: WATER_CONFIG, cutText: 'with dry taps' },
} as const;

/** Supply as a percentage of demand, capped so a huge surplus stays readable. */
export function getSupplyPercent(stats: UtilitySupplyStats): number {
  if (!(stats.demand > 0)) return 100;
  return Math.min(999, Math.round((stats.supply / stats.demand) * 100));
}

/** Whether a chip should be shown: desktop whenever there is demand, mobile only when supply is short. */
export function shouldShowUtilityChip(stats: UtilitySupplyStats | undefined, variant: 'desktop' | 'mobile'): stats is UtilitySupplyStats {
  if (!stats || !(stats.demand > 0)) return false;
  return variant === 'desktop' || stats.ratio < 1;
}

interface UtilityChipProps {
  kind: 'power' | 'water';
  stats: UtilitySupplyStats;
  /** Whether this utility's overlay is on (the chip toggles it). */
  active: boolean;
  onClick: () => void;
  variant: 'desktop' | 'mobile';
}

/** Top-bar power / water chip (S3-T7/T8): supply as % of demand; amber below 100%, red below 80%. */
export function UtilityChip({ kind, stats, active, onClick, variant }: UtilityChipProps) {
  const { label, icon: Icon, iconClass, config, cutText } = KIND[kind];
  const percent = getSupplyPercent(stats);
  const colorClass = STATUS_TEXT_CLASS[getSupplyStatus(stats.ratio, config)];
  const cutCount = stats.cut.length;
  const detail =
    stats.ratio < 1
      ? `Demand is higher than supply: ${cutCount} of ${stats.feeders.length} neighbourhoods take turns ${cutText}.`
      : 'Supply covers demand.';
  const tooltip = `${label}: ${formatIndianNumber(Math.round(stats.supply))} supply for ${formatIndianNumber(
    Math.round(stats.demand)
  )} demand (${percent}%). ${detail} Click to see the ${label.toLowerCase()} overlay.`;
  const ariaLabel = `${label} supply ${percent} percent. ${active ? 'Hide' : 'Show'} the ${label.toLowerCase()} overlay.`;

  if (variant === 'mobile') {
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
          className={`flex items-center gap-1 rounded-full pl-1 pr-1.5 py-0.5 ring-1 ${
            active ? 'bg-marigold/25 ring-marigold/70' : 'bg-sandstone/10 ring-sandstone/20'
          }`}
        >
          <Icon size={11} className={iconClass} />
          <span className={`text-[10px] font-mono font-semibold tabular-nums ${colorClass}`}>{percent}%</span>
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
            active ? '!border-marigold/70 !bg-marigold/10 shadow-[0_0_16px_-4px_hsl(var(--marigold)/0.55)]' : 'hover:!border-gold/40'
          }`}
          aria-label={ariaLabel}
          aria-pressed={active}
        >
          <HudIconBadge tint={kind}><Icon size={16} /></HudIconBadge>
          <span className="flex flex-col items-start leading-none">
            <span className={`text-[15px] font-mono font-semibold ${colorClass}`}>{percent}%</span>
            <span className="mt-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <p className="max-w-xs">{tooltip}</p>
      </TooltipContent>
    </Tooltip>
  );
}
