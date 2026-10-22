---
name: save-compat-append-only-ids
description: Use when adding or changing any id, enum value, ordered list, storage key or GameState field that ends up in a save, share URL or browser storage - append-only rules, the load and normalise path, version counters, the save pipeline, undo, and the manual old-save check.
---

# Save Compat And Append-Only IDs

Players' saves outlive the code. Ids are stored as strings, some lists are stored by index, and old saves lack every field added since. The rules: never rename or reorder, only append; every new field is optional with a documented "missing means"; every load path normalises the same way. Breaking this silently corrupts cities.

## Read first
- `documentation/game-plan/README.md` rules 4 and 5
- `loadGameState` and `normalizeGameStateVersions` in `src/context/GameContext.tsx`
- `GameState` in `src/games/isocity/types/game.ts`

## Formats (append only, never rename or reorder)
| What | Where | Why it is a format |
|---|---|---|
| `BuildingType` values, `BUILDING_STATS` key order | `src/games/isocity/types/buildings.ts` | ids in saves; `gridBuffer.ts` indexes by `Object.keys(BUILDING_STATS)` |
| `BUILDING_TYPES` array | `src/lib/shareState.ts` | share-URL indices |
| `Tool` values | `src/games/isocity/types/game.ts` | `selectedTool` saved |
| `ZoneType` | `src/games/isocity/types/zones.ts` | tile zones saved |
| `OverlayMode` | `src/components/game/types.ts` | saved and used in notification deep links |
| `MapId` | `src/games/isocity/maps/varanasi.ts` | `state.mapId` |
| Festival, landmark, advisor, forecast ids | their modules | saved in state |
| Storage keys | see below | existing browsers |

To change what the player sees, change the display name (`TOOL_INFO[...].name`) or sprite, never the id.

## Storage keys (do not rename)
- Saves and prefs (`src/lib/isocityStorage.ts`): `isocity-game-state`, `isocity-saved-city`, `isocity-game-state-last-month`, `isocity-saved-cities-index`, prefix `isocity-city-`, `isocity-sprite-pack`, `isocity-day-night-mode`, `isocity-ui-preferences`.
- Feedback: `isocity-problem-icons`, `isocity-tips-shown` (`src/lib/feedbackPrefs.ts`), `isocity-tips-disabled` (`useTipSystem.ts`), prefix `isocity-citizen-feed-` (`CitizenFeed.tsx`).
- Newer: `varanasi-graphics-quality`, `varanasi-graphics-renderer` (`GRAPHICS_STORAGE_KEYS`, `graphicsSettings.ts`), `varanasi-audio-settings` (`audioConfig.ts`).
- New keys: pick a prefix and keep it; most existing keys are `isocity-*` (inherited) and stay that way.

## New GameState fields
1. Make it optional with a comment: `/** ... Missing means <default>. */` (see `mapId` - missing means `'random'`; `pauseOnCrisis` - missing means on; `informal`, `failure`, `forecasts`, `heatwave`, `outbreaks`, `festival`, `peakPopulation`, `landmarksBuilt`, `landmarksSeen`).
2. Read it with a default at the use site (`state.x ?? fresh()`), so no migration is needed.
3. Only when a required field must exist, add a default in `loadGameState` beside the existing ones (`adjacentCities`, `waterBodies`, `cities`, `hour`, `effectiveTaxRate`, `constructionProgress`, `abandoned`, ids).
4. Renamed content needs an explicit migration, like `park_medium` -> `park_large` in `loadGameState` (grid and `selectedTool`).

## Load paths
- Autosave: `loadGameState` -> migrations -> `normalizeGameStateVersions` (defaults `gameVersion`, `structureVersion`, `roadNetworkVersion` to 0) -> `withCalmSpeed` (never resume faster than Normal) -> `withSelectTool`.
- Saved cities, imports and share links each call `normalizeGameStateVersions` too (several call sites in GameContext.tsx). A new normalisation must go into all of them; grep `normalizeGameStateVersions(`.
- Example: `localizeExampleState` (`src/lib/exampleCity.ts`) on the JSON in `public/example-states/`.

## Version counters
- `structureVersion`: bumped in simulation.ts when buildings or footprints change; keys structure caches (service coverage, crisis masks, ghat boat network, static layers).
- `roadNetworkVersion`: bumped in simulation.ts when roads change; read by the road and vehicle renderers (`roadDrawing.ts`, `vehicleSystems.ts`).
- `gameVersion`: bumped by GameContext when a city is loaded or replaced; clears vehicles and entities and per-city caches.
Bump through the existing code paths; a missed bump means stale caches, an extra bump means wasted rebuilds.

## Save pipeline
- IndexedDB (S1-T9): `src/lib/storage/idbStore.ts` (`getSavesStore`), `saveStore.ts` (`migrateLegacySaves` from localStorage, `safeWrite`, `createSerialQueue`), `saveConfig.ts` (`AUTOSAVE_CONFIG`), `slicedStringify.ts` (`stringifyInSlices`, keeps the main thread under budget).
- Compression in a worker: `src/lib/saveWorker.ts`, `saveWorkerManager.ts` (`serializeAndCompressAsync`, `decompressAndParseAsync`).
- Corrupted data is kept, never deleted; the next autosave replaces it.
- Undo (`src/lib/undo.ts`): `UndoEntry` holds changed tiles only, `UNDO_LIMIT` 10, `createUndoEntry`, `pushUndoEntry`, `applyUndo`. Not saved; a new per-tile field that placement changes must round-trip through it.

## Gotchas
- Never edit `public/example-states/*.json`; they double as old-save fixtures.
- Removing a type from a menu is fine (`VARANASI_HIDDEN_TOOLS`); deleting it from `BuildingType` breaks saves.
- Optional maps keyed by `BuildingType` default silently; tsc does not catch a missing entry (skills/add-building lists them).
- Saves are lz-string compressed JSON; a new `Map`/`Set`/typed array in state does not survive JSON. Store plain arrays or recompute caches on load.

## Verify
- Unit: tick or load a state with the new field deleted; no throw, default applied.
- Manual old-save check (Definition of Done): before your change, play a city and let it autosave (or save a named city); apply the change; reload; the city loads, ticks, and saves again.
- Load Example still works; a share link made before the change still opens.
- Run skills/verification-gate.
