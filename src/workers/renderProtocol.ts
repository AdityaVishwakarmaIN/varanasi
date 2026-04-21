import type { CloudWeatherMode, OverlayMode } from '@/components/game/types';
import type { Tile, Tool } from '@/types/game';

export type RenderWorkerCanvasId = 'base' | 'cars' | 'wind' | 'buildings' | 'air' | 'lighting';

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
