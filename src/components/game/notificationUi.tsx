'use client';

/** Shared by the notification toasts and the notification log: icon, "can locate" and which ones to list. */
import React from 'react';
import { AlertTriangle, Flame, Home, Info, Landmark, Route, Thermometer, Trophy, Waves, type LucideIcon } from 'lucide-react';
import type { Notification } from '@/types/game';
import { festivalFromEventId } from '@/components/game/FestivalPanel';
import { cn } from '@/lib/utils';

/** Notification `icon` names used by the simulation and context. Anything else (an emoji) is shown as text. */
const ICONS: Record<string, LucideIcon> = {
  alert: AlertTriangle,
  home: Home,
  road: Route,
  trophy: Trophy,
  fire: Flame,
  flood: Waves,
  heat: Thermometer,
  info: Info,
  landmark: Landmark,
};

export function NotificationIcon({ icon, className }: { icon: string; className?: string }) {
  const Icon = ICONS[icon];
  if (Icon) return <Icon className={cn('w-4 h-4', className)} aria-hidden />;
  if (/^[a-z_-]+$/.test(icon)) return <Info className={cn('w-4 h-4', className)} aria-hidden />;
  return <span className="text-base leading-none" aria-hidden>{icon}</span>;
}

/** Save failures have their own toast (SaveErrorToast); they are not toasted or logged here. */
export function isHandledElsewhere(n: Notification): boolean {
  return n.id.startsWith('save-failed-');
}

/** True when Game's `locateNotification` can do something: a tile, an overlay or a festival event panel. */
export function canLocateNotification(n: Notification): boolean {
  return (n.x !== undefined && n.y !== undefined) || n.overlay !== undefined || festivalFromEventId(n.id) !== null;
}
