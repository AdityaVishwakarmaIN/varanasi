'use client';

import React, { useEffect, useState } from 'react';
import { useGame } from '@/context/GameContext';
import { getPerfRenderer, getPerfSnapshot, type PerfSnapshot } from '@/lib/perfStats';

export const PERF_HUD_CONFIG = {
  /** The HUD refreshes this often (not every frame, so it costs almost nothing). */
  refreshMs: 500,
  toggleKey: 'F3',
  urlParam: 'perf',
  /** Frame p95 colour thresholds (ms): green up to 60 fps, yellow up to 30 fps, red above. */
  frameGoodMs: 16.7,
  frameOkMs: 33,
} as const;

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el?.closest?.('input, textarea, select, [contenteditable="true"], [contenteditable=""]');
}

function frameColor(ms: number): string {
  if (ms <= PERF_HUD_CONFIG.frameGoodMs) return 'text-green-400';
  if (ms <= PERF_HUD_CONFIG.frameOkMs) return 'text-yellow-400';
  return 'text-red-400';
}

function initialVisible(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get(PERF_HUD_CONFIG.urlParam) === '1';
}

/**
 * Performance HUD (S1-T2). Hidden by default; toggle with F3 or open with `?perf=1`.
 * Shows FPS, frame/tick/save times, renderer, map size and entity counts.
 */
export function PerfHud() {
  const { latestStateRef } = useGame();
  const [visible, setVisible] = useState(initialVisible);
  const [snapshot, setSnapshot] = useState<PerfSnapshot | null>(null);
  const [renderer, setRenderer] = useState('');
  const [mapSize, setMapSize] = useState(0);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== PERF_HUD_CONFIG.toggleKey || e.repeat || isTypingTarget(e.target)) return;
      e.preventDefault(); // F3 is "find next" in some browsers
      setVisible((v) => !v);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const refresh = () => {
      setSnapshot(getPerfSnapshot());
      setRenderer(getPerfRenderer());
      setMapSize(latestStateRef.current?.gridSize ?? 0);
    };
    const id = setInterval(refresh, PERF_HUD_CONFIG.refreshMs);
    const first = setTimeout(refresh, 0);
    return () => {
      clearInterval(id);
      clearTimeout(first);
    };
  }, [visible, latestStateRef]);

  if (!visible) return null;

  const s = snapshot;
  const entities = s ? Object.entries(s.entities) : [];
  return (
    <div
      className="fixed top-2 left-2 z-[9999] pointer-events-none select-none rounded-md bg-black/75 px-2.5 py-2 font-mono text-[11px] leading-4 text-white shadow-lg"
      data-testid="perf-hud"
      aria-hidden="true"
    >
      <div className="font-semibold">
        {s ? s.fps.toFixed(0) : '–'} fps <span className="text-white/50">· {renderer} · {mapSize}×{mapSize}</span>
      </div>
      {s && (
        <>
          <div>
            frame p50 {s.frameP50.toFixed(1)} · p95{' '}
            <span className={frameColor(s.frameP95)}>{s.frameP95.toFixed(1)}</span> · max {s.frameMax.toFixed(1)} ms
          </div>
          <div>tick p95 {s.tickP95.toFixed(1)} · max {s.tickMax.toFixed(1)} ms</div>
          <div>save max {s.saveMax.toFixed(1)} ms</div>
          {entities.length > 0 && (
            <div className="mt-1 text-white/70">
              {entities.map(([name, n]) => `${name} ${n}`).join(' · ')}
            </div>
          )}
        </>
      )}
      <div className="mt-1 text-white/40">F3 to hide</div>
    </div>
  );
}
