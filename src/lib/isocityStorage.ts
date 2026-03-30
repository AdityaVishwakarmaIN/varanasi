'use client';

import { decompressFromUTF16 } from 'lz-string';
import type { GameState, SavedCityMeta } from '@/types/game';

export const ISOCITY_STORAGE_KEY = 'isocity-game-state';
export const ISOCITY_SAVED_CITY_STORAGE_KEY = 'isocity-saved-city';
export const ISOCITY_SAVED_CITIES_INDEX_KEY = 'isocity-saved-cities-index';
export const ISOCITY_SAVED_CITY_PREFIX = 'isocity-city-';
export const ISOCITY_SPRITE_PACK_STORAGE_KEY = 'isocity-sprite-pack';
export const ISOCITY_DAY_NIGHT_MODE_STORAGE_KEY = 'isocity-day-night-mode';
export const COASTER_STORAGE_PREFIX = 'coaster-';

const APP_STORAGE_PREFIXES = ['isocity-', COASTER_STORAGE_PREFIX] as const;

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
