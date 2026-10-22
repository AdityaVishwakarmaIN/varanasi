---
name: procedural-sprite-authoring
description: Use when drawing or changing building, landmark, riverfront or tree art in code (procedural Canvas-2D sprites) - the anchor contract, ProceduralSpriteDef, flipped/waterfront orientation, the Indian kits, isoPainter helpers, the registry and cache tiers, and how to preview and test.
---

# Procedural Sprite Authoring

Almost every building is now drawn in code: a `draw(ctx, w, h, variant)` function paints the building once per (type, variant, flipped, resolution) into a cached canvas that both renderers blit. This replaced most painted sprite sheets. Painted art is still possible later through skills/isometric-asset-sheets (generate) and skills/varanasi-image-to-asset (convert and wire); `skills/adding-asset-sheets.md` is stale.

## Read first
- Header comment of `src/components/game/procedural/varanasiSprites.ts` (the anchor contract, authoritative)
- Header comment of `src/components/game/procedural/indian/index.ts` (kit contract)
- `src/components/game/procedural/isoPainter.ts` (`Iso` class)
- A sibling sprite of the same family, e.g. `drawGhat`, `drawSTP`, or a kit file in `procedural/indian/`

## Anchor contract (from the varanasiSprites.ts header)
- `tilePx`: pixel width of one tile in the cached canvas (default `PROCEDURAL_TILE_PX` 256).
- `width = footprint x tilePx`; `height = (heightTiles + footprint x 0.6 + BOTTOM_PAD_TILES) x tilePx`; `baseTopY = heightTiles x tilePx` (top corner of the base diamond, at x = width/2).
- Place on the map with `getProceduralSpriteDrawRect(sprite, screenX, screenY, TILE_WIDTH)` from the origin tile (min x, min y). Never hand-compute offsets.
- Size helpers: `getProceduralSpriteSize(type, tilePx)`.

## ProceduralSpriteDef
`footprint` (N for NxN, MUST equal `getBuildingSize(type).width`), `variants`, `heightTiles` (space above the diamond top, in tile widths), `draw`, optional `tileable` (joins seamlessly with neighbours, e.g. `ghat`, `embankment`), optional `waterfront` (front side is +x).

## Orientation
- `flipped = false`: waterfront art faces grid +x (screen lower-right). On the Varanasi map the Ganga is east (+x) of the west-bank ghats.
- `flipped = true`: canvas mirrored, art faces grid +y (screen lower-left), matching how the renderer mirrors `building.flipped`.
- Draw the river side on +x; never paint a separate mirrored version.

## Where art lives
- Varanasi set: `VARANASI_PROCEDURAL_SPRITES` / `VARANASI_PROCEDURAL_SPRITE_TYPES` in `varanasiSprites.ts` (ghat, sewage_treatment_plant, informal_housing, jal_sansthan_water_works, embankment and the five `landmark_*`).
- Everything else: kits in `procedural/indian/` - `residential`, `commercial`, `industrial`, `services`, `sports`, `parks`, `special`, `mixedUse`, `trees` (each `<name>.ts` with sprites, most with a `<name>Kit.ts` of shared parts), merged into `INDIAN_PROCEDURAL_SPRITES` in `indian/index.ts`.
- Entry point: `procedural/buildingArt.ts` registers the Indian set (`registerProceduralSprites`; Varanasi art wins a clash) and re-exports the API. Renderer code imports from `buildingArt`, never directly from `varanasiSprites`.

## Workflow
1. Pick the file: Varanasi-specific -> `varanasiSprites.ts`; otherwise the right kit in `procedural/indian/`.
2. Start the draw function with `makeIso(ctx, w, h, footprint)`; build with `Iso` methods and shared parts (`slab`, `lawn`, `paving`, `coursesU`/`coursesV`, `windowU`/`windowV`, `weatherU`/`weatherV`, `grime`, `dome`, `chhatri`, `flag`, `pipe`, `waterSurface`, `ghatSteps`, `hut`, `govBlock`, `shikhara` ...).
3. Colours from the palette `C` and `OUTLINE` (varanasiSprites.ts); derive tones with `mat`, `mix`, `shade`, `alpha` (isoPainter.ts). Style: warm sandstone, lime-wash, faded paint, soft shading, no hard black shadows.
4. Randomness only through `seededRng(key, variant)` - deterministic per (type, variant). Never `Math.random`.
5. Add the def (footprint from `getBuildingSize`, variants, heightTiles) to the Varanasi record or the kit's export.
6. Preview, then test.

## Runtime and caching
- Cache tiers: `BUILDING_ART_TIERS` [96, 192, 320] px per tile; `pickArtTilePx(screenTilePx)` picks the smallest tier at least ~85% of the on-screen size.
- `getProceduralSprite(...)` paints on demand within `PROCEDURAL_PAINT_BUDGET_MS` (8 ms) per frame; cache cap `PROCEDURAL_CACHE_MAX_BYTES` (160 MB); `clearProceduralSpriteCache`.
- Variants on the map: `pickProceduralVariant(type, tileX, tileY)`, `normalizeVariant`. Sheets for the GPU path: `renderProceduralSpriteSheet`, `proceduralFrameKey`.

## Gotchas
- Import-time purity: these modules must have no side effects at import (they load in Node tests and workers). `buildingArt.ts` registration is the single deliberate exception.
- Kit files import only from `../varanasiSprites` and `../isoPainter`; importing `./index` or `../buildingArt` creates a cycle.
- `isVaranasiProceduralSprite(type)` checks the whole registry, so it is true for any procedural art, not only the Varanasi set.
- A footprint mismatch with `getBuildingSize` draws art over the wrong tiles; the test catches it for the Varanasi set only - check kits by eye.
- Tall art must fit in `heightTiles`; anything above is clipped.
- `getProceduralSprite` returns null in Node (no canvas implementation); unit tests drive `paintProceduralSprite` / the draw functions directly.
- A first view of many new types can exceed the 8 ms paint budget; the cache fills over several frames, so pop-in on first zoom is expected, stutter is not.

## Verify
- Browser preview: `npm run dev`, open `/dev/sprites` (`src/app/dev/sprites/page.tsx`, scenes in `previewScenes.ts`; disabled in production) - every sprite x variant, light and dark backgrounds, a riverbank row of ghats, flipped ghats.
- Headless sheet: `node scripts/sprite-preview/render.js <scratch>/sprites.png [type1,type2] [--abandoned]` (esbuild bundle of `entry.ts`, global Playwright). Write the PNG outside the repo and look at it.
- Test: `npx vitest run src/components/game/procedural/__tests__/varanasiSprites.test.ts` (registry, sizes, placement, variants, every draw path in both orientations).
- In game at three zoom levels on both renderers (skills/render-feature), then skills/verification-gate.
