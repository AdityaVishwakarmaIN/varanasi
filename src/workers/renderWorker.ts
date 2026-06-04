import { renderLightingFrame } from '@/components/game/lightingRenderer';
import { createPixiApp, LayerStack, PixiRenderer } from '@/components/game/gpu';
import type { Application } from 'pixi.js';
import type {
  RenderWorkerCanvasMap,
  RenderWorkerLightingSnapshot,
  RenderWorkerMessage,
  RenderWorkerResponse,
  RenderWorkerViewportState,
} from './renderProtocol';

let canvases: RenderWorkerCanvasMap = {};
let lightingSnapshot: RenderWorkerLightingSnapshot | null = null;

// ---- P6: off-thread GPU (PixiJS) backend hosted on an OffscreenCanvas ----
// The 'gpu' canvas is transferred via transferControlToOffscreen and driven entirely
// inside this worker. We bootstrap the same backend used on the main thread
// (createPixiApp + LayerStack + PixiRenderer). Per-frame WORLD draw passes still need
// entity snapshots + draw-fn hosting plumbed across the worker boundary; that is the
// P7 runtime cutover. Here we prove the backend initialises off-thread and tracks the
// camera so the OffscreenCanvas GPU path is hostable in a worker.
let pixiApp: Application | null = null;
let pixiRenderer: PixiRenderer | null = null;
let pixiInitStarted = false;

function ensurePixi(viewport: RenderWorkerViewportState): void {
  if (pixiInitStarted || !canvases.gpu) return;
  pixiInitStarted = true;
  const canvas = canvases.gpu;
  canvas.width = viewport.canvasSize.width;
  canvas.height = viewport.canvasSize.height;
  const layers = new LayerStack();
  const renderer = new PixiRenderer(canvas, layers);
  pixiRenderer = renderer;
  createPixiApp({ canvas, width: canvas.width, height: canvas.height })
    .then((app) => {
      app.stage.addChild(layers.root);
      pixiApp = app;
      renderGpu(viewport);
    })
    .catch((error) => {
      postResponse({
        type: 'error',
        error: error instanceof Error ? error.message : 'GPU worker init failed',
      });
    });
}

function renderGpu(viewport: RenderWorkerViewportState): void {
  if (!pixiApp || !pixiRenderer) return;
  pixiRenderer.beginFrame();
  pixiRenderer.applyCamera({ dpr: viewport.dpr, offset: viewport.offset, zoom: viewport.zoom });
  // World draw passes are plumbed in P7 (entity snapshots over the protocol).
  pixiApp.render();
}

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
        ensurePixi(message.snapshot.viewport);
        renderGpu(message.snapshot.viewport);
        return;

      case 'viewport':
        ensurePixi(message.viewport);
        renderGpu(message.viewport);
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
        if (pixiApp) pixiApp.destroy(true);
        pixiApp = null;
        pixiRenderer = null;
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
