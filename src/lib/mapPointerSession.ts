/**
 * Mouse press tracking for the map canvas.
 *
 * A press that starts on the map (zone rectangle, road / rail stroke, pan, held building placement)
 * must keep going until the button is released, wherever the pointer goes: over a toast or panel
 * floating above the map, over the sidebar or top bar, or outside the browser window. The canvas
 * container only receives events while the pointer is over it, so for the life of the press the
 * moves and the release are read from the window instead.
 *
 * Kept free of React so the rules can be unit tested with a plain EventTarget.
 */

export interface MapPointerSessionHandlers {
  /** The pointer moved (anywhere on the page) while the button is held. */
  onMove: (e: { clientX: number; clientY: number }) => void;
  /** The button was released: finish the gesture (commit the zone rectangle, end the pan, ...). */
  onEnd: () => void;
  /** The window lost focus mid-press (Alt+Tab, a system dialog): abandon the gesture without committing it. */
  onCancel: () => void;
}

/** `MouseEvent.buttons` bit for a `MouseEvent.button` value (they are numbered differently). */
export function buttonsMaskFor(button: number): number {
  switch (button) {
    case 0: return 1; // primary
    case 1: return 4; // middle
    case 2: return 2; // secondary
    default: return 1 << button; // back (3) = 8, forward (4) = 16
  }
}

/**
 * A move with the session's button no longer held means the release happened where we could not
 * see it (outside the window on some platforms). Treat it as the release so a drag never sticks.
 */
export function isReleaseMissed(buttons: number | undefined, button: number): boolean {
  return typeof buttons === 'number' && (buttons & buttonsMaskFor(button)) === 0;
}

// Option objects, not a bare `true`: some EventTarget implementations (Node) ignore a boolean on removal.
const CAPTURE = { capture: true } as const;

type MouseLike = Event & { clientX?: number; clientY?: number; button?: number; buttons?: number };

/**
 * Listen on `target` (the window) for the rest of a press of `button`. Returns `stop`, which removes
 * the listeners without calling any handler (for unmount). The session ends itself exactly once:
 * on the button's release, on a move that shows the release was missed, or on window blur.
 */
export function startMapPointerSession(
  target: EventTarget,
  button: number,
  handlers: MapPointerSessionHandlers,
): () => void {
  let active = true;

  const stop = () => {
    if (!active) return;
    active = false;
    target.removeEventListener('mousemove', onMove, CAPTURE);
    target.removeEventListener('mouseup', onUp, CAPTURE);
    target.removeEventListener('blur', onBlur);
  };

  function onMove(event: Event) {
    const e = event as MouseLike;
    if (isReleaseMissed(e.buttons, button)) {
      stop();
      handlers.onEnd();
      return;
    }
    handlers.onMove({ clientX: e.clientX ?? 0, clientY: e.clientY ?? 0 });
  }

  function onUp(event: Event) {
    const e = event as MouseLike;
    // Another button going up mid-drag does not end it (a right-click cancel is handled on its press)
    if (e.button !== undefined && e.button !== button) return;
    stop();
    handlers.onEnd();
  }

  function onBlur() {
    stop();
    handlers.onCancel();
  }

  // Capture phase: a floating panel that stops propagation of its own mouse events cannot swallow the drag.
  target.addEventListener('mousemove', onMove, CAPTURE);
  target.addEventListener('mouseup', onUp, CAPTURE);
  target.addEventListener('blur', onBlur);
  return stop;
}
