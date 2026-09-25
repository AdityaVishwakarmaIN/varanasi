/**
 * Indian-style procedural building art: every building type drawn in code (warm sandstone,
 * lime-washed plaster, faded paint, rooftop tanks and laundry) in place of the old sprite sheets.
 *
 * ── Contract (same as ../varanasiSprites.ts) ───────────────────────────────────────────────────
 *   Each entry is a `ProceduralSpriteDef` keyed by the game `BuildingType` id. `footprint` MUST equal
 *   `getBuildingSize(type).width`. `draw(ctx, w, h, variant)` paints into a transparent canvas whose
 *   base diamond's top corner is at (w/2, heightTiles × tilePx); use `makeIso(ctx, w, h, footprint)`
 *   and the helpers/palette exported from ../varanasiSprites and ../isoPainter.
 *   Drawing must be deterministic per (type, variant): use `seededRng`, never Math.random.
 *   Import helpers from '../varanasiSprites' / '../isoPainter' only: never from './index' or
 *   '../buildingArt' (that would create an import cycle).
 */
import type { ProceduralSpriteDef } from '../varanasiSprites';
import { RESIDENTIAL_SPRITES } from './residential';
import { COMMERCIAL_SPRITES } from './commercial';
import { INDUSTRIAL_SPRITES } from './industrial';
import { SERVICES_SPRITES } from './services';
import { SPORTS_SPRITES } from './sports';
import { PARKS_SPRITES } from './parks';
import { SPECIAL_SPRITES } from './special';
import { MIXED_USE_SPRITES } from './mixedUse';

export const INDIAN_PROCEDURAL_SPRITES: Record<string, ProceduralSpriteDef> = {
  ...RESIDENTIAL_SPRITES,
  ...COMMERCIAL_SPRITES,
  ...INDUSTRIAL_SPRITES,
  ...SERVICES_SPRITES,
  ...SPORTS_SPRITES,
  ...PARKS_SPRITES,
  ...SPECIAL_SPRITES,
  ...MIXED_USE_SPRITES,
};
