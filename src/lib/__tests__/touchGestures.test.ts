import { describe, expect, it } from 'vitest';
import { TOUCH_CONFIG } from '@/lib/controlsConfig';
import {
  classifyTouch,
  computePinchPose,
  createPinchStart,
  hasMovedBeyondTap,
  isDrawModeTool,
  needsTapConfirm,
} from '@/lib/touchGestures';
import { getInteractionSkips } from '@/lib/cameraMotion';

describe('classifyTouch', () => {
  it('uses the S1-T11 thresholds', () => {
    expect(TOUCH_CONFIG.tapMaxMs).toBe(250);
    expect(TOUCH_CONFIG.tapMaxMovePx).toBe(10);
    expect(TOUCH_CONFIG.longPressMs).toBe(500);
    expect(TOUCH_CONFIG.confirmCostFraction).toBe(0.1);
  });

  it('short and still is a tap', () => {
    expect(classifyTouch(0, 0)).toBe('tap');
    expect(classifyTouch(249, 9.9)).toBe('tap');
  });

  it('moving 10 px or more is a drag, however long', () => {
    expect(classifyTouch(50, 10)).toBe('drag');
    expect(classifyTouch(900, 40)).toBe('drag');
  });

  it('still for 500 ms or more is a long-press', () => {
    expect(classifyTouch(500, 0)).toBe('longPress');
    expect(classifyTouch(2000, 5)).toBe('longPress');
  });

  it('still, between tap and long-press, does nothing', () => {
    expect(classifyTouch(250, 0)).toBe('hold');
    expect(classifyTouch(499, 3)).toBe('hold');
  });

  it('measures movement as distance', () => {
    expect(hasMovedBeyondTap(6, 6)).toBe(false); // 8.5 px
    expect(hasMovedBeyondTap(8, 8)).toBe(true); // 11.3 px
    expect(hasMovedBeyondTap(0, -10)).toBe(true);
  });
});

describe('isDrawModeTool', () => {
  it('is on for road, rail, subway and zone tools only', () => {
    for (const tool of ['road', 'rail', 'subway', 'zone_residential', 'zone_commercial', 'zone_industrial', 'zone_dezone'] as const) {
      expect(isDrawModeTool(tool)).toBe(true);
    }
    for (const tool of ['select', 'bulldoze', 'park', 'hospital', 'zone_water', 'zone_land'] as const) {
      expect(isDrawModeTool(tool)).toBe(false);
    }
  });
});

describe('needsTapConfirm', () => {
  it('asks when the cost is more than 10% of money', () => {
    expect(needsTapConfirm(1000, 100000)).toBe(false);
    expect(needsTapConfirm(10000, 100000)).toBe(false); // exactly 10%
    expect(needsTapConfirm(10001, 100000)).toBe(true);
    expect(needsTapConfirm(1000, 5000)).toBe(true);
  });

  it('never asks for free tools, and always asks when broke', () => {
    expect(needsTapConfirm(0, 0)).toBe(false);
    expect(needsTapConfirm(25, 0)).toBe(true);
    expect(needsTapConfirm(25, -500)).toBe(true);
  });
});

describe('computePinchPose', () => {
  const pose = { zoom: 1, offset: { x: 100, y: 50 } };

  it('keeps the world point under the pinch centre fixed while zooming', () => {
    const centre = { x: 300, y: 200 };
    const start = createPinchStart(pose, 100, centre);
    const next = computePinchPose(start, 200, centre, 0.1, 4);
    expect(next.zoom).toBeCloseTo(2);
    const before = { x: (centre.x - pose.offset.x) / pose.zoom, y: (centre.y - pose.offset.y) / pose.zoom };
    const after = { x: (centre.x - next.offset.x) / next.zoom, y: (centre.y - next.offset.y) / next.zoom };
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  it('pans with the centre when the fingers move together', () => {
    const start = createPinchStart(pose, 100, { x: 300, y: 200 });
    const next = computePinchPose(start, 100, { x: 330, y: 180 }, 0.1, 4);
    expect(next.zoom).toBe(1);
    expect(next.offset).toEqual({ x: 130, y: 30 });
  });

  it('clamps zoom to the limits', () => {
    const start = createPinchStart(pose, 100, { x: 0, y: 0 });
    expect(computePinchPose(start, 1000, { x: 0, y: 0 }, 0.1, 2).zoom).toBe(2);
    expect(computePinchPose(start, 1, { x: 0, y: 0 }, 0.5, 2).zoom).toBe(0.5);
  });
});

describe('getInteractionSkips', () => {
  const idle = { isMobile: false, panning: false, pinching: false, wheelZooming: false, zoom: 0.3 };

  it('skips nothing when the camera is still', () => {
    expect(getInteractionSkips(idle, 0.5)).toEqual({ skipUpdates: false, skipAnimated: false, skipSmall: false });
    expect(getInteractionSkips({ ...idle, isMobile: true }, 0.5).skipAnimated).toBe(false);
  });

  it('treats pan, pinch and wheel zoom the same', () => {
    for (const moving of [{ panning: true }, { pinching: true }, { wheelZooming: true }]) {
      expect(getInteractionSkips({ ...idle, ...moving }, 0.5).skipSmall).toBe(true);
      expect(getInteractionSkips({ ...idle, ...moving, zoom: 0.8 }, 0.5).skipSmall).toBe(false);
      const mobile = getInteractionSkips({ ...idle, ...moving, isMobile: true, zoom: 0.8 }, 0.5);
      expect(mobile.skipAnimated).toBe(true);
      expect(mobile.skipUpdates).toBe(true);
    }
  });
});
