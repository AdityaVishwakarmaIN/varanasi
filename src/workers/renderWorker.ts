import { renderLightingFrame } from '@/components/game/lightingRenderer';
import type {
  RenderWorkerCanvasMap,
  RenderWorkerLightingSnapshot,
  RenderWorkerMessage,
  RenderWorkerResponse,
} from './renderProtocol';

let canvases: RenderWorkerCanvasMap = {};
let lightingSnapshot: RenderWorkerLightingSnapshot | null = null;

function postResponse(response: RenderWorkerResponse): void {
  self.postMessage(response);
}

function renderLighting(): void {
  if (!canvases.lighting || !lightingSnapshot) {
    return;
  }

  if (
    canvases.lighting.width !== lightingSnapshot.viewport.canvasSize.width ||
    canvases.lighting.height !== lightingSnapshot.viewport.canvasSize.height
  ) {
    canvases.lighting.width = lightingSnapshot.viewport.canvasSize.width;
    canvases.lighting.height = lightingSnapshot.viewport.canvasSize.height;
  }

  const ctx = canvases.lighting.getContext('2d');
  if (!ctx) {
    return;
  }

  renderLightingFrame({
    ctx,
    canvas: canvases.lighting,
    worldState: {
      grid: lightingSnapshot.grid,
      gridSize: lightingSnapshot.gridSize,
      cloudWeatherMode: lightingSnapshot.cloudWeatherMode,
    },
    visualHour: lightingSnapshot.visualHour,
    offset: lightingSnapshot.viewport.offset,
    zoom: lightingSnapshot.viewport.zoom,
    isMobile: lightingSnapshot.isMobile,
    dpr: lightingSnapshot.viewport.dpr,
    isInteractionActive: lightingSnapshot.viewport.isInteractionActive,
  });
}

self.onmessage = (event: MessageEvent<RenderWorkerMessage>) => {
  try {
    const message = event.data;

    switch (message.type) {
      case 'init':
        canvases = message.canvases;
        postResponse({ type: 'ready' });
        renderLighting();
        return;

      case 'lighting-state':
        lightingSnapshot = message.snapshot;
        renderLighting();
        return;

      case 'viewport':
        if (!lightingSnapshot) return;
        lightingSnapshot = {
          ...lightingSnapshot,
          viewport: message.viewport,
        };
        renderLighting();
        return;

      case 'tool':
      case 'grid-version':
      case 'speed':
        return;

      case 'terminate':
        close();
        return;
    }
  } catch (error) {
    postResponse({
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown render worker error',
    });
  }
};
