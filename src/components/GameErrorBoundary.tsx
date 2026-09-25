'use client';

/**
 * Crash safety (S5-T12). A React error boundary around the game: on a crash it autosaves the
 * last good city state (if it can) and shows "Something went wrong. Your city was saved." with a
 * reload button.
 *
 * The boundary sits outside GameProvider (so a crash in the provider is caught too); the state
 * getter is registered by <CrashSaveRegistrar/>, rendered inside the provider.
 */
import React, { useEffect } from 'react';
import { T } from 'gt-next';
import { compressToUTF16 } from 'lz-string';
import { Button } from '@/components/ui/button';
import { useGame } from '@/context/GameContext';
import { isBenchmarkState } from '@/lib/benchmark';
import { flushPendingSaves, writeIsoCityAutosaveRaw } from '@/lib/isocityStorage';
import type { GameState } from '@/types/game';

let getCrashState: (() => GameState | null) | null = null;

/** Registers the live game state so the error boundary can save it after a crash. */
export function CrashSaveRegistrar() {
  const { latestStateRef } = useGame();
  useEffect(() => {
    const getter = () => latestStateRef.current ?? null;
    getCrashState = getter;
    return () => {
      if (getCrashState === getter) getCrashState = null;
    };
  }, [latestStateRef]);
  return null;
}

/** Saves the registered state into the autosave slot. Resolves true when the city is on disk. */
export async function saveCityAfterCrash(): Promise<boolean> {
  try {
    const state = getCrashState?.();
    if (!state?.grid || !state.stats) {
      // Nothing to save now; an earlier autosave may still be there.
      await flushPendingSaves();
      return false;
    }
    if (isBenchmarkState(state)) return false; // benchmark cities are never saved
    await flushPendingSaves();
    await writeIsoCityAutosaveRaw(compressToUTF16(JSON.stringify(state)));
    return true;
  } catch (e) {
    console.error('Crash autosave failed:', e);
    return false;
  }
}

type SaveStatus = 'saving' | 'saved' | 'failed';

interface BoundaryState {
  error: Error | null;
  save: SaveStatus;
}

export class GameErrorBoundary extends React.Component<{ children: React.ReactNode }, BoundaryState> {
  state: BoundaryState = { error: null, save: 'saving' };

  static getDerivedStateFromError(error: Error): Partial<BoundaryState> {
    return { error, save: 'saving' };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Game crashed:', error, info.componentStack);
    void saveCityAfterCrash().then((ok) => this.setState({ save: ok ? 'saved' : 'failed' }));
  }

  render() {
    if (!this.state.error) return this.props.children;
    const { save } = this.state;
    return (
      <main
        role="alert"
        className="h-[100dvh] w-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
      >
        <div className="max-w-sm w-full text-center space-y-4">
          <h1 className="text-2xl font-light text-white/90">
            {save === 'saved' && <T>Something went wrong. Your city was saved.</T>}
            {save === 'saving' && <T>Something went wrong. Saving your city…</T>}
            {save === 'failed' && <T>Something went wrong. Your last autosave is kept.</T>}
          </h1>
          <Button
            className="min-h-[44px] w-full bg-white/10 hover:bg-white/20 text-white border border-white/20"
            disabled={save === 'saving'}
            onClick={() => window.location.reload()}
          >
            <T>Reload</T>
          </Button>
        </div>
      </main>
    );
  }
}
