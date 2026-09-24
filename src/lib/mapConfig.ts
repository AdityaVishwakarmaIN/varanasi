/**
 * Map sizes per map and device (S1-T8, used by the new-game map picker in S2-T3).
 * The Varanasi map has a fixed size (no Expand/Shrink); random maps keep today's defaults.
 */
import type { MapId } from '@/games/isocity/maps/varanasi';

export const MAP_SIZES: Record<MapId, { desktop: number; mobile: number }> = {
  varanasi: { desktop: 160, mobile: 120 },
  random: { desktop: 70, mobile: 50 },
};

export function getMapSize(mapId: MapId, isMobile: boolean): number {
  return isMobile ? MAP_SIZES[mapId].mobile : MAP_SIZES[mapId].desktop;
}

/** Default city name for a new game on this map. */
export const DEFAULT_CITY_NAMES: Record<MapId, string> = {
  varanasi: 'Varanasi',
  random: 'New City',
};

/**
 * Where the camera starts when a city is opened: on the Varanasi map, the west-bank riverfront at the crescent
 * (where the ghats go); elsewhere, the map centre.
 */
export function getInitialFocusTile(mapId: MapId | undefined, gridSize: number): { x: number; y: number } {
  if (mapId === 'varanasi') {
    return { x: Math.round(0.49 * (gridSize - 1)), y: Math.round(0.62 * (gridSize - 1)) };
  }
  const c = Math.floor(gridSize / 2);
  return { x: c, y: c };
}
