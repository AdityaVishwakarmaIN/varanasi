/**
 * Audio data and pure rules (S5-T9). No Web Audio or DOM here, so it is unit-tested
 * (src/lib/__tests__/audio.test.ts). The Web Audio side lives in `audioManager.ts` and is
 * loaded lazily by `./index.ts` after the first user interaction.
 *
 * Every sound effect is synthesized in the browser from the recipes below (no audio files, so
 * nothing to license). Music is optional: tracks are listed in `AUDIO_CONFIG.musicPlaylistUrl`
 * (a JSON file under public/audio/) and only files with a recorded licence in
 * public/audio/LICENSES.md may be added there. Without the playlist the game has no music.
 */
import type { Tool } from '@/types/game';

export const SFX_IDS = [
  'click',
  'place',
  'road',
  'bulldoze',
  'money',
  'notification',
  'alert',
  'unlock',
  'festival',
] as const;
export type SfxId = (typeof SFX_IDS)[number];

export const AUDIO_CONFIG = {
  storageKey: 'varanasi-audio-settings',
  /** Optional playlist: `{ "tracks": [{ "title": "...", "src": ["/audio/music/a.ogg", "/audio/music/a.m4a"] }] }`. */
  musicPlaylistUrl: '/audio/music/playlist.json',
  /** The same SFX never plays more often than this (road drags place many tiles per second). */
  sfxMinIntervalMs: 70,
  /** A notification chime is skipped if a louder cue (alert, unlock, festival) just played for it. */
  notificationSuppressMs: 600,
  /** The notification chime waits this long so a louder cue for the same event can replace it. */
  notificationDelayMs: 150,
  /** Queued SFX older than this when the audio engine finishes loading are dropped. */
  pendingSfxMaxAgeMs: 400,
  /** Music fades in/out over this many seconds. */
  musicFadeSec: 2,
  /** Silence between playlist tracks. */
  musicGapMs: 4000,
  /** Ambient river + temple bells (Medium and High quality only). */
  ambient: {
    qualities: ['medium', 'high'] as readonly string[],
    /** Zoom at which the ambient starts to be heard, and where it reaches full volume. */
    zoomStart: 0.9,
    zoomFull: 1.8,
    /** Tiles around the screen centre searched for ghats/river. */
    searchRadius: 8,
    /** Ghat or water tiles in the search box for full proximity. */
    fullProximityTiles: 12,
    /** Seconds between temple-bell strikes (random within the range). */
    bellEverySec: [7, 16] as const,
    updateMs: 1000,
  },
} as const;

export interface AudioSettings {
  master: number;
  music: number;
  sfx: number;
  ambient: number;
  muted: boolean;
}

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  master: 0.8,
  music: 0.5,
  sfx: 0.7,
  ambient: 0.5,
  muted: false,
};

function clamp01(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback;
}

/** Settings from storage (any shape) → valid settings; bad fields fall back to the defaults. */
export function sanitizeAudioSettings(raw: unknown): AudioSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_AUDIO_SETTINGS;
  return {
    master: clamp01(r.master, d.master),
    music: clamp01(r.music, d.music),
    sfx: clamp01(r.sfx, d.sfx),
    ambient: clamp01(r.ambient, d.ambient),
    muted: typeof r.muted === 'boolean' ? r.muted : d.muted,
  };
}

export type AudioChannel = 'music' | 'sfx' | 'ambient';

/** Final gain of a channel: 0 when muted or when the tab is hidden. */
export function channelGain(settings: AudioSettings, channel: AudioChannel, hidden = false): number {
  if (settings.muted || hidden) return 0;
  return settings.master * settings[channel];
}

/** Sound for a successful build-tool action. */
export function sfxForTool(tool: Tool): SfxId | null {
  if (tool === 'select') return null;
  if (tool === 'bulldoze') return 'bulldoze';
  if (tool === 'road' || tool === 'rail' || tool === 'subway' || tool === 'embankment') return 'road';
  return 'place';
}

/** Louder cues that replace the generic notification chime. */
export function sfxForNotification(n: { severity?: string; icon?: string }): SfxId {
  if (n.severity === 'crisis') return 'alert';
  if (n.icon === 'landmark') return 'unlock';
  if (n.icon === 'trophy') return 'festival';
  return 'notification';
}

/**
 * Ambient level 0..1 from camera zoom and how much ghat/river is near the screen centre.
 * Silent on Low quality.
 */
export function ambientLevel(zoom: number, nearbyTiles: number, quality: string): number {
  const a = AUDIO_CONFIG.ambient;
  if (!a.qualities.includes(quality)) return 0;
  const z = Math.min(1, Math.max(0, (zoom - a.zoomStart) / (a.zoomFull - a.zoomStart)));
  const p = Math.min(1, Math.max(0, nearbyTiles / a.fullProximityTiles));
  return z * p;
}

/** Fisher-Yates with an injectable random source (so it is testable). */
export function shufflePlaylist<T>(tracks: readonly T[], random: () => number = Math.random): T[] {
  const out = [...tracks];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export interface MusicTrack {
  title: string;
  /** Candidate files in preference order (e.g. .ogg then .m4a for Safari). */
  src: string[];
}

/** Playlist JSON → tracks; anything malformed is skipped. */
export function parsePlaylist(raw: unknown): MusicTrack[] {
  const tracks = (raw as { tracks?: unknown } | null)?.tracks;
  if (!Array.isArray(tracks)) return [];
  return tracks.flatMap((t): MusicTrack[] => {
    const src = (t as { src?: unknown })?.src;
    const list = (Array.isArray(src) ? src : [src]).filter((s): s is string => typeof s === 'string' && s.startsWith('/'));
    if (!list.length) return [];
    const title = (t as { title?: unknown }).title;
    return [{ title: typeof title === 'string' ? title : list[0], src: list }];
  });
}

/** One synthesized tone: an oscillator (or noise) with a short attack/decay envelope. */
export interface ToneStep {
  /** Start offset in seconds. */
  at: number;
  wave: OscillatorType | 'noise';
  /** Start frequency (Hz); for noise, the band-pass centre. */
  freq: number;
  /** Optional glide target frequency. */
  freqEnd?: number;
  dur: number;
  gain: number;
}

/**
 * SFX recipes. Pentatonic, soft sounds (sine/triangle) so they sit under the music; short (all
 * under 0.8 s, far below the 50 KB file budget as they are not files at all).
 */
export const SFX_RECIPES: Record<SfxId, ToneStep[]> = {
  click: [{ at: 0, wave: 'triangle', freq: 880, dur: 0.05, gain: 0.25 }],
  place: [
    { at: 0, wave: 'triangle', freq: 330, freqEnd: 220, dur: 0.12, gain: 0.5 },
    { at: 0, wave: 'noise', freq: 900, dur: 0.06, gain: 0.25 },
  ],
  road: [{ at: 0, wave: 'noise', freq: 600, dur: 0.07, gain: 0.3 }],
  bulldoze: [
    { at: 0, wave: 'noise', freq: 250, dur: 0.25, gain: 0.5 },
    { at: 0, wave: 'sawtooth', freq: 90, freqEnd: 55, dur: 0.22, gain: 0.15 },
  ],
  money: [
    { at: 0, wave: 'sine', freq: 1318.5, dur: 0.12, gain: 0.12 },
    { at: 0.07, wave: 'sine', freq: 1760, dur: 0.18, gain: 0.1 },
  ],
  notification: [
    { at: 0, wave: 'sine', freq: 784, dur: 0.18, gain: 0.3 },
    { at: 0.1, wave: 'sine', freq: 1046.5, dur: 0.25, gain: 0.25 },
  ],
  alert: [
    { at: 0, wave: 'triangle', freq: 440, dur: 0.2, gain: 0.45 },
    { at: 0.22, wave: 'triangle', freq: 349.2, dur: 0.2, gain: 0.45 },
    { at: 0.44, wave: 'triangle', freq: 440, dur: 0.3, gain: 0.45 },
  ],
  unlock: [
    { at: 0, wave: 'sine', freq: 523.3, dur: 0.3, gain: 0.35 },
    { at: 0.12, wave: 'sine', freq: 659.3, dur: 0.3, gain: 0.35 },
    { at: 0.24, wave: 'sine', freq: 784, dur: 0.3, gain: 0.35 },
    { at: 0.36, wave: 'sine', freq: 1046.5, dur: 0.45, gain: 0.35 },
  ],
  festival: [
    { at: 0, wave: 'sine', freq: 587.3, dur: 0.7, gain: 0.3 },
    { at: 0, wave: 'sine', freq: 1468, dur: 0.6, gain: 0.08 },
    { at: 0.15, wave: 'triangle', freq: 146.8, dur: 0.15, gain: 0.35 },
    { at: 0.3, wave: 'triangle', freq: 146.8, dur: 0.15, gain: 0.35 },
    { at: 0.38, wave: 'triangle', freq: 196, dur: 0.2, gain: 0.35 },
  ],
};

/** Total length of a recipe in seconds. */
export function recipeDuration(id: SfxId): number {
  return Math.max(...SFX_RECIPES[id].map((s) => s.at + s.dur));
}
