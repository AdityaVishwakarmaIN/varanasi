// Consolidated GameContext for the SimCity-like game
'use client';

import React, { createContext, useCallback, useContext, useEffect, useState, useRef } from 'react';
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
import { isToolAvailable } from '@/games/isocity/maps/varanasiCatalog';
import { formatINR } from '@/lib/format';
import {
  SPRITE_PACKS,
  DEFAULT_SPRITE_PACK_ID,
  getSpritePack,
  setActiveSpritePack,
  SpritePack,
} from '@/lib/renderConfig';
import {
  ISOCITY_DAY_NIGHT_MODE_STORAGE_KEY,
  ISOCITY_SPRITE_PACK_STORAGE_KEY,
  clearIsoCityAutosave,
  deleteIsoCitySavedCityData,
  flushPendingSaves,
  loadIsoCitySavedCities,
  backupIsoCityToSavedCities,
  readIsoCityAutosaveRaw,
  readIsoCityMonthlyBackupsRaw,
  readIsoCitySavedCityRaw,
  rotateIsoCityMonthlyBackups,
  trackPendingSave,
  updateIsoCitySavedCities,
  writeIsoCityAutosaveRaw,
  writeIsoCityCorruptAutosaveRaw,
  writeIsoCitySavedCityRaw,
} from '@/lib/isocityStorage';
import { migrateAndValidateState } from '@/lib/saveMigration';
import { AUTOSAVE_CONFIG } from '@/lib/storage/saveConfig';
import { SaveErrorToast } from '@/components/game/SaveErrorToast';
import { UndoToast, type UndoToastInfo } from '@/components/game/UndoToast';
import { applyUndo, createUndoEntry, pushUndoEntry, type UndoEntry } from '@/lib/undo';
import {
  copyLegacyGridToBuffer,
  createIsoCityGridBufferFromGrid,
  setIsoCityGridVersions,
  type IsoCityGridBuffer,
} from '@/games/isocity/gridBuffer';
import { isMobile } from 'react-device-detect';
import { createNewGameState, type NewGameOptions } from '@/lib/newGame';
import { acceptEmergencyLoan as acceptLoan, declineEmergencyLoan as declineLoan } from '@/lib/failure';
import { playSfx } from '@/lib/audio';
import { sfxForTool } from '@/lib/audio/audioConfig';
import { clampEffectiveTaxRate, clampTaxRate } from '@/lib/tax';
import {
  addForecast as addForecastToState,
  pushNotifications,
  shouldPauseForCrisis,
  type ForecastInput,
  type NotificationExtras,
} from '@/lib/notifications';

// Map size for new games. The UI layer decides desktop vs phone; simulation.ts stays device-agnostic.
const DEFAULT_GRID_SIZE = getDefaultGridSize(isMobile);
/** Largest single addMoney grant (either sign): ₹100 crore. */
const MAX_MONEY_GRANT = 1_000_000_000;

export type DayNightMode = 'auto' | 'day' | 'night';
/** Outcome of one placeAtTile call. */
export type PlaceResult = 'placed' | 'unchanged' | 'noMoney';


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
  /** Speed to return to when the player resumes (the last non-zero speed the player chose). */
  lastRunSpeed: 1 | 2 | 3;
  /** Why the city is paused when the game paused itself (e.g. a crisis); null for a player pause or while running. */
  pauseReason: string | null;
  /** Resume at the last running speed. */
  resumeGame: () => void;
  /** "Exit Without Saving": drop changes since the last save by skipping every further autosave. */
  discardUnsavedChanges: () => void;
  setTaxRate: (rate: number) => void;
  setActivePanel: (panel: GameState['activePanel']) => void;
  setBudgetFunding: (key: keyof Budget, funding: number) => void;
  upgradeServiceBuilding: (x: number, y: number) => boolean; // Returns true if upgrade succeeded
  /** 'noMoney': the placement was valid but the city could not pay for it. */
  placeAtTile: (x: number, y: number, isRemote?: boolean) => PlaceResult;
  /** Undoes the last build / bulldoze (up to 10 deep). Returns false when there is nothing to undo. */
  undoLast: () => boolean;
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
  /** Emergency loan dialog buttons (S4-T11). */
  acceptEmergencyLoan: () => void;
  declineEmergencyLoan: () => void;
  /** Loads the oldest of the rolling monthly autosave copies of this city (S4-T11). Resolves false if there is none. */
  loadLastAutosave: () => Promise<boolean>;
  /** How many months back the copy `loadLastAutosave` would load is (0 = none). */
  getLastAutosaveMonthsBack: () => Promise<number>;
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

/** A loaded city never starts faster than Normal (a save made on Very Fast must not jump ahead); a paused save stays paused. */
function withCalmSpeed<T extends { speed: 0 | 1 | 2 | 3 }>(state: T): T {
  return state.speed > 1 ? { ...state, speed: 1 } : state;
}

// A freshly loaded/new city starts on the Select tool so the first drag pans
// the map instead of painting whatever tool was active when it was saved.
function withSelectTool<T extends { selectedTool: Tool }>(state: T): T {
  return state.selectedTool === 'select' ? state : { ...state, selectedTool: 'select' };
}

// Load the autosave from IndexedDB (S1-T9)
// Supports both compressed (lz-string) and uncompressed (legacy) formats.
// Decompression + JSON.parse run in the save worker; `migrateAndValidateState` checks and migrates it.
type AutosaveLoadResult =
  | { status: 'none' }
  | { status: 'ok'; state: GameState }
  /** The autosave exists but could not be loaded; `raw` is the stored blob to keep (null if it could not even be read). */
  | { status: 'corrupt'; raw: string | null };

async function loadGameState(): Promise<AutosaveLoadResult> {
  if (typeof window === 'undefined') return { status: 'none' };
  let saved: string | null;
  try {
    // Make sure a save started just before (e.g. when leaving the game) has landed.
    await flushPendingSaves();
    saved = await readIsoCityAutosaveRaw();
  } catch (e) {
    console.error('Failed to read the autosave:', e);
    return { status: 'corrupt', raw: null };
  }
  if (!saved) return { status: 'none' };
  try {
    const state = migrateAndValidateState(await decompressAndParseAsync<unknown>(saved));
    if (state) return { status: 'ok', state };
    console.error('Saved game state is corrupt or missing required fields');
  } catch (e) {
    console.error('Failed to load game state:', e);
  }
  return { status: 'corrupt', raw: saved };
}

export const LOAD_FAILED_MESSAGE = 'Could not load your city — a copy was kept';

/** Tell the player the autosave could not be loaded (E3). */
function withLoadFailedNotification(state: GameState): GameState {
  return {
    ...state,
    notifications: [
      {
        id: `load-failed-${Date.now()}`,
        title: LOAD_FAILED_MESSAGE,
        description: 'Your saved city could not be opened, so a new city was started. The old save was kept, not overwritten.',
        icon: 'alert',
        timestamp: Date.now(),
      },
      ...(state.notifications ?? []).slice(0, 9),
    ],
  };
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
      const state = migrateAndValidateState(await decompressAndParseAsync<unknown>(saved), { fallbackId: cityId });
      if (!state) console.error('Corrupted city save data for:', cityId);
      return state;
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
  const [state, setState] = useState<GameState>(() => createInitialGameState(DEFAULT_GRID_SIZE, 'Varanasi'));
  // Read once at load time; later prop changes must not restart the city.
  const newGameOptionsRef = useRef(newGameOptions);
  
  const [hasExistingGame, setHasExistingGame] = useState(false);
  const [isStateReady, setIsStateReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextSaveRef = useRef(false);
  /** Set when the autosave on disk could not be loaded and no copy of it was kept: autosaving would destroy it. */
  const autosaveBlockedRef = useRef(false);
  // Set by "Exit Without Saving": no autosave may write after this (interval, tab hide or unmount)
  const discardChangesRef = useRef(false);
  // Last speed the player chose, and whether the player (not a crisis) paused
  const [lastRunSpeed, setLastRunSpeed] = useState<1 | 2 | 3>(1);
  const [pausedByPlayer, setPausedByPlayer] = useState(false);
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
  // Undo ring (last 10 build / bulldoze actions): changed tiles only, see lib/undo.ts
  const undoStackRef = useRef<UndoEntry[]>([]);
  const undoSeqRef = useRef(0);
  /** The state an action was recorded from: a re-run of the same updater (Strict Mode) records once. */
  const undoRecordedFromRef = useRef<GameState | null>(null);
  const shownUndoSeqRef = useRef(0);
  const [undoToast, setUndoToast] = useState<(UndoToastInfo & { cityKey: string }) | null>(null);
  const [pendingLandmarkBulldoze, setPendingLandmarkBulldoze] = useState<{ x: number; y: number; id: LandmarkId } | null>(null);
  const gridBufferRef = useRef<IsoCityGridBuffer | null>(null);

  // The state React last committed: lets the tick's UI sync see a newer player action.
  const committedStateRef = useRef(state);
  // States pushed to React from latestStateRef (by `commit` or the tick's UI sync). The ref already holds
  // them or something newer, so the sync effect below must not rewind the ref to them.
  const pushedStatesRef = useRef(new WeakSet<GameState>());

  /**
   * The single way player actions change the city: apply `updater` to the newest simulation state
   * (latestStateRef, which the ticks advance between 500 ms UI syncs), store it in the ref, then hand
   * it to React. Building on React's `prev` instead would drop the ticks since the last sync.
   */
  const commit = useCallback((updater: (s: GameState) => GameState): GameState => {
    const prev = latestStateRef.current;
    const next = updater(prev);
    if (next === prev) return prev;
    latestStateRef.current = next;
    stateChangedRef.current = true;
    pushedStatesRef.current.add(next);
    setState(next);
    return next;
  }, []);

  useEffect(() => {
    // Only states that did not come from the ref (loads, setters not routed through commit) replace it
    if (!pushedStatesRef.current.has(state)) latestStateRef.current = state;
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

    /** Copy an autosave that failed to load to its own key; if that is impossible, block autosaves. */
    const keepCorruptAutosave = async (raw: string | null) => {
      if (raw === null) {
        autosaveBlockedRef.current = true;
        return;
      }
      try {
        const key = await writeIsoCityCorruptAutosaveRaw(raw);
        console.error(`The autosave could not be loaded; a copy was kept as "${key}"`);
      } catch (e) {
        console.error('Failed to keep a copy of the corrupt autosave:', e);
        autosaveBlockedRef.current = true;
      }
    };

    // City saves are in IndexedDB, which is async (the first call also
    // migrates old localStorage saves). Children render once this is done.
    const loadSaves = async () => {
      // Load saved cities index
      const cities = await loadIsoCitySavedCities();
      if (cancelled) return;
      setSavedCities(cities);

      // Load game state (unless startFresh is true - used for co-op to start with a new city)
      const loaded: AutosaveLoadResult = startFresh ? { status: 'none' } : await loadGameState();
      if (cancelled) return;
      if (loaded.status === 'ok') {
        skipNextSaveRef.current = true; // Set skip flag BEFORE updating state
        // Point the simulation loop at the loaded city right away
        const calmSaved = withSelectTool(withCalmSpeed(loaded.state));
        latestStateRef.current = calmSaved;
        setState(calmSaved);
        setHasExistingGame(true);
        return;
      }
      if (loaded.status === 'corrupt') {
        // Never autosave over a city we could not load: keep a copy first, and if even that fails,
        // stop autosaving until the player starts or loads a city themselves.
        await keepCorruptAutosave(loaded.raw);
        if (cancelled) return;
      }
      // No save (or a fresh start): create the chosen map (default: Varanasi)
      const fresh = createNewGameState(newGameOptionsRef.current, isMobile);
      const next = loaded.status === 'corrupt' ? withLoadFailedNotification(fresh) : fresh;
      latestStateRef.current = next;
      setState(next);
      setHasExistingGame(false);
    };

    loadSaves()
      .catch((e) => {
        console.error('Failed to load saves:', e);
        // Whatever is on disk was not loaded: do not let the placeholder city autosave over it
        autosaveBlockedRef.current = true;
        if (!cancelled) setState((prev) => withLoadFailedNotification(prev));
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
      // Wait for the initial load; never overwrite an autosave that failed to load and was not copied
      if (!hasLoadedRef.current || autosaveBlockedRef.current) {
        return;
      }

      // "Exit Without Saving": leave the last save as it is
      if (discardChangesRef.current) {
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
      const prevMonth = latestStateRef.current.month;
      const newState = simulateTick(latestStateRef.current);
      recordTick(performance.now() - now);
      latestStateRef.current = newState;
      stateChangedRef.current = true;
      // Three rolling autosave copies, rotated once per in-game month, never of a finished city (S4-T11)
      if (newState.month !== prevMonth && !newState.gameOver && !isBenchmarkState(newState)) {
        trackPendingSave(
          serializeAndCompressInSlicesAsync(optimizeStateForSave(newState), { onSlice: recordSave }).then(rotateIsoCityMonthlyBackups)
        ).catch((e) => console.error('Failed to save the monthly autosave copy:', e));
      }

      // PERF: Only sync to React every 500ms to avoid expensive reconciliation
      // Canvas reads from latestStateRef so it sees updates immediately
      // React state is only needed for UI elements (stats, budget display)
      // A crisis auto-pause (S4-T4) syncs right away so the speed controls and the loop stop together.
      const pausedByTick = newState.speed !== prevSpeed;
      if (pausedByTick || now - lastUiSyncRef.current >= GAME_LOOP_CONFIG.uiSyncIntervalMs) {
        lastUiSyncRef.current = now;
        // A player action queued since the last commit wins over this sync; its commit
        // re-points latestStateRef at the action's state and the next sync carries on.
        pushedStatesRef.current.add(newState);
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
    commit((prev) => (isToolAvailable(tool, prev.mapId) ? { ...prev, selectedTool: tool, activePanel: 'none' } : prev));
  }, [commit]);

  const setSpeed = useCallback((speed: 0 | 1 | 2 | 3) => {
    if (speed !== 0) setLastRunSpeed(speed);
    setPausedByPlayer(speed === 0);
    commit((prev) => (prev.gameOver ? prev : { ...prev, speed }));
  }, [commit]);

  const resumeGame = useCallback(() => setSpeed(lastRunSpeed), [setSpeed, lastRunSpeed]);

  const discardUnsavedChanges = useCallback(() => {
    discardChangesRef.current = true;
    stateChangedRef.current = false;
  }, []);

  // A crisis (not the player) paused the city: name it, so the pause is never a mystery
  const pauseReason = state.speed === 0 && !pausedByPlayer
    ? (state.notifications.find((n) => n.severity === 'crisis')?.title ?? null)
    : null;

  const setTaxRate = useCallback((rate: number) => {
    commit((prev) => ({ ...prev, taxRate: clampTaxRate(rate) }));
  }, [commit]);

  const setActivePanel = useCallback(
    (panel: GameState['activePanel']) => {
      commit((prev) => ({ ...prev, activePanel: panel }));
    },
    [commit],
  );

  const setBudgetFunding = useCallback(
    (key: keyof Budget, funding: number) => {
      const clamped = clamp(funding, 0, 100);
      commit((prev) => ({
        ...prev,
        budget: {
          ...prev.budget,
          [key]: { ...prev.budget[key], funding: clamped },
        },
      }));
    },
    [commit],
  );

  /** Called from state updaters: must stay idempotent for the same `prev` (React may run an updater twice). */
  const rememberForUndo = useCallback((prev: GameState, next: GameState, tool: Tool = prev.selectedTool) => {
    if (undoRecordedFromRef.current === prev) return;
    undoRecordedFromRef.current = prev;
    const entry = createUndoEntry(prev, next, tool, Date.now());
    if (entry) undoStackRef.current = pushUndoEntry(undoStackRef.current, entry, ++undoSeqRef.current);
  }, []);

  const placeAtTile = useCallback((x: number, y: number, isRemote = false): PlaceResult => {
    // For multiplayer broadcast, we need to capture the tool synchronously
    // before React batches the setState. We read from the latest state ref.
    const currentTool = latestStateRef.current.selectedTool;
    // Map-hidden tools (e.g. subway, terraform on Varanasi) can never be used, even if selected somehow.
    if (!isToolAvailable(currentTool, latestStateRef.current.mapId)) return 'unchanged';

    // S5-T1: bulldozing a landmark asks first (a remote bulldoze was already confirmed by that player)
    if (!isRemote && currentTool === 'bulldoze') {
      const s = latestStateRef.current;
      const origin = findBuildingOrigin(s.grid, x, y, s.gridSize);
      if (origin && isLandmarkType(origin.buildingType)) {
        const id = origin.buildingType;
        setPendingLandmarkBulldoze((p) => p ?? { x, y, id });
        return 'unchanged';
      }
    }

    let result: PlaceResult = 'unchanged';
    const applyPlacement = (prev: GameState): GameState => {
      const tool = prev.selectedTool;
      if (tool === 'select') return prev;

      const info = TOOL_INFO[tool];
      const cost = info?.cost ?? 0;
      const tile = prev.grid[y]?.[x];

      if (!tile) return prev;

      // Prevent wasted spend if nothing would change
      if (tool === 'bulldoze' && tile.building.type === 'grass' && tile.zone === 'none') {
        return prev;
      }

      const building = toolBuildingMap[tool];
      const zone = toolZoneMap[tool];

      if (zone && tile.zone === zone) return prev;
      if (building && tile.building.type === building) return prev;

      // The simulation functions hold the placement rules and return `prev` when refused
      let nextState: GameState;
      if (tool === 'subway') nextState = placeSubway(prev, x, y);
      else if (tool === 'zone_water') nextState = placeWaterTerraform(prev, x, y);
      else if (tool === 'zone_land') nextState = placeLandTerraform(prev, x, y);
      else if (tool === 'bulldoze') nextState = bulldozeTile(prev, x, y);
      else if (zone) nextState = placeBuilding(prev, x, y, null, zone);
      else if (building) nextState = placeBuilding(prev, x, y, building, null);
      else return prev;

      if (nextState === prev) return prev;
      // Money is checked after validity so the caller can tell "can't afford" from "can't build here"
      if (cost > 0 && prev.stats.money < cost) {
        result = 'noMoney';
        return prev;
      }
      if (cost > 0) {
        nextState = {
          ...nextState,
          stats: { ...nextState.stats, money: nextState.stats.money - cost },
        };
      }

      return recalculateDerivedState(nextState);
    };

    // Multiplayer actions are broadcast tile by tile, so only a solo city can be undone.
    const recordUndo = !isRemote && !placeCallbackRef.current;
    const before = latestStateRef.current;
    const after = commit((prev) => {
      const next = applyPlacement(prev);
      if (recordUndo && next !== prev) rememberForUndo(prev, next);
      return next;
    });
    if (after !== before) result = 'placed';

    // S5-T9: sound for a local build/road/bulldoze that actually changed the tile.
    const sfx = isRemote ? null : sfxForTool(currentTool);
    if (sfx && after.grid[y]?.[x] !== before.grid[y]?.[x]) playSfx(sfx);

    // Broadcast to multiplayer if this is a local action (not remote)
    // We use the tool captured before setState since React 18 batches async
    if (!isRemote && currentTool !== 'select' && placeCallbackRef.current) {
      placeCallbackRef.current({ x, y, tool: currentTool });
    }
    return result;
  }, [commit, rememberForUndo]);

  const upgradeServiceBuildingHandler = useCallback((x: number, y: number) => {
    let upgradeSucceeded = false;
    commit((prev) => {
      const upgradedState = upgradeServiceBuilding(prev, x, y);
      if (upgradedState) {
        upgradeSucceeded = true;
        return recalculateDerivedState(upgradedState);
      }
      return prev;
    });
    return upgradeSucceeded;
  }, [commit]);

  // Called after a road/rail drag operation to create bridges for water crossings
  const finishTrackDrag = useCallback((pathTiles: { x: number; y: number }[], trackType: 'road' | 'rail', isRemote = false) => {
    commit((prev) => {
      const bridged = createBridgesOnPath(prev, pathTiles, trackType);
      if (bridged === prev) return prev;
      // Bridges built by a drag join that drag's undo entry
      if (!isRemote && !placeCallbackRef.current) rememberForUndo(prev, bridged, trackType);
      return recalculateDerivedState(bridged);
    });

    // Broadcast to multiplayer if this is a local action (not remote)
    if (!isRemote && bridgeCallbackRef.current) {
      bridgeCallbackRef.current({ pathTiles, trackType });
    }
  }, [commit, rememberForUndo]);

  const undoLast = useCallback((): boolean => {
    const entry = undoStackRef.current[undoStackRef.current.length - 1];
    if (!entry) return false;
    undoStackRef.current = undoStackRef.current.slice(0, -1);
    commit((prev) => recalculateDerivedState(applyUndo(prev, entry)));
    setUndoToast(null);
    return true;
  }, [commit]);

  // A new game or a loaded city starts with an empty history
  const cityKey = `${state.id}:${state.gameVersion ?? 0}`;
  useEffect(() => {
    undoStackRef.current = [];
  }, [cityKey]);

  // Show the "Built X - Undo" toast for the newest history entry (a drag keeps updating one entry)
  useEffect(() => {
    const top = undoStackRef.current[undoStackRef.current.length - 1];
    if (!top || top.seq === shownUndoSeqRef.current) return;
    shownUndoSeqRef.current = top.seq;
    setUndoToast({
      seq: top.seq,
      cityKey,
      kind: top.kind,
      subject: top.subject,
      count: top.count,
      mapId: state.mapId,
      lostValue: top.lostValue,
      refund: top.spent,
    });
  }, [state, cityKey]);

  const connectToCity = useCallback((cityId: string) => {
    commit((prev) => {
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
            description: `Trade route established with ${city.name}. +${formatINR(tradeBonus)} bonus and +${formatINR(tradeIncome)}/month income.`,
            icon: 'road',
            timestamp: Date.now(),
          },
          ...prev.notifications.slice(0, 9), // Keep only 10 most recent
        ],
      };
    });
  }, [commit]);

  const discoverCity = useCallback((cityId: string) => {
    commit((prev) => {
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
  }, [commit]);

  // Check for cities that should be discovered based on roads reaching edges
  // Calls onDiscover callback with city info if a new city was discovered
  const checkAndDiscoverCities = useCallback((onDiscover?: (city: { id: string; direction: 'north' | 'south' | 'east' | 'west'; name: string }) => void): void => {
    commit((prev) => {
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
  }, [commit]);

  const setDisastersEnabled = useCallback((enabled: boolean) => {
    commit((prev) => ({ ...prev, disastersEnabled: enabled }));
  }, [commit]);

  const setPauseOnCrisis = useCallback((enabled: boolean) => {
    commit((prev) => ({ ...prev, pauseOnCrisis: enabled }));
  }, [commit]);

  const acceptEmergencyLoan = useCallback(() => {
    commit((prev) => {
      if (prev.failure?.loanStatus !== 'offered') return prev;
      const { next, amount } = acceptLoan(prev.failure);
      return { ...prev, failure: next, stats: { ...prev.stats, money: prev.stats.money + amount } };
    });
  }, [commit]);

  const declineEmergencyLoan = useCallback(() => {
    commit((prev) => (prev.failure?.loanStatus === 'offered' ? { ...prev, failure: declineLoan(prev.failure) } : prev));
  }, [commit]);
  const markLandmarksSeen = useCallback(() => {
    commit((prev) => {
      const seen = getUnlockedLandmarks(getPeakDisplayedPopulation(prev)).length;
      return (prev.landmarksSeen ?? 0) >= seen ? prev : { ...prev, landmarksSeen: seen };
    });
  }, [commit]);

  const resolveLandmarkBulldoze = useCallback((confirmed: boolean) => {
    const pending = pendingLandmarkBulldoze;
    setPendingLandmarkBulldoze(null);
    if (!confirmed || !pending) return;
    const cost = TOOL_INFO.bulldoze.cost;
    commit((prev) => {
      if (prev.stats.money < cost) return prev;
      const next = bulldozeTile(prev, pending.x, pending.y);
      if (next === prev) return prev;
      // No refund for a landmark: only the normal bulldoze cost is paid
      return recalculateDerivedState({ ...next, stats: { ...next.stats, money: next.stats.money - cost } });
    });
    placeCallbackRef.current?.({ x: pending.x, y: pending.y, tool: 'bulldoze' });
  }, [pendingLandmarkBulldoze, commit]);

  
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
      ...withSelectTool(next),
      gameVersion: (prev.gameVersion ?? 0) + 1,
      structureVersion: (versionBase.structureVersion ?? 0) + 1,
      roadNetworkVersion: (versionBase.roadNetworkVersion ?? 0) + 1,
    };
    // The player chose this city, so autosaving it is wanted again (see autosaveBlockedRef)
    autosaveBlockedRef.current = false;
    latestStateRef.current = city;
    setState(city);
  }, []);

  /**
   * Before the live city is replaced by a different one, keep it in the saved-cities list as
   * "<name> (auto-backup)" (see `backupIsoCityToSavedCities`). Captures the state synchronously.
   */
  const backupLiveCity = useCallback((targetCityId?: string): Promise<void> => {
    const current = latestStateRef.current;
    if (!current?.id || !(current.stats?.population > 0) || isBenchmarkState(current)) return Promise.resolve();
    if (targetCityId === current.id) return Promise.resolve();
    return trackPendingSave((async () => {
      const compressed = await serializeAndCompressInSlicesAsync(optimizeStateForSave(current), { onSlice: recordSave });
      const cities = await backupIsoCityToSavedCities(current, compressed, targetCityId);
      if (cities) setSavedCities(cities);
    })()).catch((e) => console.error('Failed to back up the city:', e));
  }, []);

  const newGame = useCallback((options?: NewGameOptions) => {
    void backupLiveCity();
    clearGameState(); // Clear saved state when starting fresh
    replaceCity(createNewGameState(options, isMobile), latestStateRef.current);
  }, [replaceCity, backupLiveCity]);

  /** The oldest of the rolling monthly copies of this city that is not game over, and how many months back it is. */
  const findOldestMonthlyBackup = useCallback(async (): Promise<{ city: GameState; monthsBack: number } | null> => {
    await flushPendingSaves();
    const raws = await readIsoCityMonthlyBackupsRaw();
    for (let i = raws.length - 1; i >= 0; i--) {
      const raw = raws[i];
      const parsed = raw ? migrateAndValidateState(await decompressAndParseAsync<unknown>(raw).catch(() => null)) : null;
      if (parsed && parsed.id === latestStateRef.current.id && !parsed.gameOver) {
        return { city: parsed, monthsBack: i + 1 };
      }
    }
    return null;
  }, []);

  const getLastAutosaveMonthsBack = useCallback(async (): Promise<number> => {
    try {
      return (await findOldestMonthlyBackup())?.monthsBack ?? 0;
    } catch {
      return 0;
    }
  }, [findOldestMonthlyBackup]);

  const loadLastAutosave = useCallback(async (): Promise<boolean> => {
    try {
      const found = await findOldestMonthlyBackup();
      if (!found) return false;
      replaceCity({ ...found.city, speed: 0 }, latestStateRef.current);
      return true;
    } catch (e) {
      console.error('Failed to load the last autosave:', e);
      return false;
    }
  }, [replaceCity, findOldestMonthlyBackup]);

  const loadState = useCallback((stateString: string): boolean => {
    try {
      const migrated = migrateAndValidateState(JSON.parse(stateString));
      if (!migrated) return false;
      const imported = withCalmSpeed(migrated);
      // Keep the city being replaced as a saved-city backup (5b)
      void backupLiveCity(imported.id);
      // Bumps gameVersion to clear vehicles/entities when loading a new state
      replaceCity(imported, imported);
      return true;
    } catch {
      return false;
    }
  }, [replaceCity, backupLiveCity]);

  const exportState = useCallback((): string => {
    return JSON.stringify(latestStateRef.current);
  }, []);

  const generateRandomCity = useCallback(() => {
    clearGameState(); // Clear saved state when generating a new city
    replaceCity(ensureUtilityCapacity(generateRandomAdvancedCity(DEFAULT_GRID_SIZE)), latestStateRef.current);
  }, [replaceCity]);

  // Expand the city grid by 15 tiles on each side (30x30 total increase)
  const expandCity = useCallback(() => {
    // The fixed Varanasi map never changes size (it would break the river layout).
    if (latestStateRef.current.mapId === 'varanasi') return;
    setState((prev) => {
      if (prev.mapId === 'varanasi') return prev;
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
    // The fixed Varanasi map never changes size (it would cut the river layout).
    const current = latestStateRef.current;
    if (current.mapId === 'varanasi') return false;
    // Decide success before setState: an updater may run later (or twice), so a flag set inside it is unreliable.
    const precomputed = shrinkGrid(current.grid, current.gridSize, 15);
    if (!precomputed) return false;
    setState((prev) => {
      const result = prev.grid === current.grid ? precomputed : shrinkGrid(prev.grid, prev.gridSize, 15);

      // If shrink failed (grid too small), return previous state unchanged
      if (!result) {
        return prev;
      }

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
    return true;
  }, []);

  const addMoney = useCallback((amount: number) => {
    // Only finite amounts; one grant is capped so a bad caller cannot corrupt the treasury.
    if (!Number.isFinite(amount)) return;
    amount = clamp(amount, -MAX_MONEY_GRANT, MAX_MONEY_GRANT);
    setState((prev) => ({
      ...prev,
      stats: {
        ...prev.stats,
        money: prev.stats.money + amount,
      },
    }));
  }, []);

  const addNotification = useCallback((title: string, description: string, icon: string, extras?: NotificationExtras) => {
    commit((prev) => {
      const added = [{ id: `note-${Date.now()}-${Math.random()}`, title, description, icon, timestamp: Date.now(), ...extras }];
      return {
        ...prev,
        notifications: pushNotifications(prev.notifications, added),
        // A crisis pauses the city when the player wants that (S4-T4)
        ...(shouldPauseForCrisis(prev, added) ? { speed: 0 as const } : {}),
      };
    });
  }, [commit]);

  const addForecast = useCallback((title: string, description: string, daysAhead: number, icon = '🔮', extras?: Partial<Omit<ForecastInput, 'title' | 'description' | 'daysAhead' | 'icon'>>) => {
    commit((prev) => ({
      ...prev,
      ...addForecastToState(prev, { id: extras?.id ?? `${title}-${daysAhead}`, title, description, daysAhead, icon, ...extras }),
    }));
  }, [commit]);

  // Save current city to the multi-save system
  const saveCity = useCallback(() => {
    // The ref, not React state: it holds the ticks since the last 500 ms UI sync
    const state = latestStateRef.current;
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
  }, [reportSaveResult]);

  // Load a saved city from the multi-save system
  const loadSavedCity = useCallback(async (cityId: string): Promise<boolean> => {
    // loadCityState migrates and validates (and uses cityId when the save has no id)
    const loadedCity = await loadCityState(cityId);
    if (!loadedCity) return false;
    const cityState = withCalmSpeed(loadedCity);

    // Keep the city being replaced as a saved-city backup (5b)
    void backupLiveCity(cityState.id === latestStateRef.current.id ? cityState.id : cityId);

    skipNextSaveRef.current = true;
    replaceCity(cityState, cityState);

    // Also update the current game's autosave
    saveGameState(cityState, reportSaveResult);

    return true;
  }, [reportSaveResult, backupLiveCity, replaceCity]);

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
    lastRunSpeed,
    pauseReason,
    resumeGame,
    discardUnsavedChanges,
    setTaxRate,
    setActivePanel,
    setBudgetFunding,
    placeAtTile,
    undoLast,
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
    acceptEmergencyLoan,
    declineEmergencyLoan,
    loadLastAutosave,
    getLastAutosaveMonthsBack,
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
        <div className="h-screen w-screen flex items-center justify-center bg-slate-950 text-white/90 text-base font-medium">
          <T>Loading city...</T>
        </div>
      )}
      {undoToast && undoToast.cityKey === cityKey && (
        <UndoToast info={undoToast} onUndo={undoLast} onDismiss={() => setUndoToast(null)} />
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
