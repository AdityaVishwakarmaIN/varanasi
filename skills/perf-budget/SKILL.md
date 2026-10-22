---
name: perf-budget
description: Use when a change could cost frame time, tick time or save time (new entities, per-tile scans, masks, draw passes, quality settings, game-loop timing), and when measuring or logging performance. Holds the hard targets, the loop and quality numbers, the measuring tools and the perf-log format.
---

# Perf Budget

"Never stutters" is a hard requirement (`documentation/game-plan/00-game-design.md` §7): when a target cannot be met the game lowers detail by itself instead of dropping frames. Every change that adds work per tick or per frame must stay inside these budgets, be measured, and be logged.

## Read first
- `documentation/game-plan/00-game-design.md` §7 (targets) and `documentation/game-plan/perf-log.md` (history)
- `src/lib/gameLoop.ts`, `src/lib/qualityConfig.ts`, `src/lib/graphicsSettings.ts`, `src/lib/perfStats.ts`
- skills/render-pipeline-gotchas for where render time goes

## Targets (design §7)
| Metric | Desktop | Mobile |
|---|---|---|
| Map tested | 160x160 fully built | 120x120 fully built |
| Frame p95 while panning/zooming | 16.7 ms (60 fps) | 33 ms (30 fps) |
| Worst single frame | 50 ms | 100 ms |
| Sim tick on main thread | 4 ms | 8 ms |
| Autosave main-thread block | 16 ms | 33 ms |

## Rules
- No allocation per tick or per frame in hot loops: reuse arrays, use `for` loops, no `forEach`/spread/closures per tile.
- Per-tile derived data goes in typed-array masks cached on `structureVersion` (pattern: `getShadeMask(grid, size, structureVersion)` in `src/lib/crisisSim.ts`, `getCityFloodMask` in `src/lib/floodSim.ts`).
- In `simulateTick`, write through `CopyOnWriteGrid` (`src/lib/simulation.ts`); only touched rows are cloned. Never clone the grid (perf-log: cloning all 160 rows was ~2 ms plus heavy GC before S1-T5).
- Crowd entities need a per-preset cap and culling (skills/render-feature).
- Cache anything that depends only on buildings by `structureVersion`, on roads by `roadNetworkVersion`.

## Reference

### Game loop (`src/lib/gameLoop.ts`)
- `TICK_INTERVAL_MS`: desktop `[500, 300, 200]`, mobile `[750, 450, 300]` ms per tick for speeds 1-3; read via `getTickIntervalMs(speed, isMobile)`.
- `GAME_LOOP_CONFIG`: `maxTicksPerFrame: 2` (spiral-of-death guard), `slowTickMs: 12` (after a slower tick, no second tick that frame), `uiSyncIntervalMs: 500` (how often GameContext pushes sim state to React UI).
- `SimulationScheduler` applies these; it is unit-tested in `src/lib/__tests__/gameLoop.test.ts`.

### Quality (`src/lib/qualityConfig.ts`, `src/lib/graphicsSettings.ts`)
- `QUALITY_PRESETS` low / medium / high, `dprCap` 1 / 1.5 / 2 (`getRenderDpr`).
- `AUTO_QUALITY_START`: desktop `high`, mobile `medium`.
- `AUTO_QUALITY_CONFIG`: check every 2000 ms, budget `{ desktop: 16.7, mobile: 33 }`, drop after 3 over-budget checks, raise after 10 checks under 0.6 x budget, ignore 2 checks after a change. Pure step: `stepAutoQuality`; caller `runAutoQualityCheck(frameP95, interacting)`.
- Battery saver (`src/lib/batterySaver.ts`): paused and idle for `BATTERY_SAVER_CONFIG.idleMs` (5000) drops to 10 fps; `batterySaverFrameMs` is the pure rule.

### Measuring
- PerfHud (`src/components/game/PerfHud.tsx`): mounted only with `?dev=1` (`isDevMode`, `src/lib/devMode.ts`); then F3 or `?perf=1` toggles it.
- Counters (`src/lib/perfStats.ts`): `recordFrame`, `recordTick`, `recordSave`, `setEntityCount`, `getPerfSnapshot`, `startPerfCapture` / `stopPerfCapture`.
- Browser benchmark: `?bench=120` or `?bench=160`, plus `&flythrough=1` for the measured 30 s figure-eight (`BENCHMARK_CONFIG`, `parseBenchmarkParams` in `src/lib/benchmark.ts`, run by `BenchmarkRunner`, always mounted; no `?dev=1` needed). It loads a seeded city and skips the start screen.
- Sim benchmark (node): `BENCH=1 npx vitest run src/lib/__tests__/simBench.test.ts`; optional `BENCH_TICKS=200`, `BENCH_SIZE=160`, `BENCH_PROFILE=1` (per-function self time).

### Logging (`documentation/game-plan/perf-log.md`)
Append a row, newest at the bottom:
`| Date | Commit | Device | Map | Renderer | FPS | Frame p95 | Frame max | Tick p95 | Tick max | Save max | Notes |`
- Device: the real machine, or "DevTools CPU 4x throttle".
- Map: `bench-120`, `bench-160` or `varanasi-160-full`. Renderer: `canvas` or `gpu`. Times in ms.
- Note the quality setting and entity counts in Notes.

## Gotchas
- Headless CI numbers are not representative: shared vCPUs, software GL. SwiftShader GPU runs at ~1.2 FPS; it says nothing about real GPUs. Use them only for A/B within one session, and say so in Notes.
- Real-hardware rows for the reference devices are still owed (S1-T13); `gpuByDefault` stays off until they exist.
- Under load, p95 is dominated by CPU contention and GC; run before/after in the same session, alternating, and compare p50 too.
- Auto quality may drop to low during a headless run; force `varanasi-graphics-quality` in localStorage when comparing.
- A slow tick shows up as frame hitches at speed 3, not as low average FPS; check Frame max and Tick max.

## Verify
- `BENCH=1 npx vitest run src/lib/__tests__/simBench.test.ts` before and after a sim change.
- `?bench=160&flythrough=1` (desktop) and `?bench=120&flythrough=1` at 390x844 with CPU throttle for render changes.
- Perf-log row added; then skills/verification-gate.
