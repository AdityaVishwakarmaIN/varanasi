# Varanasi: Game Plan

This folder is the **single source of truth** for what we are building and in what order.
It is written so that any developer or AI coding assistant can pick up a task and finish it
without guessing.

---

## 1. Reading order

| # | File | What it is | When to read it |
|---|------|------------|-----------------|
| 0 | [00-game-design.md](00-game-design.md) | The game's scope and requirements: what the game is, who it's for, what's in and out | **Always read first** |
| 1 | [sprint-1-performance-and-controls.md](sprint-1-performance-and-controls.md) | Foundation: smooth frame rate, big maps, game loop, saves, controls | Before any Sprint 1 task |
| 2 | [sprint-2-varanasi-and-the-ganga.md](sprint-2-varanasi-and-the-ganga.md) | The real Varanasi map, the Ganga river, ghats, Ganga Health, tourism | Before any Sprint 2 task |
| 3 | [sprint-3-indian-city-life.md](sprint-3-indian-city-life.md) | Indian look, mixed traffic, power cuts, water supply, informal settlements | Before any Sprint 3 task |
| 4 | [sprint-4-seasons-and-crises.md](sprint-4-seasons-and-crises.md) | Indian calendar, monsoon floods, heatwaves, disease, failure states | Before any Sprint 4 task |
| 5 | [sprint-5-festivals-landmarks-and-launch.md](sprint-5-festivals-landmarks-and-launch.md) | Festivals, landmarks, advisors, audio, mobile polish, launch | Before any Sprint 5 task |

Also: [perf-log.md](perf-log.md) records every performance measurement (started in Sprint 1).

**Sprints must be done in order.** Each sprint depends on the one before it. Within a sprint, do
tasks in the listed order unless a task says otherwise.

---

## 2. Rules for whoever implements a task (human or AI)

Follow all of these rules, every time.

1. **Read before you write.** Before changing code, open every file listed in the task's
   "Files to read" section. Do not guess what a function does. Read it.
2. **One task at a time.** Finish a task, verify it, and commit it before starting the next one.
   Do not mix two tasks in one commit.
3. **Stay inside the task.** Only do what the task describes. If you notice something else that
   should change, write it under "Notes for later" at the bottom of the sprint doc instead of doing it.
4. **Never rename existing IDs.** Do not rename existing `BuildingType`, `Tool`, `ZoneType`
   or `OverlayMode` values, or storage keys. Old save files use these strings, and renaming them
   breaks players' saves. To change what the player sees, change the **display name** (for example
   `TOOL_INFO[...].name`) and the **sprite**, not the ID.
5. **Add new building types at the END of `BUILDING_STATS`.**
   `src/games/isocity/gridBuffer.ts` builds its index list from `Object.keys(BUILDING_STATS)`,
   so the order matters.
6. **No magic numbers.** Every tunable number (costs, rates, thresholds, chances) goes into a named
   config object, following the pattern of `SCORING_CONFIG` in `src/lib/scoring.ts`. The task docs
   give **starting values**. They will be tuned during playtesting.
7. **Game logic must be pure.** Simulation and scoring functions take state in and return new
   state or numbers out. They must not touch React, the DOM, the canvas, or `window`. This keeps
   them testable and lets them run in a Web Worker.
8. **Use the existing patterns.** New UI strings use `msg('...')` (see `src/games/isocity/types/game.ts`).
   New UI uses the shadcn components in `src/components/ui/`. New imports use the `@/` alias.
9. **Verify every task** before committing:
   - `npm run build` must pass (it also type-checks).
   - `npm run lint`: the repo already has some lint errors. **Your change must not add new ones.**
     Count the errors before and after.
   - `npm test` must pass (unit tests are added in Sprint 1, task S1-T2).
   - Do the task's **"How to test"** steps in the running game (`npm run dev`).
10. **Commit message format:** `S<sprint>-T<task>: <short description>`,
    for example `S1-T4: cache service coverage by structure version`.
11. **When unsure, stop and ask.** If a task is unclear or contradicts the code you find, stop and
    ask the project owner. Do not invent scope.
12. **Update the docs.** When a task is done, tick its checkbox in the sprint doc. If you
    measured performance, add the numbers to [perf-log.md](perf-log.md).

---

## 3. Definition of Done (applies to every task)

A task is **done** only when all of these are true:

- [ ] Every acceptance criterion in the task is met.
- [ ] `npm run build` passes.
- [ ] `npm run lint` shows no new errors.
- [ ] `npm test` passes (from Sprint 1 onward).
- [ ] The "How to test" steps were done by hand and behaved as described.
- [ ] Old save files still load (open a save made before your change and check that it works).
- [ ] The game still runs on a phone-sized screen (Chrome DevTools → device toolbar → a 390×844 phone).
- [ ] The task checkbox in the sprint doc is ticked.

---

## 4. Glossary

| Term | Meaning in this project |
|------|--------------------------|
| **Tile** | One diamond-shaped square on the map. The map is a square grid of tiles (`gridSize × gridSize`). |
| **Tick** | One step of the simulation: the city grows, money is collected, and fires spread. Runs several times per second. |
| **Frame** | One redraw of the screen. The goal is 60 per second (about 16.7 ms each). |
| **Frame time** | How long one frame took to draw, in milliseconds. Lower is better. |
| **p95** | The 95th percentile. "p95 frame time = 20 ms" means 95% of frames took 20 ms or less. |
| **Stutter / hitch** | One frame that takes far longer than the others (for example over 50 ms). The player sees it as a freeze or jerk. |
| **Zone** | Land the player marks as Residential, Commercial or Industrial. Buildings grow on zones by themselves. |
| **Service building** | A building the player places that covers an area: police, fire, hospital, school, power, water. |
| **Overlay** | A coloured map layer that shows one thing, such as power coverage or pollution. |
| **Sprite / sprite sheet** | The picture of a building or vehicle. A sprite sheet is one image containing many sprites. |
| **Sprite pack** | A full set of sprite sheets (the game's "art style"). See `src/lib/renderConfig.ts`. |
| **Ghat** | Stone steps leading down to the Ganga. The heart of Varanasi's riverfront. |
| **Ganga Health** | A new 0–100 score for how clean the river is. Added in Sprint 2. |
| **Lakh / crore** | Indian number units: 1 lakh = 100,000 and 1 crore = 10,000,000. |
| **GPU renderer** | The PixiJS drawing path in `src/components/game/gpu/`. It is faster than the Canvas2D path. |
| **Web Worker** | Browser feature that runs code on a separate CPU thread so the screen does not freeze. |
| **Benchmark city** | A fixed, repeatable test city used to measure performance. Created in Sprint 1. |

---

## 5. Codebase map (where things live)

| Area | Main files |
|------|-----------|
| App entry and start screen | `src/app/page.tsx`, `src/components/Game.tsx` |
| Global game state and game loop | `src/context/GameContext.tsx` (look for `simulateTick` and `setInterval`) |
| Simulation (growth, money, services, fire) | `src/lib/simulation.ts` |
| Scores (safety, health, environment, happiness) | `src/lib/scoring.ts` |
| Types (tiles, buildings, tools, stats) | `src/games/isocity/types/*.ts` (`src/types/game.ts` re-exports them) |
| Map drawing and mouse/touch input | `src/components/game/CanvasIsometricGrid.tsx` |
| GPU renderer (PixiJS) | `src/components/game/gpu/` |
| Vehicles, pedestrians, boats, trains, planes | `src/components/game/*System.ts` |
| Weather, clouds, lighting | `src/components/game/effectsSystems.ts`, `cloudWeatherConfig.ts`, `sceneLighting.ts` |
| Overlays | `src/components/game/overlays.ts`, `OverlayModeToggle.tsx` |
| Side panels (budget, stats, advisors, settings) | `src/components/game/panels/` |
| Toolbar and build menu | `src/components/game/Sidebar.tsx`, `src/components/mobile/` |
| Saving and loading | `src/lib/isocityStorage.ts`, `src/lib/saveWorker.ts`, `src/lib/saveWorkerManager.ts` |
| Performance helpers | `src/lib/performanceUtils.ts` (spatial grid, LOD, frame budget) |
| Sprite configuration | `src/lib/renderConfig.ts` |
| Sprite art pipeline | `skills/varanasi-image-to-asset/SKILL.md`, `ai-design/` |
| Contextual tips | `src/hooks/useTipSystem.ts` |
