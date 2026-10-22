---
name: sim-golden-contract
description: Use when touching simulateTick or anything it calls - the tick's structure, determinism rules, the golden SHA-256 fingerprint test, the set*Enabled toggles, when re-recording goldens is allowed, and how balance tests encode design targets.
---

# Sim Golden Contract

`simulateTick` was optimised in S1-T5 under a golden-master test: seeded scenarios must reproduce, tick by tick, the fingerprints recorded from the original code (commit 243c14d). Every later system ships behind a toggle so the goldens can run with it off. This contract is how behaviour changes stay deliberate. Break a golden only on purpose, and say so in the commit.

## Read first
- `src/lib/__tests__/simulateTick.test.ts` (header comment and `GOLDEN` history comment)
- `simulateTick(state, forcedWeather?, rng = Math.random)` in `src/lib/simulation.ts`
- `src/lib/rng.ts` (`createRng(seed)`, `Rng`)

## Tick structure (simulation.ts)
- Service coverage is cached by structure; `setServiceCoverageCacheEnabled(false)` forces a full recompute (used by the equivalence test).
- Tile writes go through `CopyOnWriteGrid` (`writable`, `modifiable`, `touchRow`, `finish`): rows and tiles are cloned on first write, untouched rows keep identity. Inside the tick the local accessor `writableTile` wraps `cowGrid.writable`; helpers take a `WritableTileAccessor`.
- Per-tile loop has fast paths ("skip tiles that definitely won't change"); tiny pollution snaps to 0 so cleared tiles return to them. A new per-tile rule must keep those fast paths valid.
- City totals come from ONE pass, `scanGridTotals` (private). Add new totals there, not in a second grid walk.
- Daily and monthly gates and Varanasi gates: skills/calendar-and-crisis-gating.
- Result: changed fields spread into a new state object; the input state is never mutated (a test asserts this).

## Toggles (all `let xEnabled = true` + `export function setXEnabled(enabled: boolean)`)
`simulation.ts`: `setServiceCoverageCacheEnabled`, `setSeasonalEffectsEnabled`, `setUtilityCapacityEnabled`, `setLandmarkUnlocksEnabled`, `setCrisesEnabled` (heatwave, disease, collapse), `setFestivalsEnabled`, `setFloodsEnabled`, `setFailureStatesEnabled`, `setInformalSettlementsEnabled`. `src/lib/mixedUse.ts`: `setMixedUseEnabled`.
The golden test's `beforeEach` turns every system toggle off and `afterEach` turns all back on (and resets the cache toggle). A new system's toggle must be added to both, or it leaks into the goldens or into the next test file.

## Determinism
- `simulateTick` still calls `Math.random` internally in older code paths; tests replace it with `vi.spyOn(Math, 'random').mockImplementation(createRng(seed))` and restore it in `finally`.
- New code takes an `Rng` argument (thread the tick's `rng`), never calls `Math.random` directly.
- Wall-clock values (`Date.now()` notification timestamps) are excluded from fingerprints; never let them affect sim results.
- Tests run in Node only (`vitest.config.ts`: `environment: 'node'`, `include: ['src/**/*.test.ts']`). No DOM in sim code or its tests.

## Golden fingerprints
- `fingerprint(state)` = SHA-256 (`node:crypto` `createHash`) of `canonical(state)`, first 16 hex chars, one per tick, joined by `,`.
- `canonical` sorts keys, drops `undefined`, ids, notification timestamps, cosmetic names, and fields in `FIELDS_ADDED_AFTER_GOLDENS` (`mapId`, `taxIncome`, `informal`) and `STATS_FIELDS_ADDED_AFTER_GOLDENS` (`power`, `water`).
- Scenarios are random maps from `generateRandomAdvancedCity(size, 'Test', createRng(seed))` (60 and a 160 benchmark), so Varanasi-only systems rarely touch them, but their toggles are still off.
- A new always-on state field changes every fingerprint. Either keep it `undefined` when its system is off, or add it to `FIELDS_ADDED_AFTER_GOLDENS` with a comment.

## Re-recording (only for an intended behaviour change)
1. Confirm the change is intended and cannot sit behind a toggle.
2. `PRINT_SIM_FINGERPRINTS=1 npx vitest run src/lib/__tests__/simulateTick.test.ts` and paste the printed `GOLDEN` lines.
3. Add one line to the history comment above `GOLDEN` saying what changed and why.
4. Say "re-recorded goldens: <reason>" in the commit message. Never re-record to make an unexplained diff pass.

## New-system checklist
- [ ] Toggle exported beside the others and imported in `simulateTick.test.ts`.
- [ ] Off in `beforeEach`, on in `afterEach`.
- [ ] Goldens pass unchanged with it off.
- [ ] New `GameState` field stays `undefined` while the system is off (or is listed in `FIELDS_ADDED_AFTER_GOLDENS`).
- [ ] Randomness comes from the tick's `rng`.

## Balance tests
- Design targets are tests: `economyBalance.test.ts` (paybacks, upkeep coverage), `tourism.test.ts` (tourism share). Retune config, not assertions; changing a target needs the owner.

## Gotchas
- Cache on/off equivalence must hold: if you add a cache, add it to the equivalence test or a sibling.
- A mutation of `state.grid` passes most tests but corrupts undo and the static-layer caches; the non-mutation test catches it.
- `vi.spyOn` without `mockRestore` leaks seeded randomness into later tests.
- Vitest under load can time out a worker; use `--testTimeout 120000 --maxWorkers 2` (skills/verification-gate).

## Verify
- `npx vitest run src/lib/__tests__/simulateTick.test.ts` green with your toggle off.
- Your system's own test with the toggle on.
- `BENCH=1 npx vitest run src/lib/__tests__/simBench.test.ts` tick cost not worse (skills/perf-budget).
