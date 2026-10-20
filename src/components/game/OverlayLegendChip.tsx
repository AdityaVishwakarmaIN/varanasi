'use client';

import React from 'react';
import { X } from 'lucide-react';
import { OverlayMode } from './types';
import { OVERLAY_CONFIG, OVERLAY_LEGEND } from './overlays';

/**
 * On-map chip shown while a view overlay is on: the overlay name, a good / ok / bad colour legend
 * and an X that turns it off. Shared by the desktop and mobile layouts (rendered from Game.tsx).
 */
export const OverlayLegendChip = React.memo(function OverlayLegendChip({
  overlayMode,
  onClear,
  className = '',
}: {
  overlayMode: OverlayMode;
  onClear: () => void;
  className?: string;
}) {
  if (overlayMode === 'none') return null;
  const name = OVERLAY_CONFIG[overlayMode].label;
  return (
    <div
      role="status"
      data-testid="overlay-legend-chip"
      className={`hud-panel pointer-events-auto flex max-w-full items-center gap-2 rounded-md py-1 pl-3 pr-0 ${className}`}
    >
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold leading-tight text-chrome-text">{name} overlay</div>
        <ul className="mt-0.5 flex flex-wrap gap-x-2.5 gap-y-0.5 text-[10px] leading-tight text-chrome-muted">
          {OVERLAY_LEGEND[overlayMode].map((stop) => (
            <li key={stop.label} className="flex items-center gap-1 whitespace-nowrap">
              <span
                aria-hidden
                className="h-2.5 w-2.5 shrink-0 rounded-sm ring-1 ring-chrome-border"
                style={stop.color ? { background: stop.color } : undefined}
              />
              {stop.label}
            </li>
          ))}
        </ul>
      </div>
      <button
        type="button"
        onClick={onClear}
        className="press flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-chrome-muted hover:text-chrome-text"
        aria-label={`Turn off the ${name} overlay`}
        title="Turn off overlay"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
});
