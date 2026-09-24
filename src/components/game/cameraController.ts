/**
 * cameraController: a minimal, module-level handle on the map camera.
 *
 * `CanvasIsometricGrid` owns the camera (its `offset` and `zoom` React state) and registers a
 * controller here while it is mounted. Code outside the component (the benchmark fly-through,
 * later smooth-camera / inertia code) can read and move the camera without prop drilling.
 *
 * Coordinates: `screen = world * zoom + offset`, where `world` is the isometric pixel space
 * returned by `gridToScreen(x, y, 0, 0)` in `./utils`.
 */

export type CameraSnapshot = {
  offset: { x: number; y: number };
  zoom: number;
  canvasSize: { width: number; height: number };
  gridSize: number;
};

export type CameraUpdate = {
  offset?: { x: number; y: number };
  zoom?: number;
};

export interface CameraController {
  /** Current camera (as last rendered). */
  getCamera(): CameraSnapshot;
  /**
   * Move the camera. `zoom` is clamped to ZOOM_MIN..ZOOM_MAX and `offset` to the map bounds
   * (for the new zoom). Omitted fields keep their current value.
   */
  setCamera(update: CameraUpdate): void;
}

let activeController: CameraController | null = null;

/** Called by the grid component on mount. Returns an unregister function for cleanup. */
export function registerCameraController(controller: CameraController): () => void {
  activeController = controller;
  return () => {
    if (activeController === controller) activeController = null;
  };
}

/** The mounted map's camera, or null when no map is on screen. */
export function getCameraController(): CameraController | null {
  return activeController;
}

/** Offset that puts world point (worldX, worldY) at the centre of the canvas at `zoom`. */
export function offsetToCenterWorldPoint(
  worldX: number,
  worldY: number,
  zoom: number,
  canvasSize: { width: number; height: number },
): { x: number; y: number } {
  return {
    x: canvasSize.width / 2 - worldX * zoom,
    y: canvasSize.height / 2 - worldY * zoom,
  };
}
