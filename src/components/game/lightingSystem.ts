import { useEffect } from 'react';
import { WorldRenderState } from './types';
import { renderLightingFrame } from './lightingRenderer';
import type { IsoRenderer } from '@/components/game/gpu/IsoRenderer';

export interface LightingSystemConfig {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  worldStateRef: React.MutableRefObject<WorldRenderState>;
  visualHour: number;
  offset: { x: number; y: number };
  zoom: number;
  canvasWidth: number;
  canvasHeight: number;
  isMobile: boolean;
  isPanningRef: React.MutableRefObject<boolean>;
  isPinchZoomingRef: React.MutableRefObject<boolean>;
  /** Ref to track desktop wheel zooming state */
  isWheelZoomingRef: React.MutableRefObject<boolean>;
  /** Boolean state value to trigger re-render when panning stops */
  isPanning: boolean;
  /** Boolean state value to trigger re-render when wheel zooming stops */
  isWheelZooming: boolean;
  disabled?: boolean;
  /**
   * Ref that flips true the instant the lighting canvas is handed to a
   * worker via transferControlToOffscreen. Checked synchronously at effect
   * run time because the `disabled` prop lags by one render (it's driven
   * by async worker-init state), producing a crash window where this hook
   * would call getContext on an already-transferred canvas.
   */
  transferredRef?: React.MutableRefObject<boolean>;
}

/**
 * Hook for rendering day/night lighting effects
 * Renders darkness overlay with light cutouts for buildings and roads
 */
export function useLightingSystem(config: LightingSystemConfig): void {
  const {
    canvasRef,
    worldStateRef,
    visualHour,
    offset,
    zoom,
    canvasWidth,
    canvasHeight,
    isMobile,
    isPanningRef,
    isPinchZoomingRef,
    isWheelZoomingRef,
    isPanning,
    isWheelZooming,
    disabled = false,
    transferredRef,
  } = config;

  useEffect(() => {
    if (disabled) return;
    if (transferredRef?.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    let ctx: IsoRenderer | null;
    try {
      ctx = canvas.getContext('2d');
    } catch {
      // Canvas has been transferred to a worker (or is otherwise unusable
      // for 2D contexts). Skip silently; the worker owns rendering now.
      return;
    }
    if (!ctx) return;

    renderLightingFrame({
      ctx,
      canvas,
      worldState: {
        grid: worldStateRef.current.grid,
        gridSize: worldStateRef.current.gridSize,
        cloudWeatherMode: worldStateRef.current.cloudWeatherMode,
      },
      visualHour,
      offset,
      zoom,
      isMobile,
      dpr: window.devicePixelRatio || 1,
      isInteractionActive: isPanningRef.current || isPinchZoomingRef.current || isWheelZoomingRef.current,
    });
  }, [canvasRef, worldStateRef, visualHour, offset, zoom, canvasWidth, canvasHeight, isMobile, isPanningRef, isPinchZoomingRef, isWheelZoomingRef, isPanning, isWheelZooming, disabled]);
}
