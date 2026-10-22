---
name: add-map-or-scenario
description: Use when adding a new start option (real-geography map, pre-built old-city scenario), changing river geometry or map sizes, or touching the new-game flow.
---

# Add Map Or Scenario

A map is a `MapId`, a size table entry, a terrain generator described as data, and a set of `mapId` gates scattered through sim, UI and render code. A scenario is a pure transform applied to a state at load time. Scope check first: `documentation/game-plan/00-game-design.md` section 6.2 lists the pre-built "old city" start and scripted scenario missions as CUT from v1, even though vision.md asks for them. Get the owner's sign-off before building a scenario; write it under "Notes for later" otherwise.

## Read first
- skills/varanasi-world-model (geography, zones)
- skills/save-compat-append-only-ids (`MapId` is saved; missing means `'random'`)
- skills/ganga-river-economy (starting Ganga Health must match the rules)
- `src/games/isocity/maps/varanasi.ts`, `src/lib/mapConfig.ts`, `src/lib/newGame.ts`, `documentation/new-game-reset-flow-summary.md`

## Workflow: new map or geometry change
1. `MapId` union in `src/games/isocity/maps/varanasi.ts` (`'random' | 'varanasi'`) - append only.
2. Data, not tiles: geometry is fractions `u` (west->east) and `v` (north->south) in `VARANASI_MAP` (Ganga centreline south to north, `widthFraction`, tributaries Assi and Varuna, `eastFloodplainFraction`, `treeDensity`) with generator tunables in `VARANASI_GEN_CONFIG`. A new map gets its own data object in the same style so it works at every size.
3. Sizes and names in `src/lib/mapConfig.ts`: `MAP_SIZES` (varanasi `{ desktop: 160, mobile: 120 }`, random `{ desktop: 70, mobile: 50 }`), `getMapSize`, `DEFAULT_CITY_NAMES`, `getInitialFocusTile` (camera start).
4. Generation: `generateVaranasiTerrain` (`generateVaranasi.ts`) builds tiles from `getVaranasiLayout(size)` (`varanasiLayout.ts`, cached per size; `LAYOUT_WATER`, `LAYOUT_SIDE`). The private `generateTerrain(size, rng, mapId)` in `src/lib/simulation.ts` dispatches on `mapId`; `createInitialGameState(size, cityName, rng, mapId)` calls it. Add a branch there for a new map; the random generator (`generateLakes` / `generateOceans` patterns) stays the default.
5. Zones: `getRiverZoneArrays(gridSize)` (`riverZones.ts`) recomputes zones from the layout, cached per size, never saved. A geometry change therefore changes zones of OLD saves too - check placed ghats still sit on `westRiverfront`.
6. New-game flow: `DEFAULT_MAP_ID` (`'varanasi'`), `resolveNewGame`, `createNewGameState` (`src/lib/newGame.ts`); cards in `src/components/MapChoiceCards.tsx`. Keep the random map option.
7. Gating audit: every Varanasi-only system checks the map. List them all and decide per hit:
   `rg -n "mapId === 'varanasi'|mapId !== 'varanasi'" src --glob '!**/__tests__/**'`
   Menus use `isToolVisible(tool, mapId)` (`varanasiCatalog.ts`); overlays use `getOverlayModesForMap(mapId)`.
8. Benchmark at the new size (skills/perf-budget); 160 is the current ceiling the targets were set for.

## New-map checklist
- [ ] `MapId` appended; `MAP_SIZES`, `DEFAULT_CITY_NAMES`, `getInitialFocusTile` entries.
- [ ] Geometry as a fraction-based data object plus a `*_GEN_CONFIG`; generator branch in `generateTerrain`.
- [ ] Layout and zone caches keyed by map as well as size.
- [ ] Every `mapId === 'varanasi'` gate reviewed: does the system apply to the new map?
- [ ] Catalog (`isToolVisible`) and overlay (`getOverlayModesForMap`) rules decided.
- [ ] `MapChoiceCards.tsx` card with `msg()` copy and a thumbnail that matches the house style.
- [ ] mapgen test: river connected, banks present, deterministic for a seed.
- [ ] perf-log row at the new size.

## Workflow: scenario (after sign-off)
1. Write a pure load-time transform like `localizeExampleState` / `varanasiExampleState` in `src/lib/exampleCity.ts`: input state in, new state out, type remaps through tables like `EXAMPLE_TYPE_MAP` and `EXAMPLE_DRY_WATERFRONT_MAP`.
2. Never edit `public/example-states/*.json`; they are fixtures for tests and the "Load Example" button (`handleLoadExample` in `src/app/page.tsx`).
3. Starting stats must agree with the rules: set Ganga Health from `calculateGangaTargetHealth` on the start grid (or a named constant like `EXAMPLE_START_GANGA_HEALTH`), not a hand-picked number.
4. Starting population, money and landmarks obey normal unlocks (`peakPopulation`, `getUnlockedLandmarks`).
5. Add it as a start option beside the maps, with `msg()` copy.

## Gotchas
- Missing `mapId` in a save means `'random'`; a new map must never become the fallback.
- Zones and layouts are caches keyed by size only. A second real map needs the map in the key.
- River-specific helpers take `mapId` and return a neutral value off Varanasi (`getRiverZone` -> `'none'`, `getDistanceToGanga` -> `Infinity`); keep that contract.
- Map size is grid size squared: 160 is about 5x the tiles of 70, so every per-tile pass gets 5x slower.
- `createInitialGameState` defaults `rng` to `Math.random`; pass `createRng(seed)` in tests so generation is deterministic.
- The example fixtures are pre-Varanasi data; they become Varanasi cities only through `localizeExampleState` at load. A transform change alters what "Load Example" shows, so recheck it.
- A new start option appears in two places that both render `MapChoiceCards`: the start screen (`src/app/page.tsx`) and `panels/SettingsPanel.tsx`; follow skills/ui-pattern-adherence.
- Mobile uses the smaller size; test both sizes because layouts are size-dependent fractions.

## Verify
- Tests: `src/games/isocity/maps/__tests__/varanasi.test.ts`, `varanasiCatalog.test.ts`, `src/lib/__tests__/mapgen.test.ts`, `newGame.test.ts`, `exampleCity.test.ts`.
- By hand: new game for each map on desktop and at 390x844; crescent reads correctly; ghat allowed on the west riverfront and refused on the east bank; random map unchanged.
- Old save still loads and its ghats are still valid.
- Benchmark the largest size: `?bench=160&flythrough=1` (skills/perf-budget).
- Run skills/verification-gate.
