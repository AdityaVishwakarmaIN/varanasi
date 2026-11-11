/**
 * Core grid types shared across all games
 */

/** Cardinal directions for movement and orientation */
export type CardinalDirection = 'north' | 'east' | 'south' | 'west';

/** Direction metadata for calculating movement vectors */
export interface DirectionMeta {
  step: { x: number; y: number };
  vec: { dx: number; dy: number };
  angle: number;
  normal: { nx: number; ny: number };
}
