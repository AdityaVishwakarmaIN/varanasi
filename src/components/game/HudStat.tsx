'use client';

import React from 'react';
import { cn } from '@/lib/utils';

/** Tints for the round icon badge of a HUD stat. */
export const HUD_TINTS = {
  saffron: 'bg-saffron/15 text-saffron ring-saffron/30',
  marigold: 'bg-marigold/15 text-marigold ring-marigold/30',
  ganga: 'bg-ganga/15 text-ganga ring-ganga/30',
  sandstone: 'bg-sandstone/10 text-sandstone ring-sandstone/25',
  power: 'bg-yellow-400/15 text-yellow-300 ring-yellow-400/30',
  water: 'bg-sky-400/15 text-sky-300 ring-sky-400/30',
  good: 'bg-emerald-400/15 text-emerald-300 ring-emerald-400/30',
  bad: 'bg-red-400/15 text-red-300 ring-red-400/30',
} as const;

export type HudTint = keyof typeof HUD_TINTS;

/** Value colours with enough contrast on the indigo HUD. */
export const HUD_VALUE_TONE = {
  default: 'text-foreground',
  success: 'text-emerald-300',
  warning: 'text-amber-300',
  destructive: 'text-red-400',
} as const;

/** Shared chip frame for desktop HUD stats and the clickable Ganga / utility chips. */
export const HUD_CHIP_CLASS = 'hud-well flex items-center gap-2 rounded-xl h-11 pl-1.5 pr-3 max-[1359px]:pl-3';

export function HudIconBadge({ tint, children, size = 'md' }: { tint: HudTint; children: React.ReactNode; size?: 'sm' | 'md' }) {
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full ring-1',
        size === 'md' ? 'h-8 w-8 max-[1359px]:hidden' : 'h-5 w-5',
        HUD_TINTS[tint]
      )}
      aria-hidden
    >
      {children}
    </span>
  );
}

interface HudStatProps {
  icon: React.ReactNode;
  tint: HudTint;
  label: string;
  value: React.ReactNode;
  tone?: keyof typeof HUD_VALUE_TONE;
  className?: string;
}

/** A labelled number in the desktop top bar: icon badge, big value, small caps label. */
export function HudStat({ icon, tint, label, value, tone = 'default', className }: HudStatProps) {
  return (
    <div className={cn(HUD_CHIP_CLASS, className)}>
      <HudIconBadge tint={tint}>{icon}</HudIconBadge>
      <div className="flex flex-col leading-none">
        <span className={cn('text-[15px] font-semibold font-mono', HUD_VALUE_TONE[tone])}>{value}</span>
        <span className="mt-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}
