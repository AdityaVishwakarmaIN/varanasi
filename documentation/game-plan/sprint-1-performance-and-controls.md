# Sprint 1: Performance and Controls (the foundation)

> **Read first:** [README.md](README.md) (rules) and [00-game-design.md](00-game-design.md) (scope).
> **Depends on:** nothing. This is the first sprint.
> **Pillars served:** P1 Never stutters, P5 Familiar to play.

---

## 1. Goal

By the end of this sprint:

1. A **fully built 160×160 city** pans and zooms at **60 fps on a mid-range laptop** and **30 fps on a mid-range phone**,
   with no freezes.
2. We can **measure** performance at any time with an on-screen HUD and a repeatable benchmark city.
3. Mouse, keyboard and touch **controls feel good** and match what strategy players expect.
4. Saves are **reliable** for big cities.

No new gameplay is added in this sprint. The game should look and play the same, only smoother and more solid.

## 2. Why this sprint comes first

Every later sprint adds more things to simulate and draw: the river, floods, crowds, festivals, cows.
If the foundation is slow now, every feature makes it slower, and fixing performance at the end is far
more expensive. Game developers call this **"performance is a feature, budget it from day one."**

## 3. Game-development principles used in this sprint

Read these once. The tasks refer to them by name.

| Principle | Plain-English meaning |
|-----------|----------------------|
| **Measure before optimising** | Do not guess what is slow. Measure it, fix the biggest cost, then measure again. |
| **Frame budget** | At 60 fps each frame has 16.7 ms. Everything (input, simulation share, drawing) must fit inside it. |
| **Fixed timestep** | The simulation advances in equal steps ("ticks") no matter how fast the screen redraws. Drawing and simulating are separate. |
| **Never block the main thread** | Heavy work (saving, big calculations) runs in small chunks or in a Web Worker, so input and drawing never wait. |
| **Cache what rarely changes** | If a result only changes when the player builds something, compute it once and reuse it until the next build. |
| **Level of detail (LOD)** | Far away (zoomed out), draw less: no pedestrians, simpler sprites, no particles. |
| **Graceful degradation** | On weak devices, lower detail automatically instead of dropping frames. |
| **Determinism for testing** | The same seed gives the same map, so performance tests can be repeated and compared fairly. |

## 4. What exists today (read before starting)

| Thing | Where | Notes |
|-------|-------|-------|
| Simulation loop | `src/context/GameContext.tsx`, the `useEffect` that calls `setInterval` and `simulateTick(...)` (around line 860) | Tick interval 500/300/200 ms on desktop and 750/450/300 ms on mobile. Runs on the main thread. Pushes to React state every 500 ms. |
| One simulation step | `simulateTick()` in `src/lib/simulation.ts` (around line 2211) | Calls `calculateServiceCoverage()` **every tick**, even when nothing was built. |
| Render loop | `src/components/game/CanvasIsometricGrid.tsx`, functions that call `requestAnimationFrame(render)` | Canvas2D by default. |
| GPU renderer | `src/components/game/gpu/` | PixiJS v8. **Off by default**. Turned on only when built with `NEXT_PUBLIC_GPU_RENDERER=1`. A comment near line 2409 lists missing parts: beaches, railroad crossings, service-radius circles, water-body labels, tree fire overlays. |
| Performance helpers | `src/lib/performanceUtils.ts` | `SpatialGrid`, `getLODLevel`, `getVisibleTileBounds`, `FrameBudget`, `ChunkRenderer` already exist. **Reuse them.** |
| Grid as typed arrays | `src/games/isocity/gridBuffer.ts` | Can use `SharedArrayBuffer`. Groundwork for Web Worker use. |
| Saving | `src/lib/isocityStorage.ts` (localStorage keys), `src/lib/saveWorker.ts` (compression in a worker), autosave every 5 s in `GameContext.tsx` (around line 816) | localStorage holds only about 5 MB. |
| Default map size | `DEFAULT_GRID_SIZE` in `src/lib/simulation.ts` line 46 (`isMobile ? 50 : 70`) | `simulation.ts` imports `react-device-detect`, which is not allowed in pure logic (see S1-T5). |
| Zoom limits | `ZOOM_MIN = 0.3`, `ZOOM_MAX = 5` in `src/components/game/constants.ts` | |
| Keyboard | WASD and arrow keys pan (`CanvasIsometricGrid.tsx` around line 715). `Esc`, `B` (bulldoze) and `P` (pause) in `src/components/Game.tsx` around line 210 | |
| Mouse | Middle-drag or Alt+left-drag pans, wheel zooms to the cursor, right-click returns to the Select tool | `handleMouseDown` and `handleWheel` in `CanvasIsometricGrid.tsx` |
| Touch | One finger pans or taps, two fingers pinch-zoom | `handleTouchStart/Move/End` in `CanvasIsometricGrid.tsx` |
| Tests | **None.** No test framework | Added in S1-T1. |

---

## 5. Tasks

Do them **in this order**. Tick each box when it is done (see Definition of Done in README).

- [x] S1-T1: Unit test setup and seeded random numbers
- [ ] S1-T2: Performance HUD and benchmark city
- [ ] S1-T3: Record the baseline
- [ ] S1-T4: A proper game loop (fixed timestep, pause when hidden)
- [ ] S1-T5: Make the simulation cheaper
- [ ] S1-T6: Simulation in a Web Worker (**only if S1-T5 is not enough**)
- [ ] S1-T7: GPU renderer on by default, quality presets and auto-quality
- [ ] S1-T8: Support big maps (160×160 desktop, 120×120 mobile)
- [ ] S1-T9: Reliable saves (IndexedDB)
- [x] S1-T10: Desktop controls
- [x] S1-T11: Touch controls
- [x] S1-T12: Hide multiplayer
- [ ] S1-T13: Final measurement and sprint sign-off

---

### S1-T1: Unit test setup and seeded random numbers

**Why:** we need (a) a way to test pure game logic, and (b) maps that come out identical every time for
fair performance comparisons.

**Files to read:** `package.json`, `tsconfig.json`, `src/lib/simulation.ts` (functions `perlinNoise`,
`generateLakes`, `generateOceans`, `generateTerrain`, `createInitialGameState`, `generateRandomAdvancedCity`).

**Steps:**
1. Install Vitest as a dev dependency: `npm install -D vitest`.
2. Add `"test": "vitest run"` to `scripts` in `package.json`.
3. Create `vitest.config.ts` at the repo root. It must resolve the `@/` alias to `src/` (same as `tsconfig.json`)
   and use `environment: 'node'`.
4. Create `src/lib/rng.ts` exporting:
   ```ts
   /** Returns a function that gives the same sequence of numbers in [0, 1) for the same seed. */
   export function createRng(seed: number): () => number { /* mulberry32 algorithm */ }
   export type Rng = () => number;
   ```
5. In `src/lib/simulation.ts`, add an **optional last parameter** `rng: Rng = Math.random` to
   `generateLakes`, `generateOceans`, `generateTerrain`, `createInitialGameState` and `generateRandomAdvancedCity`.
   Inside **only these functions**, replace `Math.random()` with `rng()` and pass `rng` down to the
   functions they call. Also replace the `seed = Math.random() * 1000` in `generateTerrain` with `rng() * 1000`.
   Existing callers pass nothing, so the game behaves exactly as before.
6. Write tests in `src/lib/__tests__/`:
   - `rng.test.ts`: the same seed gives the same first 10 numbers, and different seeds give different numbers.
   - `mapgen.test.ts`: `generateRandomAdvancedCity(60, 'Test', createRng(42))` run twice gives grids where
     every tile's `building.type` and `zone` are equal.
   - `scoring.test.ts`: at least 3 tests of existing pure functions in `src/lib/scoring.ts`
     (for example the environment score: more trees gives a higher or equal score, and the result is always 0–100).

**Acceptance criteria:**
- `npm test` runs and all tests pass.
- Starting a normal new game still makes a random (different each time) map.

**How to test:** run `npm test`. Then `npm run dev`, start two new games and check that the maps differ.

---

### S1-T2: Performance HUD and benchmark city

**Why:** *measure before optimising.* We need numbers on screen and a fixed city to measure on.

**Files to read:** `src/components/game/CanvasIsometricGrid.tsx` (the render loop functions and where
`requestAnimationFrame` is called), `src/context/GameContext.tsx` (tick loop),
`src/components/game/panels/SettingsPanel.tsx` (the "Developer Tools" section around line 596).

**Steps:**
1. Create `src/lib/perfStats.ts`. It is a small module (no React) that stores the **last 300** values in
   ring buffers and exports:
   - `recordFrame(ms: number)`, `recordTick(ms: number)`, `recordSave(ms: number)`
   - `getPerfSnapshot(): { fps: number; frameP50: number; frameP95: number; frameMax: number; tickP95: number; tickMax: number; saveMax: number; entities: Record<string, number> }`
   - `setEntityCount(name: string, n: number)` (for example `'cars'`, `'pedestrians'`, `'boats'`)
   - `resetPerfStats()`
2. In the main render loop, measure how long each frame takes with `performance.now()` and call
   `recordFrame`. In the tick loop in `GameContext.tsx`, measure the `simulateTick` call and call `recordTick`.
   Around the save call, call `recordSave`.
3. Create `src/components/game/PerfHud.tsx`: a small fixed box in the top-left corner showing the snapshot,
   updated **twice per second** (use `setInterval` of 500 ms, *not* every frame, because the HUD must not cost performance).
   Show: FPS, frame p50/p95/max (ms), tick p95/max (ms), save max (ms), map size, and entity counts.
   Colour frame p95 green if ≤ 16.7 ms, yellow if ≤ 33 ms, red otherwise.
4. Toggle the HUD with the **F3** key and with URL parameter `?perf=1`. It is hidden by default.
5. Add a **benchmark city**:
   - In `SettingsPanel.tsx` Developer Tools, add buttons "Benchmark: Medium (120)" and "Benchmark: Large (160)".
   - Each calls `generateRandomAdvancedCity(size, 'Benchmark', createRng(20260924))` and loads the result
     with the existing `loadState`.
   - URL parameter `?bench=160` (or `120`) loads the benchmark on start (for automated runs).
6. Add a **camera fly-through** for repeatable measurement: with `?bench=...&flythrough=1`, after loading, the
   camera pans in a fixed loop for **30 seconds** (for example a figure-eight), zooms in and out once, then
   prints `getPerfSnapshot()` to the browser console as JSON. Reset the stats right before the fly-through starts.

**Acceptance criteria:**
- F3 shows and hides the HUD. The numbers change while panning.
- Loading the benchmark twice gives the **same city layout**.
- The fly-through runs by itself and logs a JSON result.

**How to test:** `npm run dev`, open `http://localhost:3000/?bench=160&flythrough=1&perf=1`, wait 30 s, then read the console.

---

### S1-T3: Record the baseline

**Why:** without a "before" number we cannot prove any improvement.

**Steps:**
1. Create `documentation/game-plan/perf-log.md` (if it does not exist) with this table header:
   `| Date | Commit | Device | Map | Renderer | FPS | Frame p95 | Frame max | Tick p95 | Tick max | Save max | Notes |`
2. Run the fly-through for **120** and **160** on desktop, and **120** in Chrome DevTools with CPU throttling
   "4× slowdown" (a stand-in for a phone). Add one row per run.
3. Also run with the GPU renderer: `NEXT_PUBLIC_GPU_RENDERER=1 npm run dev`. Add rows with Renderer = `gpu`.
4. In the Chrome DevTools **Performance** tab, record 10 seconds of panning on the 160 map. Write the **top 5
   most expensive functions** into the Notes of that row.

**Acceptance criteria:** perf-log.md has at least 6 rows plus the top-5 list.

---

### S1-T4: A proper game loop (fixed timestep, pause when hidden)

**Why:** `setInterval` can fire late, can pile up behind a slow tick, and keeps running when the tab is hidden.
The design says the game **pauses when the tab is closed or hidden**.

**Files to read:** `src/context/GameContext.tsx` (tick `useEffect` around lines 860–905, `setSpeed`),
`src/components/game/gpu/interpolate.ts` (`FixedTimestepClock` already exists, so check whether it fits).

**Steps:**
1. Create `src/lib/gameLoop.ts` with a class `SimulationScheduler`:
   - `constructor(onTick: () => void, getIntervalMs: () => number)`
   - `start()`, `stop()`, `setPaused(paused: boolean)`
   - Internally it uses `requestAnimationFrame` plus an **accumulator**. Each frame it adds the elapsed time.
     While `accumulator >= interval`, it runs one tick and subtracts `interval`.
   - **Spiral-of-death guard:** run at most **2 ticks per frame**. If more are owed, drop the extra time
     (set the accumulator to 0). The game slows down briefly instead of freezing.
   - **Tick-time guard:** if one tick took longer than 12 ms, skip running a second tick in that frame.
2. Replace the `setInterval` tick loop in `GameContext.tsx` with the scheduler. Keep the interval values
   in a named config: `TICK_INTERVAL_MS = { desktop: [500, 300, 200], mobile: [750, 450, 300] }`.
   Keep the existing "sync to React at most every 500 ms" behaviour.
3. **Pause when hidden:** listen to `document.visibilitychange`. When hidden, pause the scheduler **and** trigger
   an autosave. When visible again, resume at the previous speed. The game's own `speed` value must not
   change, because this is a separate "system pause".
4. Keep the existing speeds (0 = paused, 1, 2, 3).

**Acceptance criteria:**
- The game runs at the same speed as before at speeds 1, 2 and 3 (compare in-game days per minute
  before and after; they should be within ±10%).
- Switching to another tab for 30 s and coming back: the in-game date has **not** moved.
- On the benchmark, the HUD's frame max does not get worse compared with the baseline.

**How to test:** note the in-game date, switch tabs for 30 s, come back and check that the date is the same. Then run the fly-through and compare with perf-log.md.

---

### S1-T5: Make the simulation cheaper

**Why:** the simulation shares the main thread with drawing. Target: **tick p95 ≤ 4 ms desktop / ≤ 8 ms
mobile** on the 160 benchmark at speed 3.

**Files to read:** `src/lib/simulation.ts`: `simulateTick`, `calculateServiceCoverage` (around line 1309),
`calculateStats` (around line 1812), `updateBudgetCosts` (around line 2002). Also your top-5 list from S1-T3.

**Steps:**
1. **Cache service coverage.** `calculateServiceCoverage(grid, size)` only changes when buildings change
   (`state.structureVersion` goes up) or when budget funding changes. Create a module-level cache keyed by
   `structureVersion`, `gridSize` and a string of the budget funding values. On a cache hit, return the
   cached result. Also invalidate it when a service building is upgraded (`upgradeServiceBuilding` already
   bumps `structureVersion`, so check this).
   *Careful:* if any code path changes buildings **without** bumping `structureVersion`, the cache will be
   stale. Search for every place that sets a tile's `building` and confirm that it bumps the version, or make it bump it.
2. **Remove `react-device-detect` from `simulation.ts`.** Replace `DEFAULT_GRID_SIZE` with a function
   argument or a value passed in from the UI layer (`GameContext.tsx` already knows if it is mobile).
   Pure logic must not look at the device (README rule 7).
3. Take the **next two** most expensive simulation functions from your S1-T3 profile and make them cheaper
   using the same ideas: skip tiles that cannot change, compute rarely-changing things only when needed,
   and avoid creating new objects or arrays inside loops over all tiles.
4. Add unit tests: `simulateTick` on a seeded 60×60 city gives **identical results** with and without the
   cache (compare `stats` and all tile `building.type`, `powered` and `watered` after 20 ticks).

**Acceptance criteria:**
- Tick p95 on the 160 benchmark at speed 3 is **≤ 4 ms on desktop**. If it is not, do S1-T6.
- The tests prove the results are unchanged.

**Decision gate:** write in perf-log.md: *"S1-T5 result: tick p95 = X ms → S1-T6 needed: yes/no."*

---

### S1-T6: Simulation in a Web Worker (only if S1-T5 was not enough)

**Why:** if the simulation still costs more than 4 ms per tick, it must leave the main thread entirely.

**Skip this task** if the S1-T5 decision gate said "no". Mark it `[skipped: not needed]`.

**Files to read:** `src/lib/saveWorker.ts` and `src/lib/saveWorkerManager.ts` (an existing worker pattern
in this repo; copy its style), `src/games/isocity/gridBuffer.ts`, and every function in `GameContext.tsx`
that changes the game state (placing, bulldozing, taxes and so on).

**Design: "worker owns the tick, main thread owns player actions, actions are replayed":**
1. `src/lib/simWorker.ts`: receives `{ type: 'tick', state }` and replies `{ type: 'tickDone', state, tickMs }`.
2. `src/lib/simWorkerManager.ts`: sends a tick only when the previous one has returned (never two in flight).
3. **Player actions made while a tick is in flight** (for example placing a road) are applied to the main-thread
   state immediately, so the player sees them at once, **and** saved in a `pendingActions` list as functions
   `(state) => state`. When the worker's result returns, apply every pending action again, in order, on
   top of the worker result, then clear the list. The player's action is never lost.
4. Keep a switch `SIM_IN_WORKER` (config constant, default `true` after this task) so the old path can be turned back on if needed.

**Acceptance criteria:**
- Tick time no longer appears in the main-thread profile.
- Place 20 roads quickly while the game runs at speed 3: **all 20 roads survive**.
- The S1-T5 identical-results test still passes.

---

### S1-T7: GPU renderer on by default, quality presets and auto-quality

**Why:** drawing is usually the biggest cost. The GPU path exists but is off and incomplete.

**Files to read:** `src/components/game/gpu/*`, the GPU-related code in `CanvasIsometricGrid.tsx`
(search for `GPU_RENDERER_ENABLED` and `pixiRendererRef`), `src/lib/performanceUtils.ts` (`getLODLevel`, `LOD_LEVELS`),
`src/components/game/panels/SettingsPanel.tsx`.

**Steps:**
1. **Finish the GPU path's missing parts** listed in the comment near `CanvasIsometricGrid.tsx` line 2409:
   beaches, railroad crossings, service-radius circles, water-body labels, tree fire overlays. For each one,
   compare a screenshot of Canvas2D against GPU at the same camera position. They should look the same.
2. **Pick the renderer at runtime instead of at build time.** Replace the build flag with:
   `renderer = userSetting ?? (supportsWebGL2() ? 'gpu' : 'canvas')`. If the GPU renderer fails to start
   (an exception or a lost context), fall back to Canvas2D automatically and log a warning once.
3. **Quality presets** in Settings: `Low`, `Medium`, `High` and `Auto` (default). Put them in a config object
   `QUALITY_PRESETS` in a new file `src/lib/qualityConfig.ts`:

   | Setting | Low | Medium | High |
   |---------|-----|--------|------|
   | Pedestrians | off | 50% density | 100% |
   | Cars / vehicles | 40% | 70% | 100% |
   | Clouds, weather particles | off | on (fewer particles) | on |
   | Night lighting effect | off | on | on |
   | Smog / fireworks / particles | off | 50% | 100% |
   | Device pixel ratio cap | 1 | 1.5 | 2 |
   | Tree sway animation | off | on | on |

   (These are starting values. Every system must read its number from `QUALITY_PRESETS`, not a hard-coded value.)
4. **Auto-quality:** read `getPerfSnapshot().frameP95` every 2 seconds.
   - If p95 is over budget (16.7 ms desktop / 33 ms mobile) for **3 checks in a row**, drop one level (High → Medium → Low).
   - If p95 is under **60% of the budget** for **10 checks in a row**, raise one level.
   - This gap between the two rules is called **hysteresis**. It stops the quality from flickering up and down.
   - Never change quality while the player is actively panning or zooming. Wait until they stop.
5. The HUD shows the current renderer and quality level.

**Acceptance criteria:**
- The game uses the GPU renderer by default on a normal laptop and falls back to Canvas2D when WebGL2 is disabled
  (test: `chrome://flags` → disable WebGL, or force it with a setting).
- On the 160 benchmark with Auto quality, desktop p95 is ≤ 16.7 ms. With CPU 4× throttle on the 120 map, p95 is ≤ 33 ms.
- The two renderers look the same (screenshots side by side, attached to the commit description or perf-log notes).

---

### S1-T8: Support big maps (160×160 desktop, 120×120 mobile)

**Why:** the design needs a full-city map. The default is currently 70 (desktop) and 50 (mobile).

**Files to read:** `createInitialGameState` and `expandGrid` in `simulation.ts`, `src/components/game/MiniMap.tsx`,
`getVisibleTileBounds` in `performanceUtils.ts`, the vehicle and pedestrian system files (look for any loop over *all* tiles).

**Steps:**
1. Add a config `MAP_SIZES = { varanasi: { desktop: 160, mobile: 120 }, random: { desktop: 70, mobile: 50 } }`
   in a new `src/lib/mapConfig.ts`. The Varanasi value is used in Sprint 2. Random stays as today.
2. Load the 160 benchmark and check each system for work that grows with **map size** instead of with
   **what is on screen**. Fix these by only processing tiles inside `getVisibleTileBounds` (drawing) or by using
   `SpatialGrid` (entity lookups). Start with anything in the S1-T3 top-5 list.
3. **Entity caps:** cars, pedestrians and boats must have a maximum count (from `QUALITY_PRESETS`) and must only
   **spawn near the visible area** (visible bounds plus a margin of 10 tiles). Entities far off-screen are removed.
4. **Minimap:** make sure it redraws only when `structureVersion` changes, not every frame.
5. Check the zoom limits: at `ZOOM_MIN` the whole 160 map must fit on a 1366×768 screen. If it does not, lower
   `ZOOM_MIN` and make sure LOD hides small details at that zoom.

**Acceptance criteria:**
- A 160×160 benchmark meets the desktop targets in 00-game-design.md section 7.
- Zooming fully out shows the whole map with no stutter.

---

### S1-T9: Reliable saves (IndexedDB)

**Why:** localStorage holds only about 5 MB. A compressed 160×160 city can exceed that, and the save would **fail silently**.

**Files to read:** `src/lib/isocityStorage.ts`, `src/lib/saveWorker.ts`, `src/lib/saveWorkerManager.ts`, and
the autosave code in `GameContext.tsx` (around line 800).

**Steps:**
1. Create `src/lib/storage/idbStore.ts`: a tiny wrapper over IndexedDB with `get(key)`, `set(key, value)`,
   `del(key)` and `keys()`. It uses one database `varanasi` and one object store `saves`. Do not add a library,
   because the API is small.
2. Move the **city saves** (`isocity-game-state`, `isocity-city-*` and the saved-cities index) to IndexedDB. Keep
   small **UI preferences** in localStorage (they are tiny and read synchronously at start).
3. **Migration:** on first start after this change, if the old localStorage keys exist, copy them into IndexedDB,
   check that the copy reads back correctly, and **only then** delete the old localStorage keys. If anything
   fails, keep the old keys and log an error.
4. **Autosave policy:** save every **30 s** (not 5 s) *if something changed*, plus immediately on `visibilitychange → hidden`
   and on `pagehide`. Keep compression in the worker.
5. **Safe writes:** write the new save under a temporary key, then swap it with the real key. A crash mid-save must never
   destroy the last good save.
6. If a save fails, show a notification: "Couldn't save your city. Export it from Settings to keep a copy."

**Acceptance criteria:**
- A 160×160 city saves and loads correctly after a page refresh.
- An old save from before this change still loads (test: check out the previous commit, play, save, then switch back).
- HUD "save max" is ≤ 16 ms on desktop.

---

### S1-T10: Desktop controls

**Why:** strategy players expect standard, responsive controls. *Game feel* matters: the camera should glide, not jump.

**Files to read:** in `CanvasIsometricGrid.tsx`: `handleMouseDown`, `handleWheel`, the keyboard panning effect
(around line 715). In `src/components/Game.tsx`: the keyboard shortcut effect (around line 210). Also `Sidebar.tsx`.

**Target control scheme** (implement exactly this):

| Input | Action | Exists today? |
|-------|--------|---------------|
| Left-click | Use current tool / select | yes |
| Left-drag | Draw roads, rail and zones (with those tools); pan (with Select tool) | yes |
| Right-drag | **Pan** | no (right-click cancels the tool; keep that for a click without a drag) |
| Right-click (no drag) | Cancel current tool → Select | yes |
| Middle-drag, or Space + left-drag | Pan | middle yes, Space no |
| Mouse wheel | Zoom towards the cursor | yes |
| W A S D / arrow keys | Pan | yes |
| `+` / `-` | Zoom in / out towards the screen centre | no |
| `Space` (tap) | Pause / resume | no (today it is `P`, so keep `P` too) |
| `1` `2` `3` | Game speed | no |
| `R` `C` `I` | Residential / Commercial / Industrial zone tool | no |
| `X` | Road tool | no |
| `B` | Bulldoze | yes |
| `Esc` | Close overlay → close panel → deselect → Select tool (existing order) | yes |
| `Tab` | Cycle through overlays | no |
| `?` | Show a controls help panel | no |
| `F3` | Performance HUD | from S1-T2 |

**Steps:**
1. Put all key bindings in one config `KEY_BINDINGS` in a new `src/lib/controlsConfig.ts`, and handle them in **one** place.
   Move the existing shortcuts from `Game.tsx` there. Ignore keys while typing in inputs (the existing check does this, so reuse it).
2. **Smooth camera:** zoom animates towards the target zoom over about **120 ms** (ease-out). After a drag-pan is released,
   the camera keeps gliding briefly and slows to a stop (inertia, friction about **0.90 per frame**). Put these values in `controlsConfig.ts`.
3. **Space + drag** pans. A quick tap of Space (under 200 ms, with no mouse movement) toggles pause.
4. **Placement preview:** while a building tool is active, the hovered footprint is **green** (can build) or **red** (cannot),
   and a small label shows the **cost**. When red, the label shows the reason (for example "Needs road access",
   "Not enough money", "Blocked"). Reuse existing placement checks. Do not duplicate the rules.
5. Create a **Controls help panel** (`?` key and a button in Settings) that lists the table above, generated from `KEY_BINDINGS`.

**Acceptance criteria:** every row of the table works. The help panel matches the bindings. No shortcut fires while typing a city name.

---

### S1-T11: Touch controls

**Why:** the full game must work on phones (design decision), but one finger cannot both pan and draw.

**Files to read:** touch handlers in `CanvasIsometricGrid.tsx` (around line 3538), `src/components/mobile/MobileToolbar.tsx`,
`src/components/mobile/MobileTopBar.tsx`, `src/hooks/useMobile.ts`.

**Target touch scheme:**

| Gesture | Action |
|---------|--------|
| One-finger drag | Pan (always, whatever tool is selected) |
| Two-finger pinch | Zoom around the pinch centre |
| Tap | Use tool once (place building, or select / inspect with the Select tool) |
| Long-press (500 ms) | Inspect the tile (open tile info) with any tool |
| **Draw mode** button (on the toolbar, shown only for road, rail and zone tools) | While on, one-finger drag **draws** instead of pans. Two fingers still pan and zoom. |

**Steps:**
1. Implement the scheme above. Put gesture timings and thresholds in `controlsConfig.ts`
   (tap = under 250 ms and under 10 px movement; long-press = 500 ms).
2. **Confirm expensive taps:** if a tap would place something costing more than **10% of current money**, show a small
   ✓ / ✗ confirm bubble over the tile first. This prevents costly mis-taps.
3. The same smooth zoom and inertia as desktop (reuse the S1-T10 code).
4. Check every toolbar button: touch target ≥ **44×44 px**.
5. During pinch and pan, skip drawing small animated things (the code already does this for some; make it consistent with `QUALITY_PRESETS`).

**Acceptance criteria:** in Chrome DevTools device mode (390×844 phone), every gesture in the table works, draw mode draws roads, and a
mis-tap on an expensive building asks for confirmation.

---

### S1-T12: Hide multiplayer

**Why:** the design says multiplayer is off for v1. Less visible surface means less to maintain and test.

**Files to read:** files that use `useMultiplayer`, `CoopModal` or `ShareModal`: `src/app/page.tsx`, `src/components/Game.tsx`,
`src/components/game/Sidebar.tsx`, `src/app/coop/[roomCode]/page.tsx`.

**Steps:**
1. Add a config flag `FEATURES.coop = process.env.NEXT_PUBLIC_ENABLE_COOP === '1'` in a new `src/lib/features.ts`.
2. When the flag is off: hide every co-op and share-room button, and make `/coop/[roomCode]` redirect to `/`. **Do not delete the code.**
3. Make sure the multiplayer provider does not open network connections when the flag is off.

**Acceptance criteria:** no co-op UI is visible, no Supabase network requests appear in DevTools → Network, and the build passes.

---

### S1-T13: Final measurement and sprint sign-off

**Steps:**
1. Rerun every measurement from S1-T3 and add rows to perf-log.md.
2. Fill in the sprint result table below.
3. Play for 15 minutes on the 160 benchmark on desktop and 10 minutes in phone emulation. Write down anything that felt bad in "Notes for later".

| Target (from 00-game-design §7) | Result | Pass? |
|---------------------------------|--------|-------|
| Desktop 160: frame p95 ≤ 16.7 ms | | |
| Desktop 160: worst frame ≤ 50 ms | | |
| Mobile-sim 120: frame p95 ≤ 33 ms | | |
| Tick p95 ≤ 4 ms desktop / 8 ms mobile | | |
| Save block ≤ 16 ms desktop | | |

## 6. Sprint exit criteria

- [ ] All tasks ticked (S1-T6 may be "skipped: not needed").
- [ ] Every row in the S1-T13 table passes.
- [ ] Old saves still load.
- [ ] The game looks and plays the same as before, apart from smoothness and controls.

## 7. Notes for later

*(Implementers: add things you noticed but did not do here.)*

- **S1-T12:** with co-op off, no Supabase client is created and no Supabase network request is made, but the
  `@supabase/supabase-js` library code is still bundled and downloaded (it is imported statically by
  `MultiplayerContext` → `supabaseProvider`). Loading it with a dynamic `import()` only when `FEATURES.coop` is on
  would shrink the start-up bundle. Co-op entries in the saved-cities index are hidden (not deleted) while the flag is off.
- **S1-T10:** camera smoothing lives in `src/lib/cameraMotion.ts` (pure) and `src/components/game/useSmoothCamera.ts`
  (`animateZoomTo`, `getTargetZoom`, `startInertia`, `stop`). S1-T11 (touch) should call these from the touch handlers
  instead of `setZoom`/`setOffset` directly. The touch handlers were not changed.
- **S1-T10:** `src/lib/placement.ts` mirrors the no-op / money guards and the tool-to-building map from
  `GameContext.placeAtTile` (`toolBuildingMap`, `toolZoneMap`), because those are private to a React file that other
  tasks were editing. Later, `placeAtTile` could call `getPlacementCheck` so the guards exist in one place only.
- **S1-T10:** keyboard shortcuts are ignored while focus is inside a dialog or menu (Radix handles Esc/Tab/Space there),
  so with a panel focused, Esc closes that panel first instead of the overlay. Outside dialogs, Tab now cycles overlays
  instead of moving keyboard focus.
- **S1-T10:** the "Welcome" tip toast sits on top of the placement label and the Controls dialog (z-index). There is no
  "grab" cursor while Space is held (only while actually panning).
- **S1-T10:** while dragging roads/zones the label still shows the old area/cost text; per-tile red/green during a drag
  is only shown for bridges (existing behaviour).
- **S1-T11:** gesture helpers are pure in `src/lib/touchGestures.ts` (`classifyTouch`, `isDrawModeTool`, `needsTapConfirm`,
  `computePinchPose`); thresholds in `TOUCH_CONFIG` (`controlsConfig.ts`). Draw mode reuses the desktop mouse-drag code
  (`handleMouseDown/Move/Up` now take a minimal pointer shape), so road/rail/zone drawing rules exist once.
- **S1-T11:** to fit 44×44 px targets on a 390 px top bar, the four speed buttons became **pause/resume + one speed
  button that cycles 1× → 2× → 3×**. The speed it resumes at is only remembered for changes made with that button.
  Radix slider thumbs (tax slider) were not resized.
- **S1-T11:** render-loop skipping now uses one rule for pan, pinch and wheel zoom (`getInteractionSkips` in
  `cameraMotion.ts`): small things (boats, smog, helicopters, seaplanes) are skipped while moving below
  `SKIP_SMALL_ELEMENTS_ZOOM_THRESHOLD`; mobile still skips *all* animated entities while moving (existing perf choice).
  The pan-inertia glide does not count as "moving". When `QUALITY_PRESETS` (S1-T7) lands, read the threshold from it.
- **S1-T11:** the Controls help panel lists keyboard and mouse only; touch gestures could be added from the table in
  `touchGestures.ts`. Draw-mode drags never ask for confirmation (only taps do). While drawing on touch, the bottom
  placement label shows the desktop text ("Drag to place"). A second finger during a Draw-mode drag cancels an unfinished
  zone rectangle (roads already laid stay). Water/land terraform is not a Draw-mode tool (50,000 per tile).
- **S1-T11 (testing):** headless Chromium launched with the SwiftShader flags from `shot-helper.mjs` runs at 150–300 ms
  per frame, which delays touch events enough to fire long-presses during drags. Launch with default args for touch tests.
