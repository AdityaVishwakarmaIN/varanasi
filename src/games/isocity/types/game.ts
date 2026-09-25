/**
 * IsoCity Game State Types
 */
import type { MapId } from '@/games/isocity/maps/varanasi';
import type { SimWeather } from '@/lib/seasons';
import type { MonsoonStrength } from '@/lib/floods';
import type { HeatwaveState } from '@/lib/heatwave';
import type { OutbreakState } from '@/lib/disease';
import type { FailingStat, FailureState, GameOverReason } from '@/lib/failure';
import type { FestivalState } from '@/lib/festivals';
import type { OverlayMode } from '@/components/game/types';
import type { LandmarkId } from '@/lib/landmarks';

import { msg } from 'gt-next';
import { Building } from './buildings';
import { ZoneType } from './zones';
import { Stats, Budget, CityEconomy, HistoryPoint } from './economy';
import { ServiceCoverage } from './services';

export type Tool =
  | 'select' | 'bulldoze' | 'road' | 'rail' | 'subway'
  | 'expand_city' | 'shrink_city' | 'tree'
  | 'zone_residential' | 'zone_commercial' | 'zone_industrial' | 'zone_dezone'
  | 'zone_water' | 'zone_land'
  | 'police_station' | 'fire_station' | 'hospital' | 'school' | 'university'
  | 'park' | 'park_large' | 'tennis' | 'power_plant' | 'water_tower'
  | 'subway_station' | 'rail_station' | 'stadium' | 'museum' | 'airport'
  | 'space_program' | 'city_hall' | 'amusement_park'
  | 'basketball_courts' | 'playground_small' | 'playground_large'
  | 'baseball_field_small' | 'soccer_field_small' | 'football_field' | 'baseball_stadium'
  | 'community_center' | 'office_building_small' | 'swimming_pool' | 'skate_park'
  | 'mini_golf_course' | 'bleachers_field' | 'go_kart_track' | 'amphitheater'
  | 'greenhouse_garden' | 'animal_pens_farm' | 'cabin_house' | 'campground'
  | 'marina_docks_small' | 'pier_large' | 'roller_coaster_small'
  | 'community_garden' | 'pond_park' | 'park_gate' | 'mountain_lodge' | 'mountain_trailhead'
  // Varanasi riverfront (append only)
  | 'ghat' | 'sewage_treatment_plant'
  | 'jal_sansthan_water_works'
  | 'embankment'
  // Landmarks (S5-T1/T2)
  | 'landmark_dashashwamedh' | 'landmark_kashi_vishwanath' | 'landmark_bhu' | 'landmark_sarnath' | 'landmark_ramnagar_fort';

export interface ToolInfo {
  name: string;
  cost: number;
  description: string;
  size?: number;
}

export const TOOL_INFO: Record<Tool, ToolInfo> = {
  select: { name: msg('Select'), cost: 0, description: msg('Click to view tile info') },
  bulldoze: { name: msg('Bulldoze'), cost: 10, description: msg('Remove buildings and zones') },
  road: { name: msg('Road'), cost: 25, description: msg('Connect your city') },
  rail: { name: msg('Rail'), cost: 40, description: msg('Build railway tracks') },
  subway: { name: msg('Subway'), cost: 50, description: msg('Underground transit') },
  expand_city: { name: msg('Expand City'), cost: 0, description: msg('Add 15 tiles to each edge') },
  shrink_city: { name: msg('Shrink City'), cost: 0, description: msg('Remove 15 tiles from each edge') },
  tree: { name: msg('Tree'), cost: 15, description: msg('Plant trees to improve environment') },
  zone_residential: { name: msg('Residential'), cost: 50, description: msg('Zone for housing') },
  zone_commercial: { name: msg('Commercial'), cost: 50, description: msg('Zone for shops and offices') },
  zone_industrial: { name: msg('Industrial'), cost: 50, description: msg('Zone for factories') },
  zone_dezone: { name: msg('De-zone'), cost: 0, description: msg('Remove zoning') },
  zone_water: { name: msg('Water Terraform'), cost: 50000, description: msg('Terraform land into water') },
  zone_land: { name: msg('Land Terraform'), cost: 50000, description: msg('Terraform water into land') },
  police_station: { name: msg('Police'), cost: 500, description: msg('Increase safety'), size: 1 },
  fire_station: { name: msg('Fire Station'), cost: 500, description: msg('Fight fires'), size: 1 },
  hospital: { name: msg('Hospital'), cost: 1000, description: msg('Improve health (2x2)'), size: 2 },
  school: { name: msg('School'), cost: 400, description: msg('Basic education (2x2)'), size: 2 },
  university: { name: msg('University'), cost: 2000, description: msg('Higher education (3x3)'), size: 3 },
  park: { name: msg('Small Park'), cost: 150, description: msg('Boost happiness and land value (1x1)'), size: 1 },
  park_large: { name: msg('Large Park'), cost: 600, description: msg('Large park (3x3)'), size: 3 },
  tennis: { name: msg('Tennis Court'), cost: 200, description: msg('Recreation facility'), size: 1 },
  power_plant: { name: msg('Power Plant'), cost: 3000, description: msg('Generate electricity (2x2)'), size: 2 },
  water_tower: { name: msg('Water Tower'), cost: 1000, description: msg('Provide water'), size: 1 },
  subway_station: { name: msg('Subway Station'), cost: 750, description: msg('Access to subway network'), size: 1 },
  rail_station: { name: msg('Rail Station'), cost: 1000, description: msg('Passenger and freight station'), size: 2 },
  stadium: { name: msg('Stadium'), cost: 5000, description: msg('Boosts commercial demand (3x3)'), size: 3 },
  museum: { name: msg('Museum'), cost: 4000, description: msg('Boosts commercial & residential demand (3x3)'), size: 3 },
  airport: { name: msg('Airport'), cost: 10000, description: msg('Boosts commercial & industrial demand (4x4)'), size: 4 },
  space_program: { name: msg('Space Program'), cost: 15000, description: msg('Boosts industrial & residential demand (3x3)'), size: 3 },
  city_hall: { name: msg('City Hall'), cost: 6000, description: msg('Boosts all demand types (2x2)'), size: 2 },
  amusement_park: { name: msg('Amusement Park'), cost: 12000, description: msg('Major boost to commercial demand (4x4)'), size: 4 },
  basketball_courts: { name: msg('Basketball Courts'), cost: 250, description: msg('Outdoor basketball facility'), size: 1 },
  playground_small: { name: msg('Small Playground'), cost: 200, description: msg('Children\'s playground'), size: 1 },
  playground_large: { name: msg('Large Playground'), cost: 350, description: msg('Large playground with more equipment (2x2)'), size: 2 },
  baseball_field_small: { name: msg('Baseball Field'), cost: 800, description: msg('Local baseball diamond (2x2)'), size: 2 },
  soccer_field_small: { name: msg('Soccer Field'), cost: 400, description: msg('Soccer/football pitch'), size: 1 },
  football_field: { name: msg('Football Field'), cost: 1200, description: msg('Football stadium (2x2)'), size: 2 },
  baseball_stadium: { name: msg('Baseball Stadium'), cost: 6000, description: msg('Professional baseball venue (3x3)'), size: 3 },
  community_center: { name: msg('Community Center'), cost: 500, description: msg('Local community hub'), size: 1 },
  office_building_small: { name: msg('Small Office'), cost: 600, description: msg('Small office building'), size: 1 },
  swimming_pool: { name: msg('Swimming Pool'), cost: 450, description: msg('Public swimming facility'), size: 1 },
  skate_park: { name: msg('Skate Park'), cost: 300, description: msg('Skateboarding park'), size: 1 },
  mini_golf_course: { name: msg('Mini Golf'), cost: 700, description: msg('Miniature golf course (2x2)'), size: 2 },
  bleachers_field: { name: msg('Bleachers Field'), cost: 350, description: msg('Sports field with seating'), size: 1 },
  go_kart_track: { name: msg('Go-Kart Track'), cost: 1000, description: msg('Racing entertainment (2x2)'), size: 2 },
  amphitheater: { name: msg('Amphitheater'), cost: 1500, description: msg('Outdoor performance venue (2x2)'), size: 2 },
  greenhouse_garden: { name: msg('Greenhouse Garden'), cost: 800, description: msg('Botanical greenhouse (2x2)'), size: 2 },
  animal_pens_farm: { name: msg('Animal Pens'), cost: 400, description: msg('Petting zoo / farm animals'), size: 1 },
  cabin_house: { name: msg('Cabin House'), cost: 300, description: msg('Rustic cabin retreat'), size: 1 },
  campground: { name: msg('Campground'), cost: 250, description: msg('Outdoor camping area'), size: 1 },
  marina_docks_small: { name: msg('Marina'), cost: 1200, description: msg('Boat docks (2x2, must be placed next to water)'), size: 2 },
  pier_large: { name: msg('Pier'), cost: 600, description: msg('Waterfront pier (must be placed next to water)'), size: 1 },
  roller_coaster_small: { name: msg('Roller Coaster'), cost: 3000, description: msg('Thrill ride (2x2)'), size: 2 },
  community_garden: { name: msg('Community Garden'), cost: 200, description: msg('Shared gardening space'), size: 1 },
  pond_park: { name: msg('Pond Park'), cost: 350, description: msg('Park with scenic pond'), size: 1 },
  park_gate: { name: msg('Park Gate'), cost: 150, description: msg('Decorative park entrance'), size: 1 },
  mountain_lodge: { name: msg('Mountain Lodge'), cost: 1500, description: msg('Nature retreat lodge (2x2)'), size: 2 },
  mountain_trailhead: { name: msg('Trailhead'), cost: 400, description: msg('Hiking trail entrance (3x3)'), size: 3 },
  ghat: { name: msg('Ghat'), cost: 800, description: msg('Stone steps to the Ganga. Draws pilgrims and tourists.'), size: 1 },
  sewage_treatment_plant: { name: msg('Sewage Treatment Plant'), cost: 2500, description: msg('Cleans sewage before it reaches the Ganga. Treats a large area (2x2).'), size: 2 },
  jal_sansthan_water_works: { name: msg('Jal Sansthan Water Works'), cost: 6000, description: msg('Draws and treats Ganga water for a large area. Needs power; must be within 3 tiles of the Ganga. A cleaner river gives more water (3x3).'), size: 3 },
  landmark_dashashwamedh: { name: msg('Dashashwamedh Ghat'), cost: 15000, description: msg('Landmark. Counts as 4 ghats for tourism; happiness +2. Must include at least 2 west-bank riverfront tiles (2x2).'), size: 2 },
  landmark_kashi_vishwanath: { name: msg('Kashi Vishwanath Temple'), cost: 40000, description: msg('Landmark. Tourism +₹150 a tick (needs a clean Ganga); commercial demand +10. Within 8 tiles of the Ganga, west bank (2x2).'), size: 2 },
  landmark_bhu: { name: msg('Banaras Hindu University'), cost: 60000, description: msg('Landmark. Education coverage with twice the college range; residential demand +10, commercial +5. Not in a flood zone (4x4).'), size: 4 },
  landmark_sarnath: { name: msg('Sarnath'), cost: 50000, description: msg('Landmark. International tourism +₹200 a tick; happiness +3. Northern quarter of the map, west of the Ganga (3x3).'), size: 3 },
  landmark_ramnagar_fort: { name: msg('Ramnagar Fort'), cost: 80000, description: msg('Landmark. Tourism +₹250 a tick; land value +20 within 6 tiles. East bank, beyond the floodplain (3x3).'), size: 3 },
  embankment: { name: msg('Embankment'), cost: 300, description: msg('Raised river bank. Land behind it floods one river level later. Within 4 tiles of the Ganga; lowers nearby land value.'), size: 1 },
};

export interface Tile {
  x: number;
  y: number;
  zone: ZoneType;
  building: Building;
  landValue: number;
  pollution: number;
  crime: number;
  traffic: number;
  hasSubway: boolean;
  hasRailOverlay?: boolean;
}

export interface City {
  id: string;
  name: string;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  economy: CityEconomy;
  color: string;
}

export interface AdjacentCity {
  id: string;
  name: string;
  direction: 'north' | 'south' | 'east' | 'west';
  connected: boolean;
  discovered: boolean;
}

export interface WaterBody {
  id: string;
  name: string;
  type: 'lake' | 'ocean' | 'river';
  tiles: { x: number; y: number }[];
  centerX: number;
  centerY: number;
}

export type NotificationSeverity = 'info' | 'warning' | 'crisis';

export interface Notification {
  id: string;
  title: string;
  description: string;
  icon: string;
  timestamp: number;
  /** Tile the notification is about: clicking it moves the camera there (S4-T4). */
  x?: number;
  y?: number;
  /** Overlay to turn on when the notification is clicked. */
  overlay?: OverlayMode;
  /** 'crisis' pauses the game when `pauseOnCrisis` is on. Missing means 'info'. */
  severity?: NotificationSeverity;
}

/** An upcoming event shown on the calendar strip (S4-T1/S4-T4): forecasts now, festivals in Sprint 5. */
export interface Forecast {
  id: string;
  /** Absolute day (see `absoluteDay` in seasons.ts) the event is expected. */
  day: number;
  icon: string;
  title: string;
  description: string;
}

export interface AdvisorMessage {
  name: string;
  icon: string;
  messages: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
}

/** What the game-over screen shows (S4-T11). */
export interface GameOverInfo {
  reason: GameOverReason;
  year: number;
  month: number;
  /** Whole in-game years since the city was founded. */
  yearsSurvived: number;
  /** All-time peak of the displayed population. */
  peakPopulation: number;
  peakGangaHealth?: number;
  /** The stat most to blame; its line is FAILING_STAT_LINES[failingStat]. */
  failingStat: FailingStat;
}

export interface GameState {
  id: string;
  grid: Tile[][];
  gridSize: number;
  cityName: string;
  year: number;
  month: number;
  day: number;
  hour: number;
  tick: number;
  speed: 0 | 1 | 2 | 3;
  selectedTool: Tool;
  taxRate: number;
  effectiveTaxRate: number;
  stats: Stats;
  budget: Budget;
  services: ServiceCoverage;
  notifications: Notification[];
  advisorMessages: AdvisorMessage[];
  history: HistoryPoint[];
  activePanel: 'none' | 'budget' | 'statistics' | 'advisors' | 'settings';
  disastersEnabled: boolean;
  adjacentCities: AdjacentCity[];
  waterBodies: WaterBody[];
  gameVersion: number;
  structureVersion: number;
  roadNetworkVersion: number;
  cities: City[];
  /** Which map this city was started on. Missing (old saves) means 'random'. */
  mapId?: MapId;
  /** Informal settlement bookkeeping (S3-T9). Missing means nothing has happened yet. */
  informal?: InformalState;
  /** Debt, emergency loan, bankruptcy and exodus bookkeeping, incl. peak population / Ganga Health (S4-T11). Missing means a fresh state. */
  failure?: FailureState;
  /** Set when the city has failed (S4-T11); the simulation stops and the game-over screen shows. */
  gameOver?: GameOverInfo;
  /** Pause the game when a crisis notification arrives (S4-T4). Missing means on. */
  pauseOnCrisis?: boolean;
  /** Upcoming events on the calendar strip (S4-T4). */
  forecasts?: Forecast[];
  /** Weather chosen by the simulation from the season (S4-T2). Missing (old saves) means a new pick on the next tick. */
  weather?: SimWeather;
  /** Absolute day (see `absoluteDay` in seasons.ts) on which the next weather is picked. */
  weatherUntilDay?: number;
  /** This year's monsoon, rolled on 1 June (S4-T5, Varanasi only). */
  monsoonStrength?: MonsoonStrength;
  /** River level 0–3 during July–September floods (S4-T5). Missing means 0. */
  riverLevel?: number;
  /** Highest river level already announced this flood season, so each rise is reported once. */
  floodNotifiedLevel?: number;
  /** After the water falls: tiles that flooded at `siltLevel` but are dry now show silt until `siltUntilDay` (visual only). */
  siltLevel?: number;
  siltUntilDay?: number;
  /** A forecast or running heatwave (S4-T7). */
  heatwave?: HeatwaveState;
  /** Feeder blocks with a disease outbreak (S4-T9). */
  outbreaks?: OutbreakState[];
  /** Festival calendar bookkeeping and the last management event's effects (S5-T3/T4). */
  festival?: FestivalState;
  /** Highest `stats.population` ever reached, in simulation units (S5-T1). Landmark unlocks use it, so they never re-lock. */
  peakPopulation?: number;
  /** Landmarks standing on the map (S5-T1): each can be built once. Bulldozing one frees it (no refund). */
  landmarksBuilt?: LandmarkId[];
  /** How many unlocked landmarks the player has seen in the Landmarks menu; the menu button glows while fewer. */
  landmarksSeen?: number;
}

/** Saved per city. Keys are tile indices (y * gridSize + x) as strings, so the object survives JSON. */
export interface InformalState {
  /** Absolute day each tile was last bulldozed (entries older than the spawn cooldown are dropped). */
  bulldozedDay: Record<string, number>;
  /** Days in a row each settlement has met the formalisation conditions. */
  formaliseDays: Record<string, number>;
  /** The displacement happiness penalty applies until this absolute day. */
  displacedUntilDay?: number;
  /** The formalisation happiness bonus applies until this absolute day. */
  formalisedUntilDay?: number;
}

export interface SavedCityMeta {
  id: string;
  cityName: string;
  population: number;
  money: number;
  year: number;
  month: number;
  gridSize: number;
  savedAt: number;
  roomCode?: string;
}
