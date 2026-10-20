/**
 * Monthly upkeep of buildings that are not services with their own budget formula (economy balance pass).
 * Pure data; scanGridTotals sums it per budget line and updateBudgetCosts adds it to that line's cost.
 *
 * Rule of thumb: about 4–5% of the build cost a month for parks and recreation, a bit less for the big
 * attractions (they also drive demand), so a starting city's handful of parks costs little while a city
 * full of stadiums and amusement parks feels it.
 */
import type { BuildingType } from '@/games/isocity/types/buildings';
import type { Budget } from '@/games/isocity/types/economy';
import { LANDMARKS, isLandmarkType } from '@/lib/landmarks';
import { GHAT_UPKEEP_MONTHLY } from '@/lib/tourism';

/** Budget lines that building upkeep is charged to. */
export type UpkeepCategory = Extract<keyof Budget, 'parks' | 'transportation' | 'education' | 'water'>;

export interface UpkeepEntry {
  category: UpkeepCategory;
  /** ₹ per month per building (per tile for bridges). */
  monthly: number;
}

const parks = (monthly: number): UpkeepEntry => ({ category: 'parks', monthly });
const transport = (monthly: number): UpkeepEntry => ({ category: 'transportation', monthly });

export const BUILDING_UPKEEP: Readonly<Partial<Record<BuildingType, UpkeepEntry>>> = {
  // Parks (park and tennis keep their old ₹10)
  park: parks(10),
  park_large: parks(30),
  tennis: parks(10),
  basketball_courts: parks(10),
  playground_small: parks(8),
  playground_large: parks(15),
  baseball_field_small: parks(30),
  soccer_field_small: parks(15),
  football_field: parks(45),
  baseball_stadium: parks(200),
  community_center: parks(25),
  office_building_small: parks(25),
  swimming_pool: parks(20),
  skate_park: parks(12),
  mini_golf_course: parks(25),
  bleachers_field: parks(15),
  go_kart_track: parks(40),
  amphitheater: parks(60),
  greenhouse_garden: parks(30),
  animal_pens_farm: parks(15),
  cabin_house: parks(10),
  campground: parks(10),
  marina_docks_small: parks(45),
  pier_large: parks(25),
  roller_coaster_small: parks(110),
  community_garden: parks(8),
  pond_park: parks(15),
  park_gate: parks(5),
  mountain_lodge: parks(60),
  mountain_trailhead: parks(15),
  // Big attractions and civic buildings
  stadium: parks(200),
  museum: parks(150),
  amusement_park: parks(450),
  city_hall: parks(200),
  space_program: parks(500),
  // Riverfront
  ghat: parks(GHAT_UPKEEP_MONTHLY),
  embankment: { category: 'water', monthly: 5 },
  // Transport
  airport: transport(400),
  rail_station: transport(50),
  bridge: transport(10),
};

/** ₹ per month per rail tile, track or rail over a road (transportation line; subway tiles pay ₹3 too). */
export const RAIL_TILE_UPKEEP_MONTHLY = 3;

/** Upkeep entry for a building type, including landmarks (from LANDMARKS), or null when it has none here. */
export function getBuildingUpkeep(type: BuildingType): UpkeepEntry | null {
  if (isLandmarkType(type)) {
    return { category: type === 'landmark_bhu' ? 'education' : 'parks', monthly: LANDMARKS[type].upkeepMonthly };
  }
  return BUILDING_UPKEEP[type] ?? null;
}
