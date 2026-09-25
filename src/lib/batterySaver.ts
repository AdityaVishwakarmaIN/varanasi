/**
 * Battery saver (S5-T10): when the game is paused and the player has not touched anything for
 * a few seconds, the animation loop drops to a low frame rate. Any input returns to full rate
 * on the very next frame (the loop checks every requestAnimationFrame).
 */
export const BATTERY_SAVER_CONFIG = {
  /** No input for this long (while paused) turns the saver on. */
  idleMs: 5000,
  /** Frame rate while saving. */
  fps: 10,
} as const;

/**
 * Minimum ms between rendered frames: 0 = no extra limit.
 * Pure, so it is unit-tested; `now` and `lastInputAt` share one clock (performance.now()).
 */
export function batterySaverFrameMs(paused: boolean, lastInputAt: number, now: number): number {
  if (!paused) return 0;
  if (now - lastInputAt < BATTERY_SAVER_CONFIG.idleMs) return 0;
  return 1000 / BATTERY_SAVER_CONFIG.fps;
}

let lastInputAt = typeof performance !== 'undefined' ? performance.now() : 0;
let installed = false;

function noteInput(): void {
  lastInputAt = performance.now();
}

/** Starts tracking input (idempotent). Pointer, touch, wheel and keys all count. */
export function installBatterySaverInputTracking(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const opts: AddEventListenerOptions = { capture: true, passive: true };
  for (const type of ['pointerdown', 'pointermove', 'touchstart', 'wheel', 'keydown'] as const) {
    window.addEventListener(type, noteInput, opts);
  }
  lastInputAt = performance.now();
}

/** Frame interval for the render loops right now (see batterySaverFrameMs). */
export function currentBatterySaverFrameMs(paused: boolean, now: number): number {
  return batterySaverFrameMs(paused, lastInputAt, now);
}
