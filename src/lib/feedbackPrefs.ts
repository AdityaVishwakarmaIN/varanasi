/**
 * Per-player feedback preferences (S5-T5, S5-T8): "Show problem icons" and the "Reset tips" signal.
 * Stored in localStorage (UI preferences, not the save). Every access is wrapped: storage can be unavailable.
 */

const ICONS_KEY = 'isocity-problem-icons';
/** useTipSystem's shown-tips list: `{ cityId, ids }` (an old plain array is read as belonging to no city). */
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

/** "Show tips" (default on). "Skip All Tips" turns it off; Settings turns it back on. */
const TIPS_DISABLED_KEY = 'isocity-tips-disabled';
let tipsEnabled: boolean | null = null;

export function getTipsEnabled(): boolean {
  if (tipsEnabled !== null) return tipsEnabled;
  tipsEnabled = true;
  try {
    if (typeof window !== 'undefined' && window.localStorage.getItem(TIPS_DISABLED_KEY) === 'true') tipsEnabled = false;
  } catch {
    // storage unavailable: keep the default
  }
  return tipsEnabled;
}

export function setTipsEnabled(value: boolean): void {
  tipsEnabled = value;
  try {
    if (typeof window !== 'undefined') {
      if (value) window.localStorage.removeItem(TIPS_DISABLED_KEY);
      else window.localStorage.setItem(TIPS_DISABLED_KEY, 'true');
    }
  } catch {
    // storage unavailable: the choice lasts for this session
  }
  listeners.forEach((l) => l());
}

/** Forgets which tips were shown and turns tips back on, so each shows once more when it next matters. */
export function resetShownTips(): void {
  try {
    if (typeof window !== 'undefined') window.localStorage.removeItem(SHOWN_TIPS_KEY);
  } catch {
    // ignore
  }
  setTipsEnabled(true);
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(TIPS_RESET_EVENT));
}

/** Per-city "Getting started" checklist: dismissed or completed cities don't show it again. */
const CHECKLIST_KEY_PREFIX = 'isocity-checklist-done-';

export function isChecklistClosed(cityId: string): boolean {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem(CHECKLIST_KEY_PREFIX + cityId) === 'true';
  } catch {
    return false;
  }
}

export function closeChecklist(cityId: string): void {
  try {
    if (typeof window !== 'undefined') window.localStorage.setItem(CHECKLIST_KEY_PREFIX + cityId, 'true');
  } catch {
    // storage unavailable: closed for this session only
  }
}
