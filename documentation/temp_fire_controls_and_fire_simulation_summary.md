# Fire Controls And Fire Simulation Summary

**Controls**
- `Disasters` toggle in Settings controls whether random fires and spread are active; it writes `state.disastersEnabled` through `setDisastersEnabled` in [SettingsPanel.tsx](C:/Users/aditya/Desktop/Playground/varanasi/src/components/game/panels/SettingsPanel.tsx#L131) and [GameContext.tsx](C:/Users/aditya/Desktop/Playground/varanasi/src/context/GameContext.tsx#L1098).
- The `fire_station` build tool is the player's main fire-related placement control; it is mapped in [GameContext.tsx](C:/Users/aditya/Desktop/Playground/varanasi/src/context/GameContext.tsx#L116) and is categorized under services in [MobileToolbar.tsx](C:/Users/aditya/Desktop/Playground/varanasi/src/components/mobile/MobileToolbar.tsx#L234).
- Fire coverage overlay is exposed as `overlayMode = 'fire'`; it is selectable in [OverlayModeToggle.tsx](C:/Users/aditya/Desktop/Playground/varanasi/src/components/game/OverlayModeToggle.tsx#L61) and [MobileToolbar.tsx](C:/Users/aditya/Desktop/Playground/varanasi/src/components/mobile/MobileToolbar.tsx#L242).
- The fire overlay highlights buildings without fire coverage in [overlays.ts](C:/Users/aditya/Desktop/Playground/varanasi/src/components/game/overlays.ts#L161).

**Centralized Fire Data**
- `src/lib/fireConfig.ts` now owns the shared fire constants and helper functions for the simulation, response system, and default fire state.
- `DEFAULT_FIRE_STATE`, `FIRE_SIMULATION_CONFIG`, `FIRE_RESPONSE_CONFIG`, and `FIRE_WEATHER_MULTIPLIERS` are the main centralized controls.
- `FIRE_WEATHER_MULTIPLIERS` currently uses `clear = 1x`, `light_clouds = 3x`, `storm = 10x`, and `severe_storm = 50x`.
- `createDefaultFireState()`, `igniteBuilding()`, and `resetBuildingFireState()` are used wherever a building needs fire flags initialized or reset.

**State / Variables**
- `Building.onFire` and `Building.fireProgress` are the core per-building fire flags in [src/games/isocity/types/buildings.ts](C:/Users/aditya/Desktop/Playground/varanasi/src/games/isocity/types/buildings.ts).
- `GameState.disastersEnabled` defaults to `true` in new games in [simulation.ts](C:/Users/aditya/Desktop/Playground/varanasi/src/lib/simulation.ts#L1259) and [simulation.ts](C:/Users/aditya/Desktop/Playground/varanasi/src/lib/simulation.ts#L3657).
- `ServiceCoverage.fire` stores per-tile fire service coverage in [src/games/isocity/types/services.ts](C:/Users/aditya/Desktop/Playground/varanasi/src/games/isocity/types/services.ts).
- `activeFiresRef` tracks fires that already have a fire truck dispatched in [CanvasIsometricGrid.tsx](C:/Users/aditya/Desktop/Playground/varanasi/src/components/game/CanvasIsometricGrid.tsx#L176).
- `hoveredIncident` in [CanvasIsometricGrid.tsx](C:/Users/aditya/Desktop/Playground/varanasi/src/components/game/CanvasIsometricGrid.tsx#L158) is used to show fire tooltips.
- `FireType`, `FIRE_DATA`, and `FIRE_TYPES` in [incidentData.ts](C:/Users/aditya/Desktop/Playground/varanasi/src/components/game/incidentData.ts#L539) are descriptive metadata for fire labels/descriptions, not the actual building-fire simulation.
- `arson_attempt` in [incidentData.ts](C:/Users/aditya/Desktop/Playground/varanasi/src/components/game/incidentData.ts#L436) is a crime incident type, separate from building fires.

**Fire Logic**
- New buildings start with fire state via `createDefaultFireState()` in the centralized fire module, not hardcoded per builder.
- The fire simulation runs in `simulateTick` in [simulation.ts](C:/Users/aditya/Desktop/Playground/varanasi/src/lib/simulation.ts#L2231).
- If a tile is on fire, `fireProgress` increases by `1` per tick (via `FIRE_SIMULATION_CONFIG.fireProgressPerTick`). When `fireProgress >= 100` (destruction threshold), the building becomes `grass`. **Only a fire truck arriving on-scene can reset `onFire`/`fireProgress`** — passive coverage-based suppression was removed in [simulation.ts](C:/Users/aditya/Desktop/Playground/varanasi/src/lib/simulation.ts#L2386).
- Fire spread checks 4 adjacent tiles; the base chance is `0.005 * adjacentFireCount`, then reduced by fire coverage up to 95% and multiplied by the active weather multiplier in [simulation.ts](C:/Users/aditya/Desktop/Playground/varanasi/src/lib/simulation.ts#L2403).
- Random fire ignition is `Math.random() < 0.00003` on eligible non-natural tiles, also multiplied by the active weather multiplier, when disasters are enabled in [simulation.ts](C:/Users/aditya/Desktop/Playground/varanasi/src/lib/simulation.ts#L2423).
- Burning buildings are excluded from building consolidation / merge logic in [simulation.ts](C:/Users/aditya/Desktop/Playground/varanasi/src/lib/simulation.ts#L2694).
- The fast-path for completed service buildings also skips burning buildings in [simulation.ts](C:/Users/aditya/Desktop/Playground/varanasi/src/lib/simulation.ts#L2280).

**Fire Response**
- `findFires()` scans the grid and returns all `onFire` tiles in [gridFinders.ts](C:/Users/aditya/Desktop/Playground/varanasi/src/components/game/gridFinders.ts#L271).
- `vehicleSystems.ts` calls `findFires()` and dispatches `fire_truck` vehicles from the nearest fire station in [vehicleSystems.ts](C:/Users/aditya/Desktop/Playground/varanasi/src/components/game/vehicleSystems.ts#L495).
- `findNearestFireStation()` and `getFireIncidentKey()` now centralize the nearest-station search and incident key generation in [fireConfig.ts](C:/Users/aditya/Desktop/Playground/varanasi/src/lib/fireConfig.ts#L137).
- `activeFiresRef` prevents duplicate dispatch to the same fire in [vehicleSystems.ts](C:/Users/aditya/Desktop/Playground/varanasi/src/components/game/vehicleSystems.ts#L658).
- On-scene duration is dynamic: `clamp(euclideanDist(station, fire), 1, effectiveRange) / 2` seconds (game-speed scaled). `effectiveRange` equals the station's level-scaled coverage radius — same as the visual overlay ring. Max on-scene time is `effectiveRange / 2` (lv1 = 9s, lv5 ≈ 16s) in [vehicleSystems.ts](C:/Users/aditya/Desktop/Playground/varanasi/src/components/game/vehicleSystems.ts#L757).
- Fire truck speed is modeled with `FIRE_RESPONSE_CONFIG.fireTruckSpeed = 0.8` in [vehicleSystems.ts](C:/Users/aditya/Desktop/Playground/varanasi/src/components/game/vehicleSystems.ts#L638).
- Fire trucks are visually distinct with red bodies and flashing lights in [vehicleSystems.ts](C:/Users/aditya/Desktop/Playground/varanasi/src/components/game/vehicleSystems.ts#L1688).

**Rendering / UI**
- Burning tiles get a flame effect drawn directly on the canvas in [CanvasIsometricGrid.tsx](C:/Users/aditya/Desktop/Playground/varanasi/src/components/game/CanvasIsometricGrid.tsx#L1664).
- Hovering a fire tile shows the fire incident tooltip and uses `getFireNameForTile()` / `getFireDescriptionForTile()` in [CanvasIsometricGrid.tsx](C:/Users/aditya/Desktop/Playground/varanasi/src/components/game/CanvasIsometricGrid.tsx#L2719).
- `drawIncidentIndicators()` renders the pulsing fire/crime marker layer in [vehicleSystems.ts](C:/Users/aditya/Desktop/Playground/varanasi/src/components/game/vehicleSystems.ts#L1749).
- `TileInfoPanel` shows `ON FIRE!` and `fireProgress` damage percentage in [TileInfoPanel.tsx](C:/Users/aditya/Desktop/Playground/varanasi/src/components/game/panels/TileInfoPanel.tsx#L164).
- The fire coverage overlay uses `services.fire` to tint uncovered buildings in [overlays.ts](C:/Users/aditya/Desktop/Playground/varanasi/src/components/game/overlays.ts#L145).

**Initialization / Persistence**
- Random city generation includes `fire_station` placements in [simulation.ts](C:/Users/aditya/Desktop/Playground/varanasi/src/lib/simulation.ts#L3412).
- URL-share compression does not preserve active fire state; `expandTile()` resets fire flags using the centralized default fire state in [shareState.ts](C:/Users/aditya/Desktop/Playground/varanasi/src/lib/shareState.ts#L69).
- The active weather mode is tracked at runtime through `GameContext` and synced from the cloud system so fire multipliers can react without changing save data.
