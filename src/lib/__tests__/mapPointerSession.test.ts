import { describe, expect, it, vi } from 'vitest';
import { buttonsMaskFor, isReleaseMissed, startMapPointerSession } from '@/lib/mapPointerSession';

function mouse(type: string, init: { clientX?: number; clientY?: number; button?: number; buttons?: number } = {}) {
  return Object.assign(new Event(type), { clientX: 0, clientY: 0, button: 0, buttons: 1, ...init });
}

function setup(button = 0) {
  const win = new EventTarget();
  const handlers = { onMove: vi.fn(), onEnd: vi.fn(), onCancel: vi.fn() };
  const stop = startMapPointerSession(win, button, handlers);
  return { win, handlers, stop };
}

describe('mapPointerSession', () => {
  it('maps button numbers to the buttons bitmask', () => {
    expect(buttonsMaskFor(0)).toBe(1);
    expect(buttonsMaskFor(1)).toBe(4);
    expect(buttonsMaskFor(2)).toBe(2);
    expect(isReleaseMissed(1, 0)).toBe(false);
    expect(isReleaseMissed(0, 0)).toBe(true);
    expect(isReleaseMissed(2, 2)).toBe(false);
    expect(isReleaseMissed(1, 2)).toBe(true);
  });

  it('forwards every move while the button is held, wherever the pointer is', () => {
    const { win, handlers } = setup();
    win.dispatchEvent(mouse('mousemove', { clientX: 10, clientY: 20 }));
    win.dispatchEvent(mouse('mousemove', { clientX: 900, clientY: -5 }));
    expect(handlers.onMove).toHaveBeenNthCalledWith(1, { clientX: 10, clientY: 20 });
    expect(handlers.onMove).toHaveBeenNthCalledWith(2, { clientX: 900, clientY: -5 });
    expect(handlers.onEnd).not.toHaveBeenCalled();
  });

  it('ends once on the release of its own button and then stops listening', () => {
    const { win, handlers } = setup();
    win.dispatchEvent(mouse('mouseup', { button: 2, buttons: 1 })); // another button: ignored
    expect(handlers.onEnd).not.toHaveBeenCalled();
    win.dispatchEvent(mouse('mouseup', { button: 0, buttons: 0 }));
    win.dispatchEvent(mouse('mouseup', { button: 0, buttons: 0 }));
    win.dispatchEvent(mouse('mousemove', { clientX: 5 }));
    expect(handlers.onEnd).toHaveBeenCalledTimes(1);
    expect(handlers.onMove).not.toHaveBeenCalled();
  });

  it('treats a move without the button held as a missed release (no stuck drag)', () => {
    const { win, handlers } = setup();
    win.dispatchEvent(mouse('mousemove', { buttons: 0 }));
    expect(handlers.onEnd).toHaveBeenCalledTimes(1);
    expect(handlers.onMove).not.toHaveBeenCalled();
  });

  it('a right-button pan keeps going while only the right button is held', () => {
    const { win, handlers } = setup(2);
    win.dispatchEvent(mouse('mousemove', { buttons: 2 }));
    expect(handlers.onMove).toHaveBeenCalledTimes(1);
    win.dispatchEvent(mouse('mouseup', { button: 2, buttons: 0 }));
    expect(handlers.onEnd).toHaveBeenCalledTimes(1);
  });

  it('cancels (does not commit) when the window loses focus', () => {
    const { win, handlers } = setup();
    win.dispatchEvent(new Event('blur'));
    win.dispatchEvent(mouse('mouseup'));
    expect(handlers.onCancel).toHaveBeenCalledTimes(1);
    expect(handlers.onEnd).not.toHaveBeenCalled();
  });

  it('stop() detaches without calling any handler', () => {
    const { win, handlers, stop } = setup();
    stop();
    win.dispatchEvent(mouse('mousemove'));
    win.dispatchEvent(mouse('mouseup'));
    win.dispatchEvent(new Event('blur'));
    expect(handlers.onMove).not.toHaveBeenCalled();
    expect(handlers.onEnd).not.toHaveBeenCalled();
    expect(handlers.onCancel).not.toHaveBeenCalled();
  });
});
