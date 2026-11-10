---
name: render-pipeline-gotchas
description: Reference for how the map render pipeline actually works (isometric depth order, GPU layers, renderer selection, static-layer cache keys, per-render system objects, camera and render worker) and the traps that have already caused bugs. Use before touching CanvasIsometricGrid.tsx, gpu/*, vehicleSystems.ts or any draw module.
---

# Render Pipeline Gotchas

The map is drawn by one big component, `src/components/game/CanvasIsometricGrid.tsx`, onto stacked canvases (Canvas2D) or, when chosen, onto Pixi layers (GPU). Most render bugs here came from depth order, caches that never invalidate, or state that resets every React render. This skill is the reference; the step-by-step for a new drawn feature is skills/render-feature.

## Read first
- `src/components/game/gpu/layers.ts` (`LAYER_ORDER`, `DYNAMIC_LAYERS`, `isDynamicLayer`, `LayerStack`)
- `src/lib/rendererSelection.ts` (`RENDERER_CONFIG`, `parseRendererOverride`, `chooseRenderer`)
- `src/lib/graphicsSettings.ts` (`reportGpuFailure`, `getActivePreset`, `getRenderDpr`, `GRAPHICS_STORAGE_KEYS`)
- `src/components/game/visualSignature.ts` (`GridVisualTracker`, `getGridVisualVersion`, `getGridVisualChangesSince`)

## Reference

### Layers (GPU)
`LAYER_ORDER`, bottom to top: `base`, `cars`, `wind`, `buildings`, `air`, `ambient`, `airHigh`, `lighting`, `hover`.
- Dynamic (cleared and redrawn every frame): `cars`, `wind`, `air`, `ambient`, `airHigh`.
- Retained (redrawn only on change): `base`, `buildings`, `lighting`, `hover`.
- Something that moves every frame on a retained layer forces full redraws; something static on a dynamic layer is repainted for nothing.

### Depth order
- Isometric draw order is by tile depth; anything that can overlap a building must be sorted into the building queue, not drawn on its own layer above it.
- Swaying trees live on the `buildings` layer in depth order (fix commit `0380e90`, "GPU: keep swaying trees in depth order on the buildings layer"). Sway is applied per frame with `pixi.applySway(windSwayAngle(windStateRef.current))` (`windSwayAngle` in `windRenderer.ts`, `applySway` in `gpu/PixiRenderer.ts`), so trees need not move to a dynamic layer.
- With `treeSway` off (quality preset `low`) trees are drawn once with the other sprites in the building loop.

### Renderer selection
- `RENDERER_CONFIG.gpuByDefault` is `false`: `auto` means Canvas2D. GPU is opt-in from Settings (`varanasi-graphics-renderer`).
- Debug overrides: `?renderer=gpu|canvas` per page load, or build with `NEXT_PUBLIC_GPU_RENDERER=1|0`. `parseRendererOverride` also accepts `1`/`0`.
- `chooseRenderer` returns `canvas` whenever WebGL2 is missing or the GPU already failed; an override wins over the setting otherwise.
- Init errors and WebGL context loss call `reportGpuFailure`, which flips the session to Canvas2D. Never throw out of the GPU path; report and fall back.
- GPU mode still runs the Canvas2D static passes, so slow static drawing costs both renderers.
- Pixi plumbing: `gpu/PixiApp.ts`, `gpu/PixiRenderer.ts`, `gpu/textures.ts` (`TextureCache`), `gpu/camera.ts`, `gpu/interpolate.ts`. The shared draw API is `gpu/IsoRenderer.ts`.

### Static-layer cache
- The static pass keeps the last render in `staticLayerRenderRef` and skips work when `sceneDeps` (array compared element by element) and `contentKey` match.
- `contentKey` is the `grid` object while the sim runs or an overlay is on, otherwise `getGridVisualVersion(grid, gridSize)`; when paused, partial redraws use `getGridVisualChangesSince`.
- A new input that changes static drawing (a mask, a setting, a map flag) must be added to `sceneDeps`, or be a per-tile field `GridVisualTracker` tracks. Otherwise the layer keeps showing the old picture until something unrelated changes.
- Camera changes are compared separately (`cameraSame`); do not put zoom or offset in `sceneDeps`.

### Systems that rerun every render
- `createVehicleSystems` (`vehicleSystems.ts`) builds a new object on every React render. Anything that must persist between frames lives at module scope: `kerbCarIds`, `yieldingCarIds`, `burningTilesCache`, `finderCache` (keyed `${gridSize}:${structureVersion}`), `roadPrefixCache`. It reads `roadNetworkVersionRef` for road changes.
- `invalidateVehicleSystemCaches()` clears those caches; CanvasIsometricGrid calls it in the `gameVersion` reset effect, because two cities with the same size and `structureVersion` would otherwise share finder lists.
- Keep per-frame state in refs, not React state; a `setState` per frame rerenders the whole grid.

### Weather and camera
- Weather is sim state (`state.weather`, picked by `pickWeather` in `src/lib/seasons.ts` inside `simulateTick`). The renderer only reads it (`cloudWeatherMode`). Never roll weather in a draw module.
- Camera: `cameraController.ts`, `useSmoothCamera.ts`, `src/lib/cameraMotion.ts` (`createZoomAnimation`, `PanVelocityTracker`, `stepInertia`), `gpu/camera.ts`.
- Render worker path: `src/workers/renderWorker.ts`, `renderWorkerManager.ts` (`RenderWorkerManager`), `renderProtocol.ts`, `renderSupport.ts`, `entityFrameCodec.ts`. Messages are a protocol: extend `renderProtocol.ts`, do not post ad hoc objects.

## Gotchas
- Typing a draw function as `CanvasRenderingContext2D` compiles but silently skips the GPU path; type it `IsoRenderer`.
- The DPR is capped by preset (`getRenderDpr`); compute pixel sizes from it, not from `window.devicePixelRatio`.
- Headless auto-quality drops to `low` (no sway, fewer particles); set localStorage `varanasi-graphics-quality` = `high` before judging visuals.
- Overlay mode switches `contentKey` to the grid object, so overlay views redraw on every grid update; keep overlay colour maps cheap.

## Verify
- `npx vitest run src/lib/__tests__/rendererSelection.test.ts` and any draw-model test you touched.
- Same view under `?renderer=canvas` and `?renderer=gpu`; pan across trees next to tall buildings and check overlap.
- Pause the game, place and bulldoze a building: the static layer must update without a pan.
- Load a second city of the same size and check pedestrians and cars use the new map's homes and roads.
- Then skills/perf-budget and skills/verification-gate.
