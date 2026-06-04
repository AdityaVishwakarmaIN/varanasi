import { WorldRenderState } from './types';
import type { IsoRenderer } from '@/components/game/gpu/IsoRenderer';
import {
  createDefaultWindVisualState,
  buildWindTreeRenderItem,
  drawWindDustFrame,
  drawWindTreesFrame,
  updateWindVisualState,
  type WindTreeRenderItem,
  type WindVisualState,
} from './windRenderer';

export { createDefaultWindVisualState, buildWindTreeRenderItem };
export type { WindDustParticle, WindTreeRenderItem, WindVisualState } from './windRenderer';

export interface WindSystemRefs {
  windStateRef: React.MutableRefObject<WindVisualState>;
  visibleTreesRef: React.MutableRefObject<WindTreeRenderItem[]>;
}

export interface WindSystemState {
  worldStateRef: React.MutableRefObject<WorldRenderState>;
  isMobile: boolean;
}

export function createWindSystem(
  refs: WindSystemRefs,
  systemState: WindSystemState
) {
  const { windStateRef, visibleTreesRef } = refs;
  const { worldStateRef, isMobile } = systemState;

  const updateWind = (delta: number) => {
    updateWindVisualState({
      windState: windStateRef.current,
      worldState: worldStateRef.current,
      delta,
      isMobile,
    });
  };

  const drawWindTrees = (ctx: IsoRenderer) => {
    drawWindTreesFrame(
      {
        ctx,
        worldState: worldStateRef.current,
        windState: windStateRef.current,
      },
      visibleTreesRef.current
    );
  };

  const drawWindDust = (ctx: IsoRenderer) => {
    drawWindDustFrame({
      ctx,
      worldState: worldStateRef.current,
      windState: windStateRef.current,
    });
  };

  return {
    updateWind,
    drawWindTrees,
    drawWindDust,
  };
}
