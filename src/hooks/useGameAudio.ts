'use client';

/**
 * Game audio wiring (S5-T9). Mounted once by Game.tsx.
 * - Starts the (lazily loaded) audio engine on the first user interaction (autoplay rules).
 * - UI click sound for buttons (event delegation, so no per-button code).
 * - Notification chime / crisis alert for new notifications; subtle "money" on weekly income.
 * - Ambient river + bell level from camera zoom and nearby ghats/river (Medium/High quality).
 * Build/road/bulldoze sounds are played by GameContext.placeAtTile.
 */
import { useEffect, useRef, type RefObject } from 'react';
import type { GameState } from '@/types/game';
import { playSfx, setAmbientLevel, unlockAudio } from '@/lib/audio';
import { AUDIO_CONFIG, ambientLevel, sfxForNotification } from '@/lib/audio/audioConfig';
import { getGraphicsSnapshot } from '@/lib/graphicsSettings';
import { getCameraController } from '@/components/game/cameraController';
import { screenToGrid } from '@/components/game/utils';

const CLICKABLE = 'button, [role="button"], [role="menuitem"], [role="tab"], [role="switch"], [role="option"]';

/** Ghat and river tiles in a square around (cx, cy). */
function countRiverfront(state: GameState, cx: number, cy: number, r: number): number {
  let n = 0;
  for (let y = cy - r; y <= cy + r; y++) {
    const row = state.grid[y];
    if (!row) continue;
    for (let x = cx - r; x <= cx + r; x++) {
      const t = row[x]?.building.type;
      if (t === 'ghat') n += 3;
      else if (t === 'water') n += 0.5;
    }
  }
  return n;
}

export function useGameAudio(
  state: Pick<GameState, 'notifications' | 'day' | 'stats'>,
  latestStateRef: RefObject<GameState>,
): void {
  // First interaction: load and start the engine. Button clicks: UI click sound.
  useEffect(() => {
    const unlock = () => void unlockAudio();
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.(CLICKABLE);
      if (el && !(el as HTMLButtonElement).disabled) playSfx('click');
    };
    window.addEventListener('pointerdown', unlock, { capture: true });
    window.addEventListener('keydown', unlock, { capture: true });
    document.addEventListener('click', onClick, { capture: true });
    return () => {
      window.removeEventListener('pointerdown', unlock, { capture: true });
      window.removeEventListener('keydown', unlock, { capture: true });
      document.removeEventListener('click', onClick, { capture: true });
    };
  }, []);

  // New notifications → chime or crisis alert. The notifications already there on load are silent.
  const seenRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    const ids = state.notifications.map((n) => n.id);
    if (!seenRef.current) {
      seenRef.current = new Set(ids);
      return;
    }
    const seen = seenRef.current;
    const fresh = state.notifications.filter((n) => !seen.has(n.id));
    seenRef.current = new Set(ids);
    if (!fresh.length) return;
    playSfx(fresh.some((n) => sfxForNotification(n) === 'alert') ? 'alert' : 'notification');
  }, [state.notifications]);

  // Weekly income (the simulation deposits it when the day becomes a multiple of 7).
  const lastDayRef = useRef(state.day);
  const lastMoneyRef = useRef(state.stats.money);
  useEffect(() => {
    const dayChanged = state.day !== lastDayRef.current;
    if (dayChanged && state.day % 7 === 0 && state.stats.money > lastMoneyRef.current) playSfx('money');
    lastDayRef.current = state.day;
    lastMoneyRef.current = state.stats.money;
  }, [state.day, state.stats.money]);

  // Ambient river and temple bells near the ghats when zoomed in.
  useEffect(() => {
    const id = setInterval(() => {
      const city = latestStateRef.current;
      const cam = getCameraController()?.getCamera();
      const quality = getGraphicsSnapshot().qualityLevel;
      if (!city || !cam || cam.zoom <= 0) {
        setAmbientLevel(0);
        return;
      }
      const worldX = (cam.canvasSize.width / 2 - cam.offset.x) / cam.zoom;
      const worldY = (cam.canvasSize.height / 2 - cam.offset.y) / cam.zoom;
      const { gridX, gridY } = screenToGrid(worldX, worldY, 0, 0);
      const near = ambientLevel(cam.zoom, 1, quality) > 0
        ? countRiverfront(city, gridX, gridY, AUDIO_CONFIG.ambient.searchRadius)
        : 0;
      setAmbientLevel(ambientLevel(cam.zoom, near, quality));
    }, AUDIO_CONFIG.ambient.updateMs);
    return () => {
      clearInterval(id);
      setAmbientLevel(0);
    };
  }, [latestStateRef]);
}
