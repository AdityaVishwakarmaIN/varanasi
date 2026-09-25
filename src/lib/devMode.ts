/**
 * Developer tools gate (S5-T12): the benchmark buttons, sprite test view, example-state loaders
 * and the perf HUD are only available when the page URL has `?dev=1`.
 */
export const DEV_MODE_CONFIG = {
  param: 'dev',
  value: '1',
} as const;

/** Pure check on a query string (`window.location.search`). */
export function isDevModeSearch(search: string | null | undefined): boolean {
  if (!search) return false;
  return new URLSearchParams(search).get(DEV_MODE_CONFIG.param) === DEV_MODE_CONFIG.value;
}

/** True in the browser when the current URL has `?dev=1`. Always false on the server. */
export function isDevMode(): boolean {
  if (typeof window === 'undefined') return false;
  return isDevModeSearch(window.location.search);
}
