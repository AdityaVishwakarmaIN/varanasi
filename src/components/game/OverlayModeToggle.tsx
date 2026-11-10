'use client';

import React from 'react';
import { msg } from 'gt-next';
import { useMessages } from 'gt-next';
import { Button } from '@/components/ui/button';
import {
  CloseIcon,
  PowerIcon,
  WaterIcon,
  FireIcon,
  SafetyIcon,
  HealthIcon,
  EducationIcon,
  SubwayIcon,
  RiverIcon,
  FloodIcon,
} from '@/components/ui/Icons';
import { OverlayMode } from './types';
import { getOverlayButtonClass, getOverlayModesForMap } from './overlays';
import { OVERLAY_NAMES, OverlayLegend } from './OverlayLegend';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { MapId } from '@/games/isocity/maps/varanasi';

// ============================================================================
// Types
// ============================================================================

export interface OverlayModeToggleProps {
  overlayMode: OverlayMode;
  setOverlayMode: (mode: OverlayMode) => void;
  /** Map-specific overlays (the Ganga) only show on their map. */
  mapId?: MapId;
}

// ============================================================================
// Icon Mapping
// ============================================================================

/** Map overlay modes to their icons */
const OVERLAY_ICONS: Record<OverlayMode, React.ReactNode> = {
  none: <CloseIcon size={16} />,
  power: <PowerIcon size={16} />,
  water: <WaterIcon size={16} />,
  fire: <FireIcon size={16} />,
  police: <SafetyIcon size={16} />,
  health: <HealthIcon size={16} />,
  education: <EducationIcon size={16} />,
  subway: <SubwayIcon size={16} />,
  ganga: <RiverIcon size={16} />,
  flood: <FloodIcon size={16} />,
};

// ============================================================================
// Translatable Labels
// ============================================================================

const VIEW_OVERLAY_LABEL = msg('View Overlay');

// ============================================================================
// Component
// ============================================================================

/**
 * Overlay mode toggle component.
 * Allows users to switch between different visualization overlays
 * (power grid, water system, service coverage, etc.)
 */
export const OverlayModeToggle = React.memo(function OverlayModeToggle({
  overlayMode,
  setOverlayMode,
  mapId,
}: OverlayModeToggleProps) {
  const m = useMessages();
  
  return (
    <div
      className="hud-glass gold-hairline fixed bottom-4 left-[240px] z-50 flex items-center gap-2 rounded-2xl py-1.5 pl-3 pr-1.5"
      role="toolbar"
      aria-label={String(m(VIEW_OVERLAY_LABEL))}
    >
      {/* E1: what the active overlay's colours mean */}
      <OverlayLegend overlayMode={overlayMode} className="absolute bottom-full left-0 mb-2" />
      <span className="hud-label max-w-[4.5rem] leading-tight whitespace-normal">{m(VIEW_OVERLAY_LABEL)}</span>
      <div className="flex gap-1 hud-well rounded-xl p-1">
        {getOverlayModesForMap(mapId).map((mode) => {
          const isActive = overlayMode === mode;
          const name = String(m(OVERLAY_NAMES[mode]));

          return (
            <Tooltip key={mode}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setOverlayMode(mode)}
                  aria-pressed={isActive}
                  aria-label={name}
                  className={`press h-9 w-9 p-0 rounded-lg ${
                    isActive
                      ? mode === 'none' ? 'hud-selected hover:text-primary-foreground' : `${getOverlayButtonClass(mode, isActive)} text-white ring-1 ring-white/30 shadow-[0_0_12px_-2px_currentColor]`
                      : 'text-sandstone/75 hover:text-marigold hover:bg-sandstone/[0.08]'
                  }`}
                >
                  {OVERLAY_ICONS[mode]}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">{name}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
});
