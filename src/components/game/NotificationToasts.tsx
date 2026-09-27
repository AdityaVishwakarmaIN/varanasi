'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { msg, useMessages } from 'gt-next';
import { AlertTriangle, Flame, Home, Info, Landmark, MapPin, Route, Thermometer, Trophy, Waves, X, type LucideIcon } from 'lucide-react';
import type { Notification } from '@/types/game';
import { NOTIFICATION_CONFIG } from '@/lib/notifications';
import { cn } from '@/lib/utils';

const LABELS = {
  locate: msg('Show on map'),
  dismiss: msg('Dismiss'),
};

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

/** Save failures have their own toast (SaveErrorToast). */
const HANDLED_ELSEWHERE = /^save-failed-/;

function NotificationIcon({ icon, className }: { icon: string; className?: string }) {
  const Icon = ICONS[icon];
  if (Icon) return <Icon className={cn('w-4 h-4', className)} aria-hidden />;
  if (/^[a-z_-]+$/.test(icon)) return <Info className={cn('w-4 h-4', className)} aria-hidden />;
  return <span className="text-base leading-none" aria-hidden>{icon}</span>;
}

const SEVERITY_STYLES: Record<NonNullable<Notification['severity']>, string> = {
  info: 'border-gold/20',
  warning: '!border-amber-400/60',
  crisis: '!border-red-400/70 ring-1 ring-red-400/30',
};

/**
 * Toasts for new notifications (S4-T4). Notifications already on the state when the game
 * loads are not shown again. Clicking a toast with a location moves the camera there and
 * turns on its overlay.
 */
export function NotificationToasts({
  notifications,
  onLocate,
  className,
}: {
  notifications: readonly Notification[];
  onLocate: (notification: Notification) => void;
  className?: string;
}) {
  const m = useMessages();
  const seenRef = useRef<Set<string> | null>(null);
  const [toasts, setToasts] = useState<Notification[]>([]);

  useEffect(() => {
    if (seenRef.current === null) {
      seenRef.current = new Set(notifications.map((n) => n.id));
      return;
    }
    const seen = seenRef.current;
    const fresh = notifications.filter((n) => !seen.has(n.id) && !HANDLED_ELSEWHERE.test(n.id));
    if (fresh.length === 0) return;
    for (const n of fresh) seen.add(n.id);
    setToasts((prev) => [...fresh, ...prev].slice(0, NOTIFICATION_CONFIG.maxToasts));
  }, [notifications]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <div
      aria-live="polite"
      className={cn('pointer-events-none flex flex-col items-stretch gap-2', className)}
    >
      {toasts.map((n) => (
        <NotificationToast
          key={n.id}
          notification={n}
          onDismiss={dismiss}
          onLocate={onLocate}
          locateLabel={m(LABELS.locate)}
          dismissLabel={m(LABELS.dismiss)}
        />
      ))}
    </div>
  );
}

function NotificationToast({
  notification: n,
  onDismiss,
  onLocate,
  locateLabel,
  dismissLabel,
}: {
  notification: Notification;
  onDismiss: (id: string) => void;
  onLocate: (notification: Notification) => void;
  locateLabel: string;
  dismissLabel: string;
}) {
  const isCrisis = n.severity === 'crisis';
  /** S5-T1: landmark unlocks are a celebration, shown in gold. */
  const isCelebration = n.icon === 'landmark';
  const canLocate = n.x !== undefined && n.y !== undefined;

  useEffect(() => {
    const timer = setTimeout(
      () => onDismiss(n.id),
      isCrisis ? NOTIFICATION_CONFIG.crisisToastMs : NOTIFICATION_CONFIG.toastMs
    );
    return () => clearTimeout(timer);
  }, [n.id, isCrisis, onDismiss]);

  const locate = () => {
    onLocate(n);
    onDismiss(n.id);
  };

  return (
    <div
      role={isCrisis ? 'alert' : 'status'}
      className={cn(
        'hud-panel pointer-events-auto flex items-start gap-2.5 rounded-xl p-2.5 text-sm',
        'animate-in fade-in slide-in-from-top-2 duration-200',
        SEVERITY_STYLES[n.severity ?? 'info'],
        isCelebration && '!border-marigold/70 ring-1 ring-marigold/40 shadow-[0_0_24px_-6px_hsl(var(--marigold)/0.6)]'
      )}
    >
      <span className={cn('shrink-0 h-8 w-8 rounded-lg ring-1 flex items-center justify-center', isCrisis ? 'bg-red-500/15 ring-red-400/40' : isCelebration ? 'bg-marigold/15 ring-marigold/40' : 'bg-sandstone/[0.06] ring-gold/15')}>
        <NotificationIcon icon={n.icon} className={isCrisis ? 'text-red-400' : isCelebration ? 'text-marigold' : 'text-sandstone/80'} />
      </span>
      <button
        type="button"
        onClick={canLocate ? locate : undefined}
        disabled={!canLocate}
        className="flex-1 min-w-0 text-left disabled:cursor-default"
      >
        <p className={cn('font-semibold truncate', isCrisis ? 'text-red-300' : isCelebration ? 'text-marigold' : 'text-foreground')}>{n.title}</p>
        <p className="text-xs text-muted-foreground line-clamp-2">{n.description}</p>
        {canLocate && (
          <span className="mt-1 inline-flex items-center gap-1 text-xs text-marigold">
            <MapPin className="w-3 h-3" />
            {locateLabel}
          </span>
        )}
      </button>
      <button
        type="button"
        onClick={() => onDismiss(n.id)}
        className="text-muted-foreground hover:text-foreground -m-1.5 min-w-11 min-h-11 md:min-w-8 md:min-h-8 rounded-lg flex items-center justify-center"
        aria-label={dismissLabel}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
