# IsoCity Perf Upgrade - Completion Summary

This summarizes the current implementation status of [isocity-perf-upgrade_d4f87744.plan.md](./isocity-perf-upgrade_d4f87744.plan.md).

## Phase 1 - OffscreenCanvas Render Worker

- [x] Scaffold render worker: `renderWorker.ts`, `renderWorkerManager.ts`, `renderProtocol.ts` with capability detection and main-thread fallback
- [x] Refactor `imageLoader.ts` to support `ImageBitmap` atlases and worker-safe background filtering with `OffscreenCanvas`
- [x] De-hook entity systems into pure, worker-safe cores
  Applied via `scripts/dehook.mjs` codemod: stripped 68 `useCallback` wrappers and 1 `useRef` across `vehicleSystems.ts`, `boatSystem.ts`, `bargeSystem.ts`, `seaplaneSystem.ts`, `aircraftSystems.ts`, `effectsSystems.ts`, `windSystem.ts`. Exports renamed `use*System` -> `create*System` and 16 call-sites in `CanvasIsometricGrid.tsx` updated. `lightingSystem` / `windSystem` pure renderer cores continue to exist alongside the new `create*` factories. `tsc --noEmit` clean.
- [ ] Transfer six canvases (all except `hoverCanvas`) to the worker via `transferControlToOffscreen`
  Current state: only the lighting canvas is transferred to the worker.
- [ ] Move the main paint loop body from `CanvasIsometricGrid.tsx` into `renderWorker.ts`
  Deferred. The paint loop reads closures, `imageLoader` cache, `Tile[][]` grid, React state (`currentSpritePack`, `overlayMode`, `selectedTool`) and emits side effects via callbacks. A safe port requires per-frame grid/bitmap transfer protocol, visual-parity validation, and cannot be completed as a drive-through without risking silent regressions.
- [ ] Move the animated entities loop into the worker
  Deferred. Depends on the paint-loop port landing first so entity state ownership can transition to the worker.
- [ ] Keep `MiniMap` on the main thread and feed it from worker/shared-buffer data
  Ready to be driven from `gridBufferRef` (see Phase 2 infrastructure below) once consumers opt in.
- [ ] Verify full Phase 1 parity and ship
  Blocked on the two deferred migration tasks above.

## Phase 2 - Flat Typed-Array Grid

- [x] Define SoA schema in `src/games/isocity/gridBuffer.ts` with typed arrays and version header
- [x] Add `gridAdapter.ts` with `getTile` / `setTileField` style incremental migration helpers
- [x] Wire `GameContext` to maintain a live SoA mirror of `state.grid` on every state change, exposed via `gridBufferRef` so the worker, MiniMap, and read-only simulation scans can read typed arrays without walking `Tile[][]`. Size/version header is kept in sync; cost is ~12 B/tile copied at state-change cadence (~2 Hz during simulation).
- [ ] Migrate `simulateTick`, `calculateServiceCoverage`, and `calculateStats` in `src/lib/simulation.ts` to direct typed-array reads/writes
  Deferred. `simulation.ts` has 260 direct tile-field accesses across a 4,294-line module; `simulateTick` signature takes `GameState`, not a buffer. A safe migration needs (a) signature changes to pass the buffer in or keep `state.grid` as the write side with a read-only buffer view, and (b) the golden-state diff harness listed below to compare old and new outputs before swapping.
- [ ] Migrate remaining O(grid^2) scans to typed-array/indexed reads
  Gated on the item above.
- [ ] Update save/load worker and storage serialization to preserve JSON compatibility from the SoA buffer
  Not required until the canonical storage becomes the buffer; current buffer is a read-side mirror only.
- [ ] Decide and implement `SharedArrayBuffer` vs `postMessage + ArrayBuffer` strategy in `next.config.js`
  Deferred with the worker migration. Current `ArrayBuffer` is sufficient for the mirror use case.
- [ ] Add golden-state diff verification for old vs new simulation outputs
  Precondition for the sim migration above.

## Verified So Far

- [x] `npx tsc --noEmit`
- [x] `npm run build`
- [ ] `npm run lint`
  Current state: lint still fails on pre-existing repo issues, including an existing `CanvasIsometricGrid.tsx` memoization warning/error path that was not introduced by this plan.

## Landed this session

- Chunk A - Entity system de-hooking via `scripts/dehook.mjs` (mechanical codemod, 68 useCallback wrappers stripped, 1 useRef replaced, 7 hook exports renamed, 16 call-sites updated).
- Chunk C infrastructure - `gridBufferRef` SoA mirror maintained in `GameContext` on every state change; read-side consumers can now fetch typed-array views without walking `Tile[][]`.

## What requires a follow-up session

- Full paint loop port into the worker (visual parity validation required).
- Animated entities ownership handoff to the worker.
- Golden-state diff test harness.
- `simulation.ts` hot-path migration to read directly from `gridBufferRef` (260 field accesses; signature changes to `simulateTick`).
- Save/load routing from the SoA buffer.
- COOP/COEP decision for `SharedArrayBuffer`.
