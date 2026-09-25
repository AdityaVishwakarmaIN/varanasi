/**
 * Build-menu catalog per map (S2-T5 Riverfront group, S3-T1 Indian names and hidden tools).
 *
 * IDs never change (old saves use them). On the Varanasi map only the DISPLAY name, the description and
 * which tools appear in the menu change. Existing buildings of hidden types still work and draw.
 */
import { msg } from 'gt-next';
import type { Tool, ToolInfo } from '@/games/isocity/types/game';
import type { MapId } from './varanasi';
import type { LandmarkId } from '@/lib/landmarks';

type Display = { name: string; description: string };

/** Varanasi display names (wrapped with msg() like TOOL_INFO). */
export const VARANASI_DISPLAY: Partial<Record<Tool, Display>> = {
  police_station: { name: msg('Police Thana'), description: msg('Keeps the neighbourhood safe') },
  fire_station: { name: msg('Fire Station'), description: msg('Fights fires in dense lanes') },
  hospital: { name: msg('District Hospital'), description: msg('Improves health (2x2)') },
  school: { name: msg('Government School'), description: msg('Basic education (2x2)') },
  university: { name: msg('College'), description: msg('Higher education (3x3). BHU arrives as a landmark later') },
  power_plant: { name: msg('Thermal Power Station'), description: msg('Generates electricity (2x2)') },
  water_tower: { name: msg('Overhead Water Tank'), description: msg('Stores and supplies water') },
  city_hall: { name: msg('Nagar Nigam Office'), description: msg('Municipal headquarters. Boosts all demand') },
  stadium: { name: msg('Cricket Stadium'), description: msg('Boosts commercial demand (3x3)') },
  baseball_field_small: { name: msg('Cricket Ground'), description: msg('Local cricket ground (2x2)') },
  basketball_courts: { name: msg('Kabaddi Court'), description: msg('Outdoor kabaddi court') },
  tennis: { name: msg('Badminton Court'), description: msg('Recreation') },
  amusement_park: { name: msg('Mela Ground'), description: msg('Fairground. Major boost to commercial demand') },
  community_center: { name: msg('Community Hall'), description: msg('Local gathering place') },
  pond_park: { name: msg('Kund'), description: msg('A traditional stepped water tank with a garden') },
  animal_pens_farm: { name: msg('Gaushala'), description: msg('Cow shelter. Reduces stray cows') },
  greenhouse_garden: { name: msg('Plant Nursery'), description: msg('Greenery') },
  marina_docks_small: { name: msg('Boat Jetty'), description: msg('Riverside boat landing (2x2, next to water)') },
  park: { name: msg('Park'), description: msg('Boosts land value and happiness') },
  park_large: { name: msg('Large Garden'), description: msg('Large green space (3x3)') },
  zone_residential: { name: msg('Residential'), description: msg('Homes grow here') },
  zone_commercial: { name: msg('Bazaar & Commercial'), description: msg('Shops and offices; dense bazaars grow homes above') },
  zone_industrial: { name: msg('Industrial'), description: msg('Workshops, godowns and factories') },
  embankment: { name: msg('Embankment (Tatbandh)'), description: msg('Raised bank against monsoon floods. Land behind it floods one river level later. Within 4 tiles of the Ganga, not on ghats; lowers land value within 2 tiles.') },
};

/** Tools hidden from the build menu on the Varanasi map (S3-T1; the map is also fixed-size). */
export const VARANASI_HIDDEN_TOOLS: ReadonlySet<Tool> = new Set<Tool>([
  'space_program',
  'baseball_stadium',
  'football_field',
  'mini_golf_course',
  'go_kart_track',
  'skate_park',
  'mountain_lodge',
  'mountain_trailhead',
  'cabin_house',
  'campground',
  'roller_coaster_small',
  'pier_large',
  'bleachers_field',
  'expand_city',
  'shrink_city',
]);

/** Tools that exist only on the Varanasi map. */
export const VARANASI_ONLY_TOOLS: ReadonlySet<Tool> = new Set<Tool>([
  'ghat', 'sewage_treatment_plant', 'jal_sansthan_water_works', 'embankment',
  'landmark_dashashwamedh', 'landmark_kashi_vishwanath', 'landmark_bhu', 'landmark_sarnath', 'landmark_ramnagar_fort',
]);

/** The "Riverfront" build-menu group, listed first on the Varanasi map. */
export const RIVERFRONT_TOOLS: readonly Tool[] = ['ghat', 'sewage_treatment_plant', 'jal_sansthan_water_works', 'embankment'];

/** The "Landmarks" build-menu group (S5-T1), Varanasi only, in unlock order (same order as LANDMARK_IDS). */
export const LANDMARK_TOOLS: readonly (Tool & LandmarkId)[] = [
  'landmark_dashashwamedh', 'landmark_kashi_vishwanath', 'landmark_bhu', 'landmark_sarnath', 'landmark_ramnagar_fort',
];

/** Should this tool appear in the build menu on this map? */
export function isToolVisible(tool: Tool, mapId: MapId | undefined): boolean {
  if (mapId === 'varanasi') return !VARANASI_HIDDEN_TOOLS.has(tool);
  return !VARANASI_ONLY_TOOLS.has(tool);
}

/** Filter a menu list for this map. */
export function visibleTools(tools: readonly Tool[], mapId: MapId | undefined): Tool[] {
  return tools.filter((t) => isToolVisible(t, mapId));
}

/** Name/description to show for a tool on this map (falls back to TOOL_INFO). */
export function getToolDisplay(tool: Tool, info: ToolInfo, mapId: MapId | undefined): ToolInfo {
  const override = mapId === 'varanasi' ? VARANASI_DISPLAY[tool] : undefined;
  return override ? { ...info, ...override } : info;
}

/**
 * Display name (msg-encoded, for m()) for a placed building on this map, when the map renames it;
 * undefined means "use the default label". Building IDs match tool IDs for every renamed building.
 */
export function getBuildingDisplayName(buildingType: string, mapId: MapId | undefined): string | undefined {
  if (mapId !== 'varanasi') return undefined;
  return VARANASI_DISPLAY[buildingType as Tool]?.name;
}
