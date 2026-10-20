'use client';

import React from 'react';
import { msg, useGT, useMessages } from 'gt-next';
import { Pause, Play } from 'lucide-react';
import { useGame } from '@/context/GameContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const LABELS = {
  paused: msg('Paused'),
  resume: msg('Resume'),
};

/**
 * Shows that the clock is stopped, and why when the city paused itself (a crisis). One click
 * resumes at the speed the player had before. Nothing is rendered while the city runs.
 */
export function PausedIndicator({ className }: { className?: string }) {
  const { state, pauseReason, resumeGame } = useGame();
  const gt = useGT();
  const m = useMessages();
  if (state.speed !== 0 || state.gameOver) return null;
  return (
    <div
      role="status"
      className={cn(
        'pointer-events-auto flex items-center gap-2 rounded-md border border-chrome-border bg-chrome-panel py-1 pl-3 pr-1 text-sm text-chrome-text shadow-md',
        className,
      )}
    >
      <Pause className="h-4 w-4 shrink-0 text-chrome-muted" aria-hidden />
      <span className="min-w-0 truncate font-medium">
        {pauseReason ? gt('Paused — {reason}', { reason: pauseReason }) : m(LABELS.paused)}
      </span>
      <Button size="sm" onClick={resumeGame} className="h-8 shrink-0 gap-1" aria-label={String(m(LABELS.resume))}>
        <Play className="h-3.5 w-3.5" aria-hidden />
        {m(LABELS.resume)}
      </Button>
    </div>
  );
}
