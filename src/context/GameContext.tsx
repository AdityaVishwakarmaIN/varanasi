// Consolidated GameContext for the SimCity-like game
'use client';

import React, { createContext, useCallback, useContext, useEffect, useState, useRef } from 'react';
import { compressToUTF16, decompressFromUTF16 } from 'lz-string';
import { T } from 'gt-next';
import { serializeAndCompressInSlicesAsync, decompressAndParseAsync } from '@/lib/saveWorkerManager';
import { simulateTick } from '@/lib/simulation';
import { recordSave, recordTick } from '@/lib/perfStats';
import { GAME_LOOP_CONFIG, SimulationScheduler, getTickIntervalMs } from '@/lib/gameLoop';
import { isBenchmarkState } from '@/lib/benchmark';
import {
  Budget,
  BuildingType,
  GameState,
  SavedCityMeta,
  Tool,
  TOOL_INFO,
  ZoneType,
} from '@/types/game';
import {
  bulldozeTile,
  createInitialGameState,
  getDefaultGridSize,
  expandGrid,
  shrinkGrid,
  placeBuilding,
  placeSubway,
  placeWaterTerraform,
  placeLandTerraform,
  checkForDiscoverableCities,
  generateRandomAdvancedCity,
  ensureUtilityCapacity,
  createBridgesOnPath,
  recalculateDerivedState,
  upgradeServiceBuilding,
  findBuildingOrigin,
} from '@/lib/simulation';
import { getPeakDisplayedPopulation, getUnlockedLandmarks, isLandmarkType, type LandmarkId } from '@/lib/landmarks';
import {
  SPRITE_PACKS,
  DEFAULT_SPRITE_PACK_ID,
  getSpritePack,
  setActiveSpritePack,
  SpritePack,
} from '@/lib/renderConfig';
import {
  ISOCITY_DAY_NIGHT_MODE_STORAGE_KEY,
  ISOCITY_SAVED_CITY_STORAGE_KEY,
  ISOCITY_SPRITE_PACK_STORAGE_KEY,
  clearIsoCityAutosave,
  deleteIsoCitySavedCityData,
  flushPendingSaves,
  loadIsoCitySavedCities,
  readIsoCityAutosaveRaw,
  readIsoCitySavedCityRaw,
  trackPendingSave,
  updateIsoCitySavedCities,
  writeIsoCityAutosaveRaw,
  writeIsoCitySavedCityRaw,
} from '@/lib/isocityStorage';
import { AUTOSAVE_CONFIG } from '@/lib/storage/saveConfig';
import { SaveErrorToast } from '@/components/game/SaveErrorToast';
import {
  copyLegacyGridToBuffer,
  createIsoCityGridBufferFromGrid,
  setIsoCityGridVersions,
  type IsoCityGridBuffer,
} from '@/games/isocity/gridBuffer';
import { isMobile } from 'react-device-detect';
import { createNewGameState, type NewGameOptions } from '@/lib/newGame';
import {
  addForecast as addForecastToState,
  pushNotifications,
  shouldPauseForCrisis,
  type ForecastInput,
  type NotificationExtras,
} from '@/lib/notifications';

// Map size for new games. The UI layer decides desktop vs phone; simulation.ts stays device-agnostic.
const DEFAULT_GRID_SIZE = getDefaultGridSize(isMobile);

export type DayNightMode = 'auto' | 'day' | 'night';

// Info about a saved city (for restore functionality)
export type SavedCityInfo = {
  cityName: string;
  population: number;
  money: number;
  savedAt: number;
} | null;

type GameContextValue = {
  state: GameState;
  // PERF: Ref to latest state for real-time access without React re-renders
  // Canvas should use this instead of state.grid for smooth updates
  latestStateRef: React.RefObject<GameState>;
  // PERF: Struct-of-arrays mirror of state.grid, refreshed on every state change.
  // Consumers (render worker, mini-map, read-only simulation scans) can read
  // grid fields via typed-array indexing without walking Tile[][]. Mutations
  // continue to flow through simulation.ts against state.grid; this buffer is
  // a read-side mirror that stays in sync via a useEffect below.
  gridBufferRef: React.RefObject<IsoCityGridBuffer | null>;
  setTool: (tool: Tool) => void;
  setSpeed: (speed: 0 | 1 | 2 | 3) => void;
  setTaxRate: (rate: number) => void;
  setActivePanel: (panel: GameState['activePanel']) => void;
  setBudgetFunding: (key: keyof Budget, funding: number) => void;
  upgradeServiceBuilding: (x: number, y: number) => boolean; // Returns true if upgrade succeeded
  placeAtTile: (x: number, y: number, isRemote?: boolean) => void;
  setPlaceCallback: (callback: ((args: { x: number; y: number; tool: Tool }) => void) | null) => void;
  finishTrackDrag: (pathTiles: { x: number; y: number }[], trackType: 'road' | 'rail', isRemote?: boolean) => void; // Create bridges after road/rail drag
  setBridgeCallback: (callback: ((args: { pathTiles: { x: number; y: number }[]; trackType: 'road' | 'rail' }) => void) | null) => void;
  connectToCity: (cityId: string) => void;
  discoverCity: (cityId: string) => void;
  checkAndDiscoverCities: (onDiscover?: (city: { id: string; direction: 'north' | 'south' | 'east' | 'west'; name: string }) => void) => void;
  setDisastersEnabled: (enabled: boolean) => void;
  newGame: (options?: NewGameOptions) => void;
  loadState: (stateString: string) => boolean;
  exportState: () => string;
  generateRandomCity: () => void;
  expandCity: () => void;
  shrinkCity: () => boolean;
  hasExistingGame: boolean;
  isStateReady: boolean; // True when initial state loading is complete
  isSaving: boolean;
  addMoney: (amount: number) => void;
  /** Adds a notification. With x/y it can be located; `severity: 'crisis'` may pause the city (S4-T4). */
  addNotification: (title: string, description: string, icon: string, extras?: NotificationExtras) => void;
  /** Puts a forecast on the calendar strip and sends a warning notification (S4-T4). */
  addForecast: (title: string, description: string, daysAhead: number, icon?: string, extras?: Partial<Omit<ForecastInput, 'title' | 'description' | 'daysAhead' | 'icon'>>) => void;
  setPauseOnCrisis: (enabled: boolean) => void;
  /** S5-T1: the player opened the Landmarks menu, so its glow stops. */
  markLandmarksSeen: () => void;
  /** S5-T1: a landmark the player tried to bulldoze, waiting for the confirm dialog. */
  pendingLandmarkBulldoze: { x: number; y: number; id: LandmarkId } | null;
  /** Answer the landmark bulldoze dialog (true bulldozes it, with no refund). */
  resolveLandmarkBulldoze: (confirmed: boolean) => void;
  // Sprite pack management
  currentSpritePack: SpritePack;
  availableSpritePacks: SpritePack[];
  setSpritePack: (packId: string) => void;
  // Day/night mode override
  dayNightMode: DayNightMode;
  setDayNightMode: (mode: DayNightMode) => void;
  visualHour: number; // The hour to use for rendering (respects day/night mode override)
  // Save/restore city for shared links
  saveCurrentCityForRestore: () => void;
  restoreSavedCity: () => boolean;
  getSavedCityInfo: () => SavedCityInfo;
  clearSavedCity: () => void;
  // Multi-city save system
  savedCities: SavedCityMeta[];
  saveCity: () => void;
  loadSavedCity: (cityId: string) => Promise<boolean>;
  deleteSavedCity: (cityId: string) => void;
  renameSavedCity: (cityId: string, newName: string) => void;
  // Set when a save failed (cleared by the next successful save or dismissSaveError)
  saveError: string | null;
  dismissSaveError: () => void;
};

// Shown when writing a save fails (quota, IndexedDB unavailable, ...).
export const SAVE_FAILED_MESSAGE = "Couldn't save your city. Export it from Settings to keep a copy.";

const GameContext = createContext<GameContextValue | null>(null);

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

const toolBuildingMap: Partial<Record<Tool, BuildingType>> = {
  road: 'road',
  rail: 'rail',
  rail_station: 'rail_station',
  tree: 'tree',
  police_station: 'police_station',
  fire_station: 'fire_station',
  hospital: 'hospital',
  school: 'school',
  university: 'university',
  park: 'park',
  park_large: 'park_large',
  tennis: 'tennis',
  power_plant: 'power_plant',
  water_tower: 'water_tower',
  subway_station: 'subway_station',
  stadium: 'stadium',
  museum: 'museum',
  airport: 'airport',
  space_program: 'space_program',
  city_hall: 'city_hall',
  amusement_park: 'amusement_park',
  // New parks
  basketball_courts: 'basketball_courts',
  playground_small: 'playground_small',
  playground_large: 'playground_large',
  baseball_field_small: 'baseball_field_small',
  soccer_field_small: 'soccer_field_small',
  football_field: 'football_field',
  baseball_stadium: 'baseball_stadium',
  community_center: 'community_center',
  office_building_small: 'office_building_small',
  swimming_pool: 'swimming_pool',
  skate_park: 'skate_park',
  mini_golf_course: 'mini_golf_course',
  bleachers_field: 'bleachers_field',
  go_kart_track: 'go_kart_track',
  amphitheater: 'amphitheater',
  greenhouse_garden: 'greenhouse_garden',
  animal_pens_farm: 'animal_pens_farm',
  cabin_house: 'cabin_house',
  campground: 'campground',
  marina_docks_small: 'marina_docks_small',
  pier_large: 'pier_large',
  roller_coaster_small: 'roller_coaster_small',
  community_garden: 'community_garden',
  pond_park: 'pond_park',
  park_gate: 'park_gate',
  mountain_lodge: 'mountain_lodge',
  mountain_trailhead: 'mountain_trailhead',
  ghat: 'ghat',
  sewage_treatment_plant: 'sewage_treatment_plant',
  jal_sansthan_water_works: 'jal_sansthan_water_works',
  embankment: 'embankment',
  landmark_dashashwamedh: 'landmark_dashashwamedh',
  landmark_kashi_vishwanath: 'landmark_kashi_vishwanath',
  landmark_bhu: 'landmark_bhu',
  landmark_sarnath: 'landmark_sarnath',
  landmark_ramnagar_fort: 'landmark_ramnagar_fort',
};

const toolZoneMap: Partial<Record<Tool, ZoneType>> = {
  zone_residential: 'residential',
  zone_commercial: 'commercial',
  zone_industrial: 'industrial',
  zone_dezone: 'none',
};

function normalizeGameStateVersions(state: GameState): GameState {
  return {
    ...state,
    gameVersion: state.gameVersion ?? 0,
    structureVersion: state.structureVersion ?? 0,
    roadNetworkVersion: state.roadNetworkVersion ?? 0,
  };
}

// Load the autosave from IndexedDB (S1-T9)
// Supports both compressed (lz-string) and uncompressed (legacy) formats.
// Decompression + JSON.parse run in the save worker.
async function loadGameState(): Promise<GameState | null> {
  if (typeof window === 'undefined') return null;
  try {
    // Make sure a save started just before (e.g. when leaving the game) has landed.
    await flushPendingSaves();
    const saved = await readIsoCityAutosaveRaw();
    if (saved) {
      const parsed = await decompressAndParseAsync<any>(saved);
      if (!parsed) {
        // Corrupted data: keep it (never destroy a save) - the next autosave replaces it
        console.error('Corrupted save data detected, starting a new city');
        return null;
      }
      // Validate it has essential properties
      if (parsed && 
          parsed.grid && 
          Array.isArray(parsed.grid) &&
          parsed.gridSize && 
          typeof parsed.gridSize === 'number' &&
          parsed.stats &&
          parsed.stats.money !== undefined &&
          parsed.stats.population !== undefined) {
        // Migrate park_medium to park_large
        if (parsed.grid) {
          for (let y = 0; y < parsed.grid.length; y++) {
            for (let x = 0; x < parsed.grid[y].length; x++) {
              if (parsed.grid[y][x]?.building?.type === 'park_medium') {
                parsed.grid[y][x].building.type = 'park_large';
              }
            }
          }
        }
        // Migrate selectedTool if it's park_medium
        if (parsed.selectedTool === 'park_medium') {
          parsed.selectedTool = 'park_large';
        }
        // Ensure adjacentCities and waterBodies exist for backward compatibility
        if (!parsed.adjacentCities) {
          parsed.adjacentCities = [];
        }
        // Migrate adjacentCities to have 'discovered' property
        for (const city of parsed.adjacentCities) {
          if (city.discovered === undefined) {
            // Old cities that exist are implicitly discovered (they were visible in the old system)
            city.discovered = true;
          }
        }
        if (!parsed.waterBodies) {
          parsed.waterBodies = [];
        }
        // Ensure cities exists for multi-city support
        if (!parsed.cities) {
          // Create a default city covering the entire map
          parsed.cities = [{
            id: parsed.id || 'default-city',
            name: parsed.cityName || 'City',
            bounds: {
              minX: 0,
              minY: 0,
              maxX: (parsed.gridSize || 50) - 1,
              maxY: (parsed.gridSize || 50) - 1,
            },
            economy: {
              population: parsed.stats?.population || 0,
              jobs: parsed.stats?.jobs || 0,
              income: parsed.stats?.income || 0,
              expenses: parsed.stats?.expenses || 0,
              happiness: parsed.stats?.happiness || 50,
              lastCalculated: 0,
            },
            color: '#3b82f6',
          }];
        }
        // Ensure hour exists for day/night cycle
        if (parsed.hour === undefined) {
          parsed.hour = 12; // Default to noon
        }
        // Ensure effectiveTaxRate exists for lagging tax effect
        if (parsed.effectiveTaxRate === undefined) {
          parsed.effectiveTaxRate = parsed.taxRate ?? 9; // Start at current tax rate
        }
        // Migrate constructionProgress for existing buildings (they're already built)
        if (parsed.grid) {
          for (let y = 0; y < parsed.grid.length; y++) {
            for (let x = 0; x < parsed.grid[y].length; x++) {
              if (parsed.grid[y][x]?.building && parsed.grid[y][x].building.constructionProgress === undefined) {
                parsed.grid[y][x].building.constructionProgress = 100; // Existing buildings are complete
              }
              // Migrate abandoned property for existing buildings (they're not abandoned)
              if (parsed.grid[y][x]?.building && parsed.grid[y][x].building.abandoned === undefined) {
                parsed.grid[y][x].building.abandoned = false;
              }
            }
          }
        }
        // Ensure version fields exist for backward compatibility
        if (parsed.gameVersion === undefined) {
          parsed.gameVersion = 0;
        }
        if (parsed.structureVersion === undefined) {
          parsed.structureVersion = 0;
        }
        if (parsed.roadNetworkVersion === undefined) {
          parsed.roadNetworkVersion = 0;
        }
        // Migrate to include UUID if missing
        if (!parsed.id) {
          parsed.id = generateUUID();
        }
        return normalizeGameStateVersions(parsed as GameState);
      } else {
        console.error('Saved game state is missing required fields, starting a new city');
      }
    }
  } catch (e) {
    console.error('Failed to load game state:', e);
  }
  return null;
}

// Optimize game state for saving by removing unnecessary/transient data
function optimizeStateForSave(state: GameState): GameState {
  // Create a shallow copy to avoid mutating the original
  const optimized = { ...state };
  
  // Clear notifications (they're transient)
  optimized.notifications = [];
  
  // Clear advisor messages (they're regenerated each tick)
  optimized.advisorMessages = [];
  
  // Limit history to last 50 entries (instead of 100)
  if (optimized.history && optimized.history.length > 50) {
    optimized.history = optimized.history.slice(-50);
  }
  
  return optimized;
}

// Save game state to IndexedDB with lz-string compression (S1-T9)
// PERF: Compression runs in the save worker; the IndexedDB write is a safe
// write (temp key + atomic swap), so a failed or interrupted save never
// destroys the last good one. Rejects if the save failed.
async function saveGameStateAsync(state: GameState): Promise<void> {
  if (typeof window === 'undefined') return;

  // Validate state before saving
  if (!state || !state.grid || !state.gridSize || !state.stats) {
    console.error('Invalid game state, cannot save', { state, hasGrid: !!state?.grid, hasGridSize: !!state?.gridSize, hasStats: !!state?.stats });
    return;
  }

  // Step 1: Optimize state (fast, stays on main thread)
  const optimizedState = optimizeStateForSave(state);

  // Step 2: Serialize in ~6 ms slices (each slice is timed as "save" in the perf HUD), compress in a worker
  const compressed = await serializeAndCompressInSlicesAsync(optimizedState, { onSlice: recordSave });

  // Benchmark cities (S1-T2) do all the save work (so "save max" is measured) but are
  // never written, so loading a benchmark cannot overwrite the player's saved city.
  if (isBenchmarkState(state)) return;

  // Step 3: Safe write to IndexedDB
  await writeIsoCityAutosaveRaw(compressed);
}

// Wrapper that takes a callback for compatibility with existing code.
// The callback gets `ok = false` if the save failed.
function saveGameState(state: GameState, callback?: (ok: boolean) => void): void {
  trackPendingSave(saveGameStateAsync(state)).then(
    () => callback?.(true),
    (e) => {
      console.error('Failed to save game state:', e);
      callback?.(false);
    },
  );
}

// Clear saved game state
function clearGameState(): void {
  if (typeof window === 'undefined') return;
  clearIsoCityAutosave().catch((e) => {
    console.error('Failed to clear game state:', e);
  });
}

// Load sprite pack from localStorage
function loadSpritePackId(): string {
  if (typeof window === 'undefined') return DEFAULT_SPRITE_PACK_ID;
  try {
    const saved = localStorage.getItem(ISOCITY_SPRITE_PACK_STORAGE_KEY);
    if (saved && SPRITE_PACKS.some(p => p.id === saved)) {
      return saved;
    }
  } catch (e) {
    console.error('Failed to load sprite pack preference:', e);
  }
  return DEFAULT_SPRITE_PACK_ID;
}

// Save sprite pack to localStorage
function saveSpritePackId(packId: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ISOCITY_SPRITE_PACK_STORAGE_KEY, packId);
  } catch (e) {
    console.error('Failed to save sprite pack preference:', e);
  }
}

// Load day/night mode from localStorage
function loadDayNightMode(): DayNightMode {
  if (typeof window === 'undefined') return 'auto';
  try {
    const saved = localStorage.getItem(ISOCITY_DAY_NIGHT_MODE_STORAGE_KEY);
    if (saved === 'auto' || saved === 'day' || saved === 'night') {
      return saved;
    }
  } catch (e) {
    console.error('Failed to load day/night mode preference:', e);
  }
  return 'auto';
}

// Save day/night mode to localStorage
function saveDayNightMode(mode: DayNightMode): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ISOCITY_DAY_NIGHT_MODE_STORAGE_KEY, mode);
  } catch (e) {
    console.error('Failed to save day/night mode preference:', e);
  }
}

// Save current city for later restoration (when viewing shared cities)
function saveCityForRestore(state: GameState): void {
  if (typeof window === 'undefined') return;
  try {
    const savedData = {
      state: state,
      info: {
        cityName: state.cityName,
        population: state.stats.population,
        money: state.stats.money,
        savedAt: Date.now(),
      },
    };
    const compressed = compressToUTF16(JSON.stringify(savedData));
    localStorage.setItem(ISOCITY_SAVED_CITY_STORAGE_KEY, compressed);
  } catch (e) {
    console.error('Failed to save city for restore:', e);
  }
}

// Helper to decompress saved city data (supports both compressed and legacy formats)
function decompressSavedCity(saved: string): { state?: GameState; info?: SavedCityInfo } | null {
  // Try to decompress first (new format)
  let jsonString = decompressFromUTF16(saved);
  if (!jsonString) {
    // Legacy uncompressed format
    jsonString = saved;
  }
  try {
    return JSON.parse(jsonString);
  } catch {
    return null;
  }
}

// Load saved city info (just metadata, not full state)
function loadSavedCityInfo(): SavedCityInfo {
  if (typeof window === 'undefined') return null;
  try {
    const saved = localStorage.getItem(ISOCITY_SAVED_CITY_STORAGE_KEY);
    if (saved) {
      const parsed = decompressSavedCity(saved);
      if (parsed?.info) {
        return parsed.info as SavedCityInfo;
      }
    }
  } catch (e) {
    console.error('Failed to load saved city info:', e);
  }
  return null;
}

// Load full saved city state
function loadSavedCityState(): GameState | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = localStorage.getItem(ISOCITY_SAVED_CITY_STORAGE_KEY);
    if (saved) {
      const parsed = decompressSavedCity(saved);
      if (parsed?.state && parsed.state.grid && parsed.state.gridSize && parsed.state.stats) {
        return normalizeGameStateVersions(parsed.state as GameState);
      }
    }
  } catch (e) {
    console.error('Failed to load saved city state:', e);
  }
  return null;
}

// Clear saved city
function clearSavedCityStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(ISOCITY_SAVED_CITY_STORAGE_KEY);
  } catch (e) {
    console.error('Failed to clear saved city:', e);
  }
}

// Generate a UUID v4
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older environments
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Save a city state to IndexedDB with compression (S1-T9)
// PERF: Compression happens in the worker. Rejects if the save failed.
async function saveCityStateAsync(cityId: string, state: GameState): Promise<void> {
  if (typeof window === 'undefined') return;
  const compressed = await serializeAndCompressInSlicesAsync(state);
  await writeIsoCitySavedCityRaw(cityId, compressed);
}

// Wrapper that tracks the save so leaving the game waits for it
function saveCityState(cityId: string, state: GameState): Promise<void> {
  return trackPendingSave(saveCityStateAsync(cityId, state));
}

// Load a saved city state from IndexedDB (supports compressed and legacy formats)
async function loadCityState(cityId: string): Promise<GameState | null> {
  if (typeof window === 'undefined') return null;
  try {
    const saved = await readIsoCitySavedCityRaw(cityId);
    if (saved) {
      const parsed = await decompressAndParseAsync<any>(saved);
      if (!parsed) {
        console.error('Corrupted city save data for:', cityId);
        return null;
      }
      if (parsed.grid && parsed.gridSize && parsed.stats) {
        return normalizeGameStateVersions(parsed as GameState);
      }
    }
  } catch (e) {
    console.error('Failed to load city state:', e);
  }
  return null;
}

// Delete a saved city from IndexedDB
function deleteCityState(cityId: string): void {
  if (typeof window === 'undefined') return;
  deleteIsoCitySavedCityData(cityId).catch((e) => {
    console.error('Failed to delete city state:', e);
  });
}

export function GameProvider({
  children,
  startFresh = false,
  newGameOptions,
}: {
  children: React.ReactNode;
  startFresh?: boolean;
  /** With startFresh: the map and name for the new city (S2-T3). Without it, a Varanasi city is created. */
  newGameOptions?: NewGameOptions;
}) {
  // Start with a default state, we'll load from IndexedDB after mount (unless startFresh is true)
  const [state, setState] = useState<GameState>(() => createInitialGameState(DEFAULT_GRID_SIZE, 'IsoCity'));
  // Read once at load time; later prop changes must not restart the city.
  const newGameOptionsRef = useRef(newGameOptions);
  
  const [hasExistingGame, setHasExistingGame] = useState(false);
  const [isStateReady, setIsStateReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextSaveRef = useRef(false);
  const hasLoadedRef = useRef(false);
  
  // Callback for multiplayer action broadcast
  const placeCallbackRef = useRef<((args: { x: number; y: number; tool: Tool }) => void) | null>(null);
  const bridgeCallbackRef = useRef<((args: { pathTiles: { x: number; y: number }[]; trackType: 'road' | 'rail' }) => void) | null>(null);
  
  // Sprite pack state
  const [currentSpritePack, setCurrentSpritePack] = useState<SpritePack>(() => getSpritePack(DEFAULT_SPRITE_PACK_ID));
  
  // Day/night mode state
  const [dayNightMode, setDayNightModeState] = useState<DayNightMode>('auto');
  
  // Saved cities state for multi-city save system
  const [savedCities, setSavedCities] = useState<SavedCityMeta[]>([]);
  
  // Save-failure reporting (S1-T9)
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveFailureNotifiedRef = useRef(false);

  // Track the state that needs to be saved
  const lastSaveTimeRef = useRef<number>(0);
  
  // Update the state to save whenever state changes
  // PERF: Just mark that state has changed - defer expensive deep copy to actual save time
  const stateChangedRef = useRef(false);
  const latestStateRef = useRef(state);
  const [pendingLandmarkBulldoze, setPendingLandmarkBulldoze] = useState<{ x: number; y: number; id: LandmarkId } | null>(null);
  const gridBufferRef = useRef<IsoCityGridBuffer | null>(null);

  // The state React last committed: lets the tick's UI sync see a newer player action.
  const committedStateRef = useRef(state);

  useEffect(() => {
    latestStateRef.current = state;
    committedStateRef.current = state;

    // PERF: Keep the SoA mirror in sync with state.grid so worker/MiniMap/etc.
    // can read typed arrays without walking Tile[][]. The copy is ~12 bytes
    // per tile (<1 MB even for 250x250 grids) and runs on each state change
    // (~2 Hz during simulation), so cost is negligible compared to a full
    // React re-render.
    const current = gridBufferRef.current;
    const sizeMatches =
      current !== null &&
      current.width === state.gridSize &&
      current.height === state.gridSize;
    if (!sizeMatches) {
      gridBufferRef.current = createIsoCityGridBufferFromGrid(
        state.grid,
        state.gridSize,
        state.gridSize,
        {
          gameVersion: state.gameVersion,
          structureVersion: state.structureVersion,
          roadNetworkVersion: state.roadNetworkVersion,
        },
      );
    } else {
      copyLegacyGridToBuffer(current, state.grid);
      setIsoCityGridVersions(current, {
        gameVersion: state.gameVersion,
        structureVersion: state.structureVersion,
        roadNetworkVersion: state.roadNetworkVersion,
      });
    }
  }, [state]);
  
  useEffect(() => {
    if (!hasLoadedRef.current) {
      return;
    }
    
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      lastSaveTimeRef.current = Date.now();
      return;
    }
    
    // PERF: Just mark that state changed instead of expensive deep copy every time
    stateChangedRef.current = true;
  }, [state]);
  
  // Load preferences from localStorage and the city from IndexedDB on mount (client-side only)
  useEffect(() => {
    let cancelled = false;

    // Load sprite pack preference
    const savedPackId = loadSpritePackId();
    const pack = getSpritePack(savedPackId);
    setCurrentSpritePack(pack);
    setActiveSpritePack(pack);

    // Load day/night mode preference
    const savedDayNightMode = loadDayNightMode();
    setDayNightModeState(savedDayNightMode);

    // City saves are in IndexedDB, which is async (the first call also
    // migrates old localStorage saves). Children render once this is done.
    const loadSaves = async () => {
      // Load saved cities index
      const cities = await loadIsoCitySavedCities();
      if (cancelled) return;
      setSavedCities(cities);

      // Load game state (unless startFresh is true - used for co-op to start with a new city)
      const saved = startFresh ? null : await loadGameState();
      if (cancelled) return;
      if (saved) {
        skipNextSaveRef.current = true; // Set skip flag BEFORE updating state
        // Point the simulation loop at the loaded city right away
        latestStateRef.current = saved;
        setState(saved);
        setHasExistingGame(true);
      } else {
        // No save (or a fresh start): create the chosen map (default: Varanasi)
        const fresh = createNewGameState(newGameOptionsRef.current, isMobile);
        latestStateRef.current = fresh;
        setState(fresh);
        setHasExistingGame(false);
      }
    };

    loadSaves()
      .catch((e) => {
        console.error('Failed to load saves:', e);
      })
      .finally(() => {
        if (cancelled) return;
        // Mark as loaded - the skipNextSaveRef will handle skipping the first save
        hasLoadedRef.current = true;
        // Mark state as ready - consumers should wait for this before using state
        setIsStateReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [startFresh]);
  
  // PERF: Track if a save is in progress to avoid overlapping saves
  const saveInProgressRef = useRef(false);
  
  // Tell the player when a save fails (once per failure streak, so a
  // persistent problem does not spam a notification every autosave).
  const reportSaveResult = useCallback((ok: boolean) => {
    if (ok) {
      saveFailureNotifiedRef.current = false;
      setSaveError(null);
      return;
    }
    if (saveFailureNotifiedRef.current) return;
    saveFailureNotifiedRef.current = true;
    setSaveError(SAVE_FAILED_MESSAGE);
    setState((prev) => ({
      ...prev,
      notifications: [
        {
          id: `save-failed-${Date.now()}`,
          title: 'Save failed',
          description: SAVE_FAILED_MESSAGE,
          icon: 'alert',
          timestamp: Date.now(),
        },
        ...prev.notifications.slice(0, 9), // Keep only 10 most recent
      ],
    }));
  }, []);

  const dismissSaveError = useCallback(() => {
    setSaveError(null);
  }, []);

  // Separate effect that actually performs autosaves (S1-T9):
  // every AUTOSAVE_CONFIG.intervalMs if the city changed, right away when the
  // tab is hidden or the page is being unloaded, and when the game unmounts
  // (leaving to the home screen).
  useEffect(() => {
    let resaveRequested = false;

    const autosave = () => {
      // Wait for the initial load
      if (!hasLoadedRef.current) {
        return;
      }

      // Don't save if we just loaded
      if (skipNextSaveRef.current) {
        skipNextSaveRef.current = false;
        return;
      }

      // Don't overlap saves; save again once the current one is done
      if (saveInProgressRef.current) {
        if (stateChangedRef.current) resaveRequested = true;
        return;
      }

      // Don't save if state hasn't changed
      if (!stateChangedRef.current) {
        return;
      }

      // Mark save as in progress
      saveInProgressRef.current = true;
      stateChangedRef.current = false;
      setIsSaving(true);

      // PERF: No need for structuredClone here - the worker handles everything
      saveGameState(latestStateRef.current, (ok) => {
        lastSaveTimeRef.current = Date.now();
        if (ok) {
          setHasExistingGame(true);
        } else {
          // Try again at the next autosave
          stateChangedRef.current = true;
        }
        setIsSaving(false);
        saveInProgressRef.current = false;
        reportSaveResult(ok);
        if (resaveRequested && ok) {
          resaveRequested = false;
          autosave();
        }
      });
    };

    const intervalId = setInterval(autosave, AUTOSAVE_CONFIG.intervalMs);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') autosave();
    };
    // Best effort: the async write may not finish before the page unloads.
    const handlePageHide = () => autosave();

    if (AUTOSAVE_CONFIG.saveOnHidden) {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }
    if (AUTOSAVE_CONFIG.saveOnPageHide) {
      window.addEventListener('pagehide', handlePageHide);
    }

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      // Leaving the game: save what changed since the last autosave
      autosave();
    };
  }, [reportSaveResult]);

  // PERF: Track tick count to only sync UI-visible changes to React periodically
  const tickCountRef = useRef(0);
  const lastUiSyncRef = useRef(0);
  
  // Simulation loop (S1-T4): fixed-timestep scheduler driven by requestAnimationFrame.
  // PERF: Grid updates go to latestStateRef (canvas reads from it); React only gets UI updates.
  const tickIntervalRef = useRef(Infinity); // current tick interval in ms (Infinity = speed 0)

  useEffect(() => {
    const isMobileDevice = typeof window !== 'undefined' && (
      window.innerWidth < 768 ||
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    );
    tickIntervalRef.current = getTickIntervalMs(state.speed, isMobileDevice);
  }, [state.speed]);

  useEffect(() => {
    const scheduler = new SimulationScheduler(() => {
      tickCountRef.current++;
      const now = performance.now();

      // PERF: Run simulation and update ref immediately (for canvas)
      const prevSpeed = latestStateRef.current.speed;
      const newState = simulateTick(latestStateRef.current);
      recordTick(performance.now() - now);
      latestStateRef.current = newState;
      stateChangedRef.current = true;

      // PERF: Only sync to React every 500ms to avoid expensive reconciliation
      // Canvas reads from latestStateRef so it sees updates immediately
      // React state is only needed for UI elements (stats, budget display)
      // A crisis auto-pause (S4-T4) syncs right away so the speed controls and the loop stop together.
      const pausedByTick = newState.speed !== prevSpeed;
      if (pausedByTick || now - lastUiSyncRef.current >= GAME_LOOP_CONFIG.uiSyncIntervalMs) {
        lastUiSyncRef.current = now;
        // A player action queued since the last commit wins over this sync; its commit
        // re-points latestStateRef at the action's state and the next sync carries on.
        setState((prev) => (prev === committedStateRef.current ? newState : prev));
      }
    }, () => tickIntervalRef.current);

    // System pause while the tab is hidden: the game's own `speed` is not changed, and no
    // time is owed on return (the in-game date does not move while hidden).
    // Saving on hide is handled by the autosave rewrite (S1-T9).
    const onVisibilityChange = () => scheduler.setPaused(document.hidden);
    document.addEventListener('visibilitychange', onVisibilityChange);
    scheduler.setPaused(document.hidden);
    scheduler.start();

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      scheduler.stop();
    };
  }, []);

  const setTool = useCallback((tool: Tool) => {
    setState((prev) => ({ ...prev, selectedTool: tool, activePanel: 'none' }));
  }, []);

  const setSpeed = useCallback((speed: 0 | 1 | 2 | 3) => {
    setState((prev) => ({ ...prev, speed }));
  }, []);

  const setTaxRate = useCallback((rate: number) => {
    setState((prev) => ({ ...prev, taxRate: clamp(rate, 0, 100) }));
  }, []);

  const setActivePanel = useCallback(
    (panel: GameState['activePanel']) => {
      setState((prev) => ({ ...prev, activePanel: panel }));
    },
    [],
  );

  const setBudgetFunding = useCallback(
    (key: keyof Budget, funding: number) => {
      const clamped = clamp(funding, 0, 100);
      setState((prev) => ({
        ...prev,
        budget: {
          ...prev.budget,
          [key]: { ...prev.budget[key], funding: clamped },
        },
      }));
    },
    [],
  );

  const placeAtTile = useCallback((x: number, y: number, isRemote = false) => {
    // For multiplayer broadcast, we need to capture the tool synchronously
    // before React batches the setState. We read from the latest state ref.
    const currentTool = latestStateRef.current.selectedTool;

    // S5-T1: bulldozing a landmark asks first (a remote bulldoze was already confirmed by that player)
    if (!isRemote && currentTool === 'bulldoze') {
      const s = latestStateRef.current;
      const origin = findBuildingOrigin(s.grid, x, y, s.gridSize);
      if (origin && isLandmarkType(origin.buildingType)) {
        const id = origin.buildingType;
        setPendingLandmarkBulldoze((p) => p ?? { x, y, id });
        return;
      }
    }
    
    setState((prev) => {
      const tool = prev.selectedTool;
      if (tool === 'select') return prev;

      const info = TOOL_INFO[tool];
      const cost = info?.cost ?? 0;
      const tile = prev.grid[y]?.[x];

      if (!tile) return prev;
      if (cost > 0 && prev.stats.money < cost) return prev;

      // Prevent wasted spend if nothing would change
      if (tool === 'bulldoze' && tile.building.type === 'grass' && tile.zone === 'none') {
        return prev;
      }

      const building = toolBuildingMap[tool];
      const zone = toolZoneMap[tool];

      if (zone && tile.zone === zone) return prev;
      if (building && tile.building.type === building) return prev;
      
      // Handle subway tool separately (underground placement)
      if (tool === 'subway') {
        // Can't place subway under water
        if (tile.building.type === 'water') return prev;
        // Already has subway
        if (tile.hasSubway) return prev;
        
        const nextState = placeSubway(prev, x, y);
        if (nextState === prev) return prev;

        return recalculateDerivedState({
          ...nextState,
          stats: { ...nextState.stats, money: nextState.stats.money - cost },
        });
      }
      
      // Handle water terraform tool separately
      if (tool === 'zone_water') {
        // Already water - do nothing
        if (tile.building.type === 'water') return prev;
        // Don't allow terraforming bridges - would break them
        if (tile.building.type === 'bridge') return prev;
        
        const nextState = placeWaterTerraform(prev, x, y);
        if (nextState === prev) return prev;

        return recalculateDerivedState({
          ...nextState,
          stats: { ...nextState.stats, money: nextState.stats.money - cost },
        });
      }
      
      // Handle land terraform tool separately
      if (tool === 'zone_land') {
        // Only works on water
        if (tile.building.type !== 'water') return prev;
        
        const nextState = placeLandTerraform(prev, x, y);
        if (nextState === prev) return prev;

        return recalculateDerivedState({
          ...nextState,
          stats: { ...nextState.stats, money: nextState.stats.money - cost },
        });
      }

      let nextState: GameState;

      if (tool === 'bulldoze') {
        nextState = bulldozeTile(prev, x, y);
      } else if (zone) {
        nextState = placeBuilding(prev, x, y, null, zone);
      } else if (building) {
        nextState = placeBuilding(prev, x, y, building, null);
      } else {
        return prev;
      }

      if (nextState === prev) return prev;

      if (cost > 0) {
        nextState = {
          ...nextState,
          stats: { ...nextState.stats, money: nextState.stats.money - cost },
        };
      }

      return recalculateDerivedState(nextState);
    });
    
    // Broadcast to multiplayer if this is a local action (not remote)
    // We use the tool captured before setState since React 18 batches async
    if (!isRemote && currentTool !== 'select' && placeCallbackRef.current) {
      placeCallbackRef.current({ x, y, tool: currentTool });
    }
  }, []);

  const upgradeServiceBuildingHandler = useCallback((x: number, y: number) => {
    let upgradeSucceeded = false;
    setState((prev) => {
      const upgradedState = upgradeServiceBuilding(prev, x, y);
      if (upgradedState) {
        upgradeSucceeded = true;
        return recalculateDerivedState(upgradedState);
      }
      return prev;
    });
    return upgradeSucceeded;
  }, []);

  // Called after a road/rail drag operation to create bridges for water crossings
  const finishTrackDrag = useCallback((pathTiles: { x: number; y: number }[], trackType: 'road' | 'rail', isRemote = false) => {
    setState((prev) => recalculateDerivedState(createBridgesOnPath(prev, pathTiles, trackType)));
    
    // Broadcast to multiplayer if this is a local action (not remote)
    if (!isRemote && bridgeCallbackRef.current) {
      bridgeCallbackRef.current({ pathTiles, trackType });
    }
  }, []);

  const connectToCity = useCallback((cityId: string) => {
    setState((prev) => {
      const city = prev.adjacentCities.find(c => c.id === cityId);
      if (!city || city.connected) return prev;

      // Mark city as connected (and discovered if not already) and add trade income
      const updatedCities = prev.adjacentCities.map(c =>
        c.id === cityId ? { ...c, connected: true, discovered: true } : c
      );

      // Add trade income bonus (one-time bonus + monthly income)
      const tradeBonus = 5000;
      const tradeIncome = 200; // Monthly income from trade

      return {
        ...prev,
        adjacentCities: updatedCities,
        stats: {
          ...prev.stats,
          money: prev.stats.money + tradeBonus,
          income: prev.stats.income + tradeIncome,
        },
        notifications: [
          {
            id: `city-connect-${Date.now()}`,
            title: 'City Connected!',
            description: `Trade route established with ${city.name}. +$${tradeBonus} bonus and +$${tradeIncome}/month income.`,
            icon: 'road',
            timestamp: Date.now(),
          },
          ...prev.notifications.slice(0, 9), // Keep only 10 most recent
        ],
      };
    });
  }, []);

  const discoverCity = useCallback((cityId: string) => {
    setState((prev) => {
      const city = prev.adjacentCities.find(c => c.id === cityId);
      if (!city || city.discovered) return prev;

      // Mark city as discovered
      const updatedCities = prev.adjacentCities.map(c =>
        c.id === cityId ? { ...c, discovered: true } : c
      );

      return {
        ...prev,
        adjacentCities: updatedCities,
        notifications: [
          {
            id: `city-discover-${Date.now()}`,
            title: 'City Discovered!',
            description: `Your road has reached the ${city.direction} border! You can now connect to ${city.name}.`,
            icon: 'road',
            timestamp: Date.now(),
          },
          ...prev.notifications.slice(0, 9), // Keep only 10 most recent
        ],
      };
    });
  }, []);

  // Check for cities that should be discovered based on roads reaching edges
  // Calls onDiscover callback with city info if a new city was discovered
  const checkAndDiscoverCities = useCallback((onDiscover?: (city: { id: string; direction: 'north' | 'south' | 'east' | 'west'; name: string }) => void): void => {
    setState((prev) => {
      const newlyDiscovered = checkForDiscoverableCities(prev.grid, prev.gridSize, prev.adjacentCities);
      
      if (newlyDiscovered.length === 0) return prev;
      
      // Discover the first city found
      const cityToDiscover = newlyDiscovered[0];
      
      const updatedCities = prev.adjacentCities.map(c =>
        c.id === cityToDiscover.id ? { ...c, discovered: true } : c
      );
      
      // Call the callback after state update is scheduled
      if (onDiscover) {
        setTimeout(() => {
          onDiscover({
            id: cityToDiscover.id,
            direction: cityToDiscover.direction,
            name: cityToDiscover.name,
          });
        }, 0);
      }
      
      return {
        ...prev,
        adjacentCities: updatedCities,
      };
    });
  }, []);

  const setDisastersEnabled = useCallback((enabled: boolean) => {
    setState((prev) => ({ ...prev, disastersEnabled: enabled }));
  }, []);

  const setPauseOnCrisis = useCallback((enabled: boolean) => {
    setState((prev) => ({ ...prev, pauseOnCrisis: enabled }));
  }, []);

  const markLandmarksSeen = useCallback(() => {
    setState((prev) => {
      const seen = getUnlockedLandmarks(getPeakDisplayedPopulation(prev)).length;
      return (prev.landmarksSeen ?? 0) >= seen ? prev : { ...prev, landmarksSeen: seen };
    });
  }, []);

  const resolveLandmarkBulldoze = useCallback((confirmed: boolean) => {
    const pending = pendingLandmarkBulldoze;
    setPendingLandmarkBulldoze(null);
    if (!confirmed || !pending) return;
    const cost = TOOL_INFO.bulldoze.cost;
    setState((prev) => {
      if (prev.stats.money < cost) return prev;
      const next = bulldozeTile(prev, pending.x, pending.y);
      if (next === prev) return prev;
      // No refund for a landmark: only the normal bulldoze cost is paid
      return recalculateDerivedState({ ...next, stats: { ...next.stats, money: next.stats.money - cost } });
    });
    placeCallbackRef.current?.({ x: pending.x, y: pending.y, tool: 'bulldoze' });
  }, [pendingLandmarkBulldoze]);

  
  const setPlaceCallback = useCallback((callback: ((args: { x: number; y: number; tool: Tool }) => void) | null) => {
    placeCallbackRef.current = callback;
  }, []);

  const setBridgeCallback = useCallback((callback: ((args: { pathTiles: { x: number; y: number }[]; trackType: 'road' | 'rail' }) => void) | null) => {
    bridgeCallbackRef.current = callback;
  }, []);

  const setSpritePack = useCallback((packId: string) => {
    const pack = getSpritePack(packId);
    setCurrentSpritePack(pack);
    setActiveSpritePack(pack);
    saveSpritePackId(packId);
  }, []);

  const setDayNightMode = useCallback((mode: DayNightMode) => {
    setDayNightModeState(mode);
    saveDayNightMode(mode);
  }, []);

  // Compute the visual hour based on the day/night mode override
  // This doesn't affect time progression, just the rendering
  const visualHour = dayNightMode === 'auto' 
    ? state.hour 
    : dayNightMode === 'day' 
      ? 12  // Noon - full daylight
      : 22; // Night time

  /**
   * Swap in a whole new city. The simulation loop reads `latestStateRef`, so it must point at
   * the new city right away: otherwise a tick already queued for this frame simulates the old
   * city and its UI sync overwrites the one just loaded.
   * Bumping gameVersion clears vehicles/entities; the other versions force a full redraw.
   */
  const replaceCity = useCallback((next: GameState, versionBase: Pick<GameState, 'structureVersion' | 'roadNetworkVersion'>) => {
    const prev = latestStateRef.current;
    const city: GameState = {
      ...next,
      gameVersion: (prev.gameVersion ?? 0) + 1,
      structureVersion: (versionBase.structureVersion ?? 0) + 1,
      roadNetworkVersion: (versionBase.roadNetworkVersion ?? 0) + 1,
    };
    latestStateRef.current = city;
    setState(city);
  }, []);

  const newGame = useCallback((options?: NewGameOptions) => {
    clearGameState(); // Clear saved state when starting fresh
    replaceCity(createNewGameState(options, isMobile), latestStateRef.current);
  }, [replaceCity]);

  const loadState = useCallback((stateString: string): boolean => {
    try {
      const parsed = JSON.parse(stateString);
      // Validate it has essential properties
      if (parsed && 
          parsed.grid && 
          Array.isArray(parsed.grid) &&
          parsed.gridSize && 
          typeof parsed.gridSize === 'number' &&
          parsed.stats &&
          parsed.stats.money !== undefined &&
          parsed.stats.population !== undefined) {
        // Ensure new fields exist for backward compatibility
        if (!parsed.adjacentCities) {
          parsed.adjacentCities = [];
        }
        // Migrate adjacentCities to have 'discovered' property
        for (const city of parsed.adjacentCities) {
          if (city.discovered === undefined) {
            // Old cities that exist are implicitly discovered (they were visible in the old system)
            city.discovered = true;
          }
        }
        if (!parsed.waterBodies) {
          parsed.waterBodies = [];
        }
        // Ensure cities exists for multi-city support
        if (!parsed.cities) {
          parsed.cities = [{
            id: parsed.id || 'default-city',
            name: parsed.cityName || 'City',
            bounds: {
              minX: 0,
              minY: 0,
              maxX: (parsed.gridSize || 50) - 1,
              maxY: (parsed.gridSize || 50) - 1,
            },
            economy: {
              population: parsed.stats?.population || 0,
              jobs: parsed.stats?.jobs || 0,
              income: parsed.stats?.income || 0,
              expenses: parsed.stats?.expenses || 0,
              happiness: parsed.stats?.happiness || 50,
              lastCalculated: 0,
            },
            color: '#3b82f6',
          }];
        }
        // Ensure effectiveTaxRate exists for lagging tax effect
        if (parsed.effectiveTaxRate === undefined) {
          parsed.effectiveTaxRate = parsed.taxRate ?? 9;
        }
        // Migrate constructionProgress for existing buildings (they're already built)
        if (parsed.grid) {
          for (let y = 0; y < parsed.grid.length; y++) {
            for (let x = 0; x < parsed.grid[y].length; x++) {
              if (parsed.grid[y][x]?.building && parsed.grid[y][x].building.constructionProgress === undefined) {
                parsed.grid[y][x].building.constructionProgress = 100; // Existing buildings are complete
              }
              // Migrate abandoned property for existing buildings (they're not abandoned)
              if (parsed.grid[y][x]?.building && parsed.grid[y][x].building.abandoned === undefined) {
                parsed.grid[y][x].building.abandoned = false;
              }
            }
          }
        }
        // Increment gameVersion to clear vehicles/entities when loading a new state
        const normalizedState = normalizeGameStateVersions(parsed as GameState);
        replaceCity(normalizedState, normalizedState);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [replaceCity]);

  const exportState = useCallback((): string => {
    return JSON.stringify(state);
  }, [state]);

  const generateRandomCity = useCallback(() => {
    clearGameState(); // Clear saved state when generating a new city
    replaceCity(ensureUtilityCapacity(generateRandomAdvancedCity(DEFAULT_GRID_SIZE)), latestStateRef.current);
  }, [replaceCity]);

  // Expand the city grid by 15 tiles on each side (30x30 total increase)
  const expandCity = useCallback(() => {
    setState((prev) => {
      const { grid: newGrid, newSize } = expandGrid(prev.grid, prev.gridSize, 15);
      
      // Create new service grids with expanded size (all initialized to 0)
      const createServiceGrid = (): number[][] => {
        const grid: number[][] = [];
        for (let y = 0; y < newSize; y++) {
          grid.push(new Array(newSize).fill(0));
        }
        return grid;
      };
      
      // Create new boolean grids with expanded size (all initialized to false)
      const createBoolGrid = (): boolean[][] => {
        const grid: boolean[][] = [];
        for (let y = 0; y < newSize; y++) {
          grid.push(new Array(newSize).fill(false));
        }
        return grid;
      };
      
      // Copy old service values to new positions (offset by 15)
      const expandServiceGrid = (oldGrid: number[][]): number[][] => {
        const newServiceGrid = createServiceGrid();
        const offset = 15;
        // Safely iterate through the old grid
        if (oldGrid && Array.isArray(oldGrid)) {
          for (let y = 0; y < prev.gridSize; y++) {
            const row = oldGrid[y];
            if (row && Array.isArray(row)) {
              for (let x = 0; x < prev.gridSize; x++) {
                const value = row[x];
                if (typeof value === 'number') {
                  newServiceGrid[y + offset][x + offset] = value;
                }
              }
            }
          }
        }
        return newServiceGrid;
      };
      
      // Copy old boolean grid values to new positions (offset by 15)
      const expandBoolGrid = (oldGrid: boolean[][]): boolean[][] => {
        const newBoolGrid = createBoolGrid();
        const offset = 15;
        if (oldGrid && Array.isArray(oldGrid)) {
          for (let y = 0; y < prev.gridSize; y++) {
            const row = oldGrid[y];
            if (row && Array.isArray(row)) {
              for (let x = 0; x < prev.gridSize; x++) {
                const value = row[x];
                if (typeof value === 'boolean') {
                  newBoolGrid[y + offset][x + offset] = value;
                }
              }
            }
          }
        }
        return newBoolGrid;
      };
      
      return {
        ...prev,
        grid: newGrid,
        gridSize: newSize,
        // Expand all service grids
        services: {
          power: expandBoolGrid(prev.services.power),
          water: expandBoolGrid(prev.services.water),
          fire: expandServiceGrid(prev.services.fire),
          police: expandServiceGrid(prev.services.police),
          health: expandServiceGrid(prev.services.health),
          education: expandServiceGrid(prev.services.education),
        },
        // Update bounds
        bounds: {
          minX: 0,
          minY: 0,
          maxX: newSize - 1,
          maxY: newSize - 1,
        },
        // Increment game version to reset vehicles/entities
        gameVersion: (prev.gameVersion ?? 0) + 1,
        structureVersion: (prev.structureVersion ?? 0) + 1,
        roadNetworkVersion: (prev.roadNetworkVersion ?? 0) + 1,
      };
    });
  }, []);

  // Shrink the city grid by 15 tiles on each side (30x30 total reduction)
  const shrinkCity = useCallback((): boolean => {
    let success = false;
    setState((prev) => {
      const result = shrinkGrid(prev.grid, prev.gridSize, 15);
      
      // If shrink failed (grid too small), return previous state unchanged
      if (!result) {
        return prev;
      }
      
      success = true;
      const { grid: newGrid, newSize } = result;
      
      // Create new service grids with shrunken size
      const createServiceGrid = (): number[][] => {
        const grid: number[][] = [];
        for (let y = 0; y < newSize; y++) {
          grid.push(new Array(newSize).fill(0));
        }
        return grid;
      };
      
      // Create new boolean grids with shrunken size
      const createBoolGrid = (): boolean[][] => {
        const grid: boolean[][] = [];
        for (let y = 0; y < newSize; y++) {
          grid.push(new Array(newSize).fill(false));
        }
        return grid;
      };
      
      // Copy old service values from interior positions (offset by 15)
      const shrinkServiceGrid = (oldGrid: number[][]): number[][] => {
        const newServiceGrid = createServiceGrid();
        const offset = 15;
        // Safely iterate through the new grid
        if (oldGrid && Array.isArray(oldGrid)) {
          for (let y = 0; y < newSize; y++) {
            const oldRow = oldGrid[y + offset];
            if (oldRow && Array.isArray(oldRow)) {
              for (let x = 0; x < newSize; x++) {
                const value = oldRow[x + offset];
                if (typeof value === 'number') {
                  newServiceGrid[y][x] = value;
                }
              }
            }
          }
        }
        return newServiceGrid;
      };
      
      // Copy old boolean grid values from interior positions (offset by 15)
      const shrinkBoolGrid = (oldGrid: boolean[][]): boolean[][] => {
        const newBoolGrid = createBoolGrid();
        const offset = 15;
        if (oldGrid && Array.isArray(oldGrid)) {
          for (let y = 0; y < newSize; y++) {
            const oldRow = oldGrid[y + offset];
            if (oldRow && Array.isArray(oldRow)) {
              for (let x = 0; x < newSize; x++) {
                const value = oldRow[x + offset];
                if (typeof value === 'boolean') {
                  newBoolGrid[y][x] = value;
                }
              }
            }
          }
        }
        return newBoolGrid;
      };
      
      return {
        ...prev,
        grid: newGrid,
        gridSize: newSize,
        // Shrink all service grids
        services: {
          power: shrinkBoolGrid(prev.services.power),
          water: shrinkBoolGrid(prev.services.water),
          fire: shrinkServiceGrid(prev.services.fire),
          police: shrinkServiceGrid(prev.services.police),
          health: shrinkServiceGrid(prev.services.health),
          education: shrinkServiceGrid(prev.services.education),
        },
        // Update bounds
        bounds: {
          minX: 0,
          minY: 0,
          maxX: newSize - 1,
          maxY: newSize - 1,
        },
        // Increment game version to reset vehicles/entities
        gameVersion: (prev.gameVersion ?? 0) + 1,
        structureVersion: (prev.structureVersion ?? 0) + 1,
        roadNetworkVersion: (prev.roadNetworkVersion ?? 0) + 1,
      };
    });
    return success;
  }, []);

  const addMoney = useCallback((amount: number) => {
    setState((prev) => ({
      ...prev,
      stats: {
        ...prev.stats,
        money: prev.stats.money + amount,
      },
    }));
  }, []);

  const addNotification = useCallback((title: string, description: string, icon: string, extras?: NotificationExtras) => {
    setState((prev) => {
      const added = [{ id: `note-${Date.now()}-${Math.random()}`, title, description, icon, timestamp: Date.now(), ...extras }];
      return {
        ...prev,
        notifications: pushNotifications(prev.notifications, added),
        // A crisis pauses the city when the player wants that (S4-T4)
        ...(shouldPauseForCrisis(prev, added) ? { speed: 0 as const } : {}),
      };
    });
  }, []);

  const addForecast = useCallback((title: string, description: string, daysAhead: number, icon = '🔮', extras?: Partial<Omit<ForecastInput, 'title' | 'description' | 'daysAhead' | 'icon'>>) => {
    setState((prev) => ({
      ...prev,
      ...addForecastToState(prev, { id: extras?.id ?? `${title}-${daysAhead}`, title, description, daysAhead, icon, ...extras }),
    }));
  }, []);

  // Save current city for restore (when viewing shared cities)
  const saveCurrentCityForRestore = useCallback(() => {
    saveCityForRestore(state);
  }, [state]);

  // Restore saved city
  const restoreSavedCity = useCallback((): boolean => {
    const savedState = loadSavedCityState();
    if (savedState) {
      skipNextSaveRef.current = true;
      const normalizedSavedState = normalizeGameStateVersions(savedState);
      setState((prev) => ({
        ...normalizedSavedState,
        gameVersion: (prev.gameVersion ?? 0) + 1,
        structureVersion: (normalizedSavedState.structureVersion ?? 0) + 1,
        roadNetworkVersion: (normalizedSavedState.roadNetworkVersion ?? 0) + 1,
      }));
      clearSavedCityStorage();
      return true;
    }
    return false;
  }, []);

  // Get saved city info
  const getSavedCityInfo = useCallback((): SavedCityInfo => {
    return loadSavedCityInfo();
  }, []);

  // Clear saved city
  const clearSavedCity = useCallback(() => {
    clearSavedCityStorage();
  }, []);

  // Save current city to the multi-save system
  const saveCity = useCallback(() => {
    const cityMeta: SavedCityMeta = {
      id: state.id,
      cityName: state.cityName,
      population: state.stats.population,
      money: state.stats.money,
      year: state.year,
      month: state.month,
      gridSize: state.gridSize,
      savedAt: Date.now(),
    };

    const upsert = (prev: SavedCityMeta[]): SavedCityMeta[] => {
      // Check if this city already exists in the list
      const existingIndex = prev.findIndex((c) => c.id === cityMeta.id);
      let newCities: SavedCityMeta[];

      if (existingIndex >= 0) {
        // Update existing entry
        newCities = [...prev];
        newCities[existingIndex] = cityMeta;
      } else {
        // Add new entry
        newCities = [...prev, cityMeta];
      }

      // Sort by savedAt descending (most recent first)
      newCities.sort((a, b) => b.savedAt - a.savedAt);
      return newCities;
    };

    // Show it in the list right away
    setSavedCities(upsert);

    // Save the city state, then (only if that worked) the index entry.
    // Tracked so leaving the game waits for it before listing saved cities.
    const cityState = state;
    trackPendingSave((async () => {
      await saveCityState(cityState.id, cityState);
      const storedCities = await updateIsoCitySavedCities(upsert);
      setSavedCities(storedCities);
    })()).then(
      () => reportSaveResult(true),
      (e) => {
        console.error('Failed to save city:', e);
        reportSaveResult(false);
      },
    );
  }, [state, reportSaveResult]);

  // Load a saved city from the multi-save system
  const loadSavedCity = useCallback(async (cityId: string): Promise<boolean> => {
    const cityState = await loadCityState(cityId);
    if (!cityState) return false;
    
    // Ensure the loaded state has an ID
    if (!cityState.id) {
      cityState.id = cityId;
    }
    
    // Perform migrations for backward compatibility
    if (!cityState.adjacentCities) {
      cityState.adjacentCities = [];
    }
    for (const city of cityState.adjacentCities) {
      if (city.discovered === undefined) {
        city.discovered = true;
      }
    }
    if (!cityState.waterBodies) {
      cityState.waterBodies = [];
    }
    // Ensure cities exists for multi-city support
    if (!cityState.cities) {
      cityState.cities = [{
        id: cityState.id || 'default-city',
        name: cityState.cityName || 'City',
        bounds: {
          minX: 0,
          minY: 0,
          maxX: (cityState.gridSize || 50) - 1,
          maxY: (cityState.gridSize || 50) - 1,
        },
        economy: {
          population: cityState.stats?.population || 0,
          jobs: cityState.stats?.jobs || 0,
          income: cityState.stats?.income || 0,
          expenses: cityState.stats?.expenses || 0,
          happiness: cityState.stats?.happiness || 50,
          lastCalculated: 0,
        },
        color: '#3b82f6',
      }];
    }
    if (cityState.effectiveTaxRate === undefined) {
      cityState.effectiveTaxRate = cityState.taxRate ?? 9;
    }
    if (cityState.grid) {
      for (let y = 0; y < cityState.grid.length; y++) {
        for (let x = 0; x < cityState.grid[y].length; x++) {
          if (cityState.grid[y][x]?.building && cityState.grid[y][x].building.constructionProgress === undefined) {
            cityState.grid[y][x].building.constructionProgress = 100;
          }
          if (cityState.grid[y][x]?.building && cityState.grid[y][x].building.abandoned === undefined) {
            cityState.grid[y][x].building.abandoned = false;
          }
        }
      }
    }
    
    skipNextSaveRef.current = true;
    const normalizedCityState = normalizeGameStateVersions(cityState);
    setState((prev) => ({
      ...normalizedCityState,
      gameVersion: (prev.gameVersion ?? 0) + 1,
      structureVersion: (normalizedCityState.structureVersion ?? 0) + 1,
      roadNetworkVersion: (normalizedCityState.roadNetworkVersion ?? 0) + 1,
    }));
    
    // Also update the current game's autosave
    saveGameState(normalizedCityState, reportSaveResult);

    return true;
  }, [reportSaveResult]);

  // Delete a saved city from the multi-save system
  const deleteSavedCity = useCallback((cityId: string) => {
    // Delete the city state
    deleteCityState(cityId);

    // Update the index
    const remove = (prev: SavedCityMeta[]) => prev.filter((c) => c.id !== cityId);
    setSavedCities(remove);
    updateIsoCitySavedCities(remove).catch((e) => {
      console.error('Failed to update saved cities index:', e);
    });
  }, []);

  // Rename a saved city
  const renameSavedCity = useCallback((cityId: string, newName: string) => {
    // Load the city state, update the name, and save it back
    trackPendingSave((async () => {
      const cityState = await loadCityState(cityId);
      if (cityState) {
        cityState.cityName = newName;
        await saveCityState(cityId, cityState);
      }
    })()).catch((e) => {
      console.error('Failed to rename saved city:', e);
    });

    // Update the index
    const rename = (prev: SavedCityMeta[]) =>
      prev.map((c) => (c.id === cityId ? { ...c, cityName: newName } : c));
    setSavedCities(rename);
    updateIsoCitySavedCities(rename).catch((e) => {
      console.error('Failed to update saved cities index:', e);
    });

    // If the current game is the one being renamed, update its state too
    if (state.id === cityId) {
      setState((prev) => ({ ...prev, cityName: newName }));
    }
  }, [state.id]);

  const value: GameContextValue = {
    state,
    latestStateRef,
    gridBufferRef,
    setTool,
    setSpeed,
    setTaxRate,
    setActivePanel,
    setBudgetFunding,
    placeAtTile,
    upgradeServiceBuilding: upgradeServiceBuildingHandler,
    setPlaceCallback,
    finishTrackDrag,
    setBridgeCallback,
    connectToCity,
    discoverCity,
    checkAndDiscoverCities,
    setDisastersEnabled,
    newGame,
    loadState,
    exportState,
    generateRandomCity,
    expandCity,
    shrinkCity,
    hasExistingGame,
    isStateReady,
    isSaving,
    addMoney,
    addNotification,
    addForecast,
    setPauseOnCrisis,
    markLandmarksSeen,
    pendingLandmarkBulldoze,
    resolveLandmarkBulldoze,
    // Sprite pack management
    currentSpritePack,
    availableSpritePacks: SPRITE_PACKS,
    setSpritePack,
    // Day/night mode override
    dayNightMode,
    setDayNightMode,
    visualHour,
    // Save/restore city for shared links
    saveCurrentCityForRestore,
    restoreSavedCity,
    getSavedCityInfo,
    clearSavedCity,
    // Multi-city save system
    savedCities,
    saveCity,
    loadSavedCity,
    deleteSavedCity,
    renameSavedCity,
    saveError,
    dismissSaveError,
  };

  // The city loads from IndexedDB asynchronously; render the game only once
  // it is ready so the player never sees a placeholder city flash first.
  return (
    <GameContext.Provider value={value}>
      {isStateReady ? children : (
        <div className="h-screen w-screen flex items-center justify-center bg-slate-950 text-white/60">
          <T>Loading city...</T>
        </div>
      )}
      {saveError && (
        <SaveErrorToast
          onOpenSettings={() => {
            setSaveError(null);
            setActivePanel('settings');
          }}
          onDismiss={dismissSaveError}
        />
      )}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return ctx;
}
