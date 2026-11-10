'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { useOverlaySlot } from '@/components/game/MapOverlayLayer';

/**
 * Renders a toast (undo, save error) into the map overlay's "toasts" slot: the bottom-centre stack on
 * desktop, the column above the toolbar on phones (see MapOverlayLayer / Game.tsx). Without a slot
 * (no game on screen) it falls back to a fixed element placed by `fallbackClassName`.
 * The slot is looked up live, so a toast follows it when the layout switches between desktop and mobile.
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
  const slot = useOverlaySlot('toasts');
  if (slot) {
    return createPortal(
      <div role={role} className="pointer-events-auto w-full animate-rise-in">{children}</div>,
      slot
    );
  }
  return <div role={role} className={cn('animate-rise-in', fallbackClassName)}>{children}</div>;
}
