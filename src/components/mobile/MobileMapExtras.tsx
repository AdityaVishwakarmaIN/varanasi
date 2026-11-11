'use client';

/**
 * Touch-only map helpers (mobile layout):
 * - `MobileMiniMapToggle`: a 44px button that opens the shared MiniMap in a dismissible overlay
 *   (tap / drag on it to move the camera).
 * - `TouchGestureHint`: a one-time card shown the first time a build tool is picked, teaching
 *   tap to place, Draw mode, long-press inspect and pinch zoom.
 */
import React, { useEffect, useState } from 'react';
import { useGT } from 'gt-next';
import { Map as MapIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CloseIcon } from '@/components/ui/Icons';
import { MiniMap } from '@/components/game/MiniMap';
import type { Tool } from '@/types/game';

type MiniMapProps = React.ComponentProps<typeof MiniMap>;

export function MobileMiniMapToggle({
  onNavigate,
  onViewportSubscribe,
  className = '',
}: {
  onNavigate: NonNullable<MiniMapProps['onNavigate']>;
  onViewportSubscribe: NonNullable<MiniMapProps['onViewportSubscribe']>;
  className?: string;
}) {
  const gt = useGT();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        data-testid="mobile-minimap-toggle"
        aria-label={gt('Minimap')}
        aria-pressed={open}
        className={`press h-11 w-11 rounded-none focus-visible:ring-chrome-text ${open ? 'hud-selected hover:text-chrome-accentText' : 'hud-panel text-chrome-text hover:bg-chrome-well'} ${className}`}
        onClick={() => setOpen(!open)}
      >
        <MapIcon className="w-5 h-5" />
      </Button>
      {open && (
        <div
          data-testid="mobile-minimap-overlay"
          className="fixed inset-0 z-[45] flex items-center justify-center bg-[hsl(234_50%_4%/0.55)] animate-fadeIn"
          onClick={() => setOpen(false)}
        >
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <MiniMap inline size={240} onNavigate={onNavigate} onViewportSubscribe={onViewportSubscribe} />
            <Button
              variant="ghost"
              size="icon"
              aria-label={gt('Close')}
              className="absolute -top-2 -right-2 h-11 w-11 rounded-none hud-panel text-chrome-text hover:bg-chrome-well"
              onClick={() => setOpen(false)}
            >
              <CloseIcon size={16} />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

const GESTURE_HINT_KEY = 'varanasi-touch-gesture-hint-seen';

function hasSeenGestureHint(): boolean {
  try {
    return window.localStorage.getItem(GESTURE_HINT_KEY) === '1';
  } catch {
    return false;
  }
}

function markGestureHintSeen() {
  try {
    window.localStorage.setItem(GESTURE_HINT_KEY, '1');
  } catch {
    // Storage blocked (private mode): the hint just shows again next session.
  }
}

/** Shows once, the first time a tool other than Select is chosen. */
export function TouchGestureHint({ selectedTool }: { selectedTool: Tool }) {
  const gt = useGT();
  // Read once: the hint marks itself as seen as soon as it shows.
  const [seenBefore] = useState(hasSeenGestureHint);
  const [toolChosen, setToolChosen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  if (selectedTool !== 'select' && !toolChosen) setToolChosen(true);
  const visible = toolChosen && !seenBefore && !dismissed;

  useEffect(() => {
    if (visible) markGestureHintSeen();
  }, [visible]);

  if (!visible) return null;

  const lines = [
    gt('Tap to place'),
    gt('Turn on Draw to drag roads and zones'),
    gt('Long-press a tile to inspect it'),
    gt('Pinch to zoom, drag to move the map'),
  ];

  return (
    <div
      data-testid="touch-gesture-hint"
      role="dialog"
      aria-label={gt('Touch controls')}
      className="hud-panel animate-rise-in pointer-events-auto rounded-none p-3 text-sm text-chrome-text"
    >
      <div className="hud-label mb-1.5">{gt('Touch controls')}</div>
      <ul className="space-y-1 mb-2 list-disc pl-4">
        {lines.map((line) => <li key={line}>{line}</li>)}
      </ul>
      <Button className="w-full h-11 rounded-none" onClick={() => setDismissed(true)}>
        {gt('Got it')}
      </Button>
    </div>
  );
}
