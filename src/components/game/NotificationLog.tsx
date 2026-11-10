'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { msg, useMessages } from 'gt-next';
import { Bell, MapPin, X } from 'lucide-react';
import type { Notification } from '@/types/game';
import { cn } from '@/lib/utils';
import { canLocateNotification, isHandledElsewhere, NotificationIcon } from '@/components/game/notificationUi';

const LABELS = {
  title: msg('Notifications'),
  open: msg('Notification log'),
  close: msg('Close'),
  empty: msg('Nothing has happened yet.'),
  locate: msg('Show on map'),
};

function newestTimestamp(list: readonly Notification[]): number {
  return list.reduce((max, n) => Math.max(max, n.timestamp), 0);
}

/**
 * Bell with an unread count that opens the last notifications (newest first, as kept on the state).
 * Notifications already on the state when the game loads count as read.
 */
export function NotificationLog({
  notifications,
  onLocate,
  className,
  panelClassName,
}: {
  notifications: readonly Notification[];
  onLocate: (notification: Notification) => void;
  className?: string;
  /** Position of the open list relative to the bell. */
  panelClassName?: string;
}) {
  const m = useMessages();
  const [open, setOpen] = useState(false);
  const [lastSeen, setLastSeen] = useState(() => newestTimestamp(notifications));
  const rootRef = useRef<HTMLDivElement>(null);

  const entries = useMemo(() => notifications.filter((n) => !isHandledElsewhere(n)), [notifications]);
  const unread = open ? 0 : entries.filter((n) => n.timestamp > lastSeen).length;

  // While open, everything shown is read
  const newest = newestTimestamp(entries);
  if (open && newest > lastSeen) setLastSeen(newest);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn('relative pointer-events-auto', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={m(LABELS.open)}
        aria-expanded={open}
        className="hud-panel press relative h-9 w-9 min-h-11 min-w-11 md:min-h-9 md:min-w-9 rounded-none flex items-center justify-center text-chrome-muted hover:text-chrome-text"
      >
        <Bell className="w-4 h-4" aria-hidden />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-none bg-red-700 text-[10px] font-semibold text-white flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={m(LABELS.title)}
          className={cn(
            'hud-panel absolute z-40 mt-2 w-[min(22rem,calc(100vw-1.5rem))] max-h-[60vh] overflow-y-auto rounded-none p-2 text-sm',
            'animate-in fade-in slide-in-from-top-2 duration-150',
            panelClassName
          )}
        >
          <div className="flex items-center justify-between px-1 pb-1.5">
            <p className="font-semibold text-chrome-text">{m(LABELS.title)}</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={m(LABELS.close)}
              className="text-chrome-muted hover:text-chrome-accent min-w-8 min-h-8 rounded-none flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {entries.length === 0 ? (
            <p className="px-1 pb-1 text-xs text-chrome-muted">{m(LABELS.empty)}</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {entries.map((n) => {
                const isCrisis = n.severity === 'crisis';
                return (
                  <li key={n.id} className="flex items-start gap-2 rounded-none p-1.5 hover:bg-chrome-well">
                    <NotificationIcon
                      icon={n.icon}
                      className={cn('mt-0.5 shrink-0', isCrisis ? 'text-red-800' : n.severity === 'warning' ? 'text-amber-700' : 'text-chrome-muted')}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <p className={cn('font-medium truncate flex-1', isCrisis ? 'text-red-800' : 'text-chrome-text')}>{n.title}</p>
                        <time className="shrink-0 text-[10px] text-chrome-muted tabular-nums" dateTime={new Date(n.timestamp).toISOString()}>
                          {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </time>
                      </div>
                      {n.description && <p className="text-xs text-chrome-muted line-clamp-2">{n.description}</p>}
                      {canLocateNotification(n) && (
                        <button
                          type="button"
                          onClick={() => {
                            onLocate(n);
                            setOpen(false);
                          }}
                          className="mt-0.5 inline-flex items-center gap-1 text-xs text-chrome-accent hover:underline"
                        >
                          <MapPin className="w-3 h-3" />
                          {m(LABELS.locate)}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
