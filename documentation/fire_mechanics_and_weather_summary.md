# Fire Mechanics And Weather Integration Summary

## Scope

- Centralized all fire-related configuration and helper logic in [src/lib/fireConfig.ts](C:/Users/aditya/Desktop/Playground/varanasi/src/lib/fireConfig.ts).
- Wired the simulation, emergency response, and fire defaults to that shared module.
- Added active weather-based multipliers for fire ignition and adjacent-fire spread.
- Kept the implementation runtime-driven so weather stays decoupled from save data.

## Fire Rules

- Fire suppression still uses fire service coverage, via a shared helper.
- Fire damage still advances until the building is destroyed and replaced with `grass`.
- Adjacent spread still checks the 4 orthogonal neighbors.
- Random ignition still only applies to fire-eligible building types.

## Weather Multipliers

- `clear` = `1x`
- `light_clouds` = `10x`
- `storm` = `50x`
- `severe_storm` = `200x`
- The multiplier applies to random fire start chance.
- The multiplier applies to adjacent fire spread chance.

## Wiring

- [src/lib/simulation.ts](C:/Users/aditya/Desktop/Playground/varanasi/src/lib/simulation.ts) now reads the active weather mode and passes it into the fire helpers.
- [src/context/GameContext.tsx](C:/Users/aditya/Desktop/Playground/varanasi/src/context/GameContext.tsx) owns the shared runtime weather ref used by the simulation tick.
- [src/components/game/CanvasIsometricGrid.tsx](C:/Users/aditya/Desktop/Playground/varanasi/src/components/game/CanvasIsometricGrid.tsx) syncs the current cloud weather mode back into game context.
- [src/components/game/effectsSystems.ts](C:/Users/aditya/Desktop/Playground/varanasi/src/components/game/effectsSystems.ts) remains the source of cloud/weather selection.
- [src/components/game/vehicleSystems.ts](C:/Users/aditya/Desktop/Playground/varanasi/src/components/game/vehicleSystems.ts) now uses the shared fire response config for truck speed and response duration.

## Consolidation Completed

- Fire defaults were centralized for building creation, bridge creation, and share-state expansion.
- Fire truck dispatch now uses a shared nearest-station helper.
- Fire incident keys now use a shared helper instead of ad hoc string building.
- The weather implementation was kept clean by avoiding save-state changes and using a runtime weather ref instead.
