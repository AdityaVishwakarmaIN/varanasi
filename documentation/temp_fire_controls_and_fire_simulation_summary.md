# Fire Controls And Fire Simulation Summary

**Controls**
- `Disasters` toggle in Settings controls whether random fires and spread are active; it writes `state.disastersEnabled` through `setDisastersEnabled` in [SettingsPanel.tsx](C:/Users/aditya/Desktop/Playground/varanasi/src/components/game/panels/SettingsPanel.tsx#L131) and [GameContext.tsx](C:/Users/aditya/Desktop/Playground/varanasi/src/context/GameContext.tsx#L1098).
- The `fire_station` build tool is the player’s main fire-related placement control; it is mapped in [GameContext.tsx](C:/Users/aditya/Desktop/Playground/varanasi/src/context/GameContext.tsx#L116) and is categorized under services in [MobileToolbar.tsx](C:/Users/aditya/Desktop/Playground/varanasi/src/components/mobile/MobileToolbar.tsx#L234).
- Fire coverage overlay is exposed as `overlayMode = 'fire'`; it is selectable in [OverlayModeToggle.tsx](C:/Users/aditya/Desktop/Playground/varanasi/src/components/game/OverlayModeToggle.tsx#L61) and [MobileToolbar.tsx](C:/Users/aditya/Desktop/Playground/varanasi/src/components/mobile/MobileToolbar.tsx#L242).
- The fire overlay highlights buildings without fire coverage in [overlays.ts](C:/Users/aditya/Desktop/Playground/varanasi/src/components/game/overlays.ts#L161).

**State / Variables**
- `Building.onFire` and `Building.fireProgress` are the core per-building fire flags in [src/games/isocity/types/buildings.ts](C:/Users/aditya/Desktop/Playground/varanasi/src/games/isocity/types/buildings.ts).
- `GameState.disastersEnabled` defaults to `true` in new games in [simulation.ts](C:/Users/aditya/Desktop/Playground/varanasi/src/lib/simulation.ts#L1259) and [simulation.ts](C:/Users/aditya/Desktop/Playground/varanasi/src/lib/simulation.ts#L3657).
- `ServiceCoverage.fire` stores per-tile fire service coverage in [src/games/isocity/types/services.ts](C:/Users/aditya/Desktop/Playground/varanasi/src/games/isocity/types/services.ts).
- `activeFiresRef` tracks fires that already have a fire truck dispatched in [CanvasIsometricGrid.tsx](C:/Users/aditya/Desktop/Playground/varanasi/src/components/game/CanvasIsometricGrid.tsx#L176).
- `hoveredIncident` in [CanvasIsometricGrid.tsx](C:/Users/aditya/Desktop/Playground/varanasi/src/components/game/CanvasIsometricGrid.tsx#L158) is used to show fire tooltips.
- `FireType`, `FIRE_DATA`, and `FIRE_TYPES` in [incidentData.ts](C:/Users/aditya/Desktop/Playground/varanasi/src/components/game/incidentData.ts#L539) are descriptive metadata for fire labels/descriptions, not the actual building-fire simulation.
- `arson_attempt` in [incidentData.ts](C:/Users/aditya/Desktop/Playground/varanasi/src/components/game/incidentData.ts#L436) is a crime incident type, separate from building fires.

**Fire Logic**
- New buildings start with `onFire: false` and `fireProgress: 0` in [simulation.ts](C:/Users/aditya/Desktop/Playground/varanasi/src/lib/simulation.ts#L769) and [simulation.ts](C:/Users/aditya/Desktop/Playground/varanasi/src/lib/simulation.ts#L3311).
- The fire simulation runs in `simulateTick` in [simulation.ts](C:/Users/aditya/Desktop/Playground/varanasi/src/lib/simulation.ts#L2374).
- If a tile is on fire, the engine computes `fightingChance = services.fire[y][x] / 300`; a successful roll extinguishes it, otherwise `fireProgress` increases by `2/3` per tick until the building becomes `grass` at `100%` damage in [simulation.ts](C:/Users/aditya/Desktop/Playground/varanasi/src/lib/simulation.ts#L2375).
- Fire spread checks 4 adjacent tiles; the base chance is `0.005 * adjacentFireCount`, then reduced by fire coverage up to 95% in [simulation.ts](C:/Users/aditya/Desktop/Playground/varanasi/src/lib/simulation.ts#L2391).
- Random fire ignition is `Math.random() < 0.00003` on eligible non-natural tiles when disasters are enabled in [simulation.ts](C:/Users/aditya/Desktop/Playground/varanasi/src/lib/simulation.ts#L2428).
- Burning buildings are excluded from building consolidation / merge logic in [simulation.ts](C:/Users/aditya/Desktop/Playground/varanasi/src/lib/simulation.ts#L2694).
- The fast-path for completed service buildings also skips burning buildings in [simulation.ts](C:/Users/aditya/Desktop/Playground/varanasi/src/lib/simulation.ts#L2280).

**Fire Response**
- `findFires()` scans the grid and returns all `onFire` tiles in [gridFinders.ts](C:/Users/aditya/Desktop/Playground/varanasi/src/components/game/gridFinders.ts#L271).
- `vehicleSystems.ts` calls `findFires()` and dispatches `fire_truck` vehicles from the nearest fire station in [vehicleSystems.ts](C:/Users/aditya/Desktop/Playground/varanasi/src/components/game/vehicleSystems.ts#L495).
- `activeFiresRef` prevents duplicate dispatch to the same fire in [vehicleSystems.ts](C:/Users/aditya/Desktop/Playground/varanasi/src/components/game/vehicleSystems.ts#L658).
- Fire truck response time is modeled with `respondDuration = 8` seconds in [vehicleSystems.ts](C:/Users/aditya/Desktop/Playground/varanasi/src/components/game/vehicleSystems.ts#L742).
- Fire trucks are visually distinct with red bodies and flashing lights in [vehicleSystems.ts](C:/Users/aditya/Desktop/Playground/varanasi/src/components/game/vehicleSystems.ts#L1688).

**Rendering / UI**
- Burning tiles get a flame effect drawn directly on the canvas in [CanvasIsometricGrid.tsx](C:/Users/aditya/Desktop/Playground/varanasi/src/components/game/CanvasIsometricGrid.tsx#L1664).
- Hovering a fire tile shows the fire incident tooltip and uses `getFireNameForTile()` / `getFireDescriptionForTile()` in [CanvasIsometricGrid.tsx](C:/Users/aditya/Desktop/Playground/varanasi/src/components/game/CanvasIsometricGrid.tsx#L2719).
- `drawIncidentIndicators()` renders the pulsing fire/crime marker layer in [vehicleSystems.ts](C:/Users/aditya/Desktop/Playground/varanasi/src/components/game/vehicleSystems.ts#L1749).
- `TileInfoPanel` shows `ON FIRE!` and `fireProgress` damage percentage in [TileInfoPanel.tsx](C:/Users/aditya/Desktop/Playground/varanasi/src/components/game/panels/TileInfoPanel.tsx#L164).
- The fire coverage overlay uses `services.fire` to tint uncovered buildings in [overlays.ts](C:/Users/aditya/Desktop/Playground/varanasi/src/components/game/overlays.ts#L145).

**Initialization / Persistence**
- Random city generation includes `fire_station` placements in [simulation.ts](C:/Users/aditya/Desktop/Playground/varanasi/src/lib/simulation.ts#L3412).
- URL-share compression does not preserve active fire state; `expandTile()` resets `onFire` and `fireProgress` to `false` / `0` in [shareState.ts](C:/Users/aditya/Desktop/Playground/varanasi/src/lib/shareState.ts#L69).
