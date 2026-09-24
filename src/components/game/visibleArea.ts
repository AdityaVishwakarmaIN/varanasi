/**
 * S1-T8: the tile rectangle currently on screen, for entity spawning and culling.
 * `canvasSize` in the world state is in device pixels; the offset is in CSS pixels.
 */
import { getVisibleTileBounds } from '@/lib/performanceUtils';
import { getRenderDpr } from '@/lib/graphicsSettings';
import type { TileBounds } from '@/lib/entityCulling';
import { TILE_HEIGHT, TILE_WIDTH, type WorldRenderState } from './types';

export function getWorldTileBounds(world: Pick<WorldRenderState, 'offset' | 'zoom' | 'canvasSize' | 'gridSize'>): TileBounds {
  const dpr = getRenderDpr();
  return getVisibleTileBounds(
    world.offset,
    world.zoom,
    world.canvasSize.width / dpr,
    world.canvasSize.height / dpr,
    world.gridSize,
    TILE_WIDTH,
    TILE_HEIGHT,
    0
  );
}
