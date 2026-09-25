'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { msg, useMessages } from 'gt-next';
import { AlertTriangle, Flame, Home, Info, MapPin, Route, Thermometer, Trophy, Waves, X, type LucideIcon } from 'lucide-react';
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
  info: 'border-border',
  warning: 'border-amber-500/70',
  crisis: 'border-destructive ring-1 ring-destructive/40',
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
        'pointer-events-auto flex items-start gap-2 bg-card/95 backdrop-blur border rounded-sm shadow-lg p-2.5 text-sm',
        'animate-in fade-in slide-in-from-top-2 duration-200',
        SEVERITY_STYLES[n.severity ?? 'info']
      )}
    >
      <span className="shrink-0 mt-0.5 w-5 flex justify-center">
        <NotificationIcon icon={n.icon} className={isCrisis ? 'text-destructive' : 'text-muted-foreground'} />
      </span>
      <button
        type="button"
        onClick={canLocate ? locate : undefined}
        disabled={!canLocate}
        className="flex-1 min-w-0 text-left disabled:cursor-default"
      >
        <p className={cn('font-medium truncate', isCrisis && 'text-destructive')}>{n.title}</p>
        <p className="text-xs text-muted-foreground line-clamp-2">{n.description}</p>
        {canLocate && (
          <span className="mt-1 inline-flex items-center gap-1 text-xs text-primary">
            <MapPin className="w-3 h-3" />
            {locateLabel}
          </span>
        )}
      </button>
      <button
        type="button"
        onClick={() => onDismiss(n.id)}
        className="text-muted-foreground hover:text-foreground p-1 -m-1 min-w-[28px] min-h-[28px] flex items-center justify-center"
        aria-label={dismissLabel}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
