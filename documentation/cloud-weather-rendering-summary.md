# Cloud Weather Rendering Summary

## Implementation Scope

- Cloud rendering and effects only; no UI/UX, header, save-state, or gameplay-state changes.
- Targeted current weather modes: `clear`, `light_clouds`, `storm`, `severe_storm`.

## Weather Modes

- `clear`: no clouds, default renderer mode (`DEFAULT_CLOUD_WEATHER_MODE`).
- `light_clouds`: minimal transparent white clouds, low density, no lightning, uses light palette.
- `storm`: dense overcast with black-ish clouds, curated palette, rare internal lightning flashes.
- `severe_storm`: very dark cumulonimbus-heavy clouds, higher opacity/scale, rapid internal lightning.
- Weather re-rolls internally every `15 seconds` while the simulation is running.
- Weather selection uses a fixed probability split: `40% clear`, `30% light_clouds`, `20% storm`, `10% severe_storm`.

## Rendering Adjustments

- Added `CloudWeatherMode` and `LightningStrike` types plus `cloudWeatherMode` on `WorldRenderState` so the canvas can toggle behavior without touching gameplay state.
- Introduced `CLOUD_WEATHER_CONFIG` with per-mode multipliers for count, spawn interval, opacity, scale, palette, and per-type weights, plus `CLOUD_LIGHTNING_CONFIG` for strike timing.
- Cloud type selection multiplies time-of-day weights by the active weather profile before sampling.
- Spawning respects the per-mode density, opacity, and scale rules; storm modes force cumulonimbus/stratus dominance.
- Lightning support renders a single short-lived bolt with a global flash and respects the viewport; cooldown logic is internal to the effect system.
- Weather modes stay internal to the effects system, so switching modes requires manually updating `worldStateRef.current.cloudWeatherMode`.
- The day/night SVG and all existing top-bar UI remain unchanged; no weather indicator is rendered outside the cloud system.

## Files

- `src/components/game/types.ts`
- `src/components/game/constants.ts`
- `src/components/game/effectsSystems.ts`
- `src/components/game/CanvasIsometricGrid.tsx`
