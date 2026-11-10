---
name: render-feature
description: Use when adding or changing anything drawn or animated on the map (buildings, trees, vehicles, boats, pedestrians, cows, weather, floods, festival effects) so it works on Canvas2D and the opt-in Pixi GPU renderer without costing frame time.
---

# Render Feature

Map drawing is split into a pure model (what exists, where it goes) and a thin draw function that paints against the `IsoRenderer` interface, so the same code runs on Canvas2D and on the Pixi GPU path. Build and test the model first, then draw, then measure. The worked example is ghat boats: `src/components/game/ghatBoats.ts` (pure network) + `boatSystem.ts` (runtime) + `src/components/game/__tests__/ghatBoats.test.ts`.

## Read first
- skills/render-pipeline-gotchas (layers, depth order, renderer selection, caches)
- skills/perf-budget (frame budget, quality caps)
- skills/procedural-sprite-authoring for building or tree art
- `src/components/game/CanvasIsometricGrid.tsx` (the render loop), `src/components/game/gpu/IsoRenderer.ts`

## Workflow
1. Pure model in `src/components/game/<x>.ts`: config object (`GHAT_BOAT_CONFIG` pattern), typed arrays, no DOM. Cache derived data on `${gameVersion}:${gridSize}:${structureVersion}` like `getGhatBoatNetwork`. Unit test it.
2. Runtime shape - pick the closest existing one:
   - Factory with refs + state: `createBoatSystem` (`boatSystem.ts`), `createVehicleSystems` (`vehicleSystems.ts`), `createEffectsSystems` (`effectsSystems.ts`), `createAircraftSystems` (`aircraftSystems.ts`).
   - Pure function set: `spawnCow` / `stepCow` / `drawCow(ctx: IsoRenderer, cow)` in `cowSystem.ts`; spawn/update functions in `pedestrianSystem.ts`.
   - Spawning and stepping take an `Rng`; never `Math.random` in a model you want to test.
3. Draw module beside the others: `floodDraw.ts` (`drawFloodMask`), `festivalDraw.ts` (`FESTIVAL_DRAW_CONFIG`, `createFestivalVisuals`), `problemIconsDraw.ts`, `bridgeDrawing.ts`. Type the context as `IsoRenderer`, not `CanvasRenderingContext2D`; only the methods it picks work on the GPU path.
4. Pick the layer (skills/render-pipeline-gotchas: `LAYER_ORDER`, dynamic vs retained). Moving things go on a dynamic layer; static art on a retained one.
5. Static-layer redraw: if the feature changes what the cached static layers draw, its input must join the `sceneDeps` / `contentKey` of the static layer in `CanvasIsometricGrid.tsx`, or be a per-tile field tracked by `GridVisualTracker` (`visualSignature.ts`). Otherwise it never redraws.
6. Quality: read caps from `getActivePreset()` (`src/lib/graphicsSettings.ts`, presets in `QUALITY_PRESETS`, `src/lib/qualityConfig.ts`); scale counts with `scaledEntityLimit` / `ENTITY_CULL_CONFIG`. Low preset must still read correctly.
7. Cull: only step/draw what is on screen - `isInBounds`, `expandBounds`, `filterInBounds`, `countInBounds` (`src/lib/entityCulling.ts`).
8. Report counts: `setEntityCount('<name>', n)` (`src/lib/perfStats.ts`) so the PerfHud shows them.
9. Weather and season visuals read sim state (weather, `riverLevel`, floods); never decide them in the renderer.
10. Measure and log: skills/perf-budget.

## Files by concern
| Concern | Where |
|---|---|
| Render loop, static-layer cache, input handlers | `src/components/game/CanvasIsometricGrid.tsx` |
| GPU layers and sway | `src/components/game/gpu/layers.ts`, `gpu/PixiRenderer.ts` |
| Renderer-neutral draw API | `src/components/game/gpu/IsoRenderer.ts` |
| Quality and DPR | `src/lib/qualityConfig.ts`, `src/lib/graphicsSettings.ts` |
| Culling, perf counters | `src/lib/entityCulling.ts`, `src/lib/perfStats.ts` |

## Preset fields to respect
`QualityPreset` (`src/lib/qualityConfig.ts`): `pedestrianDensity`, `vehicleFraction`, `clouds`, `weatherParticleFraction`, `nightLighting`, `particleFraction`, `dprCap` (1 / 1.5 / 2), `treeSway`, `maxCars`, `maxPedestrians`, `maxBoats`, `skipSmallWhileMovingBelowZoom`. A new effect either maps onto one of these or adds a field to all three presets.

## Checklist
- [ ] Model is pure and tested; cache key includes `structureVersion` if it depends on buildings.
- [ ] Draw takes `IsoRenderer`.
- [ ] Depth order correct where it overlaps buildings or trees.
- [ ] Respects quality preset and culling; no allocation per frame.
- [ ] Static input wired into `sceneDeps` or the visual tracker.
- [ ] Looks the same under `?renderer=canvas` and `?renderer=gpu`.
- [ ] Off-Varanasi maps: gated if it is river-specific (`mapId === 'varanasi'`).

## Gotchas
- `createVehicleSystems` reruns every render; persistent state belongs at module scope (skills/render-pipeline-gotchas).
- The GPU path still runs the Canvas2D static passes, so slow static drawing costs both renderers.
- Headless SwiftShader GPU numbers (~1 FPS) are meaningless; compare renderers by eye there, by numbers only on real hardware.
- `treeSway` is false on the `low` preset (trees then draw once with the buildings). Headless auto-quality drops to low, so set `varanasi-graphics-quality` = `high` in localStorage before checking sway or particles.
- Small animated things (boats, smog, helicopters, seaplanes) are skipped while panning below `skipSmallWhileMovingBelowZoom`; a new small entity should honour it.
- Hard caps per preset and device (`maxCars`, `maxPedestrians`, `maxBoats` as `{ desktop, mobile }`, read with `deviceValue`). Add a cap for a new crowd-type entity rather than relying on culling alone.
- Spawn inside the visible area plus `ENTITY_CULL_CONFIG.spawnMarginTiles`; despawn beyond `despawnMarginTiles`.

## Verify
- `npx vitest run src/components/game/__tests__/<x>.test.ts`
- Side by side in the browser: `?renderer=canvas` and `?renderer=gpu` (Playwright flags in skills/verification-gate).
- Benchmark: `?bench=160&flythrough=1`, add a row to `documentation/game-plan/perf-log.md` (skills/perf-budget).
- Run skills/verification-gate.
