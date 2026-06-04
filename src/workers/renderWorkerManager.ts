import type { OverlayMode } from '@/components/game/types';
import type { Tool } from '@/types/game';
import { detectRenderWorkerSupport } from './renderSupport';
import type {
  RenderWorkerCanvasMap,
  RenderWorkerLightingSnapshot,
  RenderWorkerEntityFrame,
  RenderWorkerMessage,
  RenderWorkerResponse,
  RenderWorkerViewportState,
} from './renderProtocol';

export class RenderWorkerManager {
  private worker: Worker | null = null;
  private ready = false;
  private pendingMessages: RenderWorkerMessage[] = [];
  readonly support = detectRenderWorkerSupport();

  prepare(): boolean {
    if (this.worker) {
      return true;
    }

    if (!this.support.supported) {
      return false;
    }

    try {
      this.worker = new Worker(new URL('./renderWorker.ts', import.meta.url));

      this.worker.onmessage = (event: MessageEvent<RenderWorkerResponse>) => {
        if (event.data.type === 'ready') {
          this.ready = true;
          this.flushPendingMessages();
          return;
        }

        if (event.data.type === 'error') {
          console.error('Render worker error:', event.data.error);
        }
      };

      this.worker.onerror = (event) => {
        console.error('Render worker crashed:', event.message);
        this.terminate();
      };

      return true;
    } catch (error) {
      console.warn('Failed to initialize render worker, falling back to main thread:', error);
      this.terminate();
      return false;
    }
  }

  async init(canvases: RenderWorkerCanvasMap): Promise<boolean> {
    if (!this.prepare()) {
      return false;
    }

    this.postMessage({
      type: 'init',
      canvases,
    });

    return true;
  }

  updateLightingState(snapshot: RenderWorkerLightingSnapshot): void {
    this.postMessage({
      type: 'lighting-state',
      snapshot,
    });
  }

  updateViewport(viewport: RenderWorkerViewportState): void {
    this.postMessage({
      type: 'viewport',
      viewport,
    });
  }

  updateTool(tool: Tool, overlayMode?: OverlayMode): void {
    this.postMessage({
      type: 'tool',
      tool,
      overlayMode,
    });
  }

  notifyGridVersion(versions: {
    gameVersion?: number;
    structureVersion?: number;
    roadNetworkVersion?: number;
  }): void {
    this.postMessage({
      type: 'grid-version',
      ...versions,
    });
  }

  setSpeed(speed: 0 | 1 | 2 | 3): void {
    this.postMessage({
      type: 'speed',
      speed,
    });
  }

  /**
   * Step 8: send a per-frame entity snapshot to the off-thread GPU path. The packed
   * Float32 buffer is TRANSFERRED (zero-copy), so the caller must not reuse it after.
   */
  sendEntityFrame(frame: RenderWorkerEntityFrame): void {
    this.postMessage({
      type: 'entity-frame',
      frame,
    });
  }

  terminate(): void {
    if (this.worker) {
      this.worker.postMessage({ type: 'terminate' } satisfies RenderWorkerMessage);
      this.worker.terminate();
    }
    this.worker = null;
    this.ready = false;
    this.pendingMessages = [];
  }

  private postMessage(message: RenderWorkerMessage): void {
    if (!this.worker) {
      this.pendingMessages.push(message);
      return;
    }

    if (!this.ready && message.type !== 'init') {
      this.pendingMessages.push(message);
      return;
    }

    const transferList: Transferable[] = [];
    if (message.type === 'init') {
      transferList.push(...Object.values(message.canvases));
    } else if (message.type === 'entity-frame') {
      transferList.push(message.frame.buffer);
    }
    this.worker.postMessage(message, transferList);
  }

  private flushPendingMessages(): void {
    if (!this.worker || !this.ready || this.pendingMessages.length === 0) {
      return;
    }

    const queued = this.pendingMessages;
    this.pendingMessages = [];
    for (const message of queued) {
      this.postMessage(message);
    }
  }
}
