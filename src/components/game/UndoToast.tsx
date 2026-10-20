'use client';

import React, { useEffect, useRef } from 'react';
import { useGT, useMessages } from 'gt-next';
import { Undo2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TOOL_INFO, type GameState, type Tool } from '@/types/game';
import { getBuildingDisplayName } from '@/games/isocity/maps/varanasiCatalog';
import { formatINR } from '@/lib/format';
import type { UndoKind } from '@/lib/undo';

/** How long the toast stays up. Ctrl/Cmd+Z keeps working after it is gone. */
const UNDO_TOAST_MS = 5000;
/** Bulldozed buildings worth at least this much mention what was lost. */
const SHOW_VALUE_FROM = 1000;

export interface UndoToastInfo {
  /** Changes whenever the history entry changes (a drag keeps updating one entry): restarts the timer. */
  seq: number;
  kind: UndoKind;
  /** Tool or building type of the first changed tile. */
  subject: string | null;
  /** Placements merged into the entry (a drag). */
  count: number;
  mapId: GameState['mapId'];
  /** Bulldoze: price of what was removed. Bulldozing never refunds it. */
  lostValue: number;
  /** Money that undo gives back. */
  refund: number;
}

/**
 * "Built X - Undo" / "Demolished X - Undo" after a build or bulldoze. Not part of the
 * notification list: it is an action prompt, not news, and it must not push real alerts out.
 */
export function UndoToast({
  info,
  onUndo,
  onDismiss,
}: {
  info: UndoToastInfo;
  onUndo: () => void;
  onDismiss: () => void;
}) {
  const gt = useGT();
  const m = useMessages();
  const dismissRef = useRef(onDismiss);
  useEffect(() => {
    dismissRef.current = onDismiss;
  });
  useEffect(() => {
    const timer = setTimeout(() => dismissRef.current(), UNDO_TOAST_MS);
    return () => clearTimeout(timer);
  }, [info.seq]);

  const nameMsg = info.subject ? getBuildingDisplayName(info.subject, info.mapId) ?? TOOL_INFO[info.subject as Tool]?.name : undefined;
  const name = nameMsg ? m(nameMsg) : gt('structure');
  const times = info.count > 1 ? ` ×${info.count}` : '';
  const title =
    info.kind === 'demolish'
      ? gt('Demolished {name}', { name }) + times
      : info.kind === 'zone'
        ? gt('Zoned {name}', { name }) + times
        : gt('Built {name}', { name }) + times;
  const note =
    info.kind === 'demolish' && info.lostValue >= SHOW_VALUE_FROM
      ? gt('Worth {value}, not refunded. Undo restores it.', { value: formatINR(info.lostValue) })
      : null;

  return (
    <div
      role="status"
      className="fixed z-[60] left-3 right-3 bottom-[calc(19rem+env(safe-area-inset-bottom))] md:left-1/2 md:right-auto md:bottom-16 md:-translate-x-1/2 md:w-max md:max-w-[28rem] animate-rise-in"
    >
      <div className="hud-panel flex items-center gap-3 rounded-none py-2 pl-3.5 pr-1.5 text-sm text-chrome-text">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{title}</p>
          {note && <p className="text-xs text-chrome-muted">{note}</p>}
        </div>
        <Button size="sm" variant="outline" className="h-11 md:h-8 shrink-0 gap-1.5" onClick={onUndo}>
          <Undo2 className="w-4 h-4" aria-hidden />
          {gt('Undo')}
        </Button>
        <button
          type="button"
          onClick={onDismiss}
          className="text-chrome-muted hover:text-chrome-accent min-w-11 min-h-11 md:min-w-8 md:min-h-8 rounded-none flex items-center justify-center"
          aria-label={gt('Dismiss')}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
