// CHANGE SUMMARY: Added UI preferences persistence for desktop overlay/minimap visibility with safe JSON load/save defaults.
// Earlier state: only existing city/localization storage keys existed; overlay/minimap visibility had no persistent settings.

'use client';

import { decompressFromUTF16 } from 'lz-string';
import type { GameState, SavedCityMeta } from '@/types/game';

export const ISOCITY_STORAGE_KEY = 'isocity-game-state';
export const ISOCITY_SAVED_CITY_STORAGE_KEY = 'isocity-saved-city';
export const ISOCITY_SAVED_CITIES_INDEX_KEY = 'isocity-saved-cities-index';
export const ISOCITY_SAVED_CITY_PREFIX = 'isocity-city-';
export const ISOCITY_SPRITE_PACK_STORAGE_KEY = 'isocity-sprite-pack';
export const ISOCITY_DAY_NIGHT_MODE_STORAGE_KEY = 'isocity-day-night-mode';
export const ISOCITY_UI_PREFERENCES_STORAGE_KEY = 'isocity-ui-preferences';

const APP_STORAGE_PREFIXES = ['isocity-'] as const;

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

export function hasIsoCityAutosave(): boolean {
  if (typeof window === 'undefined') return false;

  const saved = localStorage.getItem(ISOCITY_STORAGE_KEY);
  if (!saved) return false;

  return parseStoredGameState(saved) !== null;
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

export function loadIsoCitySavedCities(): SavedCityMeta[] {
  if (typeof window === 'undefined') return [];

  try {
    const saved = localStorage.getItem(ISOCITY_SAVED_CITIES_INDEX_KEY);
    if (!saved) return [];

    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed as SavedCityMeta[] : [];
  } catch {
    return [];
  }
}

export function clearIsoCityStoredGameData(): void {
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

  clearMatchingKeys(localStorage);
  clearMatchingKeys(sessionStorage);
}
