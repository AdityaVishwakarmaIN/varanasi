// CHANGE SUMMARY: Added UI preferences persistence for desktop overlay/minimap visibility with safe JSON load/save defaults.
// Earlier state: only existing city/localization storage keys existed; overlay/minimap visibility had no persistent settings.
//
// S1-T9: city saves (the autosave, `isocity-city-*` and the saved-cities
// index) live in IndexedDB (`varanasi` db, `saves` store) instead of
// localStorage. The key names are unchanged. Small UI preferences stay in
// localStorage because they are read synchronously at start. Every save API
// below is async; old localStorage saves are migrated on first use.

'use client';

import { decompressFromUTF16 } from 'lz-string';
import type { GameState, SavedCityMeta } from '@/types/game';
import { getSavesStore } from '@/lib/storage/idbStore';
import {
  createSerialQueue,
  migrateLegacySaves,
  safeWrite,
  type LegacyStorage,
  type MigrationResult,
} from '@/lib/storage/saveStore';

export const ISOCITY_STORAGE_KEY = 'isocity-game-state';
export const ISOCITY_SAVED_CITY_STORAGE_KEY = 'isocity-saved-city';
export const ISOCITY_SAVED_CITIES_INDEX_KEY = 'isocity-saved-cities-index';
export const ISOCITY_SAVED_CITY_PREFIX = 'isocity-city-';
export const ISOCITY_SPRITE_PACK_STORAGE_KEY = 'isocity-sprite-pack';
export const ISOCITY_DAY_NIGHT_MODE_STORAGE_KEY = 'isocity-day-night-mode';
export const ISOCITY_UI_PREFERENCES_STORAGE_KEY = 'isocity-ui-preferences';
export const COASTER_STORAGE_PREFIX = 'coaster-';

const APP_STORAGE_PREFIXES = ['isocity-', COASTER_STORAGE_PREFIX] as const;

export interface IsocityUiPreferences {
  showOverlayPanel: boolean;
  showMinimap: boolean;
}

const DEFAULT_UI_PREFERENCES: IsocityUiPreferences = {
  showOverlayPanel: true,
  showMinimap: true,
};

function parseStoredGameState(saved: string): GameState | null {
  try {
    let jsonString = decompressFromUTF16(saved);

    if (!jsonString || !jsonString.startsWith('{')) {
      if (saved.startsWith('{')) {
        jsonString = saved;
      } else {
        return null;
      }
    }

    const parsed = JSON.parse(jsonString);
    if (parsed?.grid && parsed?.gridSize && parsed?.stats) {
      return parsed as GameState;
    }
  } catch {
    return null;
  }

  return null;
}

export function loadIsocityUiPreferences(): IsocityUiPreferences {
  if (typeof window === 'undefined') {
    return DEFAULT_UI_PREFERENCES;
  }

  const saved = localStorage.getItem(ISOCITY_UI_PREFERENCES_STORAGE_KEY);
  if (!saved) {
    return DEFAULT_UI_PREFERENCES;
  }

  try {
    const parsed = JSON.parse(saved);
    return {
      showOverlayPanel: typeof parsed?.showOverlayPanel === 'boolean' ? parsed.showOverlayPanel : DEFAULT_UI_PREFERENCES.showOverlayPanel,
      showMinimap: typeof parsed?.showMinimap === 'boolean' ? parsed.showMinimap : DEFAULT_UI_PREFERENCES.showMinimap,
    };
  } catch {
    return DEFAULT_UI_PREFERENCES;
  }
}

export function saveIsocityUiPreferences(preferences: IsocityUiPreferences): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(
      ISOCITY_UI_PREFERENCES_STORAGE_KEY,
      JSON.stringify(preferences),
    );
  } catch {}
}

// ---------------------------------------------------------------------------
// City saves (IndexedDB)
// ---------------------------------------------------------------------------

/** True for keys that hold city saves (moved to IndexedDB). */
export function isIsoCitySaveKey(key: string): boolean {
  return (
    key === ISOCITY_STORAGE_KEY ||
    key === ISOCITY_SAVED_CITIES_INDEX_KEY ||
    key.startsWith(ISOCITY_SAVED_CITY_PREFIX)
  );
}

// All writes (and reads, so they see earlier writes) run one at a time.
const saveQueue = createSerialQueue();
// Saves that were started but may not be queued yet (for example still being
// compressed in the worker). `flushPendingSaves` waits for these too.
const pendingSaves = new Set<Promise<unknown>>();
let migrationPromise: Promise<MigrationResult> | null = null;

function getLegacyStorage(): LegacyStorage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readLegacy(key: string): string | null {
  try {
    return getLegacyStorage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function removeLegacy(key: string): void {
  try {
    getLegacyStorage()?.removeItem(key);
  } catch {}
}

/**
 * Migrate old localStorage saves into IndexedDB once per page load. Safe to
 * call many times; every save function below awaits it first.
 */
export function ensureIsoCitySavesMigrated(): Promise<MigrationResult> {
  if (!migrationPromise) {
    const legacy = getLegacyStorage();
    migrationPromise = legacy
      ? migrateLegacySaves(getSavesStore(), legacy, isIsoCitySaveKey)
      : Promise.resolve({ status: 'none' });
  }
  return migrationPromise;
}

/**
 * Read a save key. Falls back to a legacy localStorage copy if IndexedDB does
 * not have it (a failed migration keeps the old keys, so the player still
 * gets their city back).
 */
function readSaveKey(key: string): Promise<string | null> {
  return saveQueue.run(async () => {
    await ensureIsoCitySavesMigrated();
    try {
      const value = await getSavesStore().get(key);
      if (value !== undefined) return value;
    } catch (error) {
      console.error(`Failed to read "${key}" from IndexedDB:`, error);
    }
    return readLegacy(key);
  });
}

function writeSaveKey(key: string, value: string): Promise<void> {
  return trackPendingSave(saveQueue.run(async () => {
    await ensureIsoCitySavesMigrated();
    await safeWrite(getSavesStore(), key, value);
  }));
}

function deleteSaveKey(key: string): Promise<void> {
  return trackPendingSave(saveQueue.run(async () => {
    await ensureIsoCitySavesMigrated();
    await getSavesStore().del(key);
    // A failed migration leaves the old copy behind; delete it too so the
    // deleted save does not come back through the fallback read.
    removeLegacy(key);
  }));
}

/** Register a save in progress so `flushPendingSaves` waits for it. */
export function trackPendingSave<T>(promise: Promise<T>): Promise<T> {
  pendingSaves.add(promise);
  const remove = () => {
    pendingSaves.delete(promise);
  };
  promise.then(remove, remove);
  return promise;
}

/** Resolves once every save started so far has finished (or failed). */
export async function flushPendingSaves(): Promise<void> {
  await Promise.allSettled(Array.from(pendingSaves));
  await saveQueue.idle();
}

/** The compressed autosave string, or null if there is none. */
export function readIsoCityAutosaveRaw(): Promise<string | null> {
  return readSaveKey(ISOCITY_STORAGE_KEY);
}

/** Write the compressed autosave (safe write: temp key, then atomic swap). Rejects on failure. */
export function writeIsoCityAutosaveRaw(compressed: string): Promise<void> {
  return writeSaveKey(ISOCITY_STORAGE_KEY, compressed);
}

export function clearIsoCityAutosave(): Promise<void> {
  return deleteSaveKey(ISOCITY_STORAGE_KEY);
}

/** True if a valid autosave exists (used for the "Continue" button). */
export async function hasIsoCityAutosave(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const saved = await readIsoCityAutosaveRaw();
  if (!saved) return false;
  return parseStoredGameState(saved) !== null;
}

export function readIsoCitySavedCityRaw(cityId: string): Promise<string | null> {
  return readSaveKey(ISOCITY_SAVED_CITY_PREFIX + cityId);
}

/** Write a named city save (safe write). Rejects on failure. */
export function writeIsoCitySavedCityRaw(cityId: string, compressed: string): Promise<void> {
  return writeSaveKey(ISOCITY_SAVED_CITY_PREFIX + cityId, compressed);
}

export function deleteIsoCitySavedCityData(cityId: string): Promise<void> {
  return deleteSaveKey(ISOCITY_SAVED_CITY_PREFIX + cityId);
}

/** Copy a named city save into the autosave slot so GameProvider loads it. */
export async function copyIsoCitySavedCityToAutosave(cityId: string): Promise<boolean> {
  const saved = await readIsoCitySavedCityRaw(cityId);
  if (!saved) return false;
  await writeIsoCityAutosaveRaw(saved);
  return true;
}

function parseSavedCitiesIndex(saved: string | null | undefined): SavedCityMeta[] {
  if (!saved) return [];
  try {
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed as SavedCityMeta[] : [];
  } catch {
    return [];
  }
}

export async function loadIsoCitySavedCities(): Promise<SavedCityMeta[]> {
  if (typeof window === 'undefined') return [];
  try {
    return parseSavedCitiesIndex(await readSaveKey(ISOCITY_SAVED_CITIES_INDEX_KEY));
  } catch {
    return [];
  }
}

/**
 * Read-modify-write the saved-cities index as one queued step, so concurrent
 * updates (game, co-op sync, home page) never overwrite each other.
 * Resolves with the new list. Rejects if the write fails.
 */
export function updateIsoCitySavedCities(
  update: (cities: SavedCityMeta[]) => SavedCityMeta[],
): Promise<SavedCityMeta[]> {
  return trackPendingSave(saveQueue.run(async () => {
    await ensureIsoCitySavesMigrated();
    const store = getSavesStore();
    let current: string | null | undefined;
    try {
      current = await store.get(ISOCITY_SAVED_CITIES_INDEX_KEY);
    } catch {
      current = undefined;
    }
    if (current === undefined) current = readLegacy(ISOCITY_SAVED_CITIES_INDEX_KEY);
    const next = update(parseSavedCitiesIndex(current));
    await safeWrite(store, ISOCITY_SAVED_CITIES_INDEX_KEY, JSON.stringify(next));
    return next;
  }));
}

/**
 * "Start fresh": remove every city save (IndexedDB) and the app's other
 * localStorage/sessionStorage keys, except the UI preferences.
 */
export async function clearIsoCityStoredGameData(): Promise<void> {
  if (typeof window === 'undefined') return;

  const clearMatchingKeys = (storage: Storage) => {
    const keysToRemove: string[] = [];

    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (!key) continue;
      if (key === ISOCITY_UI_PREFERENCES_STORAGE_KEY) continue;

      if (APP_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix))) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((key) => {
      storage.removeItem(key);
    });
  };

  try {
    clearMatchingKeys(localStorage);
    clearMatchingKeys(sessionStorage);
  } catch (error) {
    console.error('Failed to clear local game data:', error);
  }

  await flushPendingSaves();
  await saveQueue.run(async () => {
    await ensureIsoCitySavesMigrated();
    const store = getSavesStore();
    try {
      const keys = await store.keys();
      await store.batch(keys.map((key) => ({ type: 'del' as const, key })));
    } catch (error) {
      console.error('Failed to clear saved cities from IndexedDB:', error);
    }
  });
}
