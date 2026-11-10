---
name: add-building
description: Use when adding or changing any placeable building, riverfront piece (ghat-like), service, utility or landmark end to end - type, stats, tool, placement rule, sim effect, upkeep, menu, art and tests.
---

# Add Building

A building touches about a dozen registries, several of which TypeScript will not flag when you miss them. Mirror an existing type of the same family, hit by hit, then add the new rule. Worked templates: `ghat` (riverfront, tourism), `sewage_treatment_plant` (river utility with radius), `embankment` (flood defence), `landmark_*` (unlock-gated, protected).

## Read first
- skills/varanasi-world-model (units, rules, geography)
- skills/save-compat-append-only-ids (why every list below is append-only)
- skills/ganga-river-economy if it touches the river or tourism
- `src/games/isocity/types/buildings.ts`, `src/lib/placement.ts`, `src/games/isocity/maps/varanasiCatalog.ts`

## Workflow
1. Grep the closest template and list every hit: `rg -n "sewage_treatment_plant" src`. Every file in that list needs a matching edit or a written reason why not.
2. Registry (append at the END, never rename):
   - `BuildingType` and `BUILDING_STATS` in `src/games/isocity/types/buildings.ts`. `src/games/isocity/gridBuffer.ts` builds `BUILDING_VALUES` from `Object.keys(BUILDING_STATS)`, so order is a format.
   - `BUILDING_TYPES` in `src/lib/shareState.ts` (share-URL indices).
   - `Tool` and `TOOL_INFO` in `src/games/isocity/types/game.ts` (name/description via `msg()`).
   - `toolBuildingMap` in `src/context/GameContext.tsx`.
3. Footprint: add to `BUILDING_SIZES` (private, `src/lib/simulation.ts`); read it only through `getBuildingSize`.
4. Placement rule (see "Placement" below).
5. Sim effect: per-building totals go in the single pass `scanGridTotals` (simulation.ts). Tunables go in a named config, never inline. If it is a new mechanic, stop and follow skills/add-sim-system.
6. Services: if it gives coverage, update `SERVICE_CONFIG` and `SERVICE_BUILDING_TYPES` (exported) and the private `SERVICE_TYPE_BY_CODE` / `serviceTypeCode()` together in simulation.ts.
7. Economy: add `BUILDING_UPKEEP` in `src/lib/upkeep.ts` (`economyBalance.test.ts` asserts upkeep for recreation, attractions, stations, bridges, ghats and landmarks). Tourism buildings follow `GHAT_UPKEEP_MONTHLY` in `src/lib/tourism.ts`.
8. Menu: `src/games/isocity/maps/varanasiCatalog.ts` - `VARANASI_ONLY_TOOLS`, `RIVERFRONT_TOOLS`, `LANDMARK_TOOLS`, `VARANASI_HIDDEN_TOOLS`, `VARANASI_DISPLAY`. `Sidebar.tsx`, `src/components/ui/CommandMenu.tsx` and `src/components/mobile/MobileToolbar.tsx` all read it through `isToolVisible(tool, mapId)`. Thumbnails come from `src/components/game/BuildingArtThumb.tsx` and `ToolGlyph.tsx`.
9. Optional maps (Partial/Record-with-default; tsc stays silent). Check each:
   - `BUILDING_ACTIVITIES` in `src/components/game/pedestrianSystem.ts`
   - `FIRE_FUEL` in `src/lib/fireConfig.ts`
   - `EXAMPLE_TYPE_MAP` / `EXAMPLE_DRY_WATERFRONT_MAP` in `src/lib/exampleCity.ts`
   - `NON_BUILDINGS` in `src/lib/problemIcons.ts`
   - `TOOL_TO_OVERLAY_MAP` and `NON_BUILDING_TYPES` in `src/components/game/overlays.ts`
10. Art: procedural first, see skills/procedural-sprite-authoring. Painted sheets: skills/varanasi-image-to-asset.
11. Player feedback (tile info, overlay, advisor line): skills/surface-to-player.
12. Tests, then skills/verification-gate.

## Placement (home of this knowledge)
- One source of truth: `placeBuilding`, `bulldozeTile` (simulation.ts) return the SAME state object when they refuse. `getPlacementCheck` in `src/lib/placement.ts` dry-runs them (plus `placeSubway`, `placeWaterTerraform`, `placeLandTerraform`) and, on refusal, picks a `PLACEMENT_REASONS` string (`msg()`). Add your rule inside `placeBuilding` (or a helper it calls), then add the matching reason in placement.ts. Never write a second validity check in UI code.
- Mirror the guards in `placeAtTile` (GameContext.tsx); placement.ts copies them.
- Rule helpers to reuse:
  - `getGhatPlacement`, `isWaterWorksPlacementValid`, `RIVERFRONT_CONFIG` (`src/lib/ganga.ts`)
  - `isEmbankmentSiteInRange` (`src/lib/floods.ts`)
  - `canPlaceLandmark`, `getLandmarkPlacementContext`, `LANDMARK_REASONS` (`src/lib/landmarks.ts`)
  - `getRiverZone(x, y, gridSize, mapId)`, `getDistanceToGanga` (`src/games/isocity/maps/riverZones.ts`); zones `'river' | 'westRiverfront' | 'westBank' | 'eastFloodplain' | 'eastBank' | 'none'`
  - `requiresWaterAdjacency` (simulation.ts)
- Cost: one grid copy per check (~2 ms at 160). Memoise on tile + tool + state; never call it per frame or per hover pixel.
- Visibility is separate from validity: hide with `isToolVisible`, refuse with placement.
- Make rules teach the river: a reason should name the cause ("must touch the west-bank riverfront"), per the design rule "show validity and the reason before placement".

## Landmarks
- `LANDMARKS` record in `src/lib/landmarks.ts`. Unlocks use PEAK displayed population (`getPeakDisplayedPopulation`, `getUnlockedLandmarks`, `state.peakPopulation`), not the current one. Bonuses via `getLandmarkBonuses(placed, gangaHealth)`.
- Protection is per system, add your type if it must be protected: `isBuildingFireEligible` (fireConfig.ts, uses `isLandmarkType`), `getFloodDamageChance` (floods.ts, 0 for `landmark_*`), `runCollapseDay` (crisisSim.ts skips landmarks).
- Payback target 24-48 months is asserted in `economyBalance.test.ts`.

## Gotchas
- Never rename an ID; change `TOOL_INFO[...].name` and the sprite instead.
- Sim population is display / 10 (`POPULATION_DISPLAY_SCALE`, `toDisplayPopulation` in `src/lib/format.ts`). Capacities in configs are sim people unless the name says display.
- Ghats on a flooded tile are closed: simulation.ts filters `openGhats` with the flood mask, so they earn no tourism during floods.
- `isVaranasiProceduralSprite` is true for every procedural sprite, not just Varanasi ones.
- Ghat payback target is 36-60 months (`economyBalance.test.ts`); tourism must stay 15-25% of income (`tourism.test.ts`). Retune config, never the assertion.

## Verify
- Tests to extend: `src/lib/__tests__/placement.test.ts` (allowed + refused + reason), `src/lib/__tests__/varanasiSim.test.ts` (effect), `src/games/isocity/maps/__tests__/varanasiCatalog.test.ts` (menu), `src/components/game/procedural/__tests__/varanasiSprites.test.ts` (art).
- Fixture: `createInitialGameState(60, 'Varanasi', createRng(11), 'varanasi')` (signature `(size, cityName, rng = Math.random, mapId)`; `createRng` from `src/lib/rng.ts`).
- By hand: place on a valid and an invalid tile; the reason shows before click; bulldoze; save, reload.
- Run skills/verification-gate.
