/**
 * Audio facade (S5-T9): the only audio API the rest of the game uses.
 *
 *   import { playSfx } from '@/lib/audio';
 *   playSfx('unlock');   // landmark unlocked
 *   playSfx('alert');    // crisis
 *   playSfx('festival'); // festival starts
 *
 * This module is tiny and has no Web Audio code. The engine (`audioManager.ts`) is imported
 * dynamically on the first user interaction (`unlockAudio()`), so audio never delays the first
 * load, and browsers allow the AudioContext to start. Calls made before that are dropped (or,
 * within a few hundred ms of loading, played late). Settings live in localStorage.
 */
import {
  AUDIO_CONFIG,
  DEFAULT_AUDIO_SETTINGS,
  sanitizeAudioSettings,
  type AudioSettings,
  type SfxId,
} from './audioConfig';
import type { AudioManager } from './audioManager';

export type { AudioSettings, SfxId } from './audioConfig';

let settings: AudioSettings | null = null;
let manager: AudioManager | null = null;
let loading: Promise<void> | null = null;
let pending: { id: SfxId; at: number }[] = [];
let lastPriorityCueAt = -Infinity;
const listeners = new Set<() => void>();

export function getAudioSettings(): AudioSettings {
  if (settings) return settings;
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(AUDIO_CONFIG.storageKey) : null;
    settings = raw ? sanitizeAudioSettings(JSON.parse(raw)) : DEFAULT_AUDIO_SETTINGS;
  } catch {
    settings = DEFAULT_AUDIO_SETTINGS;
  }
  return settings;
}

export function setAudioSettings(patch: Partial<AudioSettings>): void {
  settings = sanitizeAudioSettings({ ...getAudioSettings(), ...patch });
  try {
    window.localStorage.setItem(AUDIO_CONFIG.storageKey, JSON.stringify(settings));
  } catch {
    // Private mode etc.: the setting still applies for this session.
  }
  manager?.setSettings(settings);
  listeners.forEach((l) => l());
}

export function subscribeAudioSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Call from a user gesture. Loads the engine once, then just resumes it. */
export function unlockAudio(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (manager) {
    manager.resume();
    return Promise.resolve();
  }
  if (!loading) {
    loading = import('./audioManager')
      .then(({ AudioManager }) => {
        manager = new AudioManager(getAudioSettings());
        const now = performance.now();
        for (const p of pending) {
          if (now - p.at <= AUDIO_CONFIG.pendingSfxMaxAgeMs) manager.playSfx(p.id);
        }
        pending = [];
        void manager.loadPlaylist();
      })
      .catch((e) => {
        console.warn('Audio unavailable:', e);
      });
  }
  return loading;
}

export function isAudioReady(): boolean {
  return manager !== null;
}

export function playSfx(id: SfxId): void {
  if (typeof window === 'undefined') return;
  const now = performance.now();
  if (id === 'notification') {
    // Wait briefly: if a louder cue for the same event (unlock, festival, alert) plays around
    // the same time, the chime is skipped so the two do not stack.
    setTimeout(() => {
      if (performance.now() - lastPriorityCueAt < AUDIO_CONFIG.notificationSuppressMs) return;
      playNow('notification', performance.now());
    }, AUDIO_CONFIG.notificationDelayMs);
    return;
  }
  if (id === 'alert' || id === 'unlock' || id === 'festival') lastPriorityCueAt = now;
  playNow(id, now);
}

function playNow(id: SfxId, now: number): void {
  if (manager) {
    manager.playSfx(id);
  } else if (loading) {
    pending.push({ id, at: now });
  }
}

/** Ambient river/bells level 0..1 (see `ambientLevel()` in audioConfig). */
export function setAmbientLevel(level: number): void {
  manager?.setAmbientLevel(level);
}
