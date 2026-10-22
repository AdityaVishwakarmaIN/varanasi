---
name: add-sim-system
description: Use when adding or changing a simulated mechanic (crisis, calendar event, utility, economy rule, Ganga-coupled effect, festival event) that runs in simulateTick and persists in saves.
---

# Add Sim System

Every Sprint 4/5 mechanic follows one shape: a pure rules module, a thin day-runner, an optional `GameState` field, an on/off toggle, and one call site inside `simulateTick`. Copy that shape. Templates: `src/lib/floods.ts` + `floodSim.ts`, `heatwave.ts`, `disease.ts`, `collapse.ts` + `crisisSim.ts`, `festivals.ts` + `festivalSim.ts`, `informal.ts` + `informalSim.ts`, `failure.ts`.

## Read first
- skills/varanasi-world-model (rules: pure logic, no magic numbers)
- skills/sim-golden-contract (determinism, toggles, goldens)
- skills/calendar-and-crisis-gating (when and where it may run)
- skills/save-compat-append-only-ids (new state fields)
- skills/ganga-river-economy if the river feeds or is fed by it
- `simulateTick` in `src/lib/simulation.ts`

## Workflow
1. Rules module `src/lib/<x>.ts`:
   - `export const <X>_CONFIG = { ... }` with a comment per number giving its rationale (pattern: `FLOOD_CONFIG`, `HEATWAVE_CONFIG`, `DISEASE_CONFIG`, `COLLAPSE_CONFIG`, `FAILURE_CONFIG`).
   - Pure functions only. No React, DOM, `window`, canvas, `Math.random`, `Date.now`. Randomness comes in as an `Rng` (`src/lib/rng.ts`).
2. Day runner `src/lib/<x>Sim.ts`: `run<X>Day(...)` takes what it needs (grid, size, today, rng) and returns new values plus notifications. Examples: `runFloodDay`, `runHeatwaveDay`, `runDiseaseDay`, `runCollapseDay`, `runFestivalDay(city, today, month, day)`, `runInformalDay(input)`; monthly: `advanceFailureState`.
3. State: add an OPTIONAL field to `GameState` (`src/games/isocity/types/game.ts`) with a "Missing means ..." comment, like `heatwave`, `outbreaks`, `festival`, `informal`, `failure`. Old saves lack it; the code must treat missing as fresh. See skills/save-compat-append-only-ids.
4. Toggle in simulation.ts beside the others:
   ```ts
   let xEnabled = true;
   export function setXEnabled(enabled: boolean): void { xEnabled = enabled; }
   ```
   Then switch it off in the golden test's `beforeEach` and back on in `afterEach` (skills/sim-golden-contract).
5. Hook into `simulateTick`:
   - Daily work goes under the `newTick === 0` gate; monthly under `newMonth !== state.month`.
   - Apply the map and disaster gates from skills/calendar-and-crisis-gating.
   - Tile writes go through the tick's `CopyOnWriteGrid` (`cowGrid.writable(x, y)`, exposed locally as `writableTile`). Never mutate `state.grid` or a tile you did not get from `writable`.
   - Helpers that edit tiles take a `WritableTileAccessor` parameter (see `evolveBuilding` and `applyBuildingFootprint` in simulation.ts) instead of the raw grid.
   - Return changed fields only, spread into the new state. Unchanged fields keep their identity.
6. River coupling: read river inputs through `gatherGangaInputs`; feed back through `calculateGangaTargetHealth` inputs, not a new score. See skills/ganga-river-economy.
7. Per-tile work: compute a typed-array mask cached on `structureVersion` (`getCityFloodMask` in floodSim.ts, `getShadeMask(grid, size, structureVersion)` and `getOutbreakMask` in crisisSim.ts). Budget rules: skills/perf-budget.
8. Forecasts and warnings: `addForecast` / `pruneForecasts` with a stable id (skills/calendar-and-crisis-gating).
9. Make it visible and actionable: skills/surface-to-player.
10. Write-up: add `documentation/<x>-summary.md` like the other feature summaries.

## Files a typical system touches
| Concern | Where |
|---|---|
| Rules + config | `src/lib/<x>.ts` |
| Day runner, masks | `src/lib/<x>Sim.ts` |
| State field | `GameState` in `src/games/isocity/types/game.ts` |
| Toggle + call site | `src/lib/simulation.ts` (`set<X>Enabled`, `simulateTick`) |
| Golden registration | `src/lib/__tests__/simulateTick.test.ts` |
| Load defaults (only if a non-optional default is needed) | `loadGameState` in `src/context/GameContext.tsx` |
| Notifications / advisor / overlay | skills/surface-to-player |
| Map drawing | skills/render-feature |

## Gotchas
- `disastersEnabled` switches off crises and floods but NOT failure states (bankruptcy, loans) - keep that split.
- A system that reads `state.mapId` must handle missing `mapId` (means `'random'`).
- Do not add work to every tick when once a day is enough; the 30 ticks per day multiply cost.
- Do not call `Math.random` "just for flavour" in sim code; it breaks seeded tests and goldens.
- Store deadlines and "until" days as absolute days, not month/day pairs (skills/calendar-and-crisis-gating).
- A system that sets `severity: 'crisis'` auto-pauses the game; use it only for real emergencies (skills/surface-to-player).
- Balance numbers live in config; tests encode targets. If a target test fails, retune config.

## Verify
- Unit test the pure module (`src/lib/__tests__/<x>.test.ts`): thresholds, edge days, rng seeds.
- Old-save test: tick a state with the new field absent; no throw, sensible default.
- Golden unchanged with the toggle off: `npx vitest run src/lib/__tests__/simulateTick.test.ts`.
- Sim cost: `BENCH=1 npx vitest run src/lib/__tests__/simBench.test.ts` before and after (skills/perf-budget).
- Run skills/verification-gate.
