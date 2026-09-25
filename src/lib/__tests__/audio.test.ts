import { describe, expect, it } from 'vitest';
import {
  AUDIO_CONFIG,
  DEFAULT_AUDIO_SETTINGS,
  SFX_IDS,
  SFX_RECIPES,
  ambientLevel,
  channelGain,
  parsePlaylist,
  recipeDuration,
  sanitizeAudioSettings,
  sfxForNotification,
  sfxForTool,
  shufflePlaylist,
} from '@/lib/audio/audioConfig';
import { BATTERY_SAVER_CONFIG, batterySaverFrameMs } from '@/lib/batterySaver';
import { isDevModeSearch } from '@/lib/devMode';

describe('audio settings (S5-T9)', () => {
  it('sanitizes stored settings and falls back to defaults', () => {
    expect(sanitizeAudioSettings(null)).toEqual(DEFAULT_AUDIO_SETTINGS);
    expect(sanitizeAudioSettings({ master: 2, music: -1, sfx: 'x', muted: 'yes' })).toEqual({
      ...DEFAULT_AUDIO_SETTINGS,
      master: 1,
      music: 0,
    });
    expect(sanitizeAudioSettings({ muted: true }).muted).toBe(true);
  });

  it('channel gain multiplies master and channel, and is 0 when muted or hidden', () => {
    const s = { ...DEFAULT_AUDIO_SETTINGS, master: 0.5, sfx: 0.8 };
    expect(channelGain(s, 'sfx')).toBeCloseTo(0.4);
    expect(channelGain({ ...s, muted: true }, 'sfx')).toBe(0);
    expect(channelGain(s, 'sfx', true)).toBe(0);
  });
});

describe('sound effects (S5-T9)', () => {
  it('every listed action has a short recipe', () => {
    for (const id of SFX_IDS) {
      expect(SFX_RECIPES[id].length).toBeGreaterThan(0);
      expect(recipeDuration(id)).toBeLessThan(1);
    }
  });

  it('maps tools and notifications to sounds', () => {
    expect(sfxForTool('select')).toBeNull();
    expect(sfxForTool('bulldoze')).toBe('bulldoze');
    expect(sfxForTool('road')).toBe('road');
    expect(sfxForTool('zone_residential')).toBe('place');
    expect(sfxForNotification({ severity: 'crisis' })).toBe('alert');
    expect(sfxForNotification({})).toBe('notification');
  });
});

describe('ambient level (S5-T9)', () => {
  const a = AUDIO_CONFIG.ambient;
  it('is silent on low quality, far away or zoomed out', () => {
    expect(ambientLevel(a.zoomFull, a.fullProximityTiles, 'low')).toBe(0);
    expect(ambientLevel(a.zoomFull, 0, 'high')).toBe(0);
    expect(ambientLevel(a.zoomStart, a.fullProximityTiles, 'high')).toBe(0);
  });
  it('rises with zoom near the ghats', () => {
    expect(ambientLevel(a.zoomFull, a.fullProximityTiles, 'medium')).toBe(1);
    const mid = ambientLevel((a.zoomStart + a.zoomFull) / 2, a.fullProximityTiles, 'high');
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
  });
});

describe('music playlist (S5-T9)', () => {
  it('parses tracks and skips malformed entries', () => {
    expect(parsePlaylist(null)).toEqual([]);
    expect(
      parsePlaylist({
        tracks: [
          { title: 'Dawn', src: ['/audio/music/a.ogg', '/audio/music/a.m4a'] },
          { src: '/audio/music/b.ogg' },
          { title: 'Bad', src: ['https://example.com/x.ogg'] },
          42,
        ],
      }),
    ).toEqual([
      { title: 'Dawn', src: ['/audio/music/a.ogg', '/audio/music/a.m4a'] },
      { title: '/audio/music/b.ogg', src: ['/audio/music/b.ogg'] },
    ]);
  });

  it('shuffles without losing tracks', () => {
    let seed = 1;
    const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const out = shufflePlaylist([1, 2, 3, 4, 5], rng);
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('battery saver (S5-T10)', () => {
  it('drops to 10 fps only when paused and idle for 5 s', () => {
    const idle = BATTERY_SAVER_CONFIG.idleMs;
    expect(batterySaverFrameMs(false, 0, idle * 10)).toBe(0);
    expect(batterySaverFrameMs(true, 1000, 1000 + idle - 1)).toBe(0);
    expect(batterySaverFrameMs(true, 1000, 1000 + idle)).toBe(100);
  });
});

describe('dev mode (S5-T12)', () => {
  it('needs ?dev=1', () => {
    expect(isDevModeSearch('')).toBe(false);
    expect(isDevModeSearch('?dev=0')).toBe(false);
    expect(isDevModeSearch('?perf=1')).toBe(false);
    expect(isDevModeSearch('?dev=1')).toBe(true);
    expect(isDevModeSearch('bench=160&dev=1')).toBe(true);
  });
});
