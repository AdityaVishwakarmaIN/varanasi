'use client';

import React from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { PowerIcon, WaterIcon } from '@/components/ui/Icons';
import { POWER_CONFIG, WATER_CONFIG, getSupplyStatus, type SupplyStatus } from '@/lib/utilities';
import { formatIndianNumber } from '@/lib/format';
import type { UtilitySupplyStats } from '@/types/game';
import { HUD_CHIP_CLASS, HudIconBadge } from '@/components/game/HudStat';

const STATUS_TEXT_CLASS: Record<SupplyStatus, string> = {
  ok: 'text-emerald-800',
  amber: 'text-amber-800',
  red: 'text-red-800',
};

const KIND = {
  power: { label: 'Power', icon: PowerIcon, iconClass: 'text-yellow-800', config: POWER_CONFIG, cutText: 'without power' },
  water: { label: 'Water', icon: WaterIcon, iconClass: 'text-sky-800', config: WATER_CONFIG, cutText: 'with dry taps' },
} as const;

/** Above this a surplus is shown as ">200%": the exact figure means nothing to the player. */
const SUPPLY_PERCENT_CAP = 200;

/** Supply as a percentage of demand, capped at SUPPLY_PERCENT_CAP + 1 so a huge surplus stays readable. */
export function getSupplyPercent(stats: UtilitySupplyStats): number {
  if (!(stats.demand > 0)) return 100;
  return Math.max(0, Math.min(SUPPLY_PERCENT_CAP + 1, Math.round((stats.supply / stats.demand) * 100)));
}

/** "85%", or ">200%" for a big surplus. */
export function getSupplyLabel(stats: UtilitySupplyStats): string {
  const percent = getSupplyPercent(stats);
  return percent > SUPPLY_PERCENT_CAP ? `>${SUPPLY_PERCENT_CAP}%` : `${percent}%`;
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
  const percentLabel = getSupplyLabel(stats);
  const colorClass = STATUS_TEXT_CLASS[getSupplyStatus(stats.ratio, config)];
  const cutCount = stats.cut.length;
  const detail =
    stats.ratio < 1
      ? `Demand is higher than supply: ${cutCount} of ${stats.feeders.length} neighbourhoods take turns ${cutText}.`
      : 'Supply covers demand.';
  const tooltip = `${label}: ${formatIndianNumber(Math.round(stats.supply))} supply for ${formatIndianNumber(
    Math.round(stats.demand)
  )} demand (${percentLabel}). ${detail} Click to see the ${label.toLowerCase()} overlay.`;
  const ariaLabel = `${label} supply ${percentLabel.replace('%', ' percent')}. ${active ? 'Hide' : 'Show'} the ${label.toLowerCase()} overlay.`;

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
          className={`flex items-center gap-1 rounded-none pl-1 pr-1.5 py-0.5 ring-1 ${
            active ? 'bg-chrome-accent/20 ring-chrome-accent' : 'bg-chrome-well ring-chrome-border'
          }`}
        >
          <Icon size={11} className={iconClass} />
          <span className={`text-[10px] font-mono font-semibold tabular-nums ${colorClass}`}>{percentLabel}</span>
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
            active ? '!border-chrome-accent !bg-chrome-accent/10' : 'hover:!border-chrome-accent/60'
          }`}
          aria-label={ariaLabel}
          aria-pressed={active}
        >
          <HudIconBadge tint={kind}><Icon size={16} /></HudIconBadge>
          <span className="flex min-w-0 flex-col items-start leading-none">
            <span className={`text-[15px] font-mono font-semibold ${colorClass}`}>{percentLabel}</span>
            <span className="mt-1 max-w-full truncate text-[9px] font-semibold uppercase tracking-[0.14em] text-chrome-muted max-[1439px]:tracking-[0.06em]">{label}</span>
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <p className="max-w-xs">{tooltip}</p>
      </TooltipContent>
    </Tooltip>
  );
}
