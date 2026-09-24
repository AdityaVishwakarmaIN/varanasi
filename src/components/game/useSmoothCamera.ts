'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  CameraPose,
  Vec2,
  ZoomAnimation,
  createZoomAnimation,
  sampleZoomAnimation,
  shouldStartInertia,
  stepInertia,
} from '@/lib/cameraMotion';

export interface SmoothCameraOptions {
  /** Current (live) camera pose. */
  getPose: () => CameraPose;
  /** Apply an absolute pose (the caller clamps offset to the map bounds). */
  applyPose: (pose: CameraPose) => void;
  /** Move the camera by a screen-space delta (the caller clamps). */
  panBy: (dx: number, dy: number) => void;
}

export interface SmoothCamera {
  /** Animate zoom to `targetZoom` (already clamped by the caller), keeping `anchor` (canvas px) fixed. */
  animateZoomTo: (targetZoom: number, anchor: Vec2) => void;
  /** The zoom the camera is heading to (the live zoom when idle). Accumulate wheel/key steps on this. */
  getTargetZoom: () => number;
  /** Start pan inertia with a release velocity in px per 60 Hz frame (ignored if too slow). */
  startInertia: (velocity: Vec2) => void;
  /** Stop any zoom animation and inertia immediately (e.g. when a new drag starts). */
  stop: () => void;
  /** True while a zoom animation or inertia is running. */
  isMoving: () => boolean;
}

/**
 * Smooth zoom (ease-out towards a target) and drag-pan inertia for the map camera (S1-T10).
 * Runs its own requestAnimationFrame loop only while something is moving.
 * Reusable by touch controls (S1-T11): call `animateZoomTo` / `startInertia` from gesture handlers.
 */
export function useSmoothCamera(options: SmoothCameraOptions): SmoothCamera {
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  const zoomAnimRef = useRef<ZoomAnimation | null>(null);
  const inertiaRef = useRef<Vec2 | null>(null);
  const frameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef(0);

  const tick = useCallback((now: number) => {
    frameRef.current = null;
    const dt = Math.min(64, Math.max(0, now - lastFrameTimeRef.current));
    lastFrameTimeRef.current = now;
    const { applyPose, panBy } = optionsRef.current;

    const anim = zoomAnimRef.current;
    if (anim) {
      const pose = sampleZoomAnimation(anim, now);
      applyPose({ zoom: pose.zoom, offset: pose.offset });
      if (pose.done) zoomAnimRef.current = null;
    }

    const velocity = inertiaRef.current;
    if (velocity) {
      const step = stepInertia(velocity, dt);
      if (step.delta.x !== 0 || step.delta.y !== 0) panBy(step.delta.x, step.delta.y);
      inertiaRef.current = step.stopped ? null : step.velocity;
    }

    if (zoomAnimRef.current || inertiaRef.current) {
      frameRef.current = requestAnimationFrame(tickRef.current);
    }
  }, []);
  const tickRef = useRef(tick);

  const ensureRunning = useCallback(() => {
    if (frameRef.current !== null) return;
    lastFrameTimeRef.current = performance.now();
    frameRef.current = requestAnimationFrame(tickRef.current);
  }, []);

  const stop = useCallback(() => {
    zoomAnimRef.current = null;
    inertiaRef.current = null;
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  }, []);

  useEffect(() => stop, [stop]);

  const animateZoomTo = useCallback((targetZoom: number, anchor: Vec2) => {
    inertiaRef.current = null;
    const now = performance.now();
    const pose = optionsRef.current.getPose();
    if (targetZoom === pose.zoom && !zoomAnimRef.current) return;
    zoomAnimRef.current = createZoomAnimation(pose, targetZoom, anchor, now);
    ensureRunning();
  }, [ensureRunning]);

  const getTargetZoom = useCallback(() => {
    return zoomAnimRef.current ? zoomAnimRef.current.toZoom : optionsRef.current.getPose().zoom;
  }, []);

  const startInertia = useCallback((velocity: Vec2) => {
    if (!shouldStartInertia(velocity)) return;
    inertiaRef.current = { x: velocity.x, y: velocity.y };
    ensureRunning();
  }, [ensureRunning]);

  const isMoving = useCallback(() => zoomAnimRef.current !== null || inertiaRef.current !== null, []);

  return useMemo(
    () => ({ animateZoomTo, getTargetZoom, startInertia, stop, isMoving }),
    [animateZoomTo, getTargetZoom, startInertia, stop, isMoving],
  );
}
