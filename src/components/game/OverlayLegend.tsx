'use client';

import React from 'react';
import { msg, useMessages } from 'gt-next';
import { OverlayMode } from './types';
import { getOverlayLegend, type OverlayLegendKey } from './overlays';

/** Translatable overlay names (legend title, overlay button tooltips). */
export const OVERLAY_NAMES: Record<OverlayMode, string> = {
  none: msg('No overlay'),
  power: msg('Power grid'),
  water: msg('Water system'),
  fire: msg('Fire coverage'),
  police: msg('Police coverage'),
  health: msg('Health coverage'),
  education: msg('Education coverage'),
  subway: msg('Subway'),
  ganga: msg('Ganga Health'),
  flood: msg('Flood risk'),
};

const LEGEND_LABELS: Record<OverlayLegendKey, string> = {
  uncovered: msg('Building not covered'),
  range: msg('Service range'),
  subway: msg('Subway line'),
  noSubway: msg('No subway'),
  gangaHurts: msg('Pollutes the river'),
  gangaCleans: msg('Cleans the river'),
  gangaPolluted: msg('Polluted'),
  gangaClean: msg('Clean'),
  floodAny: msg('Floods in any monsoon'),
  floodNormal: msg('Floods in a normal monsoon'),
  floodHeavy: msg('Floods only in a heavy monsoon'),
};

/**
 * Small chip that explains the active overlay's colours (E1). The colours come from
 * `getOverlayLegend`, i.e. the same constants the overlay is drawn with.
 */
export const OverlayLegend = React.memo(function OverlayLegend({
  overlayMode,
  className = '',
}: {
  overlayMode: OverlayMode;
  className?: string;
}) {
  const m = useMessages();
  const legend = getOverlayLegend(overlayMode);
  if (!legend || overlayMode === 'none') return null;

  return (
    <div
      className={`hud-glass gold-hairline rounded-xl px-3 py-2 text-xs text-sandstone ${className}`}
      role="note"
      aria-label={String(m(OVERLAY_NAMES[overlayMode]))}
    >
      <div className="hud-label mb-1">{m(OVERLAY_NAMES[overlayMode])}</div>
      {legend.ramp && (
        <div className="mb-1.5">
          <div
            className="h-2 w-full min-w-[8rem] rounded-full ring-1 ring-white/15"
            style={{ background: `linear-gradient(to right, ${legend.ramp.colors.join(', ')})` }}
            aria-hidden
          />
          <div className="mt-0.5 flex justify-between gap-3 text-[10px] text-sandstone/75">
            <span>{m(LEGEND_LABELS[legend.ramp.from])}</span>
            <span>{m(LEGEND_LABELS[legend.ramp.to])}</span>
          </div>
        </div>
      )}
      <ul className="flex flex-col gap-1">
        {legend.swatches.map(({ color, key }) => (
          <li key={key} className="flex items-center gap-2">
            <span className="h-3 w-3 shrink-0 rounded-sm ring-1 ring-white/25" style={{ background: color }} aria-hidden />
            <span>{m(LEGEND_LABELS[key])}</span>
          </li>
        ))}
      </ul>
    </div>
  );
});
