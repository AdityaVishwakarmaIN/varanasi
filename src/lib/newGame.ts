/**
 * New-game options (S2-T3). Pure: the UI decides mobile vs desktop and passes it in.
 */
import type { MapId } from '@/games/isocity/maps/varanasi';
import type { GameState } from '@/types/game';
import { createInitialGameState } from '@/lib/simulation';
import { DEFAULT_CITY_NAMES, getMapSize } from '@/lib/mapConfig';
import type { Rng } from '@/lib/rng';

export interface NewGameOptions {
  name?: string;
  /** Default 'varanasi' (the recommended map). */
  mapId?: MapId;
  /** Only used for random maps; the Varanasi map has a fixed size. */
  size?: number;
}

export const DEFAULT_MAP_ID: MapId = 'varanasi';

export function resolveNewGame(options: NewGameOptions | undefined, isMobile: boolean): { name: string; mapId: MapId; size: number } {
  const mapId = options?.mapId ?? DEFAULT_MAP_ID;
  const size = mapId === 'random' && options?.size ? options.size : getMapSize(mapId, isMobile);
  const name = options?.name?.trim() || DEFAULT_CITY_NAMES[mapId];
  return { name, mapId, size };
}

export function createNewGameState(options: NewGameOptions | undefined, isMobile: boolean, rng?: Rng): GameState {
  const { name, mapId, size } = resolveNewGame(options, isMobile);
  return createInitialGameState(size, name, rng, mapId);
}
