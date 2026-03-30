# Cloud Weather Rendering Summary

## Implementation Scope

- Cloud rendering and effects only; no UI/UX, header, save-state, or gameplay-state changes.
- Targeted current weather modes: `clear`, `light_clouds`, `storm`, `severe_storm`.
- Cloud and weather tuning now lives in one central file: `src/components/game/cloudWeatherConfig.ts`.

## Weather Modes

- `clear`: no clouds and no lightning.
- `light_clouds`: sparse, bright clouds with a calm sky feel.
- `storm`: denser clouds, darker tones, and rare lightning.
- `severe_storm`: strongest coverage, darkest palette, and rapid lightning.
- Weather re-rolls internally every `15 seconds` while the simulation is running.
- Weather selection uses a fixed probability split: `40% clear`, `30% light_clouds`, `20% storm`, `10% severe_storm`.

## Rendering Adjustments

- Added `CloudWeatherMode` and `LightningStrike` types plus `cloudWeatherMode` on `WorldRenderState` so the canvas can toggle behavior without touching gameplay state.
- Moved all cloud and weather knobs into `cloudWeatherConfig.ts`, including visibility, spawn pacing, layer behavior, weather probabilities, lightning timing, and cloud-type weights.
- Cloud type selection multiplies time-of-day weights by the active weather profile before sampling.
- Spawning respects the per-mode density, opacity, and scale rules; storm modes favor cumulonimbus and stratus.
- Lightning support renders a single short-lived bolt with a global flash and respects the viewport; cooldown logic is internal to the effect system.
- The day/night SVG and all existing top-bar UI remain unchanged; no weather indicator is rendered outside the cloud system.

## Files

- `src/components/game/cloudWeatherConfig.ts`
- `src/components/game/types.ts`
- `src/components/game/constants.ts`
- `src/components/game/effectsSystems.ts`
- `src/components/game/CanvasIsometricGrid.tsx`
