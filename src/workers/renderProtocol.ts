import type { CloudWeatherMode, OverlayMode } from '@/components/game/types';
import type { Tile, Tool } from '@/types/game';

export type RenderWorkerCanvasId = 'base' | 'cars' | 'wind' | 'buildings' | 'air' | 'lighting' | 'gpu';

export type RenderWorkerCanvasMap = Partial<Record<RenderWorkerCanvasId, OffscreenCanvas>>;

export interface RenderWorkerViewportState {
  offset: { x: number; y: number };
  zoom: number;
  canvasSize: { width: number; height: number };
  dpr: number;
  isInteractionActive: boolean;
}

export interface RenderWorkerLightingSnapshot {
  grid: Tile[][];
  gridSize: number;
  cloudWeatherMode: CloudWeatherMode;
  visualHour: number;
  isMobile: boolean;
  viewport: RenderWorkerViewportState;
}

export type RenderWorkerInitMessage = {
  type: 'init';
  canvases: RenderWorkerCanvasMap;
};

export type RenderWorkerLightingStateMessage = {
  type: 'lighting-state';
  snapshot: RenderWorkerLightingSnapshot;
};

export type RenderWorkerViewportMessage = {
  type: 'viewport';
  viewport: RenderWorkerViewportState;
};

export type RenderWorkerToolMessage = {
  type: 'tool';
  tool: Tool;
  overlayMode?: OverlayMode;
};

export type RenderWorkerGridVersionMessage = {
  type: 'grid-version';
  gameVersion?: number;
  structureVersion?: number;
  roadNetworkVersion?: number;
};

export type RenderWorkerSpeedMessage = {
  type: 'speed';
  speed: 0 | 1 | 2 | 3;
};

/**
 * Step 8 transport — a per-frame snapshot of MOVING entities for the off-thread GPU
 * path. Designed to be structured-clone / TRANSFER friendly: bulk numeric state lives
 * in a single transferable `ArrayBuffer` of packed Float32 records, with `layout`
 * describing how to decode it. The per-entity ENCODE (main thread) and DECODE + draw
 * replay (worker) are the local runtime cutover; this defines the boundary they cross.
 */
export interface RenderWorkerEntityGroup {
  /** Target GPU layer for this group's draws. */
  layer: RenderWorkerCanvasId;
  /** Entity kind discriminator (e.g. 'car', 'pedestrian', 'cloud'). */
  kind: string;
  /** Number of records in the group. */
  count: number;
  /** Float32 values per record (matches `RenderWorkerEntityLayout.fields`). */
  stride: number;
  /** Element offset of the group's first record within the packed buffer. */
  offset: number;
}

export interface RenderWorkerEntityLayout {
  /** Ordered groups packed into the buffer. */
  groups: RenderWorkerEntityGroup[];
  /** Field names per record, in packed order (e.g. ['x','y','angle','variant']). */
  fields: string[];
}

export interface RenderWorkerEntityFrame {
  frameId: number;
  /** Interpolation factor in [0,1) from the fixed-timestep clock (render smoothing). */
  alpha: number;
  layout: RenderWorkerEntityLayout;
  /** Packed Float32 records described by `layout`; transferred zero-copy. */
  buffer: ArrayBuffer;
}

export type RenderWorkerEntityFrameMessage = {
  type: 'entity-frame';
  frame: RenderWorkerEntityFrame;
};

export type RenderWorkerTerminateMessage = {
  type: 'terminate';
};

export type RenderWorkerMessage =
  | RenderWorkerInitMessage
  | RenderWorkerLightingStateMessage
  | RenderWorkerViewportMessage
  | RenderWorkerToolMessage
  | RenderWorkerGridVersionMessage
  | RenderWorkerSpeedMessage
  | RenderWorkerEntityFrameMessage
  | RenderWorkerTerminateMessage;

export type RenderWorkerReadyResponse = {
  type: 'ready';
};

export type RenderWorkerErrorResponse = {
  type: 'error';
  error: string;
};

export type RenderWorkerResponse =
  | RenderWorkerReadyResponse
  | RenderWorkerErrorResponse;
