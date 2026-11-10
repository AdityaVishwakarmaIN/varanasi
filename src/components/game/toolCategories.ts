/**
 * Build-menu tool categories: the ONE list shared by the desktop Sidebar and the MobileToolbar,
 * so the two menus cannot drift (a tool added here shows on both). Both menus list the building
 * groups in `BUILDING_CATEGORY_ORDER`; which tools a map hides is decided only by `getCategoryTools`.
 */
import type { Tool } from '@/types/game';
import type { MapId } from '@/games/isocity/maps/varanasi';
import { isCategoryShown, LANDMARK_TOOLS, RIVERFRONT_TOOLS, visibleTools } from '@/games/isocity/maps/varanasiCatalog';

export type ToolCategoryKey =
  | 'riverfront'
  | 'landmarks'
  | 'tools'
  | 'zones'
  | 'zoning'
  | 'services'
  | 'parks'
  | 'sports'
  | 'waterfront'
  | 'community'
  | 'utilities'
  | 'special';

export const TOOL_CATEGORIES: Record<ToolCategoryKey, readonly Tool[]> = {
  riverfront: RIVERFRONT_TOOLS,
  landmarks: LANDMARK_TOOLS,
  tools: ['select', 'bulldoze', 'road', 'rail', 'subway'],
  zones: ['zone_residential', 'zone_commercial', 'zone_industrial'],
  zoning: ['zone_dezone', 'zone_water', 'zone_land'],
  services: ['police_station', 'fire_station', 'hospital', 'school', 'university'],
  parks: ['tree', 'park', 'park_large', 'tennis', 'playground_small', 'playground_large', 'community_garden', 'pond_park', 'park_gate', 'greenhouse_garden', 'mini_golf_course', 'go_kart_track', 'amphitheater', 'roller_coaster_small', 'campground', 'cabin_house', 'mountain_lodge', 'mountain_trailhead'],
  sports: ['basketball_courts', 'soccer_field_small', 'baseball_field_small', 'football_field', 'baseball_stadium', 'swimming_pool', 'skate_park', 'bleachers_field'],
  waterfront: ['marina_docks_small', 'pier_large'],
  community: ['community_center', 'animal_pens_farm', 'office_building_small'],
  utilities: ['power_plant', 'water_tower', 'subway_station', 'rail_station'],
  special: ['stadium', 'museum', 'airport', 'space_program', 'city_hall', 'amusement_park'],
};

/**
 * Building groups, in menu order (desktop hover submenus and the mobile build sheet).
 * Utilities come first: zones stay empty without power and water, so new players must find them.
 * Riverfront and Landmarks only exist on Varanasi.
 */
export const BUILDING_CATEGORY_ORDER: readonly ToolCategoryKey[] = [
  'utilities', 'riverfront', 'landmarks', 'services', 'parks', 'sports', 'waterfront', 'community', 'special',
];

/** Categories that exist only on the Varanasi map. */
const VARANASI_ONLY_CATEGORIES: ReadonlySet<ToolCategoryKey> = new Set(['riverfront', 'landmarks']);

/**
 * The single map filter for build menus: the tools of a category shown on this map
 * (empty when the whole category is hidden there).
 */
export function getCategoryTools(key: ToolCategoryKey, mapId: MapId | undefined): Tool[] {
  if (VARANASI_ONLY_CATEGORIES.has(key) && mapId !== 'varanasi') return [];
  if (!isCategoryShown(key, mapId)) return [];
  return visibleTools(TOOL_CATEGORIES[key], mapId);
}

/** `[key, tools]` for the given categories in order, skipping those with nothing to show on this map. */
export function getMapToolCategories(keys: readonly ToolCategoryKey[], mapId: MapId | undefined): [ToolCategoryKey, Tool[]][] {
  return keys
    .map((key): [ToolCategoryKey, Tool[]] => [key, getCategoryTools(key, mapId)])
    .filter(([, tools]) => tools.length > 0);
}
