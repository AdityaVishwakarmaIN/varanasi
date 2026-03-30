# Environment Score Change Summary

## What changed

- Reworked the environment score so there is no baseline value at startup.
- Changed the base tree-coverage target for `100%` environment from `35%` to `25%`.
- Kept parks as a positive influence and pollution as a negative influence.
- Clamped the final environment score to the integer range `0..100`.

## Base environment mapping

The tree-only mapping now uses playable tiles as the denominator.

- `0%` tree coverage => `0` environment
- `25%` tree coverage => `100` environment
- Values in between are linearly interpolated and floored to an integer
- Values above the target are capped at `100`

## Playable tile denominator

The score is based on playable map tiles in the simulation grid.

- Water tiles are included
- Ground tiles are included
- Multi-tile placeholder `empty` cells are excluded
- The black background outside the rendered map is not part of the grid and is not counted

## Runtime behavior fix

Environment and other derived stats are now recalculated immediately after:

- placing buildings
- bulldozing
- terraforming land or water
- upgrading service buildings
- creating bridges after road or rail drags

This prevents the top bar from showing stale environment values until a later simulation tick.

## Key files touched

- `src/lib/simulation.ts`
- `src/context/GameContext.tsx`
