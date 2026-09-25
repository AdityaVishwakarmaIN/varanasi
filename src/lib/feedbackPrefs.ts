/**
 * Per-player feedback preferences (S5-T5, S5-T8): "Show problem icons" and the "Reset tips" signal.
 * Stored in localStorage (UI preferences, not the save). Every access is wrapped: storage can be unavailable.
 */

const ICONS_KEY = 'isocity-problem-icons';
/** Same key as useTipSystem's shown-tips list. */
export const SHOWN_TIPS_KEY = 'isocity-tips-shown';
export const TIPS_RESET_EVENT = 'isocity-tips-reset';

let showIcons: boolean | null = null;
const listeners = new Set<() => void>();

/** "Show problem icons" (default on). Cached after the first read, so the renderer can call it every frame. */
export function getShowProblemIcons(): boolean {
  if (showIcons !== null) return showIcons;
  showIcons = true;
  try {
    if (typeof window !== 'undefined' && window.localStorage.getItem(ICONS_KEY) === 'false') showIcons = false;
  } catch {
    // storage unavailable: keep the default
  }
  return showIcons;
}

export function setShowProblemIcons(value: boolean): void {
  showIcons = value;
  try {
    if (typeof window !== 'undefined') window.localStorage.setItem(ICONS_KEY, value ? 'true' : 'false');
  } catch {
    // storage unavailable: the choice lasts for this session
  }
  listeners.forEach((l) => l());
}

/** For useSyncExternalStore. */
export function subscribeFeedbackPrefs(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Forgets which tips were shown, so each shows once more when it next matters. */
export function resetShownTips(): void {
  try {
    if (typeof window !== 'undefined') window.localStorage.removeItem(SHOWN_TIPS_KEY);
  } catch {
    // ignore
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(TIPS_RESET_EVENT));
}
