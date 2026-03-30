# Day and Night Lighting Summary

## Implementation Scope

- Controls environmental dimming, sky color tints, and artificial light intensity across different times of day and weather conditions.
- Logic is centralized in `src/components/game/cloudWeatherDimming.ts`.
- Complex multi-stage dawn/dusk timeline interpolation has been removed in favor of a clean, strict Day vs. Night binary state.

## Time Boundaries

- **Daytime:** From `7:00` (7 AM) to `18:00` (6 PM).
- **Nighttime:** All other hours.
- There are no transition periods (`lerp()` logic has been eliminated). At boundaries, the game applies the respective fixed lighting state based strictly on simple condition checks.

## Daytime Weather Lighting

During the day, lighting relies on four discrete, mathematically linear steps connecting pure daylight to the absolute darkness of nighttime.

- **`clear`**: 0% towards night. Pure `255, 255, 255` tint with `0` overlay. Light sources are at `1.0` full intensity.
- **`light_clouds`**: 25% towards night. Soft `196, 199, 206` tint with `0.1` overlay. Lights dimmed to `0.9`.
- **`storm`**: 50% towards night. Strong `138, 143, 158` tint with `0.35` overlay to cast a genuine shadow over the daylight scene. Lights dimmed to `0.8`.
- **`severe_storm`**: 75% towards night. Heavy `79, 86, 109` tint with `0.5` overlay to simulate extreme gloom. Lights dimmed to `0.7`.

Increasing the storm overlay alphas ensures that poor weather genuinely turns daytime dark instead of just bleeding out light intensity.

## Nighttime Lighting

- Night always uses a static, universal ambient color of `20, 30, 60` (deep navy) and a heavy `0.6` darkness overlay regardless of weather.
- Artificial light intensity (streetlamps, window glows) during the night will still respect the weather's built-in scalar (e.g., `0.7` for severe storm, `1.0` for clear) to match atmospheric absorption.

## Files
- `src/components/game/cloudWeatherDimming.ts`
- `src/components/game/lightingSystem.ts` 
