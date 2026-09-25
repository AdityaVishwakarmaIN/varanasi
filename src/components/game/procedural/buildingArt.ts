/**
 * Building art entry point: registers the Indian procedural art (./indian) on top of the Varanasi
 * sprites and re-exports the sprite API. Import from here (not ./varanasiSprites) wherever buildings
 * are drawn, so the full art set is registered.
 */
import { registerProceduralSprites } from './varanasiSprites';
import { INDIAN_PROCEDURAL_SPRITES } from './indian';

registerProceduralSprites(INDIAN_PROCEDURAL_SPRITES);

export * from './varanasiSprites';

/** Cache resolutions (px per tile) the map picks from, by on-screen tile size. */
export const BUILDING_ART_TIERS = [96, 192, 320] as const;

/**
 * Cache resolution for a tile drawn `screenTilePx` device pixels wide: the smallest tier that is
 * at least ~85% of it (so art is never visibly upscaled), capped at the top tier.
 */
export function pickArtTilePx(screenTilePx: number): number {
  for (const t of BUILDING_ART_TIERS) if (t >= screenTilePx * 0.85) return t;
  return BUILDING_ART_TIERS[BUILDING_ART_TIERS.length - 1];
}
