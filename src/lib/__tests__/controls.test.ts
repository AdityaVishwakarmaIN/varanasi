import { describe, expect, it } from 'vitest';
import { KEY_BINDINGS, cycleValue, matchKeyBinding } from '@/lib/controlsConfig';
import {
  PanVelocityTracker,
  createZoomAnimation,
  sampleZoomAnimation,
  shouldStartInertia,
  stepInertia,
} from '@/lib/cameraMotion';

describe('matchKeyBinding', () => {
  it('matches every key of every binding, case-insensitively', () => {
    for (const binding of KEY_BINDINGS) {
      for (const key of binding.keys) {
        expect(matchKeyBinding({ key })?.action).toBe(binding.action);
        expect(matchKeyBinding({ key: key.toUpperCase() })?.action).toBe(binding.action);
      }
    }
  });

  it('maps the target control scheme', () => {
    expect(matchKeyBinding({ key: ' ' })?.action).toBe('togglePause');
    expect(matchKeyBinding({ key: 'P' })?.action).toBe('togglePause');
    expect(matchKeyBinding({ key: '1' })?.action).toBe('speed1');
    expect(matchKeyBinding({ key: '3' })?.action).toBe('speed3');
    expect(matchKeyBinding({ key: 'r' })?.action).toBe('toolResidential');
    expect(matchKeyBinding({ key: 'C' })?.action).toBe('toolCommercial');
    expect(matchKeyBinding({ key: 'i' })?.action).toBe('toolIndustrial');
    expect(matchKeyBinding({ key: 'x' })?.action).toBe('toolRoad');
    expect(matchKeyBinding({ key: 'b' })?.action).toBe('toolBulldoze');
    expect(matchKeyBinding({ key: '=' })?.action).toBe('zoomIn');
    expect(matchKeyBinding({ key: '+' })?.action).toBe('zoomIn');
    expect(matchKeyBinding({ key: '-' })?.action).toBe('zoomOut');
    expect(matchKeyBinding({ key: 'Tab' })?.action).toBe('cycleOverlay');
    expect(matchKeyBinding({ key: '?' })?.action).toBe('showHelp');
    expect(matchKeyBinding({ key: 'Escape' })?.action).toBe('cancel');
    expect(matchKeyBinding({ key: 'ArrowUp' })?.continuous).toBe(true);
  });

  it('ignores unbound keys and anything with Ctrl/Cmd/Alt', () => {
    expect(matchKeyBinding({ key: 'q' })).toBeNull();
    expect(matchKeyBinding({ key: 'r', ctrlKey: true })).toBeNull();
    expect(matchKeyBinding({ key: 'c', metaKey: true })).toBeNull();
    expect(matchKeyBinding({ key: '1', altKey: true })).toBeNull();
  });

  it('keeps F3 documentation-only (the perf HUD owns that key)', () => {
    expect(matchKeyBinding({ key: 'F3' })?.handledElsewhere).toBe(true);
  });

  it('has no key bound twice', () => {
    const seen = new Set<string>();
    for (const binding of KEY_BINDINGS) {
      for (const key of binding.keys) {
        expect(seen.has(key.toLowerCase())).toBe(false);
        seen.add(key.toLowerCase());
      }
    }
  });
});

describe('cycleValue', () => {
  const order = ['none', 'power', 'water'] as const;
  it('moves forward and wraps', () => {
    expect(cycleValue(order, 'none')).toBe('power');
    expect(cycleValue(order, 'water')).toBe('none');
  });
  it('moves backward and wraps', () => {
    expect(cycleValue(order, 'none', -1)).toBe('water');
  });
});

describe('smooth zoom', () => {
  it('keeps the anchor world point fixed and ends exactly at the target', () => {
    const pose = { zoom: 1, offset: { x: 100, y: 50 } };
    const anchor = { x: 400, y: 300 };
    const anim = createZoomAnimation(pose, 2, anchor, 0, 120);
    const worldX = (anchor.x - pose.offset.x) / pose.zoom;
    const worldY = (anchor.y - pose.offset.y) / pose.zoom;
    for (const t of [0, 30, 60, 119, 120, 500]) {
      const s = sampleZoomAnimation(anim, t);
      expect(worldX * s.zoom + s.offset.x).toBeCloseTo(anchor.x, 6);
      expect(worldY * s.zoom + s.offset.y).toBeCloseTo(anchor.y, 6);
    }
    expect(sampleZoomAnimation(anim, 60).done).toBe(false);
    const end = sampleZoomAnimation(anim, 120);
    expect(end.done).toBe(true);
    expect(end.zoom).toBe(2);
  });

  it('eases out (more than half-way at half time)', () => {
    const anim = createZoomAnimation({ zoom: 1, offset: { x: 0, y: 0 } }, 2, { x: 0, y: 0 }, 0, 120);
    expect(sampleZoomAnimation(anim, 60).zoom).toBeGreaterThan(1.5);
  });
});

describe('pan inertia', () => {
  it('decays by the friction per 60 Hz frame and eventually stops', () => {
    let v = { x: 20, y: 0 };
    const first = stepInertia(v, 1000 / 60, 0.9);
    expect(first.delta.x).toBeCloseTo(20, 6);
    expect(first.velocity.x).toBeCloseTo(18, 6);
    let frames = 0;
    let stopped = false;
    while (!stopped && frames < 1000) {
      const step = stepInertia(v, 1000 / 60, 0.9);
      v = step.velocity;
      stopped = step.stopped;
      frames++;
    }
    expect(stopped).toBe(true);
    expect(frames).toBeLessThan(100);
  });

  it('is frame-rate independent', () => {
    const at60 = stepInertia(stepInertia({ x: 10, y: 10 }, 1000 / 60, 0.9).velocity, 1000 / 60, 0.9).velocity;
    const at30 = stepInertia({ x: 10, y: 10 }, 2000 / 60, 0.9).velocity;
    expect(at30.x).toBeCloseTo(at60.x, 6);
  });

  it('estimates release velocity from recent samples only', () => {
    const tracker = new PanVelocityTracker();
    tracker.push(0, 0, 0);
    tracker.push(10, 0, 16);
    tracker.push(20, 0, 32);
    const v = tracker.getVelocity(40);
    expect(v.x).toBeGreaterThan(5);
    expect(shouldStartInertia(v)).toBe(true);
    // Pointer held still before release → no glide
    expect(tracker.getVelocity(500)).toEqual({ x: 0, y: 0 });
    expect(shouldStartInertia({ x: 0.2, y: 0 })).toBe(false);
  });
});
