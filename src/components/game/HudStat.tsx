'use client';

import React from 'react';
import { cn } from '@/lib/utils';

/** Tints for the round icon badge of a HUD stat. */
export const HUD_TINTS = {
  saffron: 'bg-chrome-panel border border-chrome-border text-chrome-text',
  marigold: 'bg-chrome-panel border border-chrome-border text-amber-700',
  ganga: 'bg-chrome-panel border border-chrome-border text-cyan-700',
  sandstone: 'bg-chrome-panel border border-chrome-border text-chrome-text',
  power: 'bg-chrome-panel border border-chrome-border text-amber-700',
  water: 'bg-chrome-panel border border-chrome-border text-blue-700',
  good: 'bg-chrome-panel border border-chrome-border text-green-700',
  bad: 'bg-chrome-panel border border-chrome-border text-red-700',
} as const;

export type HudTint = keyof typeof HUD_TINTS;

/** Value colours with enough contrast on the beige HUD. */
export const HUD_VALUE_TONE = {
  default: 'text-chrome-text',
  success: 'text-green-700',
  warning: 'text-amber-700',
  destructive: 'text-red-700',
} as const;

/** Shared chip frame for desktop HUD stats and the clickable Ganga / utility chips. */
export const HUD_CHIP_CLASS = 'hud-well flex items-center gap-2 rounded-md h-11 pl-1.5 pr-3 max-[1535px]:pl-3';

export function HudIconBadge({ tint, children, size = 'md' }: { tint: HudTint; children: React.ReactNode; size?: 'sm' | 'md' }) {
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full',
        size === 'md' ? 'h-8 w-8 max-[1535px]:hidden' : 'h-5 w-5',
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
        <span className={cn('whitespace-nowrap text-[15px] font-semibold font-mono', HUD_VALUE_TONE[tone])}>{value}</span>
        <span className="mt-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-chrome-muted">{label}</span>
      </div>
    </div>
  );
}
