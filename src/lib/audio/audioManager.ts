/**
 * Web Audio engine (S5-T9). Loaded lazily by `./index.ts` on the first user interaction, so it
 * never delays the first load and the AudioContext is created inside a user gesture (autoplay).
 *
 * Graph: master ─┬─ music   (optional playlist, HTMLAudioElement streamed through Web Audio)
 *                ├─ sfx     (synthesized from SFX_RECIPES)
 *                └─ ambient (synthesized river noise + temple bells; Medium/High quality only)
 * Everything goes silent while the tab is hidden.
 */
import {
  AUDIO_CONFIG,
  SFX_RECIPES,
  channelGain,
  parsePlaylist,
  shufflePlaylist,
  type AudioSettings,
  type MusicTrack,
  type SfxId,
} from './audioConfig';

type Ctx = AudioContext;

export class AudioManager {
  private ctx: Ctx;
  private master: GainNode;
  private music: GainNode;
  private sfx: GainNode;
  private ambient: GainNode;
  private ambientLevelGain: GainNode;
  private noiseBuffer: AudioBuffer;
  private settings: AudioSettings;
  private hidden = false;
  private lastPlayed = new Map<SfxId, number>();
  private playlist: MusicTrack[] = [];
  private playlistIndex = 0;
  private musicEl: HTMLAudioElement | null = null;
  private musicTimer: ReturnType<typeof setTimeout> | null = null;
  private ambientStarted = false;
  private ambientTarget = 0;
  private bellTimer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;

  constructor(settings: AudioSettings) {
    const AC: typeof AudioContext =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AC();
    this.settings = settings;
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    this.music = this.gainTo(this.master);
    this.sfx = this.gainTo(this.master);
    this.ambient = this.gainTo(this.master);
    this.ambientLevelGain = this.gainTo(this.ambient);
    this.ambientLevelGain.gain.value = 0;
    this.noiseBuffer = this.makeNoise(2);
    this.hidden = document.visibilityState === 'hidden';
    document.addEventListener('visibilitychange', this.onVisibility);
    this.applyGains(true);
  }

  private gainTo(dest: AudioNode): GainNode {
    const g = this.ctx.createGain();
    g.connect(dest);
    return g;
  }

  private makeNoise(seconds: number): AudioBuffer {
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  private onVisibility = () => {
    this.hidden = document.visibilityState === 'hidden';
    this.applyGains();
    if (this.hidden) {
      this.musicEl?.pause();
      void this.ctx.suspend().catch(() => {});
    } else {
      void this.ctx.resume().catch(() => {});
      if (this.musicEl && channelGain(this.settings, 'music') > 0) void this.musicEl.play().catch(() => {});
    }
  };

  private applyGains(immediate = false) {
    const t = this.ctx.currentTime;
    const set = (node: GainNode, v: number) => {
      if (immediate) node.gain.value = v;
      else node.gain.setTargetAtTime(v, t, 0.05);
    };
    // Channel gains already include master; the master node only mutes.
    set(this.master, this.settings.muted || this.hidden ? 0 : 1);
    set(this.music, channelGain(this.settings, 'music'));
    set(this.sfx, channelGain(this.settings, 'sfx'));
    set(this.ambient, channelGain(this.settings, 'ambient'));
  }

  resume(): void {
    if (this.ctx.state === 'suspended' && !this.hidden) void this.ctx.resume().catch(() => {});
  }

  setSettings(settings: AudioSettings): void {
    const musicWasOn = channelGain(this.settings, 'music') > 0;
    this.settings = settings;
    this.applyGains();
    const musicOn = channelGain(settings, 'music') > 0;
    if (musicOn && !musicWasOn) this.startMusic();
    if (!musicOn && musicWasOn) this.musicEl?.pause();
  }

  playSfx(id: SfxId): void {
    if (this.disposed || channelGain(this.settings, 'sfx', this.hidden) <= 0) return;
    const now = performance.now();
    if (now - (this.lastPlayed.get(id) ?? -Infinity) < AUDIO_CONFIG.sfxMinIntervalMs) return;
    this.lastPlayed.set(id, now);
    this.resume();
    const t0 = this.ctx.currentTime + 0.005;
    for (const step of SFX_RECIPES[id]) {
      const start = t0 + step.at;
      const end = start + step.dur;
      const env = this.ctx.createGain();
      env.gain.setValueAtTime(0.0001, start);
      env.gain.exponentialRampToValueAtTime(step.gain, start + Math.min(0.01, step.dur / 4));
      env.gain.exponentialRampToValueAtTime(0.0001, end);
      env.connect(this.sfx);
      let src: AudioScheduledSourceNode;
      if (step.wave === 'noise') {
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.noiseBuffer;
        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = step.freq;
        bp.Q.value = 1.2;
        noise.connect(bp).connect(env);
        src = noise;
      } else {
        const osc = this.ctx.createOscillator();
        osc.type = step.wave;
        osc.frequency.setValueAtTime(step.freq, start);
        if (step.freqEnd) osc.frequency.exponentialRampToValueAtTime(step.freqEnd, end);
        osc.connect(env);
        src = osc;
      }
      src.start(start);
      src.stop(end + 0.02);
      src.onended = () => env.disconnect();
    }
  }

  // ---- Music (optional) -------------------------------------------------------------------

  async loadPlaylist(): Promise<void> {
    try {
      const res = await fetch(AUDIO_CONFIG.musicPlaylistUrl, { cache: 'force-cache' });
      if (!res.ok) return; // No playlist shipped: the game simply has no music.
      this.playlist = shufflePlaylist(parsePlaylist(await res.json()));
    } catch {
      this.playlist = [];
    }
    this.startMusic();
  }

  private pickSource(track: MusicTrack): string | null {
    const probe = document.createElement('audio');
    for (const src of track.src) {
      const ext = src.split('.').pop()?.toLowerCase();
      const mime = ext === 'ogg' ? 'audio/ogg' : ext === 'm4a' || ext === 'mp4' ? 'audio/mp4' : ext === 'mp3' ? 'audio/mpeg' : '';
      if (!mime || probe.canPlayType(mime)) return src;
    }
    return null;
  }

  private startMusic(): void {
    if (this.disposed || !this.playlist.length || channelGain(this.settings, 'music') <= 0) return;
    if (this.musicEl) {
      if (!this.hidden) void this.musicEl.play().catch(() => {});
      return;
    }
    this.playTrack();
  }

  private playTrack(): void {
    if (this.disposed || !this.playlist.length) return;
    const track = this.playlist[this.playlistIndex % this.playlist.length];
    this.playlistIndex++;
    const src = this.pickSource(track);
    if (!src) return;
    const el = new Audio();
    el.crossOrigin = 'anonymous';
    el.preload = 'auto';
    el.src = src;
    this.ctx.createMediaElementSource(el).connect(this.music);
    el.onended = () => {
      this.musicEl = null;
      if (this.playlistIndex % this.playlist.length === 0) {
        this.playlist = shufflePlaylist(this.playlist);
      }
      this.musicTimer = setTimeout(() => this.playTrack(), AUDIO_CONFIG.musicGapMs);
    };
    el.onerror = () => {
      this.musicEl = null;
    };
    this.musicEl = el;
    if (!this.hidden && channelGain(this.settings, 'music') > 0) void el.play().catch(() => {});
  }

  // ---- Ambient (river + temple bells) ------------------------------------------------------

  /** 0..1 from `ambientLevel()`; 0 stops the bells. */
  setAmbientLevel(level: number): void {
    if (this.disposed) return;
    this.ambientTarget = level;
    if (level > 0 && !this.ambientStarted) this.startAmbient();
    this.ambientLevelGain.gain.setTargetAtTime(level, this.ctx.currentTime, 0.8);
  }

  private startAmbient(): void {
    this.ambientStarted = true;
    // River: looping low-passed noise with a slow swell.
    const river = this.ctx.createBufferSource();
    river.buffer = this.noiseBuffer;
    river.loop = true;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 500;
    const swell = this.ctx.createGain();
    swell.gain.value = 0.18;
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.12;
    const lfoDepth = this.ctx.createGain();
    lfoDepth.gain.value = 0.06;
    lfo.connect(lfoDepth).connect(swell.gain);
    river.connect(lp).connect(swell).connect(this.ambientLevelGain);
    river.start();
    lfo.start();
    this.scheduleBell();
  }

  private scheduleBell(): void {
    const [lo, hi] = AUDIO_CONFIG.ambient.bellEverySec;
    this.bellTimer = setTimeout(() => {
      if (this.disposed) return;
      if (this.ambientTarget > 0 && !this.hidden) this.strikeBell();
      this.scheduleBell();
    }, (lo + Math.random() * (hi - lo)) * 1000);
  }

  private strikeBell(): void {
    const t = this.ctx.currentTime + 0.01;
    const base = 520 + Math.random() * 180;
    // Inharmonic partials give a bell timbre.
    for (const [ratio, g] of [[1, 0.12], [2.76, 0.05], [5.4, 0.025]] as const) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = base * ratio;
      const env = this.ctx.createGain();
      env.gain.setValueAtTime(0.0001, t);
      env.gain.exponentialRampToValueAtTime(g, t + 0.01);
      env.gain.exponentialRampToValueAtTime(0.0001, t + 3);
      osc.connect(env).connect(this.ambientLevelGain);
      osc.start(t);
      osc.stop(t + 3.05);
      osc.onended = () => env.disconnect();
    }
  }

  dispose(): void {
    this.disposed = true;
    document.removeEventListener('visibilitychange', this.onVisibility);
    if (this.musicTimer) clearTimeout(this.musicTimer);
    if (this.bellTimer) clearTimeout(this.bellTimer);
    this.musicEl?.pause();
    void this.ctx.close().catch(() => {});
  }
}
