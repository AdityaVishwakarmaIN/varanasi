/**
 * Overlay mode utilities and configuration.
 * Handles visualization overlays for power, water, services, etc.
 */

import { Tile } from '@/types/game';
import type { MapId } from '@/games/isocity/maps/varanasi';
import { GANGA_TILE_EFFECT, getCachedGangaTileEffects, getGangaRiverColor } from '@/lib/ganga';
import { SCORING_CONFIG } from '@/lib/scoring';
import { FLOOD_CONFIG } from '@/lib/floods';
import { OverlayMode } from './types';

// ============================================================================
// Types
// ============================================================================

/** Service coverage data for a tile */
export type ServiceCoverage = {
  fire: number;
  police: number;
  health: number;
  education: number;
};

/** Configuration for an overlay mode */
export type OverlayConfig = {
  /** Display label */
  label: string;
  /** Tooltip/title text */
  title: string;
  /** Button background color when active */
  activeColor: string;
  /** Button hover color when active */
  hoverColor: string;
};

// ============================================================================
// Overlay Configuration
// ============================================================================

/** Configuration for each overlay mode */
export const OVERLAY_CONFIG: Record<OverlayMode, OverlayConfig> = {
  none: {
    label: 'None',
    title: 'No Overlay',
    activeColor: '',
    hoverColor: '',
  },
  power: {
    label: 'Power',
    title: 'Power Grid',
    activeColor: 'bg-amber-500',
    hoverColor: 'hover:bg-amber-600',
  },
  water: {
    label: 'Water',
    title: 'Water System',
    activeColor: 'bg-blue-500',
    hoverColor: 'hover:bg-blue-600',
  },
  fire: {
    label: 'Fire',
    title: 'Fire Coverage',
    activeColor: 'bg-red-500',
    hoverColor: 'hover:bg-red-600',
  },
  police: {
    label: 'Police',
    title: 'Police Coverage',
    activeColor: 'bg-blue-600',
    hoverColor: 'hover:bg-blue-700',
  },
  health: {
    label: 'Health',
    title: 'Health Coverage',
    activeColor: 'bg-green-500',
    hoverColor: 'hover:bg-green-600',
  },
  education: {
    label: 'Education',
    title: 'Education Coverage',
    activeColor: 'bg-purple-500',
    hoverColor: 'hover:bg-purple-600',
  },
  subway: {
    label: 'Subway',
    title: 'Subway Coverage',
    activeColor: 'bg-yellow-500',
    hoverColor: 'hover:bg-yellow-600',
  },
  ganga: {
    label: 'Ganga',
    title: 'Ganga Health: red tiles pollute the river, green tiles clean it',
    activeColor: 'bg-cyan-600',
    hoverColor: 'hover:bg-cyan-700',
  },
  flood: {
    label: 'Flood risk',
    title: 'Flood risk: red floods in any monsoon, orange in normal ones, yellow only in heavy ones',
    activeColor: 'bg-orange-600',
    hoverColor: 'hover:bg-orange-700',
  },
};

/** Overlays that only make sense on the Varanasi map. */
const VARANASI_ONLY_OVERLAYS: ReadonlySet<OverlayMode> = new Set<OverlayMode>(['ganga', 'flood']);

/** Overlay modes available on a map, in display / Tab-cycling order. */
export function getOverlayModesForMap(mapId: MapId | undefined): OverlayMode[] {
  return OVERLAY_MODES.filter((mode) => mapId === 'varanasi' || !VARANASI_ONLY_OVERLAYS.has(mode));
}

/** Extra per-frame context for overlays that depend on more than a single tile (Ganga). */
export interface OverlayRiverContext {
  gangaHealth: number;
  /** Per-tile GANGA_TILE_EFFECT codes (index y * gridSize + x). */
  effect: Uint8Array;
  gridSize: number;
  /** Flood overlay (S4-T5): lowest river level that floods each tile (0 = never), from `getCityFloodRisk`. */
  floodRisk?: Uint8Array;
}

/** Map of building tools to their corresponding overlay mode */
export const TOOL_TO_OVERLAY_MAP: Record<string, OverlayMode> = {
  power_plant: 'power',
  water_tower: 'water',
  fire_station: 'fire',
  police_station: 'police',
  hospital: 'health',
  school: 'education',
  university: 'education',
  subway_station: 'subway',
  subway: 'subway',
  ghat: 'ganga',
  sewage_treatment_plant: 'ganga',
  jal_sansthan_water_works: 'water',
  embankment: 'ganga',
};

/** Get the button class name for an overlay button */
export function getOverlayButtonClass(mode: OverlayMode, isActive: boolean): string {
  if (!isActive || mode === 'none') return '';
  const config = OVERLAY_CONFIG[mode];
  return `${config.activeColor} ${config.hoverColor}`;
}

// ============================================================================
// Overlay Fill Style Calculation
// ============================================================================

/** Tiles that don't need service coverage (natural/infrastructure) */
const NON_BUILDING_TYPES = new Set([
  'empty', 'grass', 'water', 'road', 'rail', 'tree'
]);

/** Check if a tile has a building that needs service coverage */
function tileNeedsCoverage(tile: Tile): boolean {
  return !NON_BUILDING_TYPES.has(tile.building.type);
}

/** Warning color for uncovered buildings */
const UNCOVERED_WARNING = 'rgba(239, 68, 68, 0.45)'; // Red tint

/** No overlay needed (transparent) */
const NO_OVERLAY = 'rgba(0, 0, 0, 0)';

/**
 * Calculate the fill style color for an overlay tile.
 * 
 * New simplified logic:
 * - Buildings without coverage get a red warning tint
 * - Covered buildings and non-building tiles get no tint
 * - Radius circles are drawn separately to show coverage areas
 * 
 * @param mode - The current overlay mode
 * @param tile - The tile being rendered
 * @param coverage - Service coverage values for the tile
 * @returns CSS color string for the overlay fill
 */
export function getOverlayFillStyle(
  mode: OverlayMode,
  tile: Tile,
  coverage: ServiceCoverage,
  river?: OverlayRiverContext
): string {
  // Only show warning on tiles that have buildings needing coverage
  const needsCoverage = tileNeedsCoverage(tile);
  
  switch (mode) {
    case 'power':
      // Red warning only on unpowered buildings
      if (!needsCoverage) return NO_OVERLAY;
      return tile.building.powered ? NO_OVERLAY : UNCOVERED_WARNING;

    case 'water':
      // Red warning only on buildings without water
      if (!needsCoverage) return NO_OVERLAY;
      return tile.building.watered ? NO_OVERLAY : UNCOVERED_WARNING;

    case 'fire':
      // Red warning only on buildings outside fire coverage
      if (!needsCoverage) return NO_OVERLAY;
      return coverage.fire > 0 ? NO_OVERLAY : UNCOVERED_WARNING;

    case 'police':
      // Red warning only on buildings outside police coverage
      if (!needsCoverage) return NO_OVERLAY;
      return coverage.police > 0 ? NO_OVERLAY : UNCOVERED_WARNING;

    case 'health':
      // Red warning only on buildings outside health coverage
      if (!needsCoverage) return NO_OVERLAY;
      return coverage.health > 0 ? NO_OVERLAY : UNCOVERED_WARNING;

    case 'education':
      // Red warning only on buildings outside education coverage
      if (!needsCoverage) return NO_OVERLAY;
      return coverage.education > 0 ? NO_OVERLAY : UNCOVERED_WARNING;

    case 'subway':
      // Underground view overlay - keep existing behavior
      return tile.hasSubway
        ? 'rgba(245, 158, 11, 0.7)'  // Bright amber for existing subway
        : 'rgba(40, 30, 20, 0.4)';   // Dark brown tint for "underground" view

    case 'ganga': {
      if (!river) return NO_OVERLAY;
      if (tile.building.type === 'water') return getGangaRiverColor(river.gangaHealth);
      const effect = river.effect[tile.y * river.gridSize + tile.x];
      if (effect === GANGA_TILE_EFFECT.hurts) return GANGA_HURTS;
      if (effect === GANGA_TILE_EFFECT.cleans) return GANGA_CLEANS;
      return NO_OVERLAY;
    }

    case 'flood': {
      const risk = river?.floodRisk?.[tile.y * river.gridSize + tile.x] ?? 0;
      return risk === 1 || risk === 2 || risk === 3 ? FLOOD_RISK_FILL[risk] : NO_OVERLAY;
    }

    case 'none':
    default:
      return NO_OVERLAY;
  }
}

/** Flood overlay fills, from FLOOD_CONFIG.overlayColors (level 1 = floods in any monsoon). */
const FLOOD_RISK_FILL: Record<1 | 2 | 3, string> = {
  1: hexToRgba(FLOOD_CONFIG.overlayColors[1], 0.6),
  2: hexToRgba(FLOOD_CONFIG.overlayColors[2], 0.5),
  3: hexToRgba(FLOOD_CONFIG.overlayColors[3], 0.45),
};

function hexToRgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** Ganga overlay: land that adds pollution or untreated sewage. */
const GANGA_HURTS = 'rgba(220, 38, 38, 0.45)';
/** Ganga overlay: riverside greenery and homes whose sewage is treated. */
const GANGA_CLEANS = 'rgba(34, 197, 94, 0.4)';

/**
 * Get the overlay mode that should be shown for a given tool.
 * Returns 'none' if the tool doesn't have an associated overlay.
 */
export function getOverlayForTool(tool: string): OverlayMode {
  return TOOL_TO_OVERLAY_MAP[tool] ?? 'none';
}

/** List of all overlay modes (for iteration) */
export const OVERLAY_MODES: OverlayMode[] = [
  'none', 'power', 'water', 'fire', 'police', 'health', 'education', 'subway', 'ganga', 'flood'
];

// ============================================================================
// Service Radius Overlay Helpers
// ============================================================================

/** Map overlay modes to their corresponding service building types */
export const OVERLAY_TO_BUILDING_TYPES: Record<OverlayMode, string[]> = {
  none: [],
  power: ['power_plant'],
  water: ['water_tower', 'jal_sansthan_water_works'],
  fire: ['fire_station'],
  police: ['police_station'],
  health: ['hospital'],
  education: ['school', 'university'],
  subway: ['subway_station'],
  ganga: ['sewage_treatment_plant'],
  flood: [],
};

/** Overlay circle stroke colors (light/visible colors) */
export const OVERLAY_CIRCLE_COLORS: Record<OverlayMode, string> = {
  none: 'transparent',
  power: 'rgba(251, 191, 36, 0.8)',    // Amber
  water: 'rgba(96, 165, 250, 0.8)',    // Blue
  fire: 'rgba(248, 113, 113, 0.8)',    // Light red
  police: 'rgba(147, 197, 253, 0.8)',  // Light blue
  health: 'rgba(134, 239, 172, 0.8)',  // Light green
  education: 'rgba(196, 181, 253, 0.8)', // Light purple
  subway: 'rgba(253, 224, 71, 0.8)',   // Yellow
  ganga: 'rgba(34, 211, 238, 0.85)',   // Cyan
  flood: 'transparent',
};

/** Building highlight glow colors */
export const OVERLAY_HIGHLIGHT_COLORS: Record<OverlayMode, string> = {
  none: 'transparent',
  power: 'rgba(251, 191, 36, 1)',      // Amber
  water: 'rgba(96, 165, 250, 1)',      // Blue  
  fire: 'rgba(239, 68, 68, 1)',        // Red
  police: 'rgba(59, 130, 246, 1)',     // Blue
  health: 'rgba(34, 197, 94, 1)',      // Green
  education: 'rgba(168, 85, 247, 1)',  // Purple
  subway: 'rgba(234, 179, 8, 1)',      // Yellow
  ganga: 'rgba(6, 182, 212, 1)',       // Cyan
  flood: 'transparent',
};

/** Overlay circle fill colors (subtle, for area visibility) */
export const OVERLAY_CIRCLE_FILL_COLORS: Record<OverlayMode, string> = {
  none: 'transparent',
  power: 'rgba(251, 191, 36, 0.12)',
  water: 'rgba(96, 165, 250, 0.12)',
  fire: 'rgba(248, 113, 113, 0.12)',
  police: 'rgba(147, 197, 253, 0.12)',
  health: 'rgba(134, 239, 172, 0.12)',
  education: 'rgba(196, 181, 253, 0.12)',
  subway: 'rgba(253, 224, 71, 0.12)',
  ganga: 'rgba(34, 211, 238, 0.1)',
  flood: 'transparent',
};

// ============================================================================
// Ganga overlay context (S2-T8)
// ============================================================================

const gangaContextCache = new WeakMap<Tile[][], { gangaHealth: number; context: OverlayRiverContext }>();

/**
 * Per-grid Ganga overlay context. Cached by grid identity (a new grid comes with each tick or edit), so the
 * catchment is evaluated at most once per simulation step, not once per frame.
 */
export function getGangaOverlayContext(
  grid: Tile[][],
  gridSize: number,
  mapId: MapId | undefined,
  gangaHealth: number | undefined
): OverlayRiverContext | undefined {
  if (mapId !== 'varanasi') return undefined;
  const health = gangaHealth ?? 75;
  const cached = gangaContextCache.get(grid);
  if (cached && cached.gangaHealth === health) return cached.context;
  // Shared with the tile info panel (same grid → same effects, computed once).
  const context: OverlayRiverContext = {
    gangaHealth: health,
    effect: getCachedGangaTileEffects(grid, gridSize).effect,
    gridSize,
  };
  gangaContextCache.set(grid, { gangaHealth: health, context });
  return context;
}

/** Flood-risk overlay context (S4-T5). `floodRisk` comes from `getCityFloodRisk` (memoized per embankment set). */
export function getFloodOverlayContext(gridSize: number, floodRisk: Uint8Array | null): OverlayRiverContext | undefined {
  if (!floodRisk) return undefined;
  const cached = floodContextCache.get(floodRisk);
  if (cached) return cached;
  const context: OverlayRiverContext = { gangaHealth: 0, effect: EMPTY_EFFECT, gridSize, floodRisk };
  floodContextCache.set(floodRisk, context);
  return context;
}
const floodContextCache = new WeakMap<Uint8Array, OverlayRiverContext>();
const EMPTY_EFFECT = new Uint8Array(0);

/**
 * Base radius (tiles, before level scaling) drawn for a building on its overlay, or null if it has none.
 * Sewage Treatment Plants are not a SERVICE_CONFIG service; their radius comes from the Ganga config.
 */
export function getOverlayBaseRadius(
  buildingType: string,
  serviceConfig: Record<string, { range?: number } | undefined>
): number | null {
  if (buildingType === 'sewage_treatment_plant') return SCORING_CONFIG.ganga.stpRadius;
  const config = serviceConfig[buildingType];
  return config && typeof config.range === 'number' ? config.range : null;
}
