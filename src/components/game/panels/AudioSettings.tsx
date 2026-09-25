'use client';

import React, { useSyncExternalStore } from 'react';
import { msg, useMessages } from 'gt-next';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { getAudioSettings, playSfx, setAudioSettings, subscribeAudioSettings, type AudioSettings as Settings } from '@/lib/audio';
import { DEFAULT_AUDIO_SETTINGS } from '@/lib/audio/audioConfig';

const LABELS = {
  sound: msg('Sound'),
  mute: msg('Mute all sound'),
  master: msg('Master volume'),
  music: msg('Music'),
  sfx: msg('Sound effects'),
  ambient: msg('River and temple bells'),
  ambientDesc: msg('Heard near the ghats when zoomed in (Medium and High quality)'),
} as const;

const getServerSettings = () => DEFAULT_AUDIO_SETTINGS;

/** Volume sliders and mute (S5-T9). Saved in localStorage. */
export function AudioSettings() {
  const m = useMessages();
  const s = useSyncExternalStore(subscribeAudioSettings, getAudioSettings, getServerSettings);

  const row = (key: 'master' | 'music' | 'sfx' | 'ambient', desc?: string) => (
    <div className="py-2" key={key}>
      <div className="flex items-center justify-between mb-2">
        <Label htmlFor={`vol-${key}`}>{m(LABELS[key])}</Label>
        <span className="text-xs text-muted-foreground tabular-nums">{Math.round(s[key] * 100)}%</span>
      </div>
      {desc && <p className="text-muted-foreground text-xs mb-2">{desc}</p>}
      <Slider
        id={`vol-${key}`}
        min={0}
        max={100}
        step={5}
        disabled={s.muted}
        value={[Math.round(s[key] * 100)]}
        onValueChange={([v]) => setAudioSettings({ [key]: v / 100 } as Partial<Settings>)}
        onValueCommit={() => {
          if (key !== 'music' && key !== 'ambient') playSfx('notification');
        }}
        className="py-2"
      />
    </div>
  );

  return (
    <div className="py-2">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{m(LABELS.sound)}</div>
      <div className="flex items-center justify-between py-2 gap-4">
        <Label htmlFor="audio-mute">{m(LABELS.mute)}</Label>
        <Switch id="audio-mute" checked={s.muted} onCheckedChange={(muted) => setAudioSettings({ muted })} />
      </div>
      {row('master')}
      {row('music')}
      {row('sfx')}
      {row('ambient', m(LABELS.ambientDesc))}
    </div>
  );
}
