'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

/**
 * Desktop bottom-centre HUD stack (paused bar, debt banners, undo and save-error toasts).
 * Game.tsx renders an element with this id inside a column that sits above the
 * "View overlay" bar, so global toasts stack there instead of covering the bar.
 */
export const BOTTOM_TOAST_SLOT_ID = 'hud-bottom-toasts';

/**
 * Renders `children` into the desktop bottom stack when it exists (desktop layout), or as a
 * fixed element with `fallbackClassName` otherwise (mobile layout, title screen).
 * Toasts only mount after a player action, so the slot is looked up once on mount.
 */
export function BottomToastPortal({
  children,
  fallbackClassName,
  role,
}: {
  children: React.ReactNode;
  fallbackClassName: string;
  role: 'status' | 'alert';
}) {
  const [slot] = useState<HTMLElement | null>(() =>
    typeof document === 'undefined' ? null : document.getElementById(BOTTOM_TOAST_SLOT_ID)
  );
  if (slot) {
    return createPortal(
      <div role={role} className="pointer-events-auto w-full animate-rise-in">{children}</div>,
      slot
    );
  }
  return <div role={role} className={cn('animate-rise-in', fallbackClassName)}>{children}</div>;
}
