'use client';

import React from 'react';
import type { Tool } from '@/types/game';
import { BuildingArtThumb } from '@/components/game/BuildingArtThumb';
import { isVaranasiProceduralSprite } from '@/components/game/procedural/buildingArt';
import {
  ToolIcons,
  TreeIcon,
  PowerIcon,
  WaterIcon,
  RiverIcon,
  CityHallIcon,
  SafetyIcon,
} from '@/components/ui/Icons';
import { cn } from '@/lib/utils';

/** Tools that place nothing (no building art to show). */
const NON_BUILDING_TOOLS = new Set<string>([
  'select', 'bulldoze', 'road', 'rail', 'subway',
  'zone_residential', 'zone_commercial', 'zone_industrial', 'zone_dezone', 'zone_water', 'zone_land',
  'expand_city', 'shrink_city',
]);

/** A small isometric block: the fallback for building tools that have no art yet. */
function BuildingFallbackIcon({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" fill="currentColor" opacity="0.14" />
      <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12L4 7.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

const svgProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

/** Menu category icons, shared by the desktop sidebar and the mobile build sheet. */
export const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  tools: (
    <svg width={18} height={18} viewBox="0 0 24 24" {...svgProps}>
      <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.8-3.8a6 6 0 01-7.9 7.9l-6.9 6.9a2.1 2.1 0 01-3-3l6.9-6.9a6 6 0 017.9-7.9z" />
    </svg>
  ),
  zones: (
    <svg width={18} height={18} viewBox="0 0 24 24" {...svgProps}>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
    </svg>
  ),
  zoning: (
    <svg width={18} height={18} viewBox="0 0 24 24" {...svgProps}>
      <rect x="4" y="4" width="16" height="16" rx="2" strokeDasharray="3 2.5" />
      <path d="M9 12h6" />
    </svg>
  ),
  riverfront: <RiverIcon size={18} />,
  landmarks: (
    <svg width={18} height={18} viewBox="0 0 24 24" {...svgProps}>
      {/* Temple shikhara */}
      <path d="M12 2v2M8 21V12c0-3 2-6 4-8 2 2 4 5 4 8v9M5 21h14M10 21v-4a2 2 0 014 0v4" />
    </svg>
  ),
  services: <SafetyIcon size={18} />,
  parks: <TreeIcon size={18} />,
  sports: (
    <svg width={18} height={18} viewBox="0 0 24 24" {...svgProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3c3 3 3 15 0 18M3 12h18" />
    </svg>
  ),
  waterfront: <WaterIcon size={18} />,
  community: (
    <svg width={18} height={18} viewBox="0 0 24 24" {...svgProps}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <path d="M16 5.2a3 3 0 010 5.6M18 14.4c1.8.8 3 2.9 3 5.6" />
    </svg>
  ),
  utilities: <PowerIcon size={18} />,
  special: <CityHallIcon size={18} />,
  expandCity: (
    <svg width={18} height={18} viewBox="0 0 24 24" {...svgProps}>
      <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
    </svg>
  ),
};

/** Whether a tool has code-drawn building art to show. */
export function toolHasArt(tool: Tool): boolean {
  return !NON_BUILDING_TOOLS.has(tool) && isVaranasiProceduralSprite(tool);
}

interface ToolGlyphProps {
  tool: Tool;
  /** Box size in CSS px. */
  size?: number;
  className?: string;
}

/**
 * The picture for a build-menu tool: the building's code-drawn art when it has some,
 * otherwise a crisp line icon in a tinted tile.
 */
export function ToolGlyph({ tool, size = 36, className }: ToolGlyphProps) {
  if (toolHasArt(tool)) {
    return (
      <span
        className={cn('relative flex shrink-0 items-end justify-center overflow-hidden rounded-lg bg-gradient-to-b from-[hsl(233_30%_20%)] to-[hsl(234_40%_11%)] ring-1 ring-gold/20', className)}
        style={{ width: size, height: size }}
        aria-hidden
      >
        <BuildingArtThumb type={tool} size={size - 4} />
      </span>
    );
  }
  const Icon = ToolIcons[tool];
  const iconSize = Math.round(size * 0.5);
  return (
    <span
      className={cn('flex shrink-0 items-center justify-center rounded-lg bg-sandstone/[0.06] text-sandstone/80 ring-1 ring-gold/15', className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {Icon ? <Icon size={iconSize} /> : <BuildingFallbackIcon size={iconSize} />}
    </span>
  );
}

export default ToolGlyph;
