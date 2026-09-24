/**
 * Desktop controls: every key binding and camera-feel number lives here (S1-T10).
 *
 * - `KEY_BINDINGS` is the single list of keyboard shortcuts. `useKeyboardControls` (used from
 *   `Game.tsx`) is the one place that listens to the keyboard and acts on it; the canvas only reads
 *   the shared held-key state for continuous WASD panning. The Controls help panel is generated from
 *   `KEY_BINDINGS` + `MOUSE_BINDINGS`, so it always matches.
 * - `CAMERA_CONFIG` holds the smooth zoom / pan inertia tuning used by `src/lib/cameraMotion.ts`.
 *
 * Pure module: no React, no DOM access at import time (safe for unit tests).
 */
import { msg } from 'gt-next';

export type ControlAction =
  | 'panUp'
  | 'panDown'
  | 'panLeft'
  | 'panRight'
  | 'zoomIn'
  | 'zoomOut'
  | 'togglePause'
  | 'speed1'
  | 'speed2'
  | 'speed3'
  | 'toolResidential'
  | 'toolCommercial'
  | 'toolIndustrial'
  | 'toolRoad'
  | 'toolBulldoze'
  | 'cancel'
  | 'cycleOverlay'
  | 'showHelp'
  | 'perfHud';

export interface KeyBinding {
  action: ControlAction;
  /** Values of `KeyboardEvent.key`, compared case-insensitively (`' '` is Space). */
  keys: readonly string[];
  /** How the key is shown in the help panel. */
  keyLabel: string;
  /** What it does (translatable). */
  label: string;
  /**
   * Continuous bindings are "held" (camera panning), read every frame from `heldActions`.
   * Everything else fires once per key press.
   */
  continuous?: boolean;
  /**
   * Documentation-only row: listed in the help panel but not handled by `useKeyboardControls`
   * because another component owns the key.
   */
  handledElsewhere?: boolean;
}

export const KEY_BINDINGS: readonly KeyBinding[] = [
  { action: 'panUp', keys: ['w', 'ArrowUp'], keyLabel: 'W / ↑', label: msg('Pan up'), continuous: true },
  { action: 'panLeft', keys: ['a', 'ArrowLeft'], keyLabel: 'A / ←', label: msg('Pan left'), continuous: true },
  { action: 'panDown', keys: ['s', 'ArrowDown'], keyLabel: 'S / ↓', label: msg('Pan down'), continuous: true },
  { action: 'panRight', keys: ['d', 'ArrowRight'], keyLabel: 'D / →', label: msg('Pan right'), continuous: true },
  // '=' is the unshifted '+' key on most layouts; numpad +/- report '+' and '-'.
  { action: 'zoomIn', keys: ['+', '='], keyLabel: '+', label: msg('Zoom in (screen centre)') },
  { action: 'zoomOut', keys: ['-', '_'], keyLabel: '-', label: msg('Zoom out (screen centre)') },
  // Space is a *tap* (see SPACE_TAP_MAX_MS); holding Space and dragging pans instead.
  { action: 'togglePause', keys: [' ', 'p'], keyLabel: 'Space (tap) / P', label: msg('Pause / resume') },
  { action: 'speed1', keys: ['1'], keyLabel: '1', label: msg('Normal speed') },
  { action: 'speed2', keys: ['2'], keyLabel: '2', label: msg('Fast speed') },
  { action: 'speed3', keys: ['3'], keyLabel: '3', label: msg('Fastest speed') },
  { action: 'toolResidential', keys: ['r'], keyLabel: 'R', label: msg('Residential zone tool') },
  { action: 'toolCommercial', keys: ['c'], keyLabel: 'C', label: msg('Commercial zone tool') },
  { action: 'toolIndustrial', keys: ['i'], keyLabel: 'I', label: msg('Industrial zone tool') },
  { action: 'toolRoad', keys: ['x'], keyLabel: 'X', label: msg('Road tool') },
  { action: 'toolBulldoze', keys: ['b'], keyLabel: 'B', label: msg('Bulldoze') },
  {
    action: 'cancel',
    keys: ['Escape'],
    keyLabel: 'Esc',
    label: msg('Close overlay → close panel → deselect → Select tool'),
  },
  { action: 'cycleOverlay', keys: ['Tab'], keyLabel: 'Tab / Shift+Tab', label: msg('Cycle overlays') },
  { action: 'showHelp', keys: ['?'], keyLabel: '?', label: msg('Show this controls panel') },
  // F3 is documentation-only here: the Performance HUD component (S1-T2, PerfHud) registers its own
  // F3 listener. Handling it in useKeyboardControls as well would toggle the HUD twice per press.
  { action: 'perfHud', keys: ['F3'], keyLabel: 'F3', label: msg('Performance HUD'), handledElsewhere: true },
];

export interface MouseBinding {
  input: string;
  label: string;
}

/** Mouse rows for the help panel (handled in `CanvasIsometricGrid`). */
export const MOUSE_BINDINGS: readonly MouseBinding[] = [
  { input: msg('Left-click'), label: msg('Use current tool / select') },
  { input: msg('Left-drag'), label: msg('Draw roads, rail and zones; pan with the Select tool') },
  { input: msg('Right-drag'), label: msg('Pan') },
  { input: msg('Right-click'), label: msg('Cancel current tool (back to Select)') },
  { input: msg('Middle-drag / Space + left-drag'), label: msg('Pan') },
  { input: msg('Mouse wheel'), label: msg('Zoom towards the cursor') },
];

/** A Space press shorter than this (ms), with no Space+drag pan, toggles pause. */
export const SPACE_TAP_MAX_MS = 200;

export const CAMERA_CONFIG = {
  /** Duration of the smooth zoom animation towards the target zoom (ease-out). */
  zoomEaseMs: 120,
  /** Mouse wheel: zoom change per notch = wheelZoomStep × max(wheelZoomMinScale, zoom). */
  wheelZoomStep: 0.05,
  wheelZoomMinScale: 0.5,
  /** `+` / `-` keys: multiply / divide the target zoom by this factor per press. */
  keyZoomFactor: 1.25,
  /** Pan inertia: velocity is multiplied by this every 60 Hz frame after a drag-pan is released. */
  panInertiaFriction: 0.9,
  /** Inertia stops when speed falls below this (px per 60 Hz frame). */
  panInertiaMinSpeed: 0.3,
  /** Release speed below this (px per 60 Hz frame) starts no inertia at all. */
  panInertiaStartSpeed: 1.5,
  /** Cap on the release speed (px per 60 Hz frame) so a flick cannot fling the map away. */
  panInertiaMaxSpeed: 60,
  /** Only pointer samples from the last N ms are used to estimate the release velocity. */
  panVelocitySampleMs: 80,
  /** If the pointer was still for longer than this before release, there is no inertia. */
  panReleaseIdleMs: 60,
} as const;

/**
 * Touch gestures (S1-T11). Handled in `CanvasIsometricGrid` via the pure helpers in
 * `src/lib/touchGestures.ts`.
 */
export const TOUCH_CONFIG = {
  /** A touch shorter than this (ms) that moved less than `tapMaxMovePx` is a tap (uses the tool once). */
  tapMaxMs: 250,
  /** Moving further than this (px) from the start turns a touch into a drag (pan, or draw in Draw mode). */
  tapMaxMovePx: 10,
  /** Holding still this long (ms) inspects the tile (opens tile info) with any tool. */
  longPressMs: 500,
  /** A tap that would cost more than this fraction of current money asks for confirmation first. */
  confirmCostFraction: 0.1,
} as const;

/** Reference frame length used to express per-frame values (60 Hz). */
export const FRAME_MS = 1000 / 60;

export interface KeyEventLike {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
}

const bindingByKey: Map<string, KeyBinding> = (() => {
  const map = new Map<string, KeyBinding>();
  for (const binding of KEY_BINDINGS) {
    for (const key of binding.keys) map.set(key.toLowerCase(), binding);
  }
  return map;
})();

/**
 * Find the binding for a key event. Returns null for unbound keys and for any key pressed with
 * Ctrl/Cmd/Alt, so browser and OS shortcuts (Ctrl+R, Cmd+C, ...) are never swallowed.
 */
export function matchKeyBinding(e: KeyEventLike): KeyBinding | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  if (!e.key) return null;
  return bindingByKey.get(e.key.toLowerCase()) ?? null;
}

/**
 * True when keyboard shortcuts must be ignored because the user is typing
 * (text inputs, textareas, selects, contenteditable).
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || typeof el.closest !== 'function') return false;
  if (el.isContentEditable) return true;
  return !!el.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""]');
}

/** True when focus is inside an open modal/menu, which owns its own keys (Esc, Tab, Space). */
export function isInsideModal(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || typeof el.closest !== 'function') return false;
  return !!el.closest('[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]');
}

/**
 * State shared between `useKeyboardControls` (which owns the keyboard listeners) and
 * `CanvasIsometricGrid` (which owns the camera). Plain mutable object in a ref: no re-renders.
 */
export interface CameraControls {
  /** Zoom one step in (+1) or out (-1) towards the centre of the screen, animated. */
  zoomStep: (direction: 1 | -1) => void;
}

export interface SharedControlsState {
  /** Continuous actions (WASD / arrows) currently held down. */
  heldActions: Set<ControlAction>;
  /** Space is currently held (Space + left-drag pans). */
  spaceHeld: boolean;
  /** A Space + drag pan happened during the current Space press (so its release is not a pause tap). */
  spaceUsedForPan: boolean;
  /** Registered by the canvas while mounted. */
  camera: CameraControls | null;
}

export function createSharedControlsState(): SharedControlsState {
  return { heldActions: new Set(), spaceHeld: false, spaceUsedForPan: false, camera: null };
}

/** Register (or clear, with null) the canvas camera API used by keyboard zoom. */
export function setCameraControls(state: SharedControlsState, camera: CameraControls | null): void {
  state.camera = camera;
}

/** Next overlay in `order` after `current` (wraps; `step` -1 goes backwards). */
export function cycleValue<T>(order: readonly T[], current: T, step: 1 | -1 = 1): T {
  if (order.length === 0) return current;
  const index = order.indexOf(current);
  if (index < 0) return order[0];
  return order[(index + step + order.length) % order.length];
}
