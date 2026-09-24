// Tunable numbers for saving (README rule 6: no magic numbers).

export const AUTOSAVE_CONFIG = {
  /** Autosave this often, but only if the city changed since the last save. */
  intervalMs: 30_000,
  /** Also save right away when the tab becomes hidden (visibilitychange → hidden). */
  saveOnHidden: true,
  /**
   * Also save on `pagehide` (tab closing / navigating away). Best effort: the
   * worker compression and the IndexedDB write are async, so the browser may
   * unload the page before they finish. `visibilitychange → hidden` fires
   * earlier in the same sequence and usually gets the write through.
   */
  saveOnPageHide: true,
  /** How long the "couldn't save" toast stays up before hiding itself. */
  errorToastMs: 12_000,
} as const;
