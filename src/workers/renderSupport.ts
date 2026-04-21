export interface RenderWorkerSupport {
  supported: boolean;
  hasWorker: boolean;
  hasOffscreenCanvas: boolean;
  hasTransferControlToOffscreen: boolean;
  hasCreateImageBitmap: boolean;
  reason?: string;
}

export function detectRenderWorkerSupport(): RenderWorkerSupport {
  if (typeof window === 'undefined') {
    return {
      supported: false,
      hasWorker: false,
      hasOffscreenCanvas: false,
      hasTransferControlToOffscreen: false,
      hasCreateImageBitmap: false,
      reason: 'Window is not available',
    };
  }

  const hasWorker = typeof Worker !== 'undefined';
  const hasOffscreenCanvas = typeof OffscreenCanvas !== 'undefined';
  const hasTransferControlToOffscreen =
    typeof HTMLCanvasElement !== 'undefined' &&
    'transferControlToOffscreen' in HTMLCanvasElement.prototype;
  const hasCreateImageBitmap = typeof createImageBitmap === 'function';

  let reason: string | undefined;
  if (!hasWorker) {
    reason = 'Worker is not supported';
  } else if (!hasOffscreenCanvas) {
    reason = 'OffscreenCanvas is not supported';
  } else if (!hasTransferControlToOffscreen) {
    reason = 'Canvas transfer is not supported';
  }

  return {
    supported: hasWorker && hasOffscreenCanvas && hasTransferControlToOffscreen,
    hasWorker,
    hasOffscreenCanvas,
    hasTransferControlToOffscreen,
    hasCreateImageBitmap,
    reason,
  };
}
